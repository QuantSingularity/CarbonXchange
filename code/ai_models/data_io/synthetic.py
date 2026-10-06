import numpy as np
import pandas as pd

from ..config import RANDOM_STATE

SEASONS = ("winter", "spring", "summer", "autumn")


def generate_synthetic_prices(
    n_samples: int = 730, seed: int = RANDOM_STATE, freq: str = "D"
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    timestamps = pd.date_range(
        end=pd.Timestamp.now().floor("D"), periods=n_samples, freq=freq
    )
    drift = 0.0004
    volatility = 0.015
    seasonal = 0.002 * np.sin(2 * np.pi * np.arange(n_samples) / 30)
    shocks = rng.normal(drift, volatility, n_samples) + seasonal
    momentum = np.zeros(n_samples)
    for i in range(1, n_samples):
        momentum[i] = 0.15 * shocks[i - 1]
    log_returns = shocks + momentum
    prices = 50.0 * np.exp(np.cumsum(log_returns))
    base_volume = 1000.0
    volumes = (
        base_volume * (1 + 25 * np.abs(log_returns)) * rng.lognormal(0, 0.2, n_samples)
    )
    return pd.DataFrame({"timestamp": timestamps, "price": prices, "volume": volumes})


def generate_synthetic_demand(
    n_samples: int = 1000, seed: int = RANDOM_STATE
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    price = rng.uniform(20, 120, n_samples)
    volume = rng.uniform(100, 5000, n_samples)
    season_index = rng.integers(0, len(SEASONS), n_samples)
    season_effect = np.array([0.9, 1.0, 1.1, 1.05])[season_index]
    demand = (
        2000
        - 8.0 * price
        + 0.35 * volume
        + 150 * (season_effect - 1.0) * 10
        + rng.normal(0, 60, n_samples)
    )
    return pd.DataFrame(
        {
            "historical_price": price,
            "trading_volume": volume,
            "season": [SEASONS[i] for i in season_index],
            "demand": np.maximum(demand, 0),
        }
    )
