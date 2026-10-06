import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent

PRICE_MODEL_FILE = "price_forecast.joblib"
DEMAND_MODEL_FILE = "demand_forecast.joblib"
PRICE_DATASET = "market_prices.csv"
DEMAND_DATASET = "market_demand.csv"
PROCESSED_DATASET = "market_demand_processed.csv"

MIN_HISTORY = 80
MIN_TRAIN_SAMPLES = 150
HISTORY_WINDOW = 200
MAX_HORIZON = 90
RANDOM_STATE = 42
NEUTRAL_BAND = 0.0025


def get_models_dir() -> Path:
    return Path(os.getenv("AI_MODELS_DIR") or PACKAGE_DIR / "models")


def get_data_dir() -> Path:
    return Path(os.getenv("AI_DATA_DIR") or PACKAGE_DIR / "data")
