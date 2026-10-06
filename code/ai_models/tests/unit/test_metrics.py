import numpy as np
import pandas as pd
import pytest
from ai_models.evaluation import evaluate_forecast, inverse_error_weights
from ai_models.exceptions import (
    AIModelError,
    InsufficientDataError,
    ModelNotTrainedError,
)


def test_weights_sum_to_one_and_favor_lower_error():
    weights = inverse_error_weights({"a": 0.01, "b": 0.04})
    assert sum(weights.values()) == pytest.approx(1.0)
    assert weights["a"] > weights["b"]


def test_zero_error_does_not_divide_by_zero():
    weights = inverse_error_weights({"a": 0.0, "b": 1.0})
    assert np.isfinite(list(weights.values())).all()


def test_perfect_predictions():
    returns = pd.Series([0.01, -0.02, 0.015, -0.005])
    base = pd.Series([10.0, 10.1, 9.9, 10.05])
    report = evaluate_forecast(returns, returns.to_numpy(), base)
    assert report["price_mape"] == pytest.approx(0.0, abs=1e-9)
    assert report["directional_accuracy"] == 1.0
    assert report["return_mse"] == pytest.approx(0.0, abs=1e-12)


def test_inverted_predictions_have_zero_directional_accuracy():
    returns = pd.Series([0.01, -0.02, 0.015, -0.005])
    base = pd.Series([10.0] * 4)
    report = evaluate_forecast(returns, -returns.to_numpy(), base)
    assert report["directional_accuracy"] == 0.0


def test_exception_hierarchy():
    assert issubclass(InsufficientDataError, ValueError)
    assert issubclass(ModelNotTrainedError, RuntimeError)
    assert issubclass(InsufficientDataError, AIModelError)
    assert issubclass(ModelNotTrainedError, AIModelError)
