"""
Advanced Forecasting Model for CarbonXchange
Implements multiple machine learning algorithms for carbon credit price prediction
and market analysis with financial industry standards
"""

import warnings

warnings.filterwarnings("ignore")

import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    GradientBoostingRegressor,
    RandomForestRegressor,
    VotingRegressor,
)
from sklearn.feature_selection import SelectKBest, f_regression
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit, cross_val_score
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import RobustScaler
from sklearn.svm import SVR

try:
    pass

    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False
    logging.warning(
        "statsmodels not installed - ARIMA forecasting disabled. Install with: pip install statsmodels"
    )

try:
    import tensorflow as tf

    TENSORFLOW_AVAILABLE = True
    logging.info("TensorFlow %s detected - LSTM models enabled", tf.__version__)
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning(
        "TensorFlow not installed - LSTM models disabled. Install with: pip install tensorflow"
    )
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@dataclass
class ModelPerformance:
    """Model performance metrics"""

    model_name: str
    mse: float
    mae: float
    r2: float
    mape: float
    directional_accuracy: float
    training_time: float
    prediction_time: float


@dataclass
class ForecastResult:
    """Forecast result with confidence intervals"""

    timestamp: datetime
    predicted_price: float
    confidence_lower: float
    confidence_upper: float
    model_confidence: float
    contributing_factors: Dict[str, float]


