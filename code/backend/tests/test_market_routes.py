"""
Tests for Market routes (/api/market/...)
Covers market data, OHLCV prices, statistics, order-book depth, recent trades.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import pytest
from src.models.market import MarketData, MarketDataType, PriceHistory, TimeFrame
from src.models.trading import (
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Trade,
    TradeStatus,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_market_data(db_session: Any, sample_project: Any) -> Any:
    """Create a MarketData entry."""
    entry = MarketData(
        symbol="VCS-2023",
        project_id=sample_project.id,
        vintage_year=2023,
        data_type=MarketDataType.SPOT_PRICE,
        value=Decimal("26.50"),
        currency="USD",
        data_source="test",
        timestamp=datetime.now(timezone.utc),
    )
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry


@pytest.fixture
def sample_price_history(db_session: Any, sample_project: Any) -> Any:
    """Create several PriceHistory candles."""
    from datetime import timedelta

    entries = []
    base_time = datetime.now(timezone.utc)
    for i in range(5):
        ts = base_time - timedelta(days=i)
        ph = PriceHistory(
            symbol="VCS-2023",
            project_id=sample_project.id,
            vintage_year=2023,
            open_price=Decimal("25.00") + Decimal(str(i * 0.5)),
            high_price=Decimal("26.00") + Decimal(str(i * 0.5)),
            low_price=Decimal("24.50") + Decimal(str(i * 0.5)),
            close_price=Decimal("25.50") + Decimal(str(i * 0.5)),
            volume=Decimal("1000"),
            volume_usd=Decimal("25500"),
            number_of_trades=10,
            period_start=ts.replace(tzinfo=None),
            period_end=(ts + timedelta(days=1)).replace(tzinfo=None),
            timeframe=TimeFrame.DAY_1,
            data_source="test",
        )
        db_session.add(ph)
        entries.append(ph)
    db_session.commit()
    return entries


@pytest.fixture
def sample_settled_trade(db_session: Any, sample_user: Any, sample_project: Any) -> Any:
    """Create a settled Trade for statistics tests."""
    import uuid as uuid_mod

    buy_order = Order(
        order_id=f"ORD-MKT-B-{uuid_mod.uuid4().hex[:8].upper()}",
        user_id=sample_user.id,
        order_type=OrderType.LIMIT,
        side=OrderSide.BUY,
        status=OrderStatus.FILLED,
        quantity=Decimal("100"),
        remaining_quantity=Decimal("0"),
        filled_quantity=Decimal("100"),
        price=Decimal("26.50"),
        credit_type="VCS",
        vintage_year=2023,
        project_id=sample_project.id,
    )
    sell_order = Order(
        order_id=f"ORD-MKT-S-{uuid_mod.uuid4().hex[:8].upper()}",
        user_id=sample_user.id,
        order_type=OrderType.LIMIT,
        side=OrderSide.SELL,
        status=OrderStatus.FILLED,
        quantity=Decimal("100"),
        remaining_quantity=Decimal("0"),
        filled_quantity=Decimal("100"),
        price=Decimal("26.50"),
        credit_type="VCS",
        vintage_year=2023,
        project_id=sample_project.id,
    )
    db_session.add(buy_order)
    db_session.add(sell_order)
    db_session.flush()

    trade = Trade(
        buy_order_id=buy_order.id,
        sell_order_id=sell_order.id,
        quantity=Decimal("100"),
        price=Decimal("26.50"),
        vintage_year=2023,
        project_id=sample_project.id,
        status=TradeStatus.SETTLED,
        credit_type="VCS",
        executed_at=datetime.now(timezone.utc),
    )
    db_session.add(trade)
    db_session.commit()
    db_session.refresh(trade)
    return trade


# ---------------------------------------------------------------------------
# GET /api/market/data
# ---------------------------------------------------------------------------


class TestMarketData:
    def test_market_data_is_public(self, client: Any) -> None:
        resp = client.get("/api/market/data")
        assert resp.status_code == 200

    def test_returns_list_structure(self, client: Any, sample_market_data: Any) -> None:
        resp = client.get("/api/market/data")
        data = resp.get_json()
        assert "market_data" in data
        assert "total" in data

    def test_filter_by_symbol(self, client: Any, sample_market_data: Any) -> None:
        resp = client.get("/api/market/data?symbol=VCS-2023")
        assert resp.status_code == 200
        data = resp.get_json()
        for entry in data["market_data"]:
            assert entry["symbol"] == "VCS-2023"

    def test_filter_by_invalid_type_400(self, client: Any) -> None:
        resp = client.get("/api/market/data?type=flying_price")
        assert resp.status_code == 400

    def test_limit_capped_at_200(self, client: Any) -> None:
        resp = client.get("/api/market/data?limit=500")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["market_data"]) <= 200


# ---------------------------------------------------------------------------
# GET /api/market/ticker/<symbol>
# ---------------------------------------------------------------------------


class TestTicker:
    def test_ticker_existing_symbol(self, client: Any, sample_market_data: Any) -> None:
        resp = client.get("/api/market/ticker/VCS-2023")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "ticker" in data
        assert data["ticker"]["symbol"] == "VCS-2023"

    def test_ticker_unknown_symbol_404(self, client: Any) -> None:
        resp = client.get("/api/market/ticker/UNKNOWN-9999")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/market/prices
# ---------------------------------------------------------------------------


class TestPriceHistory:
    def test_prices_public(self, client: Any) -> None:
        resp = client.get("/api/market/prices")
        assert resp.status_code == 200

    def test_prices_returns_structure(
        self, client: Any, sample_price_history: Any
    ) -> None:
        resp = client.get("/api/market/prices?symbol=VCS-2023")
        data = resp.get_json()
        assert "prices" in data
        assert "total" in data
        assert "symbol" in data
        assert "days" in data

    def test_limit_respected(self, client: Any, sample_price_history: Any) -> None:
        resp = client.get("/api/market/prices?limit=2")
        data = resp.get_json()
        assert len(data["prices"]) <= 2

    def test_days_filter(self, client: Any, sample_price_history: Any) -> None:
        resp = client.get("/api/market/prices?days=7&symbol=VCS-2023")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/market/prices/<symbol>/ohlcv
# ---------------------------------------------------------------------------


class TestOHLCV:
    def test_ohlcv_returns_candles(
        self, client: Any, sample_price_history: Any
    ) -> None:
        resp = client.get("/api/market/prices/VCS-2023/ohlcv")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "candles" in data
        assert "symbol" in data
        assert "count" in data
        assert data["symbol"] == "VCS-2023"

    def test_ohlcv_unknown_symbol_404(self, client: Any) -> None:
        resp = client.get("/api/market/prices/UNKNOWN-999/ohlcv")
        assert resp.status_code == 404

    def test_ohlcv_has_from_to_dates(
        self, client: Any, sample_price_history: Any
    ) -> None:
        resp = client.get("/api/market/prices/VCS-2023/ohlcv")
        data = resp.get_json()
        assert "from" in data
        assert "to" in data


# ---------------------------------------------------------------------------
# GET /api/market/summary
# ---------------------------------------------------------------------------


class TestMarketSummary:
    def test_summary_public(self, client: Any) -> None:
        resp = client.get("/api/market/summary")
        assert resp.status_code == 200

    def test_summary_with_data(self, client: Any, sample_market_data: Any) -> None:
        resp = client.get("/api/market/summary")
        data = resp.get_json()
        assert "latest_price" in data or "message" in data


# ---------------------------------------------------------------------------
# GET /api/market/statistics
# ---------------------------------------------------------------------------


class TestMarketStatistics:
    def test_statistics_public(self, client: Any) -> None:
        resp = client.get("/api/market/statistics")
        assert resp.status_code == 200

    def test_statistics_with_trades(
        self, client: Any, sample_settled_trade: Any
    ) -> None:
        resp = client.get("/api/market/statistics")
        assert resp.status_code == 200
        data = resp.get_json()
        if "error" not in data:
            assert "trade_count" in data
            assert "average_price" in data
            assert "total_volume" in data
            assert "price_volatility" in data

    def test_statistics_days_param(
        self, client: Any, sample_settled_trade: Any
    ) -> None:
        resp = client.get("/api/market/statistics?days=7")
        assert resp.status_code == 200
        data = resp.get_json()
        if "period_days" in data:
            assert data["period_days"] == 7

    def test_statistics_days_capped_at_365(self, client: Any) -> None:
        resp = client.get("/api/market/statistics?days=9999")
        assert resp.status_code == 200
        data = resp.get_json()
        if "period_days" in data:
            assert data["period_days"] <= 365

    def test_statistics_filter_by_credit_type(
        self, client: Any, sample_settled_trade: Any
    ) -> None:
        resp = client.get("/api/market/statistics?credit_type=VCS")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/market/depth/<symbol>
# ---------------------------------------------------------------------------


class TestOrderBookDepth:
    def test_depth_returns_bids_and_asks(self, client: Any, sample_order: Any) -> None:
        resp = client.get("/api/market/depth/VCS-2023")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "bids" in data
        assert "asks" in data
        assert "symbol" in data
        assert "timestamp" in data

    def test_depth_levels_respected(self, client: Any, sample_order: Any) -> None:
        resp = client.get("/api/market/depth/VCS-2023?levels=5")
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["bids"]) <= 5
        assert len(data["asks"]) <= 5


# ---------------------------------------------------------------------------
# GET /api/market/trades/recent
# ---------------------------------------------------------------------------


class TestRecentTrades:
    def test_recent_trades_public(self, client: Any) -> None:
        resp = client.get("/api/market/trades/recent")
        assert resp.status_code == 200

    def test_recent_trades_structure(
        self, client: Any, sample_settled_trade: Any
    ) -> None:
        resp = client.get("/api/market/trades/recent")
        data = resp.get_json()
        assert "trades" in data
        assert "total" in data

    def test_recent_trades_limit(self, client: Any, sample_settled_trade: Any) -> None:
        resp = client.get("/api/market/trades/recent?limit=1")
        data = resp.get_json()
        assert len(data["trades"]) <= 1

    def test_recent_trades_filter_credit_type(
        self, client: Any, sample_settled_trade: Any
    ) -> None:
        resp = client.get("/api/market/trades/recent?credit_type=VCS")
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/market/health
# ---------------------------------------------------------------------------


class TestMarketHealth:
    def test_health_endpoint_public(self, client: Any) -> None:
        resp = client.get("/api/market/health")
        assert resp.status_code == 200

    def test_health_with_data(self, client: Any, sample_market_data: Any) -> None:
        resp = client.get("/api/market/health")
        data = resp.get_json()
        assert "status" in data
