import logging
import threading
from datetime import timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Union

import numpy as np
import pandas as pd

from ..config import HISTORY_WINDOW, MAX_HORIZON, MIN_HISTORY, NEUTRAL_BAND
from ..exceptions import InsufficientDataError, ModelNotTrainedError
from ..preprocessing import build_features, prepare_frame
from .ensemble import ForecastingModel

logger = logging.getLogger(__name__)

Z_95 = 1.96


class PricePredictor:
    def __init__(self, models_dir: Optional[Union[str, Path]] = None) -> None:
        self._model = ForecastingModel(models_dir)
        self._lock = threading.Lock()
        self._loaded_mtime: Optional[float] = None

    @property
    def model(self) -> ForecastingModel:
        return self._model

    def reload_if_changed(self) -> bool:
        path = self._model.path
        with self._lock:
            if not path.exists():
                self._model = ForecastingModel(self._model.models_dir)
                self._loaded_mtime = None
                return False
            mtime = path.stat().st_mtime
            if self._loaded_mtime == mtime and self._model.is_trained:
                return True
            fresh = ForecastingModel(self._model.models_dir)
            try:
                fresh.load()
            except Exception as exc:
                logger.error("Failed to load forecasting model: %s", exc)
                return self._model.is_trained
            self._model = fresh
            self._loaded_mtime = mtime
            return True

    def is_ready(self) -> bool:
        return self.reload_if_changed() and self._model.is_trained

    def status(self) -> Dict[str, Any]:
        ready = self.is_ready()
        info: Dict[str, Any] = {
            "ready": ready,
            "models_dir": str(self._model.models_dir),
            "min_history_points": MIN_HISTORY,
            "max_horizon": MAX_HORIZON,
        }
        if ready:
            metadata = self._model.metadata
            info.update(
                {
                    "available_models": self._model.available_models(),
                    "trained_at": metadata.get("trained_at"),
                    "source": metadata.get("source"),
                    "samples": metadata.get("samples"),
                    "weights": metadata.get("weights"),
                    "metrics": metadata.get("metrics"),
                    "baseline_return_mae": metadata.get("baseline_return_mae"),
                }
            )
        return info

    def forecast(
        self,
        history: pd.DataFrame,
        horizon: int = 7,
        model_name: str = "ensemble",
    ) -> Dict[str, Any]:
        if not self.is_ready():
            raise ModelNotTrainedError("Forecasting model is not available")
        if horizon < 1 or horizon > MAX_HORIZON:
            raise ValueError(f"horizon must be between 1 and {MAX_HORIZON}")
        frame = prepare_frame(history)
        if len(frame) < MIN_HISTORY:
            raise InsufficientDataError(
                f"At least {MIN_HISTORY} observations are required, got {len(frame)}"
            )
        model = self._model
        work = frame.tail(HISTORY_WINDOW).reset_index(drop=True)
        gaps = work["timestamp"].diff().dropna()
        step = gaps.median() if len(gaps) else timedelta(days=1)
        if not isinstance(step, timedelta) or step <= timedelta(0):
            step = timedelta(days=1)
        sigma = float(model.metadata.get("residual_std", 0.0))
        current_price = float(work["price"].iloc[-1])
        last_timestamp = work["timestamp"].iloc[-1]
        cumulative = 0.0
        predictions = []
        for h in range(1, horizon + 1):
            features = build_features(work).iloc[[-1]]
            if features[model.feature_names].isna().any(axis=None):
                raise InsufficientDataError(
                    "Not enough clean history to build features"
                )
            step_return = float(model.predict_returns(features, model_name)[0])
            cumulative += step_return
            price = current_price * float(np.exp(cumulative))
            band = Z_95 * sigma * float(np.sqrt(h))
            timestamp = work["timestamp"].iloc[-1] + step
            predictions.append(
                {
                    "step": h,
                    "timestamp": pd.Timestamp(timestamp).isoformat(),
                    "predicted_price": price,
                    "lower": price * float(np.exp(-band)),
                    "upper": price * float(np.exp(band)),
                    "expected_return": step_return,
                }
            )
            next_volume = float(work["volume"].tail(5).mean())
            work = pd.concat(
                [
                    work,
                    pd.DataFrame(
                        {
                            "timestamp": [timestamp],
                            "price": [price],
                            "volume": [next_volume],
                        }
                    ),
                ],
                ignore_index=True,
            )
        total_return = float(np.exp(cumulative) - 1.0)
        if total_return > NEUTRAL_BAND:
            trend = "bullish"
        elif total_return < -NEUTRAL_BAND:
            trend = "bearish"
        else:
            trend = "neutral"
        metrics = model.metadata.get("metrics", {}).get(model_name, {})
        return {
            "model": model_name,
            "horizon": horizon,
            "current_price": current_price,
            "last_timestamp": pd.Timestamp(last_timestamp).isoformat(),
            "predictions": predictions,
            "expected_return_pct": total_return * 100.0,
            "trend": trend,
            "history_points": int(len(frame)),
            "contributing_factors": model.feature_importance(),
            "model_info": {
                "trained_at": model.metadata.get("trained_at"),
                "source": model.metadata.get("source"),
                "training_samples": model.metadata.get("samples"),
                "directional_accuracy": metrics.get("directional_accuracy"),
                "price_mape": metrics.get("price_mape"),
                "price_mae": metrics.get("price_mae"),
                "return_r2": metrics.get("return_r2"),
            },
        }
