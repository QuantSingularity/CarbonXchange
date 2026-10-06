import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.model_selection import TimeSeriesSplit, cross_val_score

from ..config import MIN_TRAIN_SAMPLES, PRICE_MODEL_FILE, get_models_dir
from ..evaluation import evaluate_forecast, inverse_error_weights
from ..exceptions import InsufficientDataError, ModelNotTrainedError
from ..persistence import atomic_dump, load_bundle
from ..preprocessing import training_matrix
from .estimators import build_estimators, build_pipeline

logger = logging.getLogger(__name__)


class ForecastingModel:
    def __init__(self, models_dir: Optional[Union[str, Path]] = None) -> None:
        self.models_dir = Path(models_dir) if models_dir else get_models_dir()
        self.models: Dict[str, Any] = {}
        self.weights: Dict[str, float] = {}
        self.feature_names: List[str] = []
        self.metadata: Dict[str, Any] = {}

    @property
    def path(self) -> Path:
        return self.models_dir / PRICE_MODEL_FILE

    @property
    def is_trained(self) -> bool:
        return bool(self.models) and bool(self.feature_names)

    def fit(
        self,
        data: pd.DataFrame,
        holdout_fraction: float = 0.2,
        n_splits: int = 4,
        source: str = "unknown",
    ) -> Dict[str, Any]:
        X, y, base_price = training_matrix(data)
        if len(X) < MIN_TRAIN_SAMPLES:
            raise InsufficientDataError(
                f"At least {MIN_TRAIN_SAMPLES} usable samples are required, got {len(X)}"
            )
        split = int(len(X) * (1 - holdout_fraction))
        X_train, X_test = X.iloc[:split], X.iloc[split:]
        y_train, y_test = y.iloc[:split], y.iloc[split:]
        price_test = base_price.iloc[split:]
        n_features = X.shape[1]
        splitter = TimeSeriesSplit(n_splits=n_splits)
        metrics: Dict[str, Dict[str, float]] = {}
        test_predictions: Dict[str, np.ndarray] = {}
        for name, estimator in build_estimators().items():
            started = time.perf_counter()
            candidate = build_pipeline(estimator, n_features)
            try:
                cv = cross_val_score(
                    clone(candidate),
                    X_train,
                    y_train,
                    cv=splitter,
                    scoring="neg_mean_squared_error",
                )
                candidate.fit(X_train, y_train)
                predicted = candidate.predict(X_test)
            except Exception as exc:
                logger.error("Model %s failed during evaluation: %s", name, exc)
                continue
            elapsed = time.perf_counter() - started
            result = evaluate_forecast(y_test, predicted, price_test)
            result["cv_mse_mean"] = float(-np.mean(cv))
            result["cv_mse_std"] = float(np.std(cv))
            result["training_seconds"] = float(elapsed)
            metrics[name] = result
            test_predictions[name] = predicted
        if not metrics:
            raise RuntimeError("No model could be trained")
        weights = inverse_error_weights(
            {name: values["cv_mse_mean"] for name, values in metrics.items()}
        )
        ensemble_test = sum(weights[name] * test_predictions[name] for name in weights)
        metrics["ensemble"] = evaluate_forecast(y_test, ensemble_test, price_test)
        baseline_mae = float(np.mean(np.abs(y_test.to_numpy())))
        residual_std = float(np.std(y_test.to_numpy() - ensemble_test, ddof=1))
        final_models = {}
        for name in weights:
            final = build_pipeline(build_estimators()[name], n_features)
            final.fit(X, y)
            final_models[name] = final
        self.models = final_models
        self.weights = weights
        self.feature_names = list(X.columns)
        self.metadata = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "samples": int(len(X)),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "residual_std": residual_std,
            "baseline_return_mae": baseline_mae,
            "weights": weights,
            "metrics": metrics,
            "feature_names": self.feature_names,
            "sklearn_version": sklearn.__version__,
            "target": "next_step_log_return",
        }
        return self.metadata

    def predict_returns(
        self, features: pd.DataFrame, model_name: str = "ensemble"
    ) -> np.ndarray:
        if not self.is_trained:
            raise ModelNotTrainedError("Model is not trained")
        X = features[self.feature_names]
        if model_name == "ensemble":
            return sum(
                self.weights[name] * self.models[name].predict(X)
                for name in self.weights
            )
        if model_name not in self.models:
            raise ValueError(f"Unknown model '{model_name}'")
        return self.models[model_name].predict(X)

    def feature_importance(self, top: int = 5) -> Dict[str, float]:
        forest = self.models.get("random_forest")
        if forest is None:
            return {}
        pipeline = forest.regressor_
        selected = np.array(self.feature_names)[
            pipeline.named_steps["select"].get_support()
        ]
        importance = pipeline.named_steps["model"].feature_importances_
        order = np.argsort(importance)[::-1][:top]
        return {str(selected[i]): float(importance[i]) for i in order}

    def available_models(self) -> List[str]:
        return list(self.models) + (["ensemble"] if self.models else [])

    def save(self) -> Path:
        if not self.is_trained:
            raise ModelNotTrainedError("Nothing to save")
        bundle = {
            "models": self.models,
            "weights": self.weights,
            "feature_names": self.feature_names,
            "metadata": self.metadata,
        }
        atomic_dump(bundle, self.path)
        with open(self.models_dir / "price_forecast_metadata.json", "w") as handle:
            json.dump(self.metadata, handle, indent=2)
        return self.path

    def load(self) -> "ForecastingModel":
        bundle = load_bundle(self.path)
        self.models = bundle["models"]
        self.weights = bundle["weights"]
        self.feature_names = bundle["feature_names"]
        self.metadata = bundle["metadata"]
        trained_with = self.metadata.get("sklearn_version")
        if trained_with and trained_with != sklearn.__version__:
            logger.warning(
                "Model trained with scikit-learn %s but %s is installed",
                trained_with,
                sklearn.__version__,
            )
        return self
