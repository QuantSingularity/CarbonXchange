import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import pytest
from ai_models.data_io import generate_synthetic_prices
from flask_jwt_extended import create_access_token
from src.models.market import PriceHistory, TimeFrame
from src.models.trading import Trade
from src.models.user import UserRole
from src.services import forecasting_service as forecasting_module
from src.services.forecasting_service import ForecastingService
from src.services.market_data_service import MarketDataService
from src.services.pricing_service import PricingService

from .conftest import make_user


@pytest.fixture
def models_dir(app: Any, tmp_path: Any, monkeypatch: Any) -> Any:
    monkeypatch.setitem(app.config, "AI_MODELS_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture(scope="module")
def synthetic_series() -> Any:
    return generate_synthetic_prices(140, seed=11)


def _headers(app: Any, user: Any) -> Any:
    with app.app_context():
        token = create_access_token(identity=user.uuid)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(app: Any, db_session: Any) -> Any:
    admin = make_user(db_session, app, role=UserRole.ADMIN)
    return _headers(app, admin)


@pytest.fixture
def user_headers(app: Any, db_session: Any) -> Any:
    return _headers(app, make_user(db_session, app))


@pytest.fixture
def seeded_symbol(db_session: Any, synthetic_series: Any) -> Any:
    symbol = f"AI-{os.urandom(3).hex()}"
    for row in synthetic_series.itertuples():
        start = row.timestamp.to_pydatetime().replace(tzinfo=None)
        db_session.add(
            PriceHistory(
                symbol=symbol,
                timeframe=TimeFrame.DAY_1,
                period_start=start,
                period_end=start + timedelta(days=1),
                open_price=Decimal(str(round(row.price, 4))),
                high_price=Decimal(str(round(row.price, 4))),
                low_price=Decimal(str(round(row.price, 4))),
                close_price=Decimal(str(round(row.price, 4))),
                volume=Decimal(str(round(row.volume, 4))),
                volume_usd=Decimal("0"),
                data_source="test",
            )
        )
    db_session.commit()
    yield symbol
    PriceHistory.query.filter_by(symbol=symbol).delete()
    db_session.commit()


@pytest.fixture
def trained(client: Any, admin_headers: Any, models_dir: Any) -> Any:
    response = client.post(
        "/api/forecast/train",
        json={"model": "price", "source": "synthetic"},
        headers=admin_headers,
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()["result"]


class TestAuthAndStatus:
    def test_requires_authentication(self, client: Any) -> None:
        assert client.get("/api/forecast/status").status_code == 401
        assert client.get("/api/forecast/price/VCS").status_code == 401
        assert client.post("/api/forecast/demand", json={}).status_code == 401

    def test_status_without_model(
        self, client: Any, user_headers: Any, models_dir: Any
    ) -> None:
        response = client.get("/api/forecast/status", headers=user_headers)
        assert response.status_code == 200
        body = response.get_json()
        assert body["enabled"] is True
        assert body["price_model"]["ready"] is False
        assert body["demand_model"]["ready"] is False

    def test_forecast_without_model_is_503(
        self, client: Any, user_headers: Any, models_dir: Any
    ) -> None:
        response = client.get("/api/forecast/price/VCS", headers=user_headers)
        assert response.status_code == 503
        assert response.get_json()["code"] == "model_unavailable"

    def test_unavailable_package(
        self, client: Any, user_headers: Any, monkeypatch: Any
    ) -> None:
        monkeypatch.setattr(forecasting_module, "AI_AVAILABLE", False)
        assert (
            client.get("/api/forecast/status", headers=user_headers).status_code == 503
        )

    def test_disabled_flag(
        self, app: Any, client: Any, user_headers: Any, monkeypatch: Any
    ) -> None:
        monkeypatch.setitem(app.config, "FEATURE_AI_FORECASTING", False)
        assert (
            client.get("/api/forecast/status", headers=user_headers).status_code == 503
        )


class TestTraining:
    def test_non_admin_cannot_train(
        self, client: Any, user_headers: Any, models_dir: Any
    ) -> None:
        response = client.post(
            "/api/forecast/train", json={"model": "price"}, headers=user_headers
        )
        assert response.status_code == 403

    def test_invalid_training_target(
        self, client: Any, admin_headers: Any, models_dir: Any
    ) -> None:
        response = client.post(
            "/api/forecast/train", json={"model": "other"}, headers=admin_headers
        )
        assert response.status_code == 400

    def test_database_training_without_history(
        self, client: Any, admin_headers: Any, models_dir: Any
    ) -> None:
        response = client.post(
            "/api/forecast/train",
            json={"model": "price", "source": "database", "symbol": "NOPE"},
            headers=admin_headers,
        )
        assert response.status_code == 400

    def test_synthetic_training_updates_status(
        self, client: Any, user_headers: Any, trained: Any
    ) -> None:
        assert "ensemble" in trained["metrics"]
        status = client.get("/api/forecast/status", headers=user_headers).get_json()
        assert status["price_model"]["ready"] is True
        assert "ensemble" in status["price_model"]["available_models"]


class TestPriceForecast:
    def test_forecast_from_candles(
        self, client: Any, user_headers: Any, trained: Any, seeded_symbol: Any
    ) -> None:
        response = client.get(
            f"/api/forecast/price/{seeded_symbol}?horizon=5", headers=user_headers
        )
        assert response.status_code == 200, response.get_json()
        body = response.get_json()
        assert body["symbol"] == seeded_symbol
        assert len(body["predictions"]) == 5
        assert body["trend"] in {"bullish", "bearish", "neutral"}
        for point in body["predictions"]:
            assert point["lower"] < point["predicted_price"] < point["upper"]

    def test_single_model_selection(
        self, client: Any, user_headers: Any, trained: Any, seeded_symbol: Any
    ) -> None:
        response = client.get(
            f"/api/forecast/price/{seeded_symbol}?horizon=2&model=random_forest",
            headers=user_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["model"] == "random_forest"

    def test_unknown_model(
        self, client: Any, user_headers: Any, trained: Any, seeded_symbol: Any
    ) -> None:
        response = client.get(
            f"/api/forecast/price/{seeded_symbol}?model=missing", headers=user_headers
        )
        assert response.status_code == 400

    @pytest.mark.parametrize("horizon", [0, -1, 500])
    def test_invalid_horizon(
        self,
        client: Any,
        user_headers: Any,
        trained: Any,
        seeded_symbol: Any,
        horizon: int,
    ) -> None:
        response = client.get(
            f"/api/forecast/price/{seeded_symbol}?horizon={horizon}",
            headers=user_headers,
        )
        assert response.status_code == 400

    def test_insufficient_history(
        self, client: Any, user_headers: Any, trained: Any
    ) -> None:
        response = client.get(
            "/api/forecast/price/UNKNOWN-SYMBOL", headers=user_headers
        )
        assert response.status_code == 422
        assert response.get_json()["code"] == "insufficient_data"


class TestDemand:
    def test_demand_flow(
        self, client: Any, admin_headers: Any, user_headers: Any, models_dir: Any
    ) -> None:
        missing = client.post(
            "/api/forecast/demand",
            json={"price": 50, "volume": 1000, "season": "summer"},
            headers=user_headers,
        )
        assert missing.status_code == 503
        trained = client.post(
            "/api/forecast/train", json={"model": "demand"}, headers=admin_headers
        )
        assert trained.status_code == 200
        response = client.post(
            "/api/forecast/demand",
            json={"price": 50, "volume": 1000, "season": "summer"},
            headers=user_headers,
        )
        assert response.status_code == 200
        assert response.get_json()["predicted_demand"] >= 0

    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"price": "abc", "volume": 1, "season": "summer"},
            {"price": -1, "volume": 1, "season": "summer"},
            {"price": 1, "volume": 1, "season": "monsoon"},
            {"price": float("inf"), "volume": 1, "season": "summer"},
        ],
    )
    def test_invalid_payloads(
        self, client: Any, user_headers: Any, models_dir: Any, payload: Any
    ) -> None:
        response = client.post(
            "/api/forecast/demand", json=payload, headers=user_headers
        )
        assert response.status_code == 400


