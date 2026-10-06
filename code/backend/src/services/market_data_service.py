import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

import pandas as pd

from ..models import db
from ..models.market import MarketData, MarketDataType, PriceHistory, TimeFrame
from ..models.trading import Trade, TradeStatus

logger = logging.getLogger(__name__)

TIMEFRAME_BY_INTERVAL = {frame.value: frame for frame in TimeFrame}


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


class MarketDataService:
    def get_current_prices(
        self, credit_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        try:
            query = MarketData.query.filter(
                MarketData.data_type == MarketDataType.SPOT_PRICE
            )
            if credit_types:
                query = query.filter(MarketData.symbol.in_(credit_types))
            prices: Dict[str, Any] = {}
            for entry in query.order_by(MarketData.timestamp.desc()).all():
                if entry.symbol in prices:
                    continue
                prices[entry.symbol] = {
                    "price": float(entry.value),
                    "volume_24h": float(entry.volume) if entry.volume else 0.0,
                    "change_24h": (
                        float(entry.change_24h) if entry.change_24h else 0.0
                    ),
                    "timestamp": entry.timestamp.isoformat(),
                }
            return prices
        except Exception as exc:
            logger.error("Error getting current prices: %s", exc)
            return {}

    def get_price_history(
        self,
        symbol: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        interval: str = "1d",
    ) -> List[Dict[str, Any]]:
        try:
            timeframe = TIMEFRAME_BY_INTERVAL.get(interval)
            if timeframe is None:
                return []
            query = PriceHistory.query.filter(
                PriceHistory.symbol == symbol, PriceHistory.timeframe == timeframe
            )
            if start_date:
                query = query.filter(
                    PriceHistory.period_start >= _naive_utc(start_date)
                )
            if end_date:
                query = query.filter(PriceHistory.period_start <= _naive_utc(end_date))
            return [
                candle.to_ohlcv_dict()
                for candle in query.order_by(PriceHistory.period_start).all()
            ]
        except Exception as exc:
            logger.error("Error getting price history: %s", exc)
            return []

    def calculate_market_statistics(
        self, credit_type: Optional[str] = None, days: int = 30
    ) -> Dict[str, Any]:
        try:
            cutoff = _naive_utc(datetime.now(timezone.utc) - timedelta(days=days))
            query = Trade.query.filter(
                Trade.status == TradeStatus.SETTLED, Trade.executed_at >= cutoff
            )
            if credit_type:
                query = query.filter(Trade.credit_type == credit_type)
            trades = query.all()
            if not trades:
                return {"error": "Insufficient data"}
            prices = [float(trade.price) for trade in trades]
            volumes = [float(trade.quantity) for trade in trades]
            return {
                "average_price": sum(prices) / len(prices),
                "min_price": min(prices),
                "max_price": max(prices),
                "total_volume": sum(volumes),
                "trade_count": len(trades),
                "period_days": days,
            }
        except Exception as exc:
            logger.error("Error calculating statistics: %s", exc)
            return {"error": str(exc)}

    def update_market_data(self, symbol: str, price_data: Dict[str, Any]) -> bool:
        try:
            now = datetime.now(timezone.utc)
            entry = MarketData(
                symbol=symbol,
                data_type=MarketDataType.SPOT_PRICE,
                value=Decimal(str(price_data.get("price", 0))),
                volume=Decimal(str(price_data.get("volume", 0))),
                change_24h=Decimal(str(price_data.get("change", 0))),
                currency=price_data.get("currency", "USD"),
                data_source=price_data.get("source", "internal"),
                timestamp=_naive_utc(now),
            )
            db.session.add(entry)
            db.session.commit()
            return True
        except Exception as exc:
            logger.error("Error updating market data: %s", exc)
            db.session.rollback()
            return False

    def record_price_history(
        self,
        symbol: str,
        timestamp: datetime,
        open_price: Decimal,
        high_price: Decimal,
        low_price: Decimal,
        close_price: Decimal,
        volume: Decimal,
        timeframe: TimeFrame = TimeFrame.DAY_1,
        data_source: str = "internal",
    ) -> bool:
        try:
            start = _naive_utc(timestamp)
            candle = PriceHistory(
                symbol=symbol,
                timeframe=timeframe,
                period_start=start,
                period_end=start + timedelta(days=1),
                open_price=open_price,
                high_price=high_price,
                low_price=low_price,
                close_price=close_price,
                volume=volume,
                volume_usd=Decimal(str(close_price)) * Decimal(str(volume)),
                data_source=data_source,
            )
            db.session.add(candle)
            db.session.commit()
            return True
        except Exception as exc:
            logger.error("Error recording price history: %s", exc)
            db.session.rollback()
            return False

    def list_forecastable_symbols(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        candle_rows = (
            db.session.query(PriceHistory.symbol, db.func.count(PriceHistory.id))
            .filter(PriceHistory.timeframe == TimeFrame.DAY_1)
            .group_by(PriceHistory.symbol)
            .all()
        )
        for symbol, count in candle_rows:
            counts[symbol] = int(count)
        trade_rows = (
            db.session.query(
                Trade.credit_type,
                db.func.count(db.func.distinct(db.func.date(Trade.executed_at))),
            )
            .filter(Trade.status == TradeStatus.SETTLED, Trade.credit_type.isnot(None))
            .group_by(Trade.credit_type)
            .all()
        )
        for credit_type, count in trade_rows:
            counts[credit_type] = max(counts.get(credit_type, 0), int(count))
        return counts

    def get_daily_series(
        self, symbol: Optional[str] = None, days: int = 365
    ) -> pd.DataFrame:
        cutoff = _naive_utc(datetime.now(timezone.utc) - timedelta(days=days))
        if symbol:
            candles = (
                PriceHistory.query.filter(
                    PriceHistory.symbol == symbol,
                    PriceHistory.timeframe == TimeFrame.DAY_1,
                    PriceHistory.period_start >= cutoff,
                )
                .order_by(PriceHistory.period_start)
                .all()
            )
            if candles:
                return pd.DataFrame(
                    {
                        "timestamp": [c.period_start for c in candles],
                        "price": [float(c.close_price) for c in candles],
                        "volume": [float(c.volume) for c in candles],
                    }
                )
        query = Trade.query.filter(
            Trade.status == TradeStatus.SETTLED, Trade.executed_at >= cutoff
        )
        if symbol:
            query = query.filter(Trade.credit_type == symbol)
        trades = query.order_by(Trade.executed_at).all()
        if not trades:
            return pd.DataFrame(columns=["timestamp", "price", "volume"])
        frame = pd.DataFrame(
            {
                "day": [pd.Timestamp(t.executed_at).normalize() for t in trades],
                "price": [float(t.price) for t in trades],
                "quantity": [float(t.quantity) for t in trades],
            }
        )
        frame["notional"] = frame["price"] * frame["quantity"]
        grouped = frame.groupby("day").agg(
            notional=("notional", "sum"), volume=("quantity", "sum")
        )
        grouped = grouped[grouped["volume"] > 0]
        grouped["price"] = grouped["notional"] / grouped["volume"]
        grouped = grouped.reset_index().rename(columns={"day": "timestamp"})
        return grouped[["timestamp", "price", "volume"]]
