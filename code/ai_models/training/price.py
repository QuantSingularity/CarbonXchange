import argparse
import logging
from pathlib import Path
from typing import List, Optional, Union

from ..config import PRICE_DATASET, get_data_dir, get_models_dir
from ..data_io import generate_synthetic_prices, load_price_frame
from ..forecasting import ForecastingModel
from .common import configure_logging

logger = logging.getLogger("ai_models.train_price")


def train_price_model(
    data_path: Optional[Union[str, Path]] = None,
    models_dir: Optional[Union[str, Path]] = None,
    synthetic: bool = False,
    samples: int = 730,
) -> ForecastingModel:
    path = Path(data_path) if data_path else get_data_dir() / PRICE_DATASET
    if synthetic or not path.exists():
        logger.warning("Training on synthetic data")
        frame = generate_synthetic_prices(samples)
        source = "synthetic"
    else:
        frame = load_price_frame(path)
        source = str(path)
    model = ForecastingModel(models_dir or get_models_dir())
    metadata = model.fit(frame, source=source)
    saved = model.save()
    for name, values in metadata["metrics"].items():
        logger.info(
            "%s directional_accuracy=%.3f price_mape=%.3f return_r2=%.4f",
            name,
            values["directional_accuracy"],
            values["price_mape"],
            values["return_r2"],
        )
    logger.info("Saved model to %s", saved)
    return model


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Train the price forecasting ensemble")
    parser.add_argument("--data", default=None)
    parser.add_argument("--models-dir", default=None)
    parser.add_argument("--synthetic", action="store_true")
    parser.add_argument("--samples", type=int, default=730)
    args = parser.parse_args(argv)
    configure_logging()
    train_price_model(args.data, args.models_dir, args.synthetic, args.samples)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
