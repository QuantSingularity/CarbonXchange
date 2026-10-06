import json

import numpy as np
import pytest
from ai_models.config import MIN_TRAIN_SAMPLES
from ai_models.data_io import generate_synthetic_prices
from ai_models.exceptions import InsufficientDataError
from ai_models.forecasting import ForecastingModel
from ai_models.preprocessing import build_features


def test_fit_reports_out_of_sample_metrics(price_frame, tmp_path):
    model = ForecastingModel(tmp_path)
    metadata = model.fit(price_frame, source="test")
    assert model.is_trained
    assert "ensemble" in metadata["metrics"]
    assert metadata["test_samples"] > 0
    assert metadata["residual_std"] > 0
    assert pytest.approx(sum(metadata["weights"].values())) == 1.0
    for values in metadata["metrics"].values():
        assert 0.0 <= values["directional_accuracy"] <= 1.0
        assert values["price_mape"] >= 0.0


def test_fit_rejects_small_datasets(tmp_path):
    model = ForecastingModel(tmp_path)
    with pytest.raises(InsufficientDataError):
        model.fit(generate_synthetic_prices(MIN_TRAIN_SAMPLES // 2))


def test_save_and_load_round_trip(trained_dir, price_frame):
    loaded = ForecastingModel(trained_dir).load()
    assert loaded.is_trained
    assert (trained_dir / "price_forecast_metadata.json").exists()
    with open(trained_dir / "price_forecast_metadata.json") as handle:
        assert json.load(handle)["source"] == "test"
    features = build_features(price_frame).iloc[[-1]]
    ensemble = loaded.predict_returns(features)
    single = loaded.predict_returns(features, "random_forest")
    assert ensemble.shape == (1,)
    assert np.isfinite(single).all()


def test_unknown_model_name(trained_dir, price_frame):
    loaded = ForecastingModel(trained_dir).load()
    with pytest.raises(ValueError):
        loaded.predict_returns(build_features(price_frame).iloc[[-1]], "missing")


def test_feature_importance(trained_dir):
    importance = ForecastingModel(trained_dir).load().feature_importance(3)
    assert len(importance) == 3
    assert all(value >= 0 for value in importance.values())
