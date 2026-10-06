import argparse
import logging
from pathlib import Path
from typing import Any, List, Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from ..config import DEMAND_DATASET, PRICE_DATASET, PROCESSED_DATASET, get_data_dir
from ..data_io import generate_synthetic_demand, generate_synthetic_prices
from .common import configure_logging

logger = logging.getLogger("ai_models.preprocess")

NUMERIC_COLUMNS = ["historical_price", "trading_volume"]


def preprocess_data(filepath: Any) -> pd.DataFrame:
    df = pd.read_csv(filepath)
    missing = [column for column in NUMERIC_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    for column in NUMERIC_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="coerce")
        df[column] = df[column].fillna(df[column].median())
    safe_volume = df["trading_volume"].where(df["trading_volume"] > 0, np.nan)
    df["price_volume_ratio"] = df["historical_price"] / safe_volume
    df["price_volume_ratio"] = df["price_volume_ratio"].fillna(
        df["price_volume_ratio"].median()
    )
    scaled = StandardScaler().fit_transform(
        df[["historical_price", "trading_volume", "price_volume_ratio"]]
    )
    return pd.DataFrame(scaled, columns=["price", "volume", "ratio"])


def ensure_datasets(data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    demand_path = data_dir / DEMAND_DATASET
    price_path = data_dir / PRICE_DATASET
    if not demand_path.exists():
        logger.warning("Creating synthetic demand dataset at %s", demand_path)
        generate_synthetic_demand().to_csv(demand_path, index=False)
    if not price_path.exists():
        logger.warning("Creating synthetic price dataset at %s", price_path)
        generate_synthetic_prices().to_csv(price_path, index=False)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Preprocess the demand dataset")
    parser.add_argument("--input", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args(argv)
    configure_logging()
    data_dir = get_data_dir()
    if args.input:
        source = Path(args.input)
    else:
        ensure_datasets(data_dir)
        source = data_dir / DEMAND_DATASET
    output = Path(args.output) if args.output else data_dir / PROCESSED_DATASET
    processed = preprocess_data(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    processed.to_csv(output, index=False)
    logger.info("Wrote %d processed rows to %s", len(processed), output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
