import argparse
import logging
from pathlib import Path
from typing import List, Optional, Union

import pandas as pd

from ..config import DEMAND_DATASET, get_data_dir, get_models_dir
from ..data_io import generate_synthetic_demand
from ..demand import DemandModel
from .common import configure_logging

logger = logging.getLogger("ai_models.train_demand")


def train_demand_model(
    data_path: Optional[Union[str, Path]] = None,
    models_dir: Optional[Union[str, Path]] = None,
) -> DemandModel:
    path = Path(data_path) if data_path else get_data_dir() / DEMAND_DATASET
    if path.exists():
        data = pd.read_csv(path)
        source = str(path)
    else:
        logger.warning("Dataset %s not found, training on synthetic data", path)
        data = generate_synthetic_demand()
        source = "synthetic"
    model = DemandModel(models_dir or get_models_dir())
    metadata = model.fit(data, source=source)
    saved = model.save()
    logger.info("Demand model metrics: %s", metadata["metrics"])
    logger.info("Model saved to %s", saved)
    return model


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Train the demand model")
    parser.add_argument("--data", default=None)
    parser.add_argument("--models-dir", default=None)
    args = parser.parse_args(argv)
    configure_logging()
    train_demand_model(args.data, args.models_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
