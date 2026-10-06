from typing import Any, Dict, List

import numpy as np
import pandas as pd

from ..config import MIN_HISTORY
from .frames import prepare_frame


def _rsi(price: pd.Series, period: int = 14) -> pd.Series:
    delta = price.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    total = gain + loss
    rsi = 100.0 * gain / total.replace(0, np.nan)
    rsi = rsi.where(total.notna(), np.nan)
    flat = total == 0
    return rsi.mask(flat, 50.0)


def build_features(data: pd.DataFrame) -> pd.DataFrame:
    df = prepare_frame(data)
    price = df["price"].astype(float)
    volume = df["volume"].astype(float)
    ts = pd.to_datetime(df["timestamp"])
    log_volume = np.log1p(volume)
    ret = np.log(price).diff()
    cols: Dict[str, pd.Series] = {"ret_1": ret}
    for lag in (1, 2, 3, 5, 10):
        cols[f"ret_lag_{lag}"] = ret.shift(lag)
    for period in (5, 10, 20):
        cols[f"momentum_{period}"] = np.log(price / price.shift(period))
    for window in (5, 10, 20, 50):
        cols[f"price_ma_ratio_{window}"] = price / price.rolling(window).mean() - 1.0
    for window in (5, 10, 20):
        cols[f"volatility_{window}"] = ret.rolling(window).std()
    cols["volatility_ratio_5_20"] = cols["volatility_5"] / cols["volatility_20"]
    for window in (10, 20):
        cols[f"ret_skew_{window}"] = ret.rolling(window).skew()
        cols[f"ret_kurt_{window}"] = ret.rolling(window).kurt()
    cols["log_volume"] = log_volume
    cols["volume_change"] = log_volume.diff()
    cols["volume_ratio_5"] = volume / volume.rolling(5).mean()
    cols["volume_ratio_20"] = volume / volume.rolling(20).mean()
    cols["ret_volume_interaction"] = ret * cols["volume_change"]
    cols["rsi_14"] = _rsi(price, 14) / 100.0
    sma20 = price.rolling(20).mean()
    std20 = price.rolling(20).std()
    band = (4.0 * std20).replace(0, np.nan)
    cols["bollinger_position"] = (price - (sma20 - 2.0 * std20)) / band
    ema_fast = price.ewm(span=12, adjust=False).mean()
    ema_slow = price.ewm(span=26, adjust=False).mean()
    macd = (ema_fast - ema_slow) / price
    macd_signal = macd.ewm(span=9, adjust=False).mean()
    cols["macd"] = macd
    cols["macd_signal"] = macd_signal
    cols["macd_histogram"] = macd - macd_signal
    rolling_min = price.rolling(20).min()
    rolling_max = price.rolling(20).max()
    cols["range_position_20"] = (price - rolling_min) / (
        rolling_max - rolling_min
    ).replace(0, np.nan)
    dow = ts.dt.dayofweek
    month = ts.dt.month
    dom = ts.dt.day
    cols["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    cols["dow_cos"] = np.cos(2 * np.pi * dow / 7)
    cols["month_sin"] = np.sin(2 * np.pi * month / 12)
    cols["month_cos"] = np.cos(2 * np.pi * month / 12)
    cols["dom_sin"] = np.sin(2 * np.pi * dom / 31)
    cols["dom_cos"] = np.cos(2 * np.pi * dom / 31)
    features = pd.DataFrame(cols, index=df.index)
    return features.replace([np.inf, -np.inf], np.nan)


def make_target(data: pd.DataFrame) -> pd.Series:
    price = prepare_frame(data)["price"].astype(float)
    return np.log(price.shift(-1) / price)


def training_matrix(data: pd.DataFrame) -> Any:
    frame = prepare_frame(data)
    features = build_features(frame)
    target = make_target(frame)
    joined = features.assign(target=target, price=frame["price"]).dropna()
    return (
        joined[list(features.columns)],
        joined["target"],
        joined["price"],
    )


def feature_names() -> List[str]:
    probe = pd.DataFrame(
        {
            "timestamp": pd.date_range("2020-01-01", periods=MIN_HISTORY, freq="D"),
            "price": np.linspace(10.0, 20.0, MIN_HISTORY),
            "volume": np.full(MIN_HISTORY, 100.0),
        }
    )
    return list(build_features(probe).columns)
