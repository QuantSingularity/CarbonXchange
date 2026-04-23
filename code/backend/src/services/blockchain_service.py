"""
Blockchain Service for CarbonXchange Backend
Full web3.py integration for carbon credit tokenization and on-chain trading.

Connection strategy (in priority order):
  1. BLOCKCHAIN_RPC_URL env var -> live chain (Ethereum / Polygon / Hardhat)
  2. No env var or connection failure -> simulation mode (all calls succeed
     locally and return deterministic fake tx hashes so the rest of the
     system keeps working in dev/test environments).

ABI files are loaded from the canonical location produced by truffle compile:
  code/blockchain/build/contracts/AdvancedCarbonCreditToken.json
  code/blockchain/build/contracts/AdvancedMarketplace.json

Contract addresses and keys come from env vars:
  CARBON_TOKEN_ADDRESS     - deployed AdvancedCarbonCreditToken
  MARKETPLACE_ADDRESS      - deployed AdvancedMarketplace
  BLOCKCHAIN_OPERATOR_KEY  - private key of the back-end operator wallet
"""

import hashlib
import json
import logging
import os
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional web3 import
# ---------------------------------------------------------------------------
try:
    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware  # type: ignore[attr-defined]

    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False
    logger.warning(
        "web3 package not installed - blockchain service will run in simulation mode"
    )

# ---------------------------------------------------------------------------
# ABI loader
# ---------------------------------------------------------------------------
_PROJECT_ROOT = Path(__file__).resolve().parents[5]
_BUILD_DIR = _PROJECT_ROOT / "code" / "blockchain" / "build" / "contracts"


def _load_abi(contract_name: str) -> Optional[list]:
    artefact = _BUILD_DIR / f"{contract_name}.json"
    if artefact.exists():
        try:
            with artefact.open() as fh:
                return json.load(fh).get("abi")
        except Exception as exc:
            logger.warning("Could not parse ABI for %s: %s", contract_name, exc)
    return None


# ---------------------------------------------------------------------------
# Simulation helpers
# ---------------------------------------------------------------------------
def _sim_tx_hash(action: str, *args: Any) -> str:
    """Return a deterministic 32-byte hex tx hash for simulation mode."""
    payload = f"{action}:" + "|".join(str(a) for a in args)
    return "0x" + hashlib.sha256(payload.encode()).hexdigest()


