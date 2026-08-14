"""
Comprehensive tests for BlockchainService.
Covers simulation mode (the default in test/dev without WEB3_PROVIDER_URL),
all public methods, and get_network_info diagnostics.

These tests intentionally don't require a live chain: simulation mode
exercises the same code paths and return shapes that real-chain mode uses,
just with deterministic fake tx hashes instead of real ones.
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
        tx = _sim_tx_hash("issue_credits", 42, 1000, "SN-1")
        assert len(tx) == 66

    def test_deterministic(self) -> None:
        tx1 = _sim_tx_hash("retire", "addr", 5, 100)
        tx2 = _sim_tx_hash("retire", "addr", 5, 100)
        assert tx1 == tx2

    def test_different_args_produce_different_hashes(self) -> None:
        tx1 = _sim_tx_hash("issue_credits", 1, 100)
        tx2 = _sim_tx_hash("issue_credits", 2, 100)
        assert tx1 != tx2

    def test_different_actions_produce_different_hashes(self) -> None:
        tx1 = _sim_tx_hash("issue_credits", 1)
        tx2 = _sim_tx_hash("retire", 1)
        assert tx1 != tx2


# ---------------------------------------------------------------------------
# Simulation mode (default when WEB3_PROVIDER_URL not set)
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

    # register_and_verify_project
    def test_register_project_returns_expected_shape(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.register_and_verify_project(
            name="Reforestation Project A",
            methodology="VM0007",
            location="Brazil",
            vintage_year=2024,
            total_credits=Decimal("10000"),
            standard="VCS",
        )
        assert result is not None
        assert isinstance(result["onchain_project_id"], int)
        assert result["register_tx"].startswith("0x")
        assert result["verify_tx"].startswith("0x")

    def test_register_project_ids_are_never_reused(
        self, blockchain_service: BlockchainService
    ) -> None:
        """
        A real contract's project id counter always increments and never
        repeats, even for two calls with identical arguments (e.g. two
        projects that happen to share a name, vintage year, and total
        credits). The simulated id must match that behaviour, since
        callers persist it under a uniqueness constraint
        (CarbonProject.onchain_project_id).
        """
        kwargs: dict = dict(
            name="Project A",
            methodology="VM0007",
            location="Brazil",
            vintage_year=2024,
            total_credits=Decimal("10000"),
            standard="VCS",
        )
        r1 = blockchain_service.register_and_verify_project(**kwargs)
        r2 = blockchain_service.register_and_verify_project(**kwargs)
        assert r1["onchain_project_id"] != r2["onchain_project_id"]

    # issue_credits
    def test_issue_credits_returns_expected_shape(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.issue_credits(
            onchain_project_id=1,
            quantity=Decimal("100"),
            serial_number="SN-0001",
        )
        assert result is not None
        assert result["tx_hash"].startswith("0x")
        assert isinstance(result["onchain_batch_id"], int)

    # tokenize_carbon_credit (register + issue convenience wrapper)
    def test_tokenize_registers_when_no_project_id_given(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.tokenize_carbon_credit(
            quantity=Decimal("100"),
            serial_number="SN-0001",
            project_name="Reforestation Project A",
            methodology="VM0007",
            location="Brazil",
            vintage_year=2024,
            total_credits=Decimal("10000"),
            standard="VCS",
        )
        assert result is not None
        assert result["tx_hash"].startswith("0x")
        assert result["onchain_project_id"] is not None
        assert result["onchain_batch_id"] is not None
        assert result["register_tx"] is not None

    def test_tokenize_skips_registration_when_project_id_given(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.tokenize_carbon_credit(
            quantity=Decimal("50"),
            serial_number="SN-0002",
            project_name="Reforestation Project A",
            methodology="VM0007",
            location="Brazil",
            vintage_year=2024,
            total_credits=Decimal("10000"),
            standard="VCS",
            onchain_project_id=42,
        )
        assert result is not None
        assert result["onchain_project_id"] == 42
        assert result["register_tx"] is None

    # transfer_tokens
    def test_transfer_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.transfer_tokens("0xReceiver", Decimal("50"))
        assert tx is not None
        assert tx.startswith("0x")

    def test_transfer_different_addresses_different_hashes(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx1 = blockchain_service.transfer_tokens("0xB", Decimal("50"))
        tx2 = blockchain_service.transfer_tokens("0xD", Decimal("50"))
        assert tx1 != tx2

    # retire_tokens
    def test_retire_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.retire_tokens(Decimal("25"), owner_address="0xOwner")
        assert tx is not None
        assert tx.startswith("0x")

    def test_retire_zero_quantity_still_returns_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        tx = blockchain_service.retire_tokens(Decimal("0"), owner_address="0xOwner")
        assert tx is not None  # sim mode always returns a hash

    # get_token_balance
    def test_get_balance_returns_zero_in_sim(
        self, blockchain_service: BlockchainService
    ) -> None:
        balance = blockchain_service.get_token_balance("0xSomeAddress")
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

    # place_sell_order / place_buy_order
    def test_place_sell_order_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.place_sell_order(
            amount=Decimal("100"),
            price_per_token=Decimal("2.5"),
            vintage_year=2024,
        )
        assert result is not None
        assert result["tx_hash"].startswith("0x")

    def test_place_buy_order_returns_tx_hash(
        self, blockchain_service: BlockchainService
    ) -> None:
        result = blockchain_service.place_buy_order(
            amount=Decimal("100"),
            price_per_token=Decimal("2.5"),
            vintage_year=2024,
        )
        assert result is not None
        assert result["tx_hash"].startswith("0x")

    def test_sell_and_buy_orders_produce_different_hashes(
        self, blockchain_service: BlockchainService
    ) -> None:
        sell = blockchain_service.place_sell_order(Decimal("100"), Decimal("2.5"), 2024)
        buy = blockchain_service.place_buy_order(Decimal("100"), Decimal("2.5"), 2024)
        assert sell["tx_hash"] != buy["tx_hash"]

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
            "payment_token_contract",
        ):
            assert key in info, f"Missing key: {key}"


# ---------------------------------------------------------------------------
# Fallback when WEB3_PROVIDER_URL set but unreachable
# ---------------------------------------------------------------------------


class TestBlockchainServiceConnectionFallback:
    def test_falls_back_to_simulation_on_bad_rpc(self, monkeypatch: Any) -> None:
        monkeypatch.setenv("WEB3_PROVIDER_URL", "http://localhost:9999")
        svc = BlockchainService()
        # Should gracefully fall back to simulation mode
        assert svc.simulation_mode is True

    def test_still_returns_result_after_fallback(self, monkeypatch: Any) -> None:
        monkeypatch.setenv("WEB3_PROVIDER_URL", "http://localhost:9999")
        svc = BlockchainService()
        result = svc.tokenize_carbon_credit(
            quantity=Decimal("50"),
            serial_number="SN-0001",
            project_name="Project A",
            methodology="VM0007",
            location="Brazil",
            vintage_year=2024,
            total_credits=Decimal("1000"),
            standard="VCS",
        )
        assert result is not None
        assert result["tx_hash"].startswith("0x")


# ---------------------------------------------------------------------------
# Large quantity precision
# ---------------------------------------------------------------------------


class TestTokenAmountPrecision:
    def test_large_quantity_issue_credits(
        self, blockchain_service: BlockchainService
    ) -> None:
        large = Decimal("999999.9999")
        result = blockchain_service.issue_credits(
            onchain_project_id=1, quantity=large, serial_number="SN-BIG"
        )
        assert result is not None

    def test_fractional_quantity_retire(
        self, blockchain_service: BlockchainService
    ) -> None:
        frac = Decimal("0.0001")
        tx = blockchain_service.retire_tokens(frac, owner_address="0xOwner")
        assert tx is not None
