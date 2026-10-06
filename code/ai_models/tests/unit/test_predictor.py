import pytest
from ai_models.config import MAX_HORIZON, MIN_HISTORY
from ai_models.exceptions import InsufficientDataError
from ai_models.forecasting import PricePredictor


def test_status_when_model_missing(tmp_path):
    predictor = PricePredictor(tmp_path)
    status = predictor.status()
    assert status["ready"] is False
    with pytest.raises(RuntimeError):
        predictor.forecast(None)


def test_forecast_shape_and_bounds(trained_dir, price_frame):
    predictor = PricePredictor(trained_dir)
    result = predictor.forecast(price_frame, horizon=10)
    assert result["horizon"] == 10
    assert len(result["predictions"]) == 10
    assert result["trend"] in {"bullish", "bearish", "neutral"}
    previous = None
    for point in result["predictions"]:
        assert point["lower"] < point["predicted_price"] < point["upper"]
        if previous is not None:
            assert point["timestamp"] > previous
        previous = point["timestamp"]
    widths = [p["upper"] - p["lower"] for p in result["predictions"]]
    assert widths[-1] > widths[0]


def test_forecast_is_deterministic(trained_dir, price_frame):
    predictor = PricePredictor(trained_dir)
    first = predictor.forecast(price_frame, horizon=5)
    second = predictor.forecast(price_frame, horizon=5)
    assert first["predictions"] == second["predictions"]


def test_forecast_validates_inputs(trained_dir, price_frame):
    predictor = PricePredictor(trained_dir)
    with pytest.raises(ValueError):
        predictor.forecast(price_frame, horizon=MAX_HORIZON + 1)
    with pytest.raises(InsufficientDataError):
        predictor.forecast(price_frame.head(MIN_HISTORY - 1), horizon=3)


def test_each_model_can_forecast(trained_dir, price_frame):
    predictor = PricePredictor(trained_dir)
    for name in predictor.status()["available_models"]:
        result = predictor.forecast(price_frame, horizon=2, model_name=name)
        assert result["model"] == name
