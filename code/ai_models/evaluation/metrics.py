from typing import Dict

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def evaluate_forecast(
    y_true: pd.Series, y_pred: np.ndarray, base_price: pd.Series
) -> Dict[str, float]:
    actual_next = base_price.to_numpy() * np.exp(y_true.to_numpy())
    predicted_next = base_price.to_numpy() * np.exp(y_pred)
    moving = y_true.to_numpy() != 0
    directional = (
        float(np.mean(np.sign(y_pred[moving]) == np.sign(y_true.to_numpy()[moving])))
        if moving.any()
        else 0.0
    )
    return {
        "return_mse": float(mean_squared_error(y_true, y_pred)),
        "return_mae": float(mean_absolute_error(y_true, y_pred)),
        "return_r2": float(r2_score(y_true, y_pred)),
        "price_mae": float(mean_absolute_error(actual_next, predicted_next)),
        "price_rmse": float(np.sqrt(mean_squared_error(actual_next, predicted_next))),
        "price_mape": float(
            np.mean(np.abs((actual_next - predicted_next) / actual_next)) * 100
        ),
        "directional_accuracy": directional,
    }


def inverse_error_weights(errors: Dict[str, float]) -> Dict[str, float]:
    inverse = {name: 1.0 / max(value, 1e-12) for name, value in errors.items()}
    total = sum(inverse.values())
    return {name: value / total for name, value in inverse.items()}
