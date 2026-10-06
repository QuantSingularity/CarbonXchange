import pandas as pd

from ..exceptions import InsufficientDataError

COLUMN_ALIASES = {
    "date": "timestamp",
    "time": "timestamp",
    "close": "price",
    "close_price": "price",
    "historical_price": "price",
    "trading_volume": "volume",
}


def prepare_frame(data: pd.DataFrame) -> pd.DataFrame:
    if data is None or len(data) == 0:
        raise InsufficientDataError("No price data supplied")
    df = data.rename(columns=COLUMN_ALIASES).copy()
    for column in ("timestamp", "price", "volume"):
        if column not in df.columns:
            raise ValueError(f"Missing required column: {column}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce", utc=True)
    df["timestamp"] = df["timestamp"].dt.tz_localize(None)
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["timestamp", "price"])
    df = df[df["price"] > 0]
    df["volume"] = df["volume"].fillna(0.0).clip(lower=0.0)
    df = df.sort_values("timestamp").drop_duplicates("timestamp", keep="last")
    return df[["timestamp", "price", "volume"]].reset_index(drop=True)
