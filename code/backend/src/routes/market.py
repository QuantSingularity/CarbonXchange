"""
Market routes for CarbonXchange Backend
Full market data API: prices, OHLCV history, statistics, and ticker endpoints.
PriceHistory uses period_start / period_end columns (not timestamp).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, jsonify, request

from ..models.market import MarketData, MarketDataType, PriceHistory
from ..models.trading import Trade, TradeStatus

logger = logging.getLogger(__name__)
market_bp = Blueprint("market", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _aware(dt: datetime) -> datetime:
    """Ensure a datetime is timezone-aware (UTC). Fixes naive DB datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------


@market_bp.route("/data", methods=["GET"])
def get_market_data() -> Any:
    """
    Get current market data snapshots.

    Query params:
      symbol  – filter by symbol
      type    – filter by data type (spot_price, bid_price, ask_price, …)
      limit   – max results (default 50, max 200)
    """
    symbol = request.args.get("symbol")
    data_type = request.args.get("type")
    limit = min(request.args.get("limit", 50, type=int), 200)

    query = MarketData.query
    if symbol:
        query = query.filter_by(symbol=symbol)
    if data_type:
        try:
            query = query.filter(MarketData.data_type == MarketDataType(data_type))
        except ValueError:
            valid = [t.value for t in MarketDataType]
            return jsonify({"error": f"Invalid type. Valid: {valid}"}), 400

    market_data = query.order_by(MarketData.timestamp.desc()).limit(limit).all()
    return jsonify(
        {
            "market_data": [m.to_dict() for m in market_data],
            "total": len(market_data),
        }
    )


@market_bp.route("/ticker/<string:symbol>", methods=["GET"])
def get_ticker(symbol: str) -> Any:
    """Return the latest market data snapshot for a symbol."""
    entry = (
        MarketData.query.filter_by(symbol=symbol)
        .order_by(MarketData.timestamp.desc())
        .first()
    )
    if not entry:
        return jsonify({"error": f"No market data for symbol '{symbol}'"}), 404
    return jsonify({"ticker": entry.to_dict()})


# ---------------------------------------------------------------------------
# Price history  (PriceHistory uses period_start / period_end)
# ---------------------------------------------------------------------------


@market_bp.route("/prices", methods=["GET"])
def get_prices() -> Any:
    """
    Get OHLCV price history.

    Query params:
      symbol   – filter by symbol (optional)
      days     – lookback window in days (default 30)
      limit    – max records (default 100, max 500)
    """
    symbol = request.args.get("symbol")
    days = request.args.get("days", 30, type=int)
    limit = min(request.args.get("limit", 100, type=int), 500)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # PriceHistory stores dates in period_start (naive in SQLite)
    cutoff_naive = cutoff.replace(tzinfo=None)
    query = PriceHistory.query.filter(PriceHistory.period_start >= cutoff_naive)
    if symbol:
        query = query.filter_by(symbol=symbol)

    prices = query.order_by(PriceHistory.period_start.desc()).limit(limit).all()
    return jsonify(
        {
            "prices": [p.to_dict() for p in prices],
            "total": len(prices),
            "symbol": symbol,
            "days": days,
        }
    )


@market_bp.route("/prices/<string:symbol>/ohlcv", methods=["GET"])
def get_ohlcv(symbol: str) -> Any:
    """
    Return OHLCV candles for the given symbol.

    Query params:
      days   – lookback (default 30)
      limit  – candle count (default 90, max 500)
    """
    days = request.args.get("days", 30, type=int)
    limit = min(request.args.get("limit", 90, type=int), 500)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).replace(tzinfo=None)

    candles = (
        PriceHistory.query.filter(
            PriceHistory.symbol == symbol,
            PriceHistory.period_start >= cutoff,
        )
        .order_by(PriceHistory.period_start.asc())
        .limit(limit)
        .all()
    )

    if not candles:
        return jsonify({"error": f"No price history for symbol '{symbol}'"}), 404

    return jsonify(
        {
            "symbol": symbol,
            "candles": [p.to_dict() for p in candles],
            "count": len(candles),
            "from": _aware(candles[0].period_start).isoformat(),
            "to": _aware(candles[-1].period_start).isoformat(),
        }
    )


# ---------------------------------------------------------------------------
# Statistics & summary
# ---------------------------------------------------------------------------


