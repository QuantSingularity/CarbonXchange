"""
Comprehensive tests for BlockchainService
Covers simulation mode, tx hash generation, all public methods,
and the get_network_info diagnostics.
"""

from decimal import Decimal
from typing import Any

import pytest
from src.services.blockchain_service import BlockchainService, _sim_tx_hash

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def blockchain_service() -> BlockchainService:
    """Return a BlockchainService in simulation mode (no env vars set)."""
    return BlockchainService()


# ---------------------------------------------------------------------------
# _sim_tx_hash helper
# ---------------------------------------------------------------------------


class TestSimTxHash:
    def test_returns_hex_string(self) -> None:
        tx = _sim_tx_hash("test", 1, 2)
        assert isinstance(tx, str)
        assert tx.startswith("0x")

    def test_length_is_66_chars(self) -> None:
        tx = _sim_tx_hash("tokenize", 42, 1000)
        assert len(tx) == 66

    def test_deterministic(self) -> None:
        tx1 = _sim_tx_hash("retire", "addr", 5, 100)
        tx2 = _sim_tx_hash("retire", "addr", 5, 100)
        assert tx1 == tx2

    def test_different_args_produce_different_hashes(self) -> None:
        tx1 = _sim_tx_hash("tokenize", 1, 100)
        tx2 = _sim_tx_hash("tokenize", 2, 100)
        assert tx1 != tx2

    def test_different_actions_produce_different_hashes(self) -> None:
        tx1 = _sim_tx_hash("tokenize", 1)
        tx2 = _sim_tx_hash("retire", 1)
        assert tx1 != tx2


# ---------------------------------------------------------------------------
# Simulation mode (default when BLOCKCHAIN_RPC_URL not set)
# ---------------------------------------------------------------------------


class TestBlockchainServiceSimulationMode:
    def test_simulation_mode_is_true_by_default(
        self, blockchain_service: BlockchainService
    ) -> None:
        assert blockchain_service.simulation_mode is True

    def test_operator_address_is_none(
        self, blockchain_service: BlockchainService
    ) -> None:
        assert blockchain_service.operator_address is None

    # tokenize_carbon_credit
    def test_tokenize_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.tokenize_carbon_credit(
            1, Decimal("100"), {"project": "reforestation"}
        )
        assert tx is not None
        assert tx.startswith("0x")
        assert len(tx) == 66

    def test_tokenize_deterministic(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx1 = blockchain_service.tokenize_carbon_credit(
            1, Decimal("100"), {"project": "reforestation"}
        )
        tx2 = blockchain_service.tokenize_carbon_credit(
            1, Decimal("100"), {"project": "reforestation"}
        )
        assert tx1 == tx2

    def test_tokenize_different_ids_different_hashes(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx1 = blockchain_service.tokenize_carbon_credit(1, Decimal("100"), {})
        tx2 = blockchain_service.tokenize_carbon_credit(2, Decimal("100"), {})
        assert tx1 != tx2

    # transfer_tokens
    def test_transfer_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.transfer_tokens(
            "0xSender", "0xReceiver", 1, Decimal("50")
        )
        assert tx is not None
        assert tx.startswith("0x")

    def test_transfer_different_addresses_different_hashes(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx1 = blockchain_service.transfer_tokens("0xA", "0xB", 1, Decimal("50"))
        tx2 = blockchain_service.transfer_tokens("0xC", "0xD", 1, Decimal("50"))
        assert tx1 != tx2

    # retire_tokens
    def test_retire_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.retire_tokens("0xOwner", 1, Decimal("25"))
        assert tx is not None
        assert tx.startswith("0x")

    def test_retire_returns_none_for_zero_quantity(
        self, blockchain_service: BlockchainService
    ) -> None:
        """Retiring 0 tokens should still return a (sim) tx hash."""
        tx = blockchain_service.retire_tokens("0xOwner", 1, Decimal("0"))
        assert tx is not None  # sim mode always returns hash

    # get_token_balance
    def test_get_balance_returns_zero_in_sim(
        self, blockchain_service: BlockchainService
    ) -> None:
        balance = blockchain_service.get_token_balance("0xSomeAddress", 1)
        assert balance == Decimal("0")

    # verify_transaction
    def test_verify_valid_sim_hash(self, blockchain_service: BlockchainService) -> None:
        tx = "0x" + "a" * 64  # 66-char valid sim hash
        result = blockchain_service.verify_transaction(tx)
        assert result["verified"] is True
        assert result["status"] == "simulated"
        assert result["simulation_mode"] is True

    def test_verify_invalid_hash_not_verified(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.verify_transaction("not-a-hash")
        assert result["verified"] is False

    def test_verify_short_hash_not_verified(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.verify_transaction("0x1234")
        assert result["verified"] is False

    # create_marketplace_listing
    def test_create_listing_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.create_marketplace_listing(
            "0xSeller", Decimal("100"), Decimal("25.50"), {"credit_type": "VCS"}
        )
        assert tx is not None
        assert tx.startswith("0x")

    def test_create_listing_deterministic(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx1 = blockchain_service.create_marketplace_listing(
            "0xSeller", Decimal("100"), Decimal("25.50")
        )
        tx2 = blockchain_service.create_marketplace_listing(
            "0xSeller", Decimal("100"), Decimal("25.50")
        )
        assert tx1 == tx2

    # execute_marketplace_trade
    def test_execute_trade_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.execute_marketplace_trade(42, "0xBuyer", Decimal("10"))
        assert tx is not None
        assert tx.startswith("0x")

    # get_network_info
    def test_network_info_in_sim_mode(
        self, blockchain_service: BlockchainService
    ) -> None:
        info = blockchain_service.get_network_info()
        assert info["simulation_mode"] is True
        assert info["connected"] is False
        assert info["chain_id"] is None
        assert info["block_number"] is None

    def test_network_info_has_required_keys(
        self, blockchain_service: BlockchainService
    ) -> None:
        info = blockchain_service.get_network_info()
        for key in (
            "connected",
            "simulation_mode",
            "chain_id",
            "block_number",
            "operator_address",
            "token_contract",
            "marketplace_contract",
        ):
            assert key in info, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# Fallback when BLOCKCHAIN_RPC_URL set but unreachable
# ---------------------------------------------------------------------------


class TestBlockchainServiceConnectionFallback:
    def test_falls_back_to_simulation_on_bad_rpc(self, monkeypatch: Any) -> None:
        monkeypatch.setenv("BLOCKCHAIN_RPC_URL", "http://localhost:9999")
        svc = BlockchainService()
        # Should gracefully fall back to simulation mode
        assert svc.simulation_mode is True

    def test_still_returns_tx_hash_after_fallback(self, monkeypatch: Any) -> None:
        monkeypatch.setenv("BLOCKCHAIN_RPC_URL", "http://localhost:9999")
        svc = BlockchainService()
        tx = svc.tokenize_carbon_credit(1, Decimal("50"), {})
        assert tx is not None
        assert tx.startswith("0x")


# ---------------------------------------------------------------------------
# Large quantity precision
# ---------------------------------------------------------------------------


class TestTokenAmountPrecision:
    def test_large_quantity_tokenize(
        self, blockchain_service: BlockchainService
    ) -> None:
        large = Decimal("999999.9999")
        tx = blockchain_service.tokenize_carbon_credit(1, large, {})
        assert tx is not None

    def test_fractional_quantity_retire(
        self, blockchain_service: BlockchainService
    ) -> None:
        frac = Decimal("0.0001")
        tx = blockchain_service.retire_tokens("0xOwner", 1, frac)
        assert tx is not None
