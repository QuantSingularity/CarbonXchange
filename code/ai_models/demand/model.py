import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Union

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from ..config import DEMAND_MODEL_FILE, RANDOM_STATE, get_models_dir
from ..exceptions import InsufficientDataError, ModelNotTrainedError
from ..persistence import atomic_dump, load_bundle

logger = logging.getLogger(__name__)

NUMERIC_FEATURES = ["historical_price", "trading_volume"]
CATEGORICAL_FEATURES = ["season"]
MIN_DEMAND_SAMPLES = 50


class DemandModel:
    def __init__(self, models_dir: Optional[Union[str, Path]] = None) -> None:
        self.models_dir = Path(models_dir) if models_dir else get_models_dir()
        self.pipeline: Optional[Pipeline] = None
        self.metadata: Dict[str, Any] = {}
        self._loaded_mtime: Optional[float] = None

    @property
    def path(self) -> Path:
        return self.models_dir / DEMAND_MODEL_FILE

    @property
    def is_trained(self) -> bool:
        return self.pipeline is not None

    def fit(self, data: pd.DataFrame, source: str = "unknown") -> Dict[str, Any]:
        required = NUMERIC_FEATURES + CATEGORICAL_FEATURES + ["demand"]
        missing = [column for column in required if column not in data.columns]
        if missing:
            raise ValueError(f"Missing required columns: {missing}")
        df = data[required].copy()
        for column in NUMERIC_FEATURES + ["demand"]:
            df[column] = pd.to_numeric(df[column], errors="coerce")
        df["season"] = df["season"].astype(str)
        df = df.dropna()
        if len(df) < MIN_DEMAND_SAMPLES:
            raise InsufficientDataError(
                f"At least {MIN_DEMAND_SAMPLES} rows are required, got {len(df)}"
            )
        X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
        y = df["demand"]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=RANDOM_STATE
        )
        pipeline = self._build()
        pipeline.fit(X_train, y_train)
        predicted = pipeline.predict(X_test)
        metrics = {
            "mae": float(mean_absolute_error(y_test, predicted)),
            "r2": float(r2_score(y_test, predicted)),
        }
        final = self._build()
        final.fit(X, y)
        self.pipeline = final
        self.metadata = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "source": source,
            "samples": int(len(df)),
            "metrics": metrics,
            "seasons": sorted(df["season"].unique().tolist()),
        }
        return self.metadata

    @staticmethod
    def _build() -> Pipeline:
        preprocess = ColumnTransformer(
            [
                ("numeric", StandardScaler(), NUMERIC_FEATURES),
                (
                    "season",
                    OneHotEncoder(handle_unknown="ignore"),
                    CATEGORICAL_FEATURES,
                ),
            ]
        )
        return Pipeline(
            [
                ("preprocess", preprocess),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=200,
                        min_samples_leaf=2,
                        random_state=RANDOM_STATE,
                        n_jobs=1,
                    ),
                ),
            ]
        )

    def predict(self, price: float, volume: float, season: str) -> float:
        if self.pipeline is None:
            raise ModelNotTrainedError("Demand model is not trained")
        row = pd.DataFrame(
            {
                "historical_price": [float(price)],
                "trading_volume": [float(volume)],
                "season": [str(season)],
            }
        )
        return float(max(self.pipeline.predict(row)[0], 0.0))

    def save(self) -> Path:
        if self.pipeline is None:
            raise ModelNotTrainedError("Nothing to save")
        atomic_dump({"pipeline": self.pipeline, "metadata": self.metadata}, self.path)
        return self.path

    def load(self) -> "DemandModel":
        bundle = load_bundle(self.path)
        self.pipeline = bundle["pipeline"]
        self.metadata = bundle["metadata"]
        return self

    def reload_if_changed(self) -> bool:
        if not self.path.exists():
            return False
        mtime = self.path.stat().st_mtime
        if self._loaded_mtime == mtime and self.is_trained:
            return True
        try:
            self.load()
        except Exception as exc:
            logger.error("Failed to load demand model: %s", exc)
            return self.is_trained
        self._loaded_mtime = mtime
        return True

    def status(self) -> Dict[str, Any]:
        ready = self.reload_if_changed()
        info: Dict[str, Any] = {"ready": ready}
        if ready:
            info.update(
                {
                    "trained_at": self.metadata.get("trained_at"),
                    "samples": self.metadata.get("samples"),
                    "metrics": self.metadata.get("metrics"),
                    "seasons": self.metadata.get("seasons"),
                }
            )
        return info
