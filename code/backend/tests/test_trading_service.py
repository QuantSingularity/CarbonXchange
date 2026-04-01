"""
Comprehensive tests for Trading Service
Tests all trading functionality with financial industry standards
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import patch

import pytest
from src.models.trading import Order, OrderSide, OrderStatus, OrderType, Trade
from src.models.user import User
from src.services.trading_service import TradingService
from tests.conftest import assert_decimal_equal


class TestTradingService:
    """Test suite for TradingService"""

    @pytest.fixture
    def trading_service(
        self,
        mock_risk_service: Any,
        mock_compliance_service: Any,
        mock_pricing_service: Any,
        mock_audit_service: Any,
    ) -> Any:
        """Create trading service with mocked dependencies"""
        service = TradingService()
        service.risk_service = mock_risk_service
        service.compliance_service = mock_compliance_service
        service.pricing_service = mock_pricing_service
        service.audit_service = mock_audit_service
        return service

    def test_create_market_buy_order_success(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test successful market buy order creation"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is True
        assert "order_id" in result
        assert result["status"] == "pending"
        order = Order.query.get(result["order_id"])
        assert order is not None
        assert order.user_id == sample_user.id
        assert order.project_id == sample_project.id
        assert order.order_type == OrderType.MARKET
        assert order.side == OrderSide.BUY
        assert order.quantity == Decimal("100")

    def test_create_limit_sell_order_success(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test successful limit sell order creation"""
        order_data = {
            "order_type": "limit",
            "side": "sell",
            "quantity": 50,
            "price": 47.5,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is True
        order = Order.query.get(result["order_id"])
        assert order.order_type == OrderType.LIMIT
        assert order.side == OrderSide.SELL
        assert_decimal_equal(order.price, Decimal("47.50"))

    def test_create_order_risk_rejection(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
        mock_risk_service: Any,
    ) -> Any:
        """Test order rejection due to risk limits"""
        mock_risk_service.check_order_risk.return_value = {
            "approved": False,
            "reason": "Order exceeds daily trading limit",
            "risk_checks": [{"severity": "HIGH", "message": "Daily limit exceeded"}],
        }
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 10000,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is False
        assert "risk" in result["reason"].lower()
        orders = Order.query.filter_by(user_id=sample_user.id).all()
        assert len(orders) == 0

    def test_create_order_compliance_rejection(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
        mock_compliance_service: Any,
    ) -> Any:
        """Test order rejection due to compliance issues"""
        mock_compliance_service.check_order_compliance.return_value = {
            "approved": False,
            "reason": "KYC verification required",
            "compliance_checks": [{"rule": "KYC_VERIFICATION", "blocking": True}],
        }
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is False
        assert (
            "compliance" in result["reason"].lower()
            or "kyc" in result["reason"].lower()
        )

    def test_create_order_invalid_user(
        self, trading_service: Any, db_session: Any, sample_project: Any
    ) -> Any:
        """Test order creation with invalid user ID"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(999999, order_data)
        assert result["success"] is False
        assert "user" in result["reason"].lower()

    def test_create_order_invalid_project(
        self, trading_service: Any, db_session: Any, sample_user: Any
    ) -> Any:
        """Test order creation with invalid project ID"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": 999999,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is False
        assert "project" in result["reason"].lower()

    def test_create_order_missing_required_fields(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test order creation with missing required fields"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is False
        assert (
            "required" in result["reason"].lower()
            or "missing" in result["reason"].lower()
        )

    def test_cancel_order_success(
        self, trading_service: Any, db_session: Any, sample_order: Any
    ) -> Any:
        """Test successful order cancellation"""
        result = trading_service.cancel_order(sample_order.user_id, sample_order.id)
        assert result["success"] is True
        assert result["status"] == "cancelled"
        db_session.refresh(sample_order)
        assert sample_order.status == OrderStatus.CANCELLED
        assert sample_order.cancelled_at is not None

    def test_cancel_order_not_found(
        self, trading_service: Any, db_session: Any, sample_user: Any
    ) -> Any:
        """Test cancellation of non-existent order"""
        result = trading_service.cancel_order(sample_user.id, 999999)
        assert result["success"] is False
        assert "not found" in result["reason"].lower()

    def test_cancel_order_wrong_user(
        self, trading_service: Any, db_session: Any, sample_order: Any
    ) -> Any:
        """Test cancellation by wrong user"""
        other_user = User(email="other@example.com", password="password")
        db_session.add(other_user)
        db_session.commit()
        result = trading_service.cancel_order(other_user.id, sample_order.id)
        assert result["success"] is False
        assert (
            "permission" in result["reason"].lower()
            or "not found" in result["reason"].lower()
        )

    def test_cancel_already_executed_order(
        self, trading_service: Any, db_session: Any, sample_order: Any
    ) -> Any:
        """Test cancellation of already executed order"""
        sample_order.status = OrderStatus.EXECUTED
        db_session.commit()
        result = trading_service.cancel_order(sample_order.user_id, sample_order.id)
        assert result["success"] is False
        assert "cannot be cancelled" in result["reason"].lower()

    def test_get_user_orders(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test retrieving user orders"""
        orders_data = [
            {"order_type": "market", "side": "buy", "quantity": 100},
            {"order_type": "limit", "side": "sell", "quantity": 50, "price": 47.5},
            {"order_type": "market", "side": "buy", "quantity": 75},
        ]
        created_orders = []
        for order_data in orders_data:
            order_data.update(
                {
                    "project_id": sample_project.id,
                    "credit_type": "VCS",
                    "vintage_year": 2023,
                }
            )
            result = trading_service.create_order(sample_user.id, order_data)
            created_orders.append(result["order_id"])
        result = trading_service.get_user_orders(sample_user.id)
        assert result["success"] is True
        assert len(result["orders"]) == 3
        returned_order_ids = [order["id"] for order in result["orders"]]
        for order_id in created_orders:
            assert order_id in returned_order_ids

    def test_get_user_orders_with_filters(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test retrieving user orders with filters"""
        buy_order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        sell_order_data = {
            "order_type": "limit",
            "side": "sell",
            "quantity": 50,
            "price": 47.5,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        trading_service.create_order(sample_user.id, buy_order_data)
        trading_service.create_order(sample_user.id, sell_order_data)
        result = trading_service.get_user_orders(
            sample_user.id, filters={"side": "buy"}
        )
        assert result["success"] is True
        assert len(result["orders"]) == 1
        assert result["orders"][0]["side"] == "buy"

    def test_get_order_book(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test retrieving order book"""
        buy_orders = [
            {"side": "buy", "quantity": 100, "price": 44.5},
            {"side": "buy", "quantity": 150, "price": 44.0},
            {"side": "buy", "quantity": 75, "price": 43.5},
        ]
        sell_orders = [
            {"side": "sell", "quantity": 80, "price": 45.5},
            {"side": "sell", "quantity": 120, "price": 46.0},
            {"side": "sell", "quantity": 60, "price": 46.5},
        ]
        all_orders = buy_orders + sell_orders
        for order_data in all_orders:
            order_data.update(
                {
                    "order_type": "limit",
                    "project_id": sample_project.id,
                    "credit_type": "VCS",
                    "vintage_year": 2023,
                }
            )
            trading_service.create_order(sample_user.id, order_data)
        result = trading_service.get_order_book(
            project_id=sample_project.id, credit_type="VCS", vintage_year=2023
        )
        assert result["success"] is True
        assert "bids" in result
        assert "asks" in result
        assert len(result["bids"]) == 3
        assert len(result["asks"]) == 3
        bid_prices = [bid["price"] for bid in result["bids"]]
        assert bid_prices == sorted(bid_prices, reverse=True)
        ask_prices = [ask["price"] for ask in result["asks"]]
        assert ask_prices == sorted(ask_prices)

    def test_execute_trade_success(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test successful trade execution"""
        buy_order_data = {
            "order_type": "limit",
            "side": "buy",
            "quantity": 100,
            "price": 45.0,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        sell_order_data = {
            "order_type": "limit",
            "side": "sell",
            "quantity": 100,
            "price": 45.0,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        buy_result = trading_service.create_order(sample_user.id, buy_order_data)
        sell_result = trading_service.create_order(sample_user.id, sell_order_data)
        buy_order = Order.query.get(buy_result["order_id"])
        sell_order = Order.query.get(sell_result["order_id"])
        result = trading_service.execute_trade(
            buy_order, sell_order, Decimal("100"), Decimal("45.00")
        )
        assert result["success"] is True
        assert "trade_id" in result
        trade = Trade.query.get(result["trade_id"])
        assert trade is not None
        assert trade.buy_order_id == buy_order.id
        assert trade.sell_order_id == sell_order.id
        assert_decimal_equal(trade.quantity, Decimal("100"))
        assert_decimal_equal(trade.price, Decimal("45.00"))
        assert_decimal_equal(trade.total_value, Decimal("4500.00"))

    def test_execute_trade_partial_fill(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test partial trade execution"""
        buy_order_data = {
            "order_type": "limit",
            "side": "buy",
            "quantity": 150,
            "price": 45.0,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        sell_order_data = {
            "order_type": "limit",
            "side": "sell",
            "quantity": 100,
            "price": 45.0,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        buy_result = trading_service.create_order(sample_user.id, buy_order_data)
        sell_result = trading_service.create_order(sample_user.id, sell_order_data)
        buy_order = Order.query.get(buy_result["order_id"])
        sell_order = Order.query.get(sell_result["order_id"])
        result = trading_service.execute_trade(
            buy_order, sell_order, Decimal("100"), Decimal("45.00")
        )
        assert result["success"] is True
        db_session.refresh(buy_order)
        db_session.refresh(sell_order)
        assert buy_order.status == OrderStatus.PARTIALLY_FILLED
        assert_decimal_equal(buy_order.filled_quantity, Decimal("100"))
        assert sell_order.status == OrderStatus.EXECUTED
        assert_decimal_equal(sell_order.filled_quantity, Decimal("100"))

    def test_match_orders_success(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test order matching algorithm"""
        orders_data = [
            {"side": "buy", "quantity": 100, "price": 45.0},
            {"side": "buy", "quantity": 50, "price": 44.5},
            {"side": "sell", "quantity": 75, "price": 45.0},
            {"side": "sell", "quantity": 25, "price": 45.5},
        ]
        for order_data in orders_data:
            order_data.update(
                {
                    "order_type": "limit",
                    "project_id": sample_project.id,
                    "credit_type": "VCS",
                    "vintage_year": 2023,
                }
            )
            trading_service.create_order(sample_user.id, order_data)
        result = trading_service.match_orders(
            project_id=sample_project.id, credit_type="VCS", vintage_year=2023
        )
        assert result["success"] is True
        assert result["matches_found"] > 0
        assert "trades_executed" in result

    def test_get_trade_history(
        self, trading_service: Any, db_session: Any, sample_trade: Any
    ) -> Any:
        """Test retrieving trade history"""
        result = trading_service.get_trade_history(
            project_id=sample_trade.project_id,
            credit_type=sample_trade.credit_type,
            vintage_year=sample_trade.vintage_year,
        )
        assert result["success"] is True
        assert len(result["trades"]) >= 1
        trade_data = result["trades"][0]
        assert trade_data["id"] == sample_trade.id
        assert_decimal_equal(Decimal(str(trade_data["price"])), sample_trade.price)
        assert_decimal_equal(
            Decimal(str(trade_data["quantity"])), sample_trade.quantity
        )

    def test_get_user_trade_history(
        self, trading_service: Any, db_session: Any, sample_user: Any, sample_trade: Any
    ) -> Any:
        """Test retrieving user-specific trade history"""
        result = trading_service.get_user_trade_history(sample_user.id)
        assert result["success"] is True
        assert len(result["trades"]) >= 1

    def test_calculate_trading_fees(self, trading_service: Any) -> Any:
        """Test trading fee calculation"""
        test_cases = [
            {
                "quantity": Decimal("100"),
                "price": Decimal("45.00"),
                "user_tier": "standard",
                "expected_fee": Decimal("2.25"),
            },
            {
                "quantity": Decimal("1000"),
                "price": Decimal("50.00"),
                "user_tier": "premium",
                "expected_fee": Decimal("12.50"),
            },
            {
                "quantity": Decimal("50"),
                "price": Decimal("40.00"),
                "user_tier": "vip",
                "expected_fee": Decimal("0.40"),
            },
        ]
        for case in test_cases:
            fee = trading_service._calculate_trading_fee(
                case["quantity"], case["price"], case["user_tier"]
            )
            assert_decimal_equal(fee, case["expected_fee"])

    def test_validate_order_data_success(self, trading_service: Any) -> Any:
        """Test order data validation with valid data"""
        valid_order_data = {
            "order_type": "limit",
            "side": "buy",
            "quantity": 100,
            "price": 45.0,
            "project_id": 1,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        is_valid, errors = trading_service._validate_order_data(valid_order_data)
        assert is_valid is True
        assert len(errors) == 0

    def test_validate_order_data_failures(self, trading_service: Any) -> Any:
        """Test order data validation with invalid data"""
        invalid_cases = [
            {"order_type": "market", "side": "buy"},
            {
                "order_type": "invalid",
                "side": "buy",
                "quantity": 100,
                "project_id": 1,
                "credit_type": "VCS",
                "vintage_year": 2023,
            },
            {
                "order_type": "market",
                "side": "invalid",
                "quantity": 100,
                "project_id": 1,
                "credit_type": "VCS",
                "vintage_year": 2023,
            },
            {
                "order_type": "market",
                "side": "buy",
                "quantity": -100,
                "project_id": 1,
                "credit_type": "VCS",
                "vintage_year": 2023,
            },
            {
                "order_type": "limit",
                "side": "buy",
                "quantity": 100,
                "project_id": 1,
                "credit_type": "VCS",
                "vintage_year": 2023,
            },
        ]
        for invalid_data in invalid_cases:
            is_valid, errors = trading_service._validate_order_data(invalid_data)
            assert is_valid is False
            assert len(errors) > 0

    def test_performance_order_creation(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
        performance_timer: Any,
    ) -> Any:
        """Test order creation performance"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        performance_timer.start()
        result = trading_service.create_order(sample_user.id, order_data)
        performance_timer.stop()
        assert result["success"] is True
        performance_timer.assert_under(1.0)

    def test_concurrent_order_creation(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test concurrent order creation handling"""
        import threading

        results = []
        errors = []

        def create_order():
            try:
                order_data = {
                    "order_type": "market",
                    "side": "buy",
                    "quantity": 10,
                    "project_id": sample_project.id,
                    "credit_type": "VCS",
                    "vintage_year": 2023,
                }
                result = trading_service.create_order(sample_user.id, order_data)
                results.append(result)
            except Exception as e:
                errors.append(str(e))

        threads = []
        for _ in range(5):
            thread = threading.Thread(target=create_order)
            threads.append(thread)
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 5
        successful_orders = [r for r in results if r.get("success")]
        assert len(successful_orders) == 5

    def test_order_expiration_handling(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test handling of expired orders"""
        order_data = {
            "order_type": "limit",
            "side": "buy",
            "quantity": 100,
            "price": 45.0,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
            "expires_at": datetime.now(timezone.utc) + timedelta(seconds=1),
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is True
        order = Order.query.get(result["order_id"])
        import time

        time.sleep(2)
        expired_count = trading_service.process_expired_orders()
        assert expired_count > 0
        db_session.refresh(order)
        assert order.status == OrderStatus.EXPIRED

    def test_market_data_integration(
        self, trading_service: Any, mock_pricing_service: Any
    ) -> Any:
        """Test integration with market data for pricing"""
        mock_pricing_service.get_current_price.return_value = {
            "price": Decimal("46.75"),
            "pricing_method": "market_based",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        current_price = trading_service._get_current_market_price("VCS", 2023)
        assert_decimal_equal(current_price, Decimal("46.75"))
        mock_pricing_service.get_current_price.assert_called_once()

    def test_audit_logging(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
        mock_audit_service: Any,
    ) -> Any:
        """Test audit logging for trading operations"""
        order_data = {
            "order_type": "market",
            "side": "buy",
            "quantity": 100,
            "project_id": sample_project.id,
            "credit_type": "VCS",
            "vintage_year": 2023,
        }
        result = trading_service.create_order(sample_user.id, order_data)
        assert result["success"] is True
        mock_audit_service.log_trading_event.assert_called()
        call_args = mock_audit_service.log_trading_event.call_args
        assert call_args[1]["user_id"] == sample_user.id
        assert call_args[1]["event_type"] == "order_create"

    def test_error_handling_database_failure(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test error handling when database operations fail"""
        with patch.object(
            db_session, "commit", side_effect=Exception("Database error")
        ):
            order_data = {
                "order_type": "market",
                "side": "buy",
                "quantity": 100,
                "project_id": sample_project.id,
                "credit_type": "VCS",
                "vintage_year": 2023,
            }
            result = trading_service.create_order(sample_user.id, order_data)
            assert result["success"] is False
            assert "error" in result["reason"].lower()

    def test_order_modification(
        self, trading_service: Any, db_session: Any, sample_order: Any
    ) -> Any:
        """Test order modification functionality"""
        modification_data = {"quantity": 75, "price": 46.0}
        result = trading_service.modify_order(
            sample_order.user_id, sample_order.id, modification_data
        )
        assert result["success"] is True
        db_session.refresh(sample_order)
        assert_decimal_equal(sample_order.quantity, Decimal("75"))
        assert_decimal_equal(sample_order.price, Decimal("46.00"))
        assert sample_order.updated_at is not None

    def test_bulk_order_operations(
        self,
        trading_service: Any,
        db_session: Any,
        sample_user: Any,
        sample_project: Any,
    ) -> Any:
        """Test bulk order operations"""
        orders_data = [
            {"order_type": "limit", "side": "buy", "quantity": 50, "price": 44.0},
            {"order_type": "limit", "side": "buy", "quantity": 75, "price": 44.5},
            {"order_type": "limit", "side": "sell", "quantity": 60, "price": 46.0},
            {"order_type": "limit", "side": "sell", "quantity": 40, "price": 46.5},
        ]
        for order_data in orders_data:
            order_data.update(
                {
                    "project_id": sample_project.id,
                    "credit_type": "VCS",
                    "vintage_year": 2023,
                }
            )
        result = trading_service.create_bulk_orders(sample_user.id, orders_data)
        assert result["success"] is True
        assert result["created_count"] == 4
        assert len(result["order_ids"]) == 4
        orders = Order.query.filter_by(user_id=sample_user.id).all()
        assert len(orders) == 4
