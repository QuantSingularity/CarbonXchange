import logging
import sys
import threading
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from flask import current_app, has_app_context

from .market_data_service import MarketDataService


def _import_ai_models() -> Any:
    try:
        import ai_models

        return ai_models
    except ImportError:
        here = Path(__file__).resolve()
        for parent in here.parents:
            if (parent / "ai_models" / "__init__.py").is_file():
                sys.path.insert(0, str(parent))
                break
        import ai_models

        return ai_models


logger = logging.getLogger(__name__)

try:
    _import_ai_models()
    from ai_models.config import MAX_HORIZON, MIN_HISTORY
    from ai_models.data_io import generate_synthetic_demand, generate_synthetic_prices
    from ai_models.demand import DemandModel
    from ai_models.exceptions import InsufficientDataError
    from ai_models.forecasting import ForecastingModel, PricePredictor

    AI_AVAILABLE = True
except ImportError as import_error:
    logger.warning(
        "ai_models package unavailable, forecasting disabled: %s", import_error
    )
    AI_AVAILABLE = False
    MAX_HORIZON = 90
    MIN_HISTORY = 80
    DemandModel = ForecastingModel = PricePredictor = None

    class InsufficientDataError(ValueError):
        pass

    def generate_synthetic_demand() -> Any:
        raise RuntimeError("ai_models package is not installed")

    def generate_synthetic_prices() -> Any:
        raise RuntimeError("ai_models package is not installed")


_training_lock = threading.Lock()
_predictors: Dict[str, PricePredictor] = {}
_demand_models: Dict[str, DemandModel] = {}
_registry_lock = threading.Lock()


class TrainingInProgressError(RuntimeError):
    pass


def _config(key: str, default: Any) -> Any:
    if has_app_context():
        return current_app.config.get(key, default)
    return default


def _models_dir() -> Optional[str]:
    configured = _config("AI_MODELS_DIR", None)
    return str(configured) if configured else None


def _resolved_dir() -> str:
    directory = _models_dir()
    if directory:
        return directory
    return str(ForecastingModel().models_dir)


def _predictor() -> PricePredictor:
    key = _resolved_dir()
    with _registry_lock:
        if key not in _predictors:
            _predictors[key] = PricePredictor(key)
        return _predictors[key]


def _demand_model() -> DemandModel:
    key = _resolved_dir()
    with _registry_lock:
        if key not in _demand_models:
            _demand_models[key] = DemandModel(key)
        return _demand_models[key]


class ForecastingService:
    min_history = MIN_HISTORY

    def __init__(self) -> None:
        self.market_data = MarketDataService()

    def enabled(self) -> bool:
        return AI_AVAILABLE and bool(_config("FEATURE_AI_FORECASTING", True))

    def max_horizon(self) -> int:
        return min(int(_config("AI_FORECAST_MAX_HORIZON", MAX_HORIZON)), MAX_HORIZON)

    def default_horizon(self) -> int:
        return min(int(_config("AI_FORECAST_DEFAULT_HORIZON", 7)), self.max_horizon())

    def history_days(self) -> int:
        return int(_config("AI_FORECAST_HISTORY_DAYS", 365))

    def is_ready(self) -> bool:
        return self.enabled() and _predictor().is_ready()

    def status(self) -> Dict[str, Any]:
        info: Dict[str, Any] = {"enabled": self.enabled()}
        info["price_model"] = _predictor().status()
        info["demand_model"] = _demand_model().status()
        info["symbols"] = self.market_data.list_forecastable_symbols()
        info["min_history_points"] = MIN_HISTORY
        info["max_horizon"] = self.max_horizon()
        return info

    def forecast_price(
        self,
        symbol: Optional[str],
        horizon: Optional[int] = None,
        model_name: str = "ensemble",
    ) -> Dict[str, Any]:
        if horizon is None:
            horizon = self.default_horizon()
        if horizon < 1 or horizon > self.max_horizon():
            return {"error": f"horizon must be between 1 and {self.max_horizon()}"}
        predictor = _predictor()
        if not predictor.is_ready():
            return {
                "error": "Forecasting model is not trained",
                "code": "model_unavailable",
            }
        if model_name not in predictor.model.available_models():
            return {"error": f"Unknown model '{model_name}'", "code": "unknown_model"}
        series = self.market_data.get_daily_series(symbol, self.history_days())
        if len(series) < MIN_HISTORY:
            return {
                "error": f"At least {MIN_HISTORY} daily observations are required, found {len(series)}",
                "code": "insufficient_data",
                "observations": int(len(series)),
            }
        try:
            result = predictor.forecast(series, horizon=horizon, model_name=model_name)
        except InsufficientDataError as exc:
            return {"error": str(exc), "code": "insufficient_data"}
        result["symbol"] = symbol
        result["engine"] = "ai_ensemble" if model_name == "ensemble" else model_name
        return result

    def train_price_model(
        self, source: str = "database", symbol: Optional[str] = None
    ) -> Dict[str, Any]:
        if not _training_lock.acquire(blocking=False):
            raise TrainingInProgressError("A training job is already running")
        try:
            used_symbol = symbol
            if source == "synthetic":
                frame = generate_synthetic_prices()
                source_label = "synthetic"
            elif source == "database":
                if not used_symbol:
                    counts = self.market_data.list_forecastable_symbols()
                    if not counts:
                        raise InsufficientDataError("No market history available")
                    used_symbol = max(counts, key=counts.get)
                frame = self.market_data.get_daily_series(
                    used_symbol, max(self.history_days(), 730)
                )
                source_label = f"database:{used_symbol}"
            else:
                raise ValueError("source must be 'database' or 'synthetic'")
            model = ForecastingModel(_models_dir())
            metadata = model.fit(frame, source=source_label)
            model.save()
            _predictor().reload_if_changed()
            return {
                "symbol": used_symbol,
                "source": source_label,
                "trained_at": metadata["trained_at"],
                "samples": metadata["samples"],
                "test_samples": metadata["test_samples"],
                "weights": metadata["weights"],
                "metrics": metadata["metrics"],
                "baseline_return_mae": metadata["baseline_return_mae"],
            }
        finally:
            _training_lock.release()

    def train_demand_model(
        self, dataset: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        if not _training_lock.acquire(blocking=False):
            raise TrainingInProgressError("A training job is already running")
        try:
            frame = dataset if dataset is not None else generate_synthetic_demand()
            source = "provided" if dataset is not None else "synthetic"
            model = DemandModel(_models_dir())
            metadata = model.fit(frame, source=source)
            model.save()
            _demand_model().reload_if_changed()
            return metadata
        finally:
            _training_lock.release()

    def predict_demand(
        self, price: float, volume: float, season: str
    ) -> Dict[str, Any]:
        model = _demand_model()
        if not model.reload_if_changed():
            return {"error": "Demand model is not trained", "code": "model_unavailable"}
        return {
            "predicted_demand": model.predict(price, volume, season),
            "inputs": {"price": price, "volume": volume, "season": season},
            "model_info": {
                "trained_at": model.metadata.get("trained_at"),
                "metrics": model.metadata.get("metrics"),
            },
        }