# ---------------------------------------------------------------------------
# BlockchainService
# ---------------------------------------------------------------------------
class BlockchainService:
    """
    Blockchain integration service for carbon credit tokenisation and trading.

    Public attributes
    -----------------
    simulation_mode : bool
        True when the service cannot connect to a real chain.
    operator_address : str | None
        Ethereum address of the back-end operator wallet.
    """

    def __init__(self) -> None:
        self._w3: Optional[Any] = None
        self._token_contract: Optional[Any] = None
        self._marketplace_contract: Optional[Any] = None
        self._operator_address: Optional[str] = None
        self._operator_key: Optional[str] = None
        self.simulation_mode: bool = True
        self._connect()

    # ------------------------------------------------------------------
    # Initialisation
    # ------------------------------------------------------------------
    def _connect(self) -> None:
        if not WEB3_AVAILABLE:
            logger.info("BlockchainService: web3 unavailable - simulation mode")
            return

        rpc_url = os.getenv("BLOCKCHAIN_RPC_URL", "")
        if not rpc_url:
            logger.info("BLOCKCHAIN_RPC_URL not set - simulation mode")
            return

        try:
            w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 10}))
            w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            if not w3.is_connected():
                raise ConnectionError(f"Cannot reach RPC endpoint: {rpc_url}")
            self._w3 = w3
            self.simulation_mode = False
            logger.info(
                "BlockchainService: connected to %s (chain id %s)",
                rpc_url,
                w3.eth.chain_id,
            )
            self._load_contracts()
            self._load_operator_wallet()
        except Exception as exc:
            logger.warning(
                "BlockchainService: connection failed (%s) - simulation mode", exc
            )
            self._w3 = None
            self.simulation_mode = True

    def _load_contracts(self) -> None:
        if self._w3 is None:
            return
        token_addr = os.getenv("CARBON_TOKEN_ADDRESS", "")
        marketplace_addr = os.getenv("MARKETPLACE_ADDRESS", "")
        token_abi = _load_abi("AdvancedCarbonCreditToken")
        marketplace_abi = _load_abi("AdvancedMarketplace")

        if token_addr and token_abi:
            try:
                self._token_contract = self._w3.eth.contract(
                    address=Web3.to_checksum_address(token_addr), abi=token_abi
                )
                logger.info("Loaded AdvancedCarbonCreditToken at %s", token_addr)
            except Exception as exc:
                logger.warning("Could not load token contract: %s", exc)

        if marketplace_addr and marketplace_abi:
            try:
                self._marketplace_contract = self._w3.eth.contract(
                    address=Web3.to_checksum_address(marketplace_addr),
                    abi=marketplace_abi,
                )
                logger.info("Loaded AdvancedMarketplace at %s", marketplace_addr)
            except Exception as exc:
                logger.warning("Could not load marketplace contract: %s", exc)

    def _load_operator_wallet(self) -> None:
        if self._w3 is None:
            return
        key = os.getenv("BLOCKCHAIN_OPERATOR_KEY", "")
        if not key:
            logger.warning(
                "BLOCKCHAIN_OPERATOR_KEY not set - write operations will fail"
            )
            return
        try:
            account = self._w3.eth.account.from_key(key)
            self._operator_address = account.address
            self._operator_key = key
            logger.info("Operator wallet loaded: %s", self._operator_address)
        except Exception as exc:
            logger.warning("Could not load operator wallet: %s", exc)

    # ------------------------------------------------------------------
    # Internal tx helper
    # ------------------------------------------------------------------
    def _send_transaction(self, fn: Any) -> str:
        if self._w3 is None or self._operator_key is None:
            raise RuntimeError("Blockchain not connected or operator key missing")
        nonce = self._w3.eth.get_transaction_count(self._operator_address)
        tx = fn.build_transaction(
            {
                "from": self._operator_address,
                "nonce": nonce,
                "gasPrice": self._w3.eth.gas_price,
            }
        )
        signed = self._w3.eth.account.sign_transaction(
            tx, private_key=self._operator_key
        )
        tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt["status"] != 1:
            raise RuntimeError(f"Transaction reverted: {tx_hash.hex()}")
        return tx_hash.hex()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @property
    def operator_address(self) -> Optional[str]:
        return self._operator_address

    def tokenize_carbon_credit(
        self,
        credit_id: int,
        quantity: Decimal,
        metadata: Dict[str, Any],
    ) -> Optional[str]:
        """Mint carbon credit tokens on-chain. Returns tx hash or None."""
        amount_wei = int(quantity * Decimal("1e18"))

        if self.simulation_mode:
            tx = _sim_tx_hash("tokenize", credit_id, amount_wei)
            logger.info(
                "[SIM] tokenize_carbon_credit credit_id=%s qty=%s tx=%s",
                credit_id,
                quantity,
                tx,
            )
            return tx

        if self._token_contract is None:
            logger.error(
                "Token contract not loaded - cannot tokenize credit %s", credit_id
            )
            return None

        try:
            fn = self._token_contract.functions.mintBatch(
                self._operator_address,
                amount_wei,
                json.dumps(metadata),
            )
            tx_hash = self._send_transaction(fn)
            logger.info("tokenize_carbon_credit credit_id=%s tx=%s", credit_id, tx_hash)
            return tx_hash
        except Exception as exc:
            logger.error("tokenize_carbon_credit failed: %s", exc)
            return None

    def transfer_tokens(
        self,
        from_address: str,
        to_address: str,
        token_id: int,
        quantity: Decimal,
    ) -> Optional[str]:
        """Transfer carbon credit tokens between addresses. Returns tx hash or None."""
        amount_wei = int(quantity * Decimal("1e18"))

        if self.simulation_mode:
            tx = _sim_tx_hash(
                "transfer", from_address, to_address, token_id, amount_wei
            )
            logger.info(
                "[SIM] transfer_tokens from=%s to=%s qty=%s tx=%s",
                from_address,
                to_address,
                quantity,
                tx,
            )
            return tx

        if self._token_contract is None:
            logger.error("Token contract not loaded - cannot transfer tokens")
            return None

        try:
            fn = self._token_contract.functions.transferFrom(
                Web3.to_checksum_address(from_address),
                Web3.to_checksum_address(to_address),
                amount_wei,
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "transfer_tokens from=%s to=%s tx=%s",
                from_address,
                to_address,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("transfer_tokens failed: %s", exc)
            return None

    def retire_tokens(
        self,
        owner_address: str,
        token_id: int,
        quantity: Decimal,
    ) -> Optional[str]:
        """Retire (burn) carbon credit tokens permanently. Returns tx hash or None."""
        amount_wei = int(quantity * Decimal("1e18"))

        if self.simulation_mode:
            tx = _sim_tx_hash("retire", owner_address, token_id, amount_wei)
            logger.info(
                "[SIM] retire_tokens owner=%s qty=%s tx=%s",
                owner_address,
                quantity,
                tx,
            )
            return tx

        if self._token_contract is None:
            logger.error("Token contract not loaded - cannot retire tokens")
            return None

        try:
            fn = self._token_contract.functions.retire(
                amount_wei,
                f"Retirement of credit {token_id}",
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "retire_tokens owner=%s token_id=%s tx=%s",
                owner_address,
                token_id,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("retire_tokens failed: %s", exc)
            return None

    def get_token_balance(self, address: str, token_id: int) -> Decimal:
        """Return on-chain token balance. Returns 0 in simulation mode."""
        if self.simulation_mode or self._token_contract is None:
            return Decimal("0")
        try:
            balance_wei = self._token_contract.functions.balanceOf(
                Web3.to_checksum_address(address)
            ).call()
            return Decimal(balance_wei) / Decimal("1e18")
        except Exception as exc:
            logger.error("get_token_balance failed: %s", exc)
            return Decimal("0")

    def verify_transaction(self, tx_hash: str) -> Dict[str, Any]:
        """
        Look up a transaction receipt and return its status.

        In simulation mode, any 66-char 0x-prefixed hash is considered verified.
        """
        if self.simulation_mode:
            verified = (
                isinstance(tx_hash, str)
                and tx_hash.startswith("0x")
                and len(tx_hash) == 66
            )
            return {
                "tx_hash": tx_hash,
                "status": "simulated",
                "verified": verified,
                "block_number": None,
                "simulation_mode": True,
            }

        if self._w3 is None:
            return {
                "tx_hash": tx_hash,
                "status": "disconnected",
                "verified": False,
            }

        try:
            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
            if receipt is None:
                return {"tx_hash": tx_hash, "status": "pending", "verified": False}
            success = receipt["status"] == 1
            return {
                "tx_hash": tx_hash,
                "status": "confirmed" if success else "reverted",
                "verified": success,
                "block_number": receipt["blockNumber"],
                "gas_used": receipt["gasUsed"],
                "simulation_mode": False,
            }
        except Exception as exc:
            logger.error("verify_transaction failed: %s", exc)
            return {
                "tx_hash": tx_hash,
                "status": "error",
                "verified": False,
                "error": str(exc),
            }

    def create_marketplace_listing(
        self,
        seller_address: str,
        token_amount: Decimal,
        price_per_token_usd: Decimal,
        listing_metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Create a sell listing on the AdvancedMarketplace. Returns tx hash or None."""
        amount_wei = int(token_amount * Decimal("1e18"))
        price_cents = int(price_per_token_usd * 100)

        if self.simulation_mode:
            tx = _sim_tx_hash("listing", seller_address, amount_wei, price_cents)
            logger.info(
                "[SIM] create_marketplace_listing seller=%s qty=%s price=%s tx=%s",
                seller_address,
                token_amount,
                price_per_token_usd,
                tx,
            )
            return tx

        if self._marketplace_contract is None:
            logger.error("Marketplace contract not loaded")
            return None

        try:
            fn = self._marketplace_contract.functions.createListing(
                Web3.to_checksum_address(seller_address),
                amount_wei,
                price_cents,
                json.dumps(listing_metadata or {}),
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "create_marketplace_listing seller=%s tx=%s",
                seller_address,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("create_marketplace_listing failed: %s", exc)
            return None

    def execute_marketplace_trade(
        self,
        listing_id: int,
        buyer_address: str,
        quantity: Decimal,
    ) -> Optional[str]:
        """Execute a purchase against an existing marketplace listing. Returns tx hash or None."""
        amount_wei = int(quantity * Decimal("1e18"))

        if self.simulation_mode:
            tx = _sim_tx_hash("trade", listing_id, buyer_address, amount_wei)
            logger.info(
                "[SIM] execute_marketplace_trade listing=%s buyer=%s qty=%s tx=%s",
                listing_id,
                buyer_address,
                quantity,
                tx,
            )
            return tx

        if self._marketplace_contract is None:
            logger.error("Marketplace contract not loaded")
            return None

        try:
            fn = self._marketplace_contract.functions.executeTrade(
                listing_id,
                Web3.to_checksum_address(buyer_address),
                amount_wei,
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "execute_marketplace_trade listing=%s buyer=%s tx=%s",
                listing_id,
                buyer_address,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("execute_marketplace_trade failed: %s", exc)
            return None

    def get_network_info(self) -> Dict[str, Any]:
        """Return connection / network diagnostics."""
        if self.simulation_mode or self._w3 is None:
            return {
                "connected": False,
                "simulation_mode": True,
                "chain_id": None,
                "block_number": None,
                "operator_address": self._operator_address,
                "token_contract": None,
                "marketplace_contract": None,
            }
        try:
            return {
                "connected": self._w3.is_connected(),
                "simulation_mode": False,
                "chain_id": self._w3.eth.chain_id,
                "block_number": self._w3.eth.block_number,
                "operator_address": self._operator_address,
                "token_contract": (
                    self._token_contract.address if self._token_contract else None
                ),
                "marketplace_contract": (
                    self._marketplace_contract.address
                    if self._marketplace_contract
                    else None
                ),
            }
        except Exception as exc:
            logger.error("get_network_info failed: %s", exc)
            return {
                "connected": False,
                "simulation_mode": True,
                "error": str(exc),
            }
