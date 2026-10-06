import pytest
from ai_models.data_io import generate_synthetic_demand
from ai_models.demand import DemandModel
from ai_models.exceptions import InsufficientDataError


def test_demand_train_predict_and_persist(tmp_path):
    model = DemandModel(tmp_path)
    metadata = model.fit(generate_synthetic_demand(400), source="test")
    assert metadata["metrics"]["r2"] > 0.5
    model.save()
    reloaded = DemandModel(tmp_path)
    assert reloaded.reload_if_changed()
    value = reloaded.predict(60.0, 2000.0, "summer")
    assert value >= 0.0
    assert reloaded.predict(60.0, 2000.0, "unknown_season") >= 0.0


def test_demand_requires_columns_and_rows(tmp_path):
    model = DemandModel(tmp_path)
    data = generate_synthetic_demand(10)
    with pytest.raises(InsufficientDataError):
        model.fit(data)
    with pytest.raises(ValueError):
        model.fit(data.drop(columns=["demand"]))
    with pytest.raises(RuntimeError):
        model.predict(1.0, 1.0, "winter")
