"""
Blockchain Service for CarbonXchange Backend
Full web3.py integration for carbon credit tokenization and on-chain trading.

Connection strategy (in priority order):
  1. WEB3_PROVIDER_URL env var -> live chain (Ethereum / Polygon / Hardhat)
  2. No env var or connection failure -> simulation mode (all calls succeed
     locally and return deterministic fake tx hashes so the rest of the
     system keeps working in dev/test environments).

These env var names match src/config.py (BaseConfig) so that a single .env
file configures both Flask and this service consistently.

ABI files are loaded from the canonical location produced by truffle compile:
  code/blockchain/build/contracts/AdvancedCarbonCreditToken.json
  code/blockchain/build/contracts/AdvancedMarketplace.json

Contract addresses and keys come from env vars:
  WEB3_PROVIDER_URL             - RPC endpoint (Ethereum / Polygon / local)
  WEB3_PRIVATE_KEY              - private key of the backend operator wallet
  CARBON_TOKEN_CONTRACT_ADDRESS - deployed AdvancedCarbonCreditToken
  MARKETPLACE_CONTRACT_ADDRESS  - deployed AdvancedMarketplace
  PAYMENT_TOKEN_CONTRACT_ADDRESS- ERC20 token AdvancedMarketplace settles in

Custody model
-------------
This service is CUSTODIAL: the backend operator wallet (WEB3_PRIVATE_KEY) is
the on-chain actor for every call in this module. It is registered on-chain
as the "developer" for every project it registers, mints/holds carbon credit
tokens on behalf of platform users, and is the account that places orders on
AdvancedMarketplace. True per-user ownership of credits is tracked in the
application database (CarbonCredit.current_owner_id / owner_wallet_address),
not by giving each end user their own on-chain wallet. This mirrors how the
existing routes/carbon_credits.py already calls this service (addresses are
passed through mostly for audit-trail/off-chain bookkeeping purposes, not as
the on-chain msg.sender).

If the platform later wants individual users to hold and move their own
on-chain tokens (a non-custodial model), transfer_tokens() below documents
the extra on-chain `approve` step that would be required from the user's own
wallet before this service could move tokens out of it.
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
_FILE_PATH = Path(__file__).resolve()
# Repo layout: <root>/code/backend/src/services/blockchain_service.py
# -> 4 parents up from this file's directory reaches <root>.
_PROJECT_ROOT = _FILE_PATH.parents[4] if len(_FILE_PATH.parents) > 4 else None
_MONOREPO_BUILD_DIR = (
    _PROJECT_ROOT / "code" / "blockchain" / "build" / "contracts"
    if _PROJECT_ROOT is not None
    else None
)

# In a monorepo checkout (local dev, CI), ABIs are read straight from
# Truffle's output at code/blockchain/build/contracts. Containerized
# deployments only COPY code/backend/ into the image (see Dockerfile /
# infrastructure/docker/Dockerfile.backend), so code/blockchain isn't
# present there - in fact this file's path is too shallow in that case for
# _MONOREPO_BUILD_DIR to resolve at all (handled above). For that case,
# set CONTRACT_ABI_DIR to wherever the built ABI JSON files were copied
# into the image (see code/backend/contracts_abi/README.md for the
# documented build step) and it takes priority over the monorepo path.
_ABI_DIR = (
    Path(os.getenv("CONTRACT_ABI_DIR", "")) if os.getenv("CONTRACT_ABI_DIR") else None
)

# Minimal standard ERC20 ABI, used for the settlement/payment token, which
# is typically an external contract (e.g. a stablecoin) with no local
# Truffle artifact of its own.
_ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function",
    },
]

# OrderType / OrderSide enum values from AdvancedMarketplace.sol - keep in
# sync with the Solidity `enum OrderType` / `enum OrderSide` declarations.
ORDER_TYPE_MARKET = 0
ORDER_TYPE_LIMIT = 1
ORDER_SIDE_BUY = 0
ORDER_SIDE_SELL = 1

_ZERO_BYTES32 = "0x" + "00" * 32
_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def _load_abi(contract_name: str) -> Optional[list]:
    search_dirs = [d for d in (_ABI_DIR, _MONOREPO_BUILD_DIR) if d is not None]
    for directory in search_dirs:
        artefact = directory / f"{contract_name}.json"
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


def _sim_onchain_id() -> int:
    """
    Return a fresh, effectively-unique fake on-chain id for simulation
    mode (a project id or batch id).

    Unlike _sim_tx_hash, this is intentionally NOT derived from the call's
    business data (name, amount, etc.): a real contract's id counter
    always increments and never repeats, even for two calls with
    identical arguments (e.g. two projects that happen to share a name,
    vintage year, and total credits). Deriving the fake id from a hash of
    those arguments would make two such calls collide on the same fake
    id, which a real chain never would - and callers may persist this id
    under a uniqueness constraint (see CarbonProject.onchain_project_id).
    """
    return int.from_bytes(os.urandom(4), "big")


def _to_wei(amount: Decimal) -> int:
    return int(amount * Decimal("1e18"))


def _from_wei(amount: int) -> Decimal:
    return Decimal(amount) / Decimal("1e18")


# ---------------------------------------------------------------------------
# BlockchainService
# ---------------------------------------------------------------------------
class BlockchainService:
    """
    Blockchain integration service for carbon credit tokenisation and
    trading against AdvancedCarbonCreditToken / AdvancedMarketplace.

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
        self._payment_token_contract: Optional[Any] = None
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

        rpc_url = os.getenv("WEB3_PROVIDER_URL", "")
        if not rpc_url:
            logger.info("WEB3_PROVIDER_URL not set - simulation mode")
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
            self._load_operator_wallet()
            self._load_contracts()
        except Exception as exc:
            logger.warning(
                "BlockchainService: connection failed (%s) - simulation mode", exc
            )
            self._w3 = None
            self.simulation_mode = True

    def _load_contracts(self) -> None:
        if self._w3 is None:
            return
        token_addr = os.getenv("CARBON_TOKEN_CONTRACT_ADDRESS", "")
        marketplace_addr = os.getenv("MARKETPLACE_CONTRACT_ADDRESS", "")
        payment_token_addr = os.getenv("PAYMENT_TOKEN_CONTRACT_ADDRESS", "")

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
        elif token_addr and not token_abi:
            logger.warning(
                "CARBON_TOKEN_CONTRACT_ADDRESS is set but no ABI was found "
                "(looked in CONTRACT_ABI_DIR=%s and %s) - run `truffle compile` "
                "in code/blockchain first",
                _ABI_DIR,
                _MONOREPO_BUILD_DIR,
            )

        if marketplace_addr and marketplace_abi:
            try:
                self._marketplace_contract = self._w3.eth.contract(
                    address=Web3.to_checksum_address(marketplace_addr),
                    abi=marketplace_abi,
                )
                logger.info("Loaded AdvancedMarketplace at %s", marketplace_addr)
            except Exception as exc:
                logger.warning("Could not load marketplace contract: %s", exc)

        if payment_token_addr:
            try:
                self._payment_token_contract = self._w3.eth.contract(
                    address=Web3.to_checksum_address(payment_token_addr),
                    abi=_ERC20_ABI,
                )
                logger.info("Loaded payment token at %s", payment_token_addr)
            except Exception as exc:
                logger.warning("Could not load payment token contract: %s", exc)

    def _load_operator_wallet(self) -> None:
        if self._w3 is None:
            return
        key = os.getenv("WEB3_PRIVATE_KEY", "")
        if not key:
            logger.warning("WEB3_PRIVATE_KEY not set - write operations will fail")
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

    def _ensure_allowance(
        self, token_contract: Any, spender: str, amount_wei: int
    ) -> None:
        """Send an on-chain `approve` if the operator's current allowance to
        `spender` is insufficient. Required before AdvancedMarketplace.
        placeOrder(), which checks the caller's allowance up front."""
        current = token_contract.functions.allowance(
            self._operator_address, spender
        ).call()
        if current >= amount_wei:
            return
        fn = token_contract.functions.approve(spender, amount_wei)
        self._send_transaction(fn)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @property
    def operator_address(self) -> Optional[str]:
        return self._operator_address

    @property
    def token_contract_address(self) -> Optional[str]:
        return self._token_contract.address if self._token_contract else None

    @property
    def marketplace_contract_address(self) -> Optional[str]:
        return (
            self._marketplace_contract.address if self._marketplace_contract else None
        )

    # ------------------------------------------------------------------
    # Project registration + credit issuance (AdvancedCarbonCreditToken)
    # ------------------------------------------------------------------
    def register_and_verify_project(
        self,
        name: str,
        methodology: str,
        location: str,
        vintage_year: int,
        total_credits: Decimal,
        standard: str,
        document_hash: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Register a new on-chain carbon project and immediately verify it
        (both calls require the operator to hold VERIFIER_ROLE, granted at
        contract deployment - see migrations/2_deploy_contracts.js).

        The operator wallet is recorded on-chain as the project developer
        (see the custody model note in this module's docstring).

        Returns {"onchain_project_id": int, "register_tx": str,
        "verify_tx": str} or None on failure.
        """
        total_credits_wei = _to_wei(total_credits)
        doc_hash = document_hash or _ZERO_BYTES32

        if self.simulation_mode:
            tx = _sim_tx_hash("register_project", name, vintage_year, total_credits_wei)
            fake_project_id = _sim_onchain_id()
            logger.info("[SIM] register_and_verify_project name=%s tx=%s", name, tx)
            return {
                "onchain_project_id": fake_project_id,
                "register_tx": tx,
                "verify_tx": tx,
            }

        if self._token_contract is None:
            logger.error("Token contract not loaded - cannot register project")
            return None

        try:
            register_fn = self._token_contract.functions.registerProject(
                name,
                methodology,
                location,
                self._operator_address,
                vintage_year,
                total_credits_wei,
                standard,
                doc_hash,
            )
            register_tx = self._send_transaction(register_fn)

            receipt = self._w3.eth.get_transaction_receipt(register_tx)
            events = self._token_contract.events.ProjectRegistered().process_receipt(
                receipt
            )
            if not events:
                logger.error("ProjectRegistered event not found in receipt")
                return None
            onchain_project_id = events[0]["args"]["projectId"]

            verify_fn = self._token_contract.functions.verifyProject(onchain_project_id)
            verify_tx = self._send_transaction(verify_fn)

            logger.info(
                "register_and_verify_project name=%s onchain_project_id=%s "
                "register_tx=%s verify_tx=%s",
                name,
                onchain_project_id,
                register_tx,
                verify_tx,
            )
            return {
                "onchain_project_id": onchain_project_id,
                "register_tx": register_tx,
                "verify_tx": verify_tx,
            }
        except Exception as exc:
            logger.error("register_and_verify_project failed: %s", exc)
            return None

    def issue_credits(
        self,
        onchain_project_id: int,
        quantity: Decimal,
        serial_number: str,
        verification_hash: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Mint (issue) carbon credit tokens for an already-registered,
        verified on-chain project. Returns
        {"tx_hash": str, "onchain_batch_id": int} or None on failure.
        """
        amount_wei = _to_wei(quantity)
        ver_hash = verification_hash or _ZERO_BYTES32

        if self.simulation_mode:
            tx = _sim_tx_hash(
                "issue_credits", onchain_project_id, amount_wei, serial_number
            )
            fake_batch_id = _sim_onchain_id()
            logger.info(
                "[SIM] issue_credits project=%s qty=%s tx=%s",
                onchain_project_id,
                quantity,
                tx,
            )
            return {"tx_hash": tx, "onchain_batch_id": fake_batch_id}

        if self._token_contract is None:
            logger.error("Token contract not loaded - cannot issue credits")
            return None

        try:
            fn = self._token_contract.functions.issueCarbonCredits(
                onchain_project_id, amount_wei, serial_number, ver_hash
            )
            tx_hash = self._send_transaction(fn)

            receipt = self._w3.eth.get_transaction_receipt(tx_hash)
            events = self._token_contract.events.BatchIssued().process_receipt(receipt)
            onchain_batch_id = events[0]["args"]["batchId"] if events else None

            logger.info(
                "issue_credits project=%s batch=%s tx=%s",
                onchain_project_id,
                onchain_batch_id,
                tx_hash,
            )
            return {"tx_hash": tx_hash, "onchain_batch_id": onchain_batch_id}
        except Exception as exc:
            logger.error("issue_credits failed: %s", exc)
            return None

    def tokenize_carbon_credit(
        self,
        *,
        quantity: Decimal,
        serial_number: str,
        project_name: str,
        methodology: str,
        location: str,
        vintage_year: int,
        total_credits: Decimal,
        standard: str,
        onchain_project_id: Optional[int] = None,
        document_hash: Optional[str] = None,
        verification_hash: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        High-level convenience wrapper for the credits API: registers +
        verifies the on-chain project if `onchain_project_id` is not
        already known, then issues `quantity` credits against it.

        Returns {"tx_hash", "onchain_project_id", "onchain_batch_id"} or
        None on failure. Callers should persist the returned
        onchain_project_id (e.g. on CarbonProject.onchain_project_id) so
        future credits for the same project skip re-registration.
        """
        register_tx = None
        if onchain_project_id is None:
            registration = self.register_and_verify_project(
                name=project_name,
                methodology=methodology,
                location=location,
                vintage_year=vintage_year,
                total_credits=total_credits,
                standard=standard,
                document_hash=document_hash,
            )
            if registration is None:
                return None
            onchain_project_id = registration["onchain_project_id"]
            register_tx = registration["register_tx"]

        issuance = self.issue_credits(
            onchain_project_id=onchain_project_id,
            quantity=quantity,
            serial_number=serial_number,
            verification_hash=verification_hash,
        )
        if issuance is None:
            return None

        return {
            "tx_hash": issuance["tx_hash"],
            "onchain_project_id": onchain_project_id,
            "onchain_batch_id": issuance["onchain_batch_id"],
            "register_tx": register_tx,
        }

    # ------------------------------------------------------------------
    # Transfers / retirement
    # ------------------------------------------------------------------
    def transfer_tokens(
        self,
        to_address: str,
        quantity: Decimal,
        from_address: Optional[str] = None,
    ) -> Optional[str]:
        """
        Move carbon credit tokens to `to_address`.

        When `from_address` is None (the common, custodial case), tokens
        move directly out of the operator's own on-chain balance via
        `transfer()`. If `from_address` is supplied and differs from the
        operator, `transferFrom()` is used instead - this requires
        `from_address` to have already submitted an on-chain `approve()`
        for this operator, which the platform does not currently
        orchestrate on the user's behalf (that would require the user to
        hold and control their own wallet).
        """
        amount_wei = _to_wei(quantity)

        if self.simulation_mode:
            tx = _sim_tx_hash("transfer", from_address, to_address, amount_wei)
            logger.info(
                "[SIM] transfer_tokens from=%s to=%s qty=%s tx=%s",
                from_address or "operator",
                to_address,
                quantity,
                tx,
            )
            return tx

        if self._token_contract is None:
            logger.error("Token contract not loaded - cannot transfer tokens")
            return None

        try:
            to_checksum = Web3.to_checksum_address(to_address)
            if (
                from_address
                and from_address.lower() != (self._operator_address or "").lower()
            ):
                fn = self._token_contract.functions.transferFrom(
                    Web3.to_checksum_address(from_address), to_checksum, amount_wei
                )
            else:
                fn = self._token_contract.functions.transfer(to_checksum, amount_wei)

            tx_hash = self._send_transaction(fn)
            logger.info(
                "transfer_tokens from=%s to=%s tx=%s",
                from_address or self._operator_address,
                to_address,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("transfer_tokens failed: %s", exc)
            return None

    def retire_tokens(
        self,
        quantity: Decimal,
        purpose: str = "Voluntary retirement",
        beneficiary: str = "",
        owner_address: Optional[str] = None,
    ) -> Optional[str]:
        """
        Permanently retire (burn) `quantity` credits from the operator's
        own custodial balance. `owner_address` is accepted for audit-trail
        logging only: retireCredits() on-chain always burns from
        msg.sender (the operator), matching this platform's custodial
        model - see the module docstring.
        """
        amount_wei = _to_wei(quantity)

        if self.simulation_mode:
            tx = _sim_tx_hash("retire", owner_address, amount_wei)
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
            fn = self._token_contract.functions.retireCredits(
                amount_wei,
                purpose,
                beneficiary or (owner_address or ""),
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "retire_tokens owner=%s tx=%s",
                owner_address,
                tx_hash,
            )
            return tx_hash
        except Exception as exc:
            logger.error("retire_tokens failed: %s", exc)
            return None

    def get_token_balance(self, address: Optional[str] = None) -> Decimal:
        """Return the on-chain carbon token balance of `address`, defaulting
        to the operator's own address. Returns 0 in simulation mode."""
        if self.simulation_mode or self._token_contract is None:
            return Decimal("0")
        try:
            target = address or self._operator_address
            balance_wei = self._token_contract.functions.balanceOf(
                Web3.to_checksum_address(target)
            ).call()
            return _from_wei(balance_wei)
        except Exception as exc:
            logger.error("get_token_balance failed: %s", exc)
            return Decimal("0")

    # ------------------------------------------------------------------
    # Marketplace (AdvancedMarketplace order book)
    # ------------------------------------------------------------------
    def place_sell_order(
        self,
        amount: Decimal,
        price_per_token: Decimal,
        vintage_year: int,
        order_type: str = "limit",
    ) -> Optional[Dict[str, Any]]:
        """
        Place a sell order for carbon credit tokens on AdvancedMarketplace.
        Automatically approves the marketplace to move the operator's
        carbon tokens if the current allowance is insufficient.
        Returns {"tx_hash": str} or None on failure.
        """
        return self._place_order(
            side=ORDER_SIDE_SELL,
            amount=amount,
            price_per_token=price_per_token,
            vintage_year=vintage_year,
            order_type=order_type,
        )

    def place_buy_order(
        self,
        amount: Decimal,
        price_per_token: Decimal,
        vintage_year: int,
        order_type: str = "limit",
    ) -> Optional[Dict[str, Any]]:
        """
        Place a buy order for carbon credit tokens on AdvancedMarketplace,
        paid for in the configured payment token. Automatically approves
        the marketplace to move the operator's payment tokens if the
        current allowance is insufficient.
        Returns {"tx_hash": str} or None on failure.
        """
        return self._place_order(
            side=ORDER_SIDE_BUY,
            amount=amount,
            price_per_token=price_per_token,
            vintage_year=vintage_year,
            order_type=order_type,
        )

    def _place_order(
        self,
        side: int,
        amount: Decimal,
        price_per_token: Decimal,
        vintage_year: int,
        order_type: str,
    ) -> Optional[Dict[str, Any]]:
        amount_wei = _to_wei(amount)
        price_wei = _to_wei(price_per_token)
        type_code = ORDER_TYPE_MARKET if order_type == "market" else ORDER_TYPE_LIMIT

        if self.simulation_mode:
            tx = _sim_tx_hash("place_order", side, amount_wei, price_wei, vintage_year)
            logger.info(
                "[SIM] place_order side=%s qty=%s price=%s tx=%s",
                "sell" if side == ORDER_SIDE_SELL else "buy",
                amount,
                price_per_token,
                tx,
            )
            return {"tx_hash": tx}

        if self._marketplace_contract is None:
            logger.error("Marketplace contract not loaded")
            return None

        try:
            marketplace_addr = self._marketplace_contract.address

            if side == ORDER_SIDE_SELL:
                if self._token_contract is None:
                    logger.error(
                        "Token contract not loaded - cannot approve sell order"
                    )
                    return None
                self._ensure_allowance(
                    self._token_contract, marketplace_addr, amount_wei
                )
            else:
                if self._payment_token_contract is None:
                    logger.error(
                        "Payment token contract not loaded - cannot approve buy order"
                    )
                    return None
                # Include headroom for the taker fee (matches the pre-check
                # AdvancedMarketplace.placeOrder performs on-chain).
                required = amount_wei * price_wei // 10**18
                required_with_fee = required + (required * 100 // 10000)  # 1% headroom
                self._ensure_allowance(
                    self._payment_token_contract, marketplace_addr, required_with_fee
                )

            fn = self._marketplace_contract.functions.placeOrder(
                type_code,
                side,
                amount_wei,
                price_wei,
                0,  # stopPrice - unused for market/limit orders
                0,  # expiresAt - 0 means "good until cancelled"
                vintage_year,
                _ZERO_BYTES32,  # clientOrderId
                0,  # minFillAmount - allow any partial fill
                False,  # isIcebergOrder
                0,  # visibleAmount
            )
            tx_hash = self._send_transaction(fn)
            logger.info(
                "place_order side=%s qty=%s price=%s tx=%s",
                "sell" if side == ORDER_SIDE_SELL else "buy",
                amount,
                price_per_token,
                tx_hash,
            )
            return {"tx_hash": tx_hash}
        except Exception as exc:
            logger.error("place_order failed: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Chain utilities
    # ------------------------------------------------------------------
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
                "payment_token_contract": None,
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
                "payment_token_contract": (
                    self._payment_token_contract.address
                    if self._payment_token_contract
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