@market_bp.route("/summary", methods=["GET"])
def get_market_summary() -> Any:
    """Get a top-level market summary."""
    try:
        latest = MarketData.query.order_by(MarketData.timestamp.desc()).first()
        if not latest:
            return jsonify({"message": "No market data available"}), 200

        return jsonify(
            {
                "latest_price": latest.to_dict(),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
    except Exception as exc:
        logger.error("Market summary error: %s", exc)
        return jsonify({"error": "Failed to get market summary"}), 500


@market_bp.route("/statistics", methods=["GET"])
def get_market_statistics() -> Any:
    """
    Return aggregate statistics over the last N days.

    Query params:
      days        – lookback window (default 30, max 365)
      credit_type – filter by credit type (optional)
    """
    days = min(request.args.get("days", 30, type=int), 365)
    credit_type = request.args.get("credit_type")

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_naive = cutoff.replace(tzinfo=None)

    query = Trade.query.filter(
        Trade.status == TradeStatus.SETTLED,
        Trade.executed_at >= cutoff_naive,
    )
    if credit_type:
        query = query.filter(Trade.credit_type == credit_type)

    trades = query.all()

    if not trades:
        return jsonify(
            {
                "error": "Insufficient data",
                "period_days": days,
                "credit_type": credit_type,
            }
        )

    prices = [float(t.price) for t in trades]
    volumes = [float(t.quantity) for t in trades]
    total_value = sum(p * v for p, v in zip(prices, volumes))
    avg_price = sum(prices) / len(prices)

    if len(prices) > 1:
        variance = sum((p - avg_price) ** 2 for p in prices) / (len(prices) - 1)
        std_dev = variance**0.5
        volatility = round(std_dev / avg_price, 6) if avg_price else 0
    else:
        std_dev = 0.0
        volatility = 0.0

    return jsonify(
        {
            "period_days": days,
            "credit_type": credit_type,
            "trade_count": len(trades),
            "average_price": round(avg_price, 4),
            "min_price": min(prices),
            "max_price": max(prices),
            "price_std_dev": round(std_dev, 4),
            "price_volatility": volatility,
            "total_volume": round(sum(volumes), 4),
            "total_value_usd": round(total_value, 2),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    )


@market_bp.route("/depth/<string:symbol>", methods=["GET"])
def get_order_book_depth(symbol: str) -> Any:
    """
    Return a simplified order-book depth snapshot for a symbol.

    Aggregates open BUY and SELL orders from the Order table.
    """
    from ..models.trading import Order, OrderSide, OrderStatus

    depth_levels = min(request.args.get("levels", 10, type=int), 50)

    bids = (
        Order.query.filter_by(status=OrderStatus.OPEN, side=OrderSide.BUY)
        .filter(Order.price.isnot(None))
        .order_by(Order.price.desc())
        .limit(depth_levels)
        .all()
    )
    asks = (
        Order.query.filter_by(status=OrderStatus.OPEN, side=OrderSide.SELL)
        .filter(Order.price.isnot(None))
        .order_by(Order.price.asc())
        .limit(depth_levels)
        .all()
    )

    return jsonify(
        {
            "symbol": symbol,
            "bids": [
                {"price": float(o.price), "quantity": float(o.remaining_quantity)}
                for o in bids
            ],
            "asks": [
                {"price": float(o.price), "quantity": float(o.remaining_quantity)}
                for o in asks
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@market_bp.route("/trades/recent", methods=["GET"])
def get_recent_trades() -> Any:
    """
    Return the most recent settled trades.

    Query params:
      limit       – max results (default 50, max 200)
      credit_type – optional filter
    """
    limit = min(request.args.get("limit", 50, type=int), 200)
    credit_type = request.args.get("credit_type")

    query = Trade.query.filter_by(status=TradeStatus.SETTLED)
    if credit_type:
        query = query.filter(Trade.credit_type == credit_type)

    trades = query.order_by(Trade.executed_at.desc()).limit(limit).all()
    return jsonify(
        {
            "trades": [t.to_dict() for t in trades],
            "total": len(trades),
        }
    )


@market_bp.route("/health", methods=["GET"])
def market_health() -> Any:
    """Return market data freshness health check."""
    latest = MarketData.query.order_by(MarketData.timestamp.desc()).first()
    if not latest:
        return jsonify({"status": "no_data"}), 200

    ts = _aware(latest.timestamp)
    age_seconds = (datetime.now(timezone.utc) - ts).total_seconds()
    status = "healthy" if age_seconds < 300 else "stale"
    return jsonify(
        {
            "status": status,
            "latest_data_age_seconds": round(age_seconds, 1),
            "latest_timestamp": ts.isoformat(),
        }
    )