class FeatureEngineer:
    """Advanced feature engineering for carbon credit price prediction"""

    def __init__(self) -> None:
        self.scalers = {}
        self.feature_names = []

    def create_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Create comprehensive feature set"""
        logger.info("Creating advanced features...")
        df = data.copy()
        required_cols = ["price", "volume", "timestamp"]
        for col in required_cols:
            if col not in df.columns:
                logger.error(f"Required column '{col}' not found in data")
                raise ValueError(f"Missing required column: {col}")
        df = df.sort_values("timestamp").reset_index(drop=True)
        df["price_change"] = df["price"].pct_change()
        df["price_change_abs"] = df["price_change"].abs()
        df["log_price"] = np.log(df["price"] + 1e-08)
        for window in [5, 10, 20, 50]:
            df[f"ma_{window}"] = df["price"].rolling(window=window).mean()
            df[f"price_ma_ratio_{window}"] = df["price"] / df[f"ma_{window}"]
        for window in [5, 10, 20]:
            df[f"volatility_{window}"] = df["price_change"].rolling(window=window).std()
            df[f"volatility_ratio_{window}"] = (
                df[f"volatility_{window}"]
                / df[f"volatility_{window}"].rolling(window=50).mean()
            )
        df["volume_change"] = df["volume"].pct_change()
        df["volume_ma_5"] = df["volume"].rolling(window=5).mean()
        df["volume_ma_20"] = df["volume"].rolling(window=20).mean()
        df["volume_ratio"] = df["volume"] / df["volume_ma_20"]
        df["price_volume_trend"] = df["price_change"] * df["volume_change"]
        df["rsi"] = self._calculate_rsi(df["price"])
        df["bollinger_upper"], df["bollinger_lower"] = self._calculate_bollinger_bands(
            df["price"]
        )
        df["bollinger_position"] = (df["price"] - df["bollinger_lower"]) / (
            df["bollinger_upper"] - df["bollinger_lower"]
        )
        df["macd"], df["macd_signal"] = self._calculate_macd(df["price"])
        df["macd_histogram"] = df["macd"] - df["macd_signal"]
        for period in [5, 10, 20]:
            df[f"momentum_{period}"] = df["price"] / df["price"].shift(period) - 1
            df[f"roc_{period}"] = df["price"].pct_change(periods=period)
        df["hour"] = pd.to_datetime(df["timestamp"]).dt.hour
        df["day_of_week"] = pd.to_datetime(df["timestamp"]).dt.dayofweek
        df["month"] = pd.to_datetime(df["timestamp"]).dt.month
        df["quarter"] = pd.to_datetime(df["timestamp"]).dt.quarter
        df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
        df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
        df["day_sin"] = np.sin(2 * np.pi * df["day_of_week"] / 7)
        df["day_cos"] = np.cos(2 * np.pi * df["day_of_week"] / 7)
        df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
        df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
        for lag in [1, 2, 3, 5, 10]:
            df[f"price_lag_{lag}"] = df["price"].shift(lag)
            df[f"volume_lag_{lag}"] = df["volume"].shift(lag)
            df[f"price_change_lag_{lag}"] = df["price_change"].shift(lag)
        for window in [5, 10, 20]:
            df[f"price_min_{window}"] = df["price"].rolling(window=window).min()
            df[f"price_max_{window}"] = df["price"].rolling(window=window).max()
            df[f"price_std_{window}"] = df["price"].rolling(window=window).std()
            df[f"price_skew_{window}"] = df["price"].rolling(window=window).skew()
            df[f"price_kurt_{window}"] = df["price"].rolling(window=window).kurt()
        if "bid_price" in df.columns and "ask_price" in df.columns:
            df["bid_ask_spread"] = df["ask_price"] - df["bid_price"]
            df["mid_price"] = (df["bid_price"] + df["ask_price"]) / 2
            df["price_impact"] = df["price"] - df["mid_price"]
        df["economic_indicator_1"] = np.random.normal(0, 1, len(df))
        df["economic_indicator_2"] = np.random.normal(0, 1, len(df))
        df["environmental_factor"] = np.random.normal(0, 1, len(df))
        df = df.replace([np.inf, -np.inf], np.nan)
        self.feature_names = [
            col for col in df.columns if col not in ["price", "timestamp", "target"]
        ]
        logger.info(f"Created {len(self.feature_names)} features")
        return df

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = delta.where(delta > 0, 0).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - 100 / (1 + rs)

    def _calculate_bollinger_bands(
        self, prices: pd.Series, period: int = 20, std_dev: int = 2
    ) -> Tuple[pd.Series, pd.Series]:
        """Calculate Bollinger Bands"""
        sma = prices.rolling(window=period).mean()
        std = prices.rolling(window=period).std()
        upper_band = sma + std * std_dev
        lower_band = sma - std * std_dev
        return (upper_band, lower_band)

    def _calculate_macd(
        self, prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> Tuple[pd.Series, pd.Series]:
        """Calculate MACD"""
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        macd = ema_fast - ema_slow
        signal_line = macd.ewm(span=signal).mean()
        return (macd, signal_line)


class AdvancedForecastingModel:
    """Advanced forecasting model with multiple algorithms"""

    def __init__(self) -> None:
        self.models = {}
        self.scalers = {}
        self.feature_engineer = FeatureEngineer()
        self.feature_selector = None
        self.ensemble_model = None
        self.performance_metrics = {}

    def prepare_data(self, data_path: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Load and prepare data for training"""
        logger.info(f"Loading data from {data_path}")
        try:
            if os.path.exists(data_path):
                data = pd.read_csv(data_path)
            else:
                logger.warning(
                    f"Data file not found at {data_path}, generating synthetic data"
                )
                data = self._generate_synthetic_data()
            required_columns = ["timestamp", "price", "volume"]
            for col in required_columns:
                if col not in data.columns:
                    logger.error(f"Required column '{col}' not found in data")
                    raise ValueError(f"Missing required column: {col}")
            data["timestamp"] = pd.to_datetime(data["timestamp"])
            data = data.sort_values("timestamp").reset_index(drop=True)
            data_with_features = self.feature_engineer.create_features(data)
            data_with_features["target"] = data_with_features["price"].shift(-1)
            data_with_features = data_with_features.dropna()
            feature_columns = self.feature_engineer.feature_names
            X = data_with_features[feature_columns]
            y = data_with_features["target"]
            logger.info(
                f"Prepared data with {len(X)} samples and {len(feature_columns)} features"
            )
            return (X, y)
        except Exception as e:
            logger.error(f"Error preparing data: {e}")
            raise

    def _generate_synthetic_data(self, n_samples: int = 1000) -> pd.DataFrame:
        """Generate synthetic carbon credit market data"""
        logger.info("Generating synthetic market data")
        start_date = datetime.now() - timedelta(days=n_samples)
        timestamps = pd.date_range(start=start_date, periods=n_samples, freq="H")
        trend = np.linspace(50, 100, n_samples)
        seasonal = 10 * np.sin(2 * np.pi * np.arange(n_samples) / 24)
        noise = np.random.normal(0, 5, n_samples)
        prices = trend + seasonal + noise
        prices = np.maximum(prices, 1)
        base_volume = 1000
        volume_trend = np.random.normal(1, 0.2, n_samples)
        volumes = base_volume * volume_trend
        volumes = np.maximum(volumes, 10)
        data = pd.DataFrame(
            {
                "timestamp": timestamps,
                "price": prices,
                "volume": volumes,
                "bid_price": prices * 0.995,
                "ask_price": prices * 1.005,
            }
        )
        return data

    def train_models(
        self, X: pd.DataFrame, y: pd.Series
    ) -> Dict[str, ModelPerformance]:
        """Train multiple forecasting models"""
        logger.info("Training multiple forecasting models...")
        tscv = TimeSeriesSplit(n_splits=5)
        scaler = RobustScaler()
        X_scaled = pd.DataFrame(
            scaler.fit_transform(X), columns=X.columns, index=X.index
        )
        self.scalers["features"] = scaler
        selector = SelectKBest(score_func=f_regression, k=min(50, len(X.columns)))
        X_selected = selector.fit_transform(X_scaled, y)
        self.feature_selector = selector
        selected_features = X.columns[selector.get_support()]
        logger.info(f"Selected {len(selected_features)} features for training")
        models_config = {
            "random_forest": RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            ),
            "gradient_boosting": GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=6,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
            ),
            "svr": SVR(kernel="rbf", C=100, gamma="scale", epsilon=0.1),
            "neural_network": MLPRegressor(
                hidden_layer_sizes=(100, 50),
                activation="relu",
                solver="adam",
                alpha=0.001,
                learning_rate="adaptive",
                max_iter=500,
                random_state=42,
            ),
            "elastic_net": ElasticNet(alpha=0.1, l1_ratio=0.5, random_state=42),
        }
        performance_results = {}
        for model_name, model in models_config.items():
            logger.info(f"Training {model_name}...")
            start_time = datetime.now()
            try:
                cross_val_score(
                    model, X_selected, y, cv=tscv, scoring="neg_mean_squared_error"
                )
                model.fit(X_selected, y)
                y_pred = model.predict(X_selected)
                training_time = (datetime.now() - start_time).total_seconds()
                mse = mean_squared_error(y, y_pred)
                mae = mean_absolute_error(y, y_pred)
                r2 = r2_score(y, y_pred)
                mape = np.mean(np.abs((y - y_pred) / y)) * 100
                y_direction = np.sign(y.diff().dropna())
                pred_direction = np.sign(pd.Series(y_pred).diff().dropna())
                directional_accuracy = np.mean(y_direction == pred_direction) * 100
                self.models[model_name] = model
                performance_results[model_name] = ModelPerformance(
                    model_name=model_name,
                    mse=mse,
                    mae=mae,
                    r2=r2,
                    mape=mape,
                    directional_accuracy=directional_accuracy,
                    training_time=training_time,
                    prediction_time=0.0,
                )
                logger.info(
                    f"{model_name} - MSE: {mse:.4f}, MAE: {mae:.4f}, R²: {r2:.4f}"
                )
            except Exception as e:
                logger.error(f"Error training {model_name}: {e}")
                continue
        if len(self.models) >= 2:
            logger.info("Creating ensemble model...")
            ensemble_estimators = [(name, model) for name, model in self.models.items()]
            self.ensemble_model = VotingRegressor(estimators=ensemble_estimators)
            self.ensemble_model.fit(X_selected, y)
            y_pred_ensemble = self.ensemble_model.predict(X_selected)
            mse_ensemble = mean_squared_error(y, y_pred_ensemble)
            mae_ensemble = mean_absolute_error(y, y_pred_ensemble)
            r2_ensemble = r2_score(y, y_pred_ensemble)
            mape_ensemble = np.mean(np.abs((y - y_pred_ensemble) / y)) * 100
            performance_results["ensemble"] = ModelPerformance(
                model_name="ensemble",
                mse=mse_ensemble,
                mae=mae_ensemble,
                r2=r2_ensemble,
                mape=mape_ensemble,
                directional_accuracy=0.0,
                training_time=0.0,
                prediction_time=0.0,
            )
            logger.info(
                f"Ensemble - MSE: {mse_ensemble:.4f}, MAE: {mae_ensemble:.4f}, R²: {r2_ensemble:.4f}"
            )
        self.performance_metrics = performance_results
        logger.info(f"Training completed. Trained {len(self.models)} models.")
        return performance_results

    def predict(
        self, X: pd.DataFrame, model_name: str = "ensemble"
    ) -> List[ForecastResult]:
        """Make predictions using specified model"""
        if model_name not in self.models and model_name != "ensemble":
            raise ValueError(f"Model '{model_name}' not found")
        if model_name == "ensemble" and self.ensemble_model is None:
            raise ValueError("Ensemble model not available")
        X_scaled = pd.DataFrame(
            self.scalers["features"].transform(X), columns=X.columns, index=X.index
        )
        X_selected = self.feature_selector.transform(X_scaled)
        start_time = datetime.now()
        if model_name == "ensemble":
            predictions = self.ensemble_model.predict(X_selected)
        else:
            predictions = self.models[model_name].predict(X_selected)
        prediction_time = (datetime.now() - start_time).total_seconds()
        prediction_std = np.std(predictions)
        confidence_interval = 1.96 * prediction_std
        results = []
        for i, pred in enumerate(predictions):
            result = ForecastResult(
                timestamp=datetime.now() + timedelta(hours=i),
                predicted_price=float(pred),
                confidence_lower=float(pred - confidence_interval),
                confidence_upper=float(pred + confidence_interval),
                model_confidence=0.8,
                contributing_factors={},
            )
            results.append(result)
        if model_name in self.performance_metrics:
            self.performance_metrics[model_name].prediction_time = prediction_time
        return results

    def save_models(self, model_dir: str) -> Any:
        """Save trained models and scalers"""
        os.makedirs(model_dir, exist_ok=True)
        for model_name, model in self.models.items():
            model_path = os.path.join(model_dir, f"{model_name}_model.pkl")
            joblib.dump(model, model_path)
            logger.info(f"Saved {model_name} model to {model_path}")
        if self.ensemble_model:
            ensemble_path = os.path.join(model_dir, "ensemble_model.pkl")
            joblib.dump(self.ensemble_model, ensemble_path)
            logger.info(f"Saved ensemble model to {ensemble_path}")
        scalers_path = os.path.join(model_dir, "scalers.pkl")
        joblib.dump(self.scalers, scalers_path)
        selector_path = os.path.join(model_dir, "feature_selector.pkl")
        joblib.dump(self.feature_selector, selector_path)
        features_path = os.path.join(model_dir, "feature_names.json")
        with open(features_path, "w") as f:
            json.dump(self.feature_engineer.feature_names, f)
        metrics_path = os.path.join(model_dir, "performance_metrics.json")
        metrics_dict = {}
        for name, perf in self.performance_metrics.items():
            metrics_dict[name] = {
                "mse": perf.mse,
                "mae": perf.mae,
                "r2": perf.r2,
                "mape": perf.mape,
                "directional_accuracy": perf.directional_accuracy,
                "training_time": perf.training_time,
                "prediction_time": perf.prediction_time,
            }
        with open(metrics_path, "w") as f:
            json.dump(metrics_dict, f, indent=2)
        logger.info(f"All models and artifacts saved to {model_dir}")

    def load_models(self, model_dir: str) -> Any:
        """Load trained models and scalers"""
        try:
            for model_file in os.listdir(model_dir):
                if (
                    model_file.endswith("_model.pkl")
                    and model_file != "ensemble_model.pkl"
                ):
                    model_name = model_file.replace("_model.pkl", "")
                    model_path = os.path.join(model_dir, model_file)
                    self.models[model_name] = joblib.load(model_path)
                    logger.info(f"Loaded {model_name} model")
            ensemble_path = os.path.join(model_dir, "ensemble_model.pkl")
            if os.path.exists(ensemble_path):
                self.ensemble_model = joblib.load(ensemble_path)
                logger.info("Loaded ensemble model")
            scalers_path = os.path.join(model_dir, "scalers.pkl")
            if os.path.exists(scalers_path):
                self.scalers = joblib.load(scalers_path)
            selector_path = os.path.join(model_dir, "feature_selector.pkl")
            if os.path.exists(selector_path):
                self.feature_selector = joblib.load(selector_path)
            features_path = os.path.join(model_dir, "feature_names.json")
            if os.path.exists(features_path):
                with open(features_path, "r") as f:
                    self.feature_engineer.feature_names = json.load(f)
            logger.info(f"Models loaded successfully from {model_dir}")
        except Exception as e:
            logger.error(f"Error loading models: {e}")
            raise


def main() -> Any:
    """Main training function"""
    logger.info("Starting advanced forecasting model training...")
    forecasting_model = AdvancedForecastingModel()
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "resources",
        "datasets",
        "market_demand.csv",
    )
    try:
        X, y = forecasting_model.prepare_data(data_path)
        performance_results = forecasting_model.train_models(X, y)
        logger.info("\n" + "=" * 50)
        logger.info("MODEL PERFORMANCE SUMMARY")
        logger.info("=" * 50)
        for model_name, perf in performance_results.items():
            logger.info(f"\n{model_name.upper()}:")
            logger.info(f"  MSE: {perf.mse:.4f}")
            logger.info(f"  MAE: {perf.mae:.4f}")
            logger.info(f"  R²: {perf.r2:.4f}")
            logger.info(f"  MAPE: {perf.mape:.2f}%")
            logger.info(f"  Directional Accuracy: {perf.directional_accuracy:.2f}%")
            logger.info(f"  Training Time: {perf.training_time:.2f}s")
        model_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"
        )
        forecasting_model.save_models(model_dir)
        logger.info("\nAdvanced forecasting model training completed successfully!")
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise


if __name__ == "__main__":
    main()