class TestMarketDataService:
    def test_record_and_read_history(self, app: Any, db_session: Any) -> None:
        service = MarketDataService()
        symbol = f"MDS-{os.urandom(3).hex()}"
        start = datetime.now(timezone.utc) - timedelta(days=2)
        assert service.record_price_history(
            symbol,
            start,
            Decimal("10"),
            Decimal("12"),
            Decimal("9"),
            Decimal("11"),
            Decimal("100"),
        )
        history = service.get_price_history(symbol)
        assert len(history) == 1
        assert history[0]["close"] == 11.0
        assert service.get_price_history(symbol, interval="bad") == []
        assert service.list_forecastable_symbols()[symbol] == 1

    def test_current_prices(self, app: Any, db_session: Any) -> None:
        service = MarketDataService()
        symbol = f"CUR-{os.urandom(3).hex()}"
        assert service.update_market_data(symbol, {"price": 21.5, "volume": 10})
        assert service.update_market_data(symbol, {"price": 22.5, "volume": 11})
        prices = service.get_current_prices([symbol])
        assert prices[symbol]["price"] == 22.5

    def test_statistics_respect_credit_type(self, app: Any, db_session: Any) -> None:
        service = MarketDataService()
        assert "error" in service.calculate_market_statistics("NO-SUCH-TYPE")

    def test_daily_series_falls_back_to_trades(
        self, app: Any, db_session: Any, sample_trade: Any
    ) -> None:
        sample_trade.credit_type = "FALLBACK-TYPE"
        sample_trade.executed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db_session.commit()
        series = MarketDataService().get_daily_series("FALLBACK-TYPE", 30)
        assert len(series) == 1
        assert series["price"].iloc[0] == pytest.approx(float(sample_trade.price))
        assert Trade.query.filter_by(credit_type="FALLBACK-TYPE").count() >= 1


class TestPricingServiceForecast:
    def test_trend_fallback_without_model(
        self, app: Any, models_dir: Any, seeded_symbol: Any, monkeypatch: Any
    ) -> None:
        with app.app_context():
            service = ForecastingService()
            assert service.is_ready() is False
            result = PricingService().get_price_forecast(
                credit_type=seeded_symbol, forecast_days=5
            )
        assert "error" in result

    def test_uses_ai_when_ready(
        self, app: Any, trained: Any, seeded_symbol: Any
    ) -> None:
        with app.app_context():
            result = PricingService().get_price_forecast(
                credit_type=seeded_symbol, forecast_days=4
            )
        assert result["engine"] == "ai_ensemble"
        assert len(result["forecast"]["prices"]) == 4
        assert len(result["forecast"]["lower"]) == 4
