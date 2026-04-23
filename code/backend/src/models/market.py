"""
Market Data models for CarbonXchange Backend
Implements comprehensive market data tracking and price analytics
"""

import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship

from . import db


class MarketDataType(Enum):
    """Market data type enumeration"""

    SPOT_PRICE = "spot_price"
    BID_PRICE = "bid_price"
    ASK_PRICE = "ask_price"
    VOLUME = "volume"
    VOLATILITY = "volatility"
    INDEX_PRICE = "index_price"


class TimeFrame(Enum):
    """Time frame enumeration for price data"""

    MINUTE_1 = "1m"
    MINUTE_5 = "5m"
    MINUTE_15 = "15m"
    MINUTE_30 = "30m"
    HOUR_1 = "1h"
    HOUR_4 = "4h"
    HOUR_12 = "12h"
    DAY_1 = "1d"
    WEEK_1 = "1w"
    MONTH_1 = "1M"


class MarketData(db.Model):
    """Market data model for real-time and historical market information"""

    __tablename__ = "market_data"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    symbol = Column(String(50), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("carbon_projects.id"), nullable=True)
    vintage_year = Column(Integer, nullable=True, index=True)
    credit_standard = Column(String(50), nullable=True)
    data_type: "Column[Any]" = Column(SQLEnum(MarketDataType), nullable=False)
    value = Column(Numeric(15, 8), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    volume = Column(Numeric(15, 4), nullable=True)
    volume_usd = Column(Numeric(15, 2), nullable=True)
    bid_size = Column(Numeric(15, 4), nullable=True)
    ask_size = Column(Numeric(15, 4), nullable=True)
    bid_price = Column(Numeric(10, 4), nullable=True)
    ask_price = Column(Numeric(10, 4), nullable=True)
    spread = Column(Numeric(10, 4), nullable=True)
    spread_percentage = Column(Numeric(8, 4), nullable=True)
    high_24h = Column(Numeric(10, 4), nullable=True)
    low_24h = Column(Numeric(10, 4), nullable=True)
    change_24h = Column(Numeric(10, 4), nullable=True)
    change_percentage_24h = Column(Numeric(8, 4), nullable=True)
    data_source = Column(String(100), nullable=False)
    data_quality = Column(String(20), nullable=False, default="good")
    confidence_score = Column(Numeric(5, 2), nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    project = relationship("CarbonProject")
    __table_args__ = (
        Index("idx_market_data_symbol_timestamp", "symbol", "timestamp"),
        Index("idx_market_data_project_vintage", "project_id", "vintage_year"),
        Index("idx_market_data_type_timestamp", "data_type", "timestamp"),
    )

    @hybrid_property
    def is_recent(self) -> Any:
        """Check if data is recent (within last hour)"""
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        ts = (
            self.timestamp.replace(tzinfo=timezone.utc)
            if self.timestamp.tzinfo is None
            else self.timestamp
        )
        return ts > one_hour_ago

    @hybrid_property
    def age_minutes(self) -> Any:
        """Get age of data in minutes"""
        ts = (
            self.timestamp.replace(tzinfo=timezone.utc)
            if self.timestamp.tzinfo is None
            else self.timestamp
        )
        delta = datetime.now(timezone.utc) - ts
        return delta.total_seconds() / 60

    def to_dict(self) -> Any:
        """Convert market data to dictionary"""
        return {
            "id": self.id,
            "uuid": self.uuid,
            "symbol": self.symbol,
            "project_id": self.project_id,
            "vintage_year": self.vintage_year,
            "credit_standard": self.credit_standard,
            "data_type": self.data_type.value,
            "value": float(self.value),
            "currency": self.currency,
            "volume": float(self.volume) if self.volume else None,
            "volume_usd": float(self.volume_usd) if self.volume_usd else None,
            "bid_price": float(self.bid_price) if self.bid_price else None,
            "ask_price": float(self.ask_price) if self.ask_price else None,
            "spread": float(self.spread) if self.spread else None,
            "spread_percentage": (
                float(self.spread_percentage) if self.spread_percentage else None
            ),
            "high_24h": float(self.high_24h) if self.high_24h else None,
            "low_24h": float(self.low_24h) if self.low_24h else None,
            "change_24h": float(self.change_24h) if self.change_24h else None,
            "change_percentage_24h": (
                float(self.change_percentage_24h)
                if self.change_percentage_24h
                else None
            ),
            "data_source": self.data_source,
            "data_quality": self.data_quality,
            "confidence_score": (
                float(self.confidence_score) if self.confidence_score else None
            ),
            "timestamp": self.timestamp.isoformat(),
            "age_minutes": self.age_minutes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self) -> Any:
        return f"<MarketData {self.symbol} - {self.data_type.value}: {self.value}>"


class PriceHistory(db.Model):
    """Price history model for OHLCV data and technical analysis"""

    __tablename__ = "price_history"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    symbol = Column(String(50), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("carbon_projects.id"), nullable=True)
    vintage_year = Column(Integer, nullable=True)
    timeframe: "Column[Any]" = Column(SQLEnum(TimeFrame), nullable=False)
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    open_price = Column(Numeric(10, 4), nullable=False)
    high_price = Column(Numeric(10, 4), nullable=False)
    low_price = Column(Numeric(10, 4), nullable=False)
    close_price = Column(Numeric(10, 4), nullable=False)
    volume = Column(Numeric(15, 4), nullable=False, default=0)
    volume_usd = Column(Numeric(15, 2), nullable=False, default=0)
    vwap = Column(Numeric(10, 4), nullable=True)
    number_of_trades = Column(Integer, nullable=False, default=0)
    sma_20 = Column(Numeric(10, 4), nullable=True)
    sma_50 = Column(Numeric(10, 4), nullable=True)
    ema_12 = Column(Numeric(10, 4), nullable=True)
    ema_26 = Column(Numeric(10, 4), nullable=True)
    rsi = Column(Numeric(5, 2), nullable=True)
    bollinger_upper = Column(Numeric(10, 4), nullable=True)
    bollinger_lower = Column(Numeric(10, 4), nullable=True)
    data_completeness = Column(Numeric(5, 2), nullable=False, default=100)
    data_source = Column(String(100), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    project = relationship("CarbonProject")
    __table_args__ = (
        Index(
            "idx_price_history_symbol_timeframe_period",
            "symbol",
            "timeframe",
            "period_start",
        ),
        Index("idx_price_history_project_period", "project_id", "period_start"),
    )

    @hybrid_property
    def price_change(self) -> Any:
        """Get price change (close - open)"""
        return self.close_price - self.open_price

    @hybrid_property
    def price_change_percentage(self) -> Any:
        """Get price change percentage"""
        if self.open_price == 0:
            return 0
        return float((self.close_price - self.open_price) / self.open_price * 100)

    @hybrid_property
    def price_range(self) -> Any:
        """Get price range (high - low)"""
        return self.high_price - self.low_price

    @hybrid_property
    def is_bullish(self) -> Any:
        """Check if period was bullish (close > open)"""
        return self.close_price > self.open_price

    @hybrid_property
    def is_bearish(self) -> Any:
        """Check if period was bearish (close < open)"""
        return self.close_price < self.open_price

    def to_dict(self) -> Any:
        """Convert price history to dictionary"""
        return {
            "id": self.id,
            "uuid": self.uuid,
            "symbol": self.symbol,
            "project_id": self.project_id,
            "vintage_year": self.vintage_year,
            "timeframe": self.timeframe.value,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "open_price": float(self.open_price),
            "high_price": float(self.high_price),
            "low_price": float(self.low_price),
            "close_price": float(self.close_price),
            "volume": float(self.volume),
            "volume_usd": float(self.volume_usd),
            "vwap": float(self.vwap) if self.vwap else None,
            "number_of_trades": self.number_of_trades,
            "price_change": float(self.price_change),
            "price_change_percentage": self.price_change_percentage,
            "price_range": float(self.price_range),
            "is_bullish": self.is_bullish,
            "is_bearish": self.is_bearish,
            "currency": self.currency,
            "data_completeness": float(self.data_completeness),
            "data_source": self.data_source,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def to_ohlcv_dict(self) -> Any:
        """Convert to OHLCV format for charting"""
        return {
            "timestamp": self.period_start.isoformat(),
            "open": float(self.open_price),
            "high": float(self.high_price),
            "low": float(self.low_price),
            "close": float(self.close_price),
            "volume": float(self.volume),
        }

    def __repr__(self) -> Any:
        return f"<PriceHistory {self.symbol} {self.timeframe.value} - O:{self.open_price} H:{self.high_price} L:{self.low_price} C:{self.close_price}>"
