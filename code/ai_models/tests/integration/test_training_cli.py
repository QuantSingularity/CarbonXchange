import pytest
from ai_models.demand import DemandModel
from ai_models.forecasting import ForecastingModel, PricePredictor
from ai_models.training import demand as demand_cli
from ai_models.training import preprocess as preprocess_cli
from ai_models.training import price as price_cli

pytestmark = pytest.mark.integration


def test_preprocess_creates_datasets_and_processed_file(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DATA_DIR", str(tmp_path))
    assert preprocess_cli.main([]) == 0
    assert (tmp_path / "market_demand.csv").exists()
    assert (tmp_path / "market_prices.csv").exists()
    processed = (tmp_path / "market_demand_processed.csv").read_text().splitlines()
    assert processed[0] == "price,volume,ratio"
    assert len(processed) > 100


def test_preprocess_rejects_missing_columns(tmp_path):
    bad = tmp_path / "bad.csv"
    bad.write_text("a,b\n1,2\n")
    with pytest.raises(ValueError):
        preprocess_cli.preprocess_data(bad)


def test_price_training_cli_produces_loadable_model(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DATA_DIR", str(tmp_path / "data"))
    models = tmp_path / "models"
    assert (
        price_cli.main(["--synthetic", "--samples", "320", "--models-dir", str(models)])
        == 0
    )
    assert ForecastingModel(models).load().is_trained
    assert PricePredictor(models).is_ready()
    assert (models / "price_forecast_metadata.json").exists()


def test_demand_training_cli_produces_loadable_model(tmp_path, monkeypatch):
    monkeypatch.setenv("AI_DATA_DIR", str(tmp_path / "data"))
    models = tmp_path / "models"
    assert demand_cli.main(["--models-dir", str(models)]) == 0
    assert DemandModel(models).reload_if_changed()
