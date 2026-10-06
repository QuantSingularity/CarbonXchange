import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from ai_models.data_io import generate_synthetic_prices
from ai_models.forecasting import ForecastingModel


@pytest.fixture(scope="session")
def price_frame():
    return generate_synthetic_prices(420, seed=7)


@pytest.fixture(scope="session")
def trained_dir(tmp_path_factory, price_frame):
    directory = tmp_path_factory.mktemp("models")
    model = ForecastingModel(directory)
    model.fit(price_frame, source="test")
    model.save()
    return directory
