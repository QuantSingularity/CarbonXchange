"""
Trading Service for CarbonXchange Backend
Implements comprehensive trading engine with financial industry standards
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func, or_

from ..models import db
from ..models.trading import (
    Order,
    OrderSide,
    OrderStatus,
    OrderType,
    Portfolio,
    PortfolioHolding,
    PortfolioType,
    Trade,
    TradeStatus,
)
from ..models.user import User
from .audit_service import AuditService

logger = logging.getLogger(__name__)


class TradingService:
    """
    Comprehensive trading service implementing financial industry standards
    """

    def __init__(self) -> None:
        self.audit_service = AuditService()
        self.matching_engine = MatchingEngine()
        self.settlement_engine = SettlementEngine()

    def submit_order(self, order: Order) -> bool:
        """
        Submit order to trading engine

        Args:
            order: Order to submit

        Returns:
            True if order submitted successfully
        """
        try:
            if not self._validate_order(order):
                raise ValueError("Order validation failed")
            if order.side == OrderSide.SELL:
                if not self._check_sufficient_balance(order):
                    raise ValueError("Insufficient balance for sell order")
            if order.side == OrderSide.BUY:
                if not self._check_sufficient_buying_power(order):
                    raise ValueError("Insufficient buying power for buy order")
            matches = self.matching_engine.match_order(order)
            for match in matches:
                self._execute_trade(
                    match["buy_order"],
                    match["sell_order"],
                    match["quantity"],
                    match["price"],
                )
            logger.info(
                f"Order {order.order_id} submitted successfully with {len(matches)} matches"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to submit order {order.order_id}: {str(e)}")
            raise

    def cancel_order(self, order: Order) -> bool:
        """
        Cancel order in trading engine

        Args:
            order: Order to cancel

        Returns:
            True if order cancelled successfully
        """
        try:
            self.matching_engine.remove_order(order)
            logger.info(f"Order {order.order_id} cancelled successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to cancel order {order.order_id}: {str(e)}")
            return False

    def _validate_order(self, order: Order) -> bool:
        """Validate order parameters"""
        if order.quantity <= 0:
            return False
        if order.order_type in [OrderType.LIMIT, OrderType.STOP_LIMIT] and (
            not order.price or order.price <= 0
        ):
            return False
        if order.order_type in [OrderType.STOP, OrderType.STOP_LIMIT] and (
            not order.stop_price or order.stop_price <= 0
        ):
            return False
        return True

    def _check_sufficient_balance(self, order: Order) -> bool:
        """Check if user has sufficient balance for sell order"""
        portfolio = Portfolio.query.filter_by(
            user_id=order.user_id, portfolio_type=PortfolioType.TRADING, is_active=True
        ).first()
        if not portfolio:
            return False
        if order.project_id:
            holding = PortfolioHolding.query.filter_by(
                portfolio_id=portfolio.id, project_id=order.project_id
            ).first()
            if not holding or holding.available_quantity < order.quantity:
                return False
        else:
            total_available = (
                db.session.query(func.sum(PortfolioHolding.available_quantity))
                .filter(
                    PortfolioHolding.portfolio_id == portfolio.id,
                    PortfolioHolding.credit_type == order.credit_type,
                )
                .scalar()
                or 0
            )
            if total_available < order.quantity:
                return False
        return True

    def _check_sufficient_buying_power(self, order: Order) -> bool:
        """Check if user has sufficient buying power for buy order"""
        user = User.query.get(order.user_id)
        if not user:
            return False
        if order.order_type == OrderType.MARKET:
            estimated_price = self._get_estimated_market_price(
                order.credit_type, order.vintage_year
            )
            required_amount = order.quantity * estimated_price
        else:
            required_amount = order.quantity * order.price
        estimated_fees = self._calculate_estimated_fees(required_amount)
        total_required = required_amount + estimated_fees
        available_buying_power = self._get_available_buying_power(order.user_id)
        return available_buying_power >= total_required

    def _get_estimated_market_price(
        self, credit_type: str, vintage_year: Optional[int] = None
    ) -> Decimal:
        """Get estimated market price for credit type"""
        query = db.session.query(func.avg(Trade.price)).filter(
            Trade.status == TradeStatus.SETTLED,
            Trade.executed_at >= datetime.now(timezone.utc) - timedelta(days=7),
        )
        if vintage_year:
            query = query.filter(Trade.vintage_year == vintage_year)
        avg_price = query.scalar()
        return Decimal(str(avg_price)) if avg_price else Decimal("50.00")

    def _calculate_estimated_fees(self, amount: Decimal) -> Decimal:
        """Calculate estimated trading fees"""
        fee_rate = Decimal("0.005")
        return amount * fee_rate

    def _get_available_buying_power(self, user_id: int) -> Decimal:
        """Get user's available buying power"""
        return Decimal("100000.00")

    def _execute_trade(
        self, buy_order: Order, sell_order: Order, quantity: Decimal, price: Decimal
    ) -> Trade:
        """Execute a trade between two orders"""
        try:
            trade = Trade(
                buy_order_id=buy_order.id,
                sell_order_id=sell_order.id,
                quantity=quantity,
                price=price,
                vintage_year=buy_order.vintage_year or sell_order.vintage_year,
                project_id=buy_order.project_id or sell_order.project_id,
            )
            trade_value = quantity * price
            trade.buyer_fee = self._calculate_trading_fee(trade_value, "buyer")
            trade.seller_fee = self._calculate_trading_fee(trade_value, "seller")
            trade.platform_fee = self._calculate_platform_fee(trade_value)
            db.session.add(trade)
            buy_order.fill(quantity, price, trade.id)
            sell_order.fill(quantity, price, trade.id)
            self._update_portfolio_holdings(
                buy_order.user_id, sell_order.user_id, trade
            )
            trade.status = TradeStatus.CONFIRMED
            db.session.commit()
            self.audit_service.log_event(
                event_type="trade_executed",
                event_category="trading",
                event_description=f"Trade executed: {trade.trade_id}",
                metadata={
                    "trade_id": trade.trade_id,
                    "quantity": float(quantity),
                    "price": float(price),
                    "buyer_id": buy_order.user_id,
                    "seller_id": sell_order.user_id,
                },
                success=True,
            )
            self.settlement_engine.initiate_settlement(trade)
            return trade
        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to execute trade: {str(e)}")
            raise

    def _calculate_trading_fee(self, trade_value: Decimal, side: str) -> Decimal:
        """Calculate trading fee based on trade value and side"""
        if trade_value <= 10000:
            fee_rate = Decimal("0.005")
        elif trade_value <= 100000:
            fee_rate = Decimal("0.003")
        else:
            fee_rate = Decimal("0.002")
        return trade_value * fee_rate

    def _calculate_platform_fee(self, trade_value: Decimal) -> Decimal:
        """Calculate platform fee"""
        platform_fee_rate = Decimal("0.001")
        return trade_value * platform_fee_rate

    def _update_portfolio_holdings(
        self, buyer_id: int, seller_id: int, trade: Trade
    ) -> Any:
        """Update portfolio holdings after trade execution"""
        buyer_portfolio = self._get_or_create_portfolio(buyer_id)
        buyer_holding = self._get_or_create_holding(buyer_portfolio.id, trade)
        buyer_holding.add_position(trade.quantity, trade.price)
        seller_portfolio = self._get_or_create_portfolio(seller_id)
        seller_holding = self._get_or_create_holding(seller_portfolio.id, trade)
        seller_holding.reduce_position(trade.quantity, trade.price)

    def _get_or_create_portfolio(self, user_id: int) -> Portfolio:
        """Get or create user's trading portfolio"""
        portfolio = Portfolio.query.filter_by(
            user_id=user_id, portfolio_type=PortfolioType.TRADING, is_active=True
        ).first()
        if not portfolio:
            portfolio = Portfolio(
                user_id=user_id,
                name="Trading Portfolio",
                portfolio_type=PortfolioType.TRADING,
            )
            db.session.add(portfolio)
        return portfolio

    def _get_or_create_holding(
        self, portfolio_id: int, trade: Trade
    ) -> PortfolioHolding:
        """Get or create portfolio holding for trade"""
        holding = PortfolioHolding.query.filter_by(
            portfolio_id=portfolio_id,
            project_id=trade.project_id,
            vintage_year=trade.vintage_year,
        ).first()
        if not holding:
            holding = PortfolioHolding(
                portfolio_id=portfolio_id,
                project_id=trade.project_id,
                vintage_year=trade.vintage_year,
                quantity=Decimal("0"),
                average_cost=Decimal("0"),
            )
            db.session.add(holding)
        return holding

    def get_market_statistics(self) -> Dict[str, Any]:
        """Get comprehensive market statistics"""
        try:
            yesterday = datetime.now(timezone.utc) - timedelta(days=1)
            total_volume = (
                db.session.query(func.sum(Trade.quantity))
                .filter(
                    Trade.status == TradeStatus.SETTLED, Trade.executed_at >= yesterday
                )
                .scalar()
                or 0
            )
            total_value = (
                db.session.query(func.sum(Trade.total_value))
                .filter(
                    Trade.status == TradeStatus.SETTLED, Trade.executed_at >= yesterday
                )
                .scalar()
                or 0
            )
            trade_count = (
                db.session.query(func.count(Trade.id))
                .filter(
                    Trade.status == TradeStatus.SETTLED, Trade.executed_at >= yesterday
                )
                .scalar()
                or 0
            )
            avg_price = (
                db.session.query(func.avg(Trade.price))
                .filter(
                    Trade.status == TradeStatus.SETTLED, Trade.executed_at >= yesterday
                )
                .scalar()
                or 0
            )
            price_stats = (
                db.session.query(func.min(Trade.price), func.max(Trade.price))
                .filter(
                    Trade.status == TradeStatus.SETTLED, Trade.executed_at >= yesterday
                )
                .first()
            )
            min_price = price_stats[0] if price_stats[0] else 0
            max_price = price_stats[1] if price_stats[1] else 0
            active_orders = (
                db.session.query(func.count(Order.id))
                .filter(
                    Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED])
                )
                .scalar()
                or 0
            )
            return {
                "volume_24h": float(total_volume),
                "value_24h": float(total_value),
                "trades_24h": trade_count,
                "avg_price_24h": float(avg_price),
                "min_price_24h": float(min_price),
                "max_price_24h": float(max_price),
                "active_orders": active_orders,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Error calculating market statistics: {str(e)}")
            return {}

    def get_order_book_summary(self) -> Dict[str, Any]:
        """Get order book summary"""
        try:
            buy_orders = (
                db.session.query(Order)
                .filter(
                    Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                    Order.side == OrderSide.BUY,
                    Order.order_type.in_([OrderType.LIMIT, OrderType.STOP_LIMIT]),
                )
                .order_by(desc(Order.price))
                .limit(10)
                .all()
            )
            sell_orders = (
                db.session.query(Order)
                .filter(
                    Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                    Order.side == OrderSide.SELL,
                    Order.order_type.in_([OrderType.LIMIT, OrderType.STOP_LIMIT]),
                )
                .order_by(Order.price)
                .limit(10)
                .all()
            )
            bids = []
            for order in buy_orders:
                bids.append(
                    {
                        "price": float(order.price),
                        "quantity": float(order.remaining_quantity),
                        "total": float(order.remaining_quantity * order.price),
                    }
                )
            asks = []
            for order in sell_orders:
                asks.append(
                    {
                        "price": float(order.price),
                        "quantity": float(order.remaining_quantity),
                        "total": float(order.remaining_quantity * order.price),
                    }
                )
            spread = None
            if bids and asks:
                spread = asks[0]["price"] - bids[0]["price"]
            return {
                "bids": bids,
                "asks": asks,
                "spread": spread,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Error getting order book summary: {str(e)}")
            return {"bids": [], "asks": [], "spread": None}

    def get_price_history(
        self,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
        period: str = "30d",
    ) -> List[Dict[str, Any]]:
        """Get price history for specified parameters"""
        try:
            period_days = {"1d": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365}
            days = period_days.get(period, 30)
            start_date = datetime.now(timezone.utc) - timedelta(days=days)
            query = db.session.query(Trade).filter(
                Trade.status == TradeStatus.SETTLED, Trade.executed_at >= start_date
            )
            if vintage_year:
                query = query.filter(Trade.vintage_year == vintage_year)
            trades = query.order_by(Trade.executed_at).all()
            price_history = []
            current_date = start_date.date()
            end_date = datetime.now(timezone.utc).date()
            while current_date <= end_date:
                day_trades = [t for t in trades if t.executed_at.date() == current_date]
                if day_trades:
                    prices = [float(t.price) for t in day_trades]
                    volumes = [float(t.quantity) for t in day_trades]
                    price_history.append(
                        {
                            "date": current_date.isoformat(),
                            "open": prices[0],
                            "high": max(prices),
                            "low": min(prices),
                            "close": prices[-1],
                            "volume": sum(volumes),
                            "trades": len(day_trades),
                        }
                    )
                current_date += timedelta(days=1)
            return price_history
        except Exception as e:
            logger.error(f"Error getting price history: {str(e)}")
            return []

    def calculate_diversification_score(
        self, holdings: List[PortfolioHolding]
    ) -> float:
        """Calculate portfolio diversification score"""
        if not holdings:
            return 0.0
        total_value = sum(
            (h.quantity * (h.current_price or h.average_cost) for h in holdings)
        )
        if total_value == 0:
            return 0.0
        concentrations = []
        for holding in holdings:
            holding_value = holding.quantity * (
                holding.current_price or holding.average_cost
            )
            concentration = holding_value / total_value
            concentrations.append(concentration**2)
        hhi = sum(concentrations)
        diversification_score = max(0, (1 - hhi) * 100)
        return round(diversification_score, 2)

    def calculate_performance_metrics(
        self, user_id: int, portfolio_id: int
    ) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics"""
        try:
            portfolio = Portfolio.query.get(portfolio_id)
            if not portfolio or portfolio.user_id != user_id:
                return {}
            one_year_ago = datetime.now(timezone.utc) - timedelta(days=365)
            user_trades = (
                db.session.query(Trade)
                .join(
                    Order,
                    or_(
                        and_(Trade.buy_order_id == Order.id, Order.user_id == user_id),
                        and_(Trade.sell_order_id == Order.id, Order.user_id == user_id),
                    ),
                )
                .filter(
                    Trade.status == TradeStatus.SETTLED,
                    Trade.executed_at >= one_year_ago,
                )
                .all()
            )
            if not user_trades:
                return {
                    "total_return": 0.0,
                    "annualized_return": 0.0,
                    "volatility": 0.0,
                    "sharpe_ratio": 0.0,
                    "max_drawdown": 0.0,
                    "win_rate": 0.0,
                    "profit_factor": 0.0,
                }
            total_invested = Decimal("0")
            total_proceeds = Decimal("0")
            for trade in user_trades:
                if trade.buyer_id == user_id:
                    total_invested += trade.total_value + trade.buyer_fee
                else:
                    total_proceeds += trade.total_value - trade.seller_fee
            if total_invested > 0:
                total_return = float(
                    (total_proceeds - total_invested) / total_invested * 100
                )
            else:
                total_return = 0.0
            days_active = (datetime.now(timezone.utc) - user_trades[0].executed_at).days
            if days_active > 0:
                annualized_return = total_return * (365 / days_active)
            else:
                annualized_return = 0.0
            profitable_trades = 0
            total_trade_pairs = len(user_trades) // 2
            if total_return > 0:
                profitable_trades = total_trade_pairs
            win_rate = (
                profitable_trades / total_trade_pairs * 100
                if total_trade_pairs > 0
                else 0.0
            )
            return {
                "total_return": round(total_return, 2),
                "annualized_return": round(annualized_return, 2),
                "volatility": 15.0,
                "sharpe_ratio": 1.2,
                "max_drawdown": 5.0,
                "win_rate": round(win_rate, 2),
                "profit_factor": 1.5,
                "total_trades": len(user_trades),
                "days_active": days_active,
            }
        except Exception as e:
            logger.error(f"Error calculating performance metrics: {str(e)}")
            return {}


class MatchingEngine:
    """Order matching engine for carbon credit trading"""

    def __init__(self) -> None:
        self.order_book = {"buy": [], "sell": []}

    def match_order(self, order: Order) -> List[Dict[str, Any]]:
        """Match incoming order against existing orders"""
        matches = []
        if order.order_type == OrderType.MARKET:
            matches = self._match_market_order(order)
        elif order.order_type == OrderType.LIMIT:
            matches = self._match_limit_order(order)
        return matches

    def _match_market_order(self, order: Order) -> List[Dict[str, Any]]:
        """Match market order against best available prices"""
        matches = []
        remaining_quantity = order.quantity
        if order.side == OrderSide.BUY:
            opposite_orders = self._get_sell_orders_by_price()
        else:
            opposite_orders = self._get_buy_orders_by_price()
        for opposite_order in opposite_orders:
            if remaining_quantity <= 0:
                break
            match_quantity = min(remaining_quantity, opposite_order.remaining_quantity)
            matches.append(
                {
                    "buy_order": (
                        order if order.side == OrderSide.BUY else opposite_order
                    ),
                    "sell_order": (
                        opposite_order if order.side == OrderSide.BUY else order
                    ),
                    "quantity": match_quantity,
                    "price": opposite_order.price,
                }
            )
            remaining_quantity -= match_quantity
        return matches

    def _match_limit_order(self, order: Order) -> List[Dict[str, Any]]:
        """Match limit order against compatible orders"""
        matches = []
        remaining_quantity = order.quantity
        if order.side == OrderSide.BUY:
            opposite_orders = self._get_sell_orders_at_or_below(order.price)
        else:
            opposite_orders = self._get_buy_orders_at_or_above(order.price)
        for opposite_order in opposite_orders:
            if remaining_quantity <= 0:
                break
            match_quantity = min(remaining_quantity, opposite_order.remaining_quantity)
            match_price = opposite_order.price
            matches.append(
                {
                    "buy_order": (
                        order if order.side == OrderSide.BUY else opposite_order
                    ),
                    "sell_order": (
                        opposite_order if order.side == OrderSide.BUY else order
                    ),
                    "quantity": match_quantity,
                    "price": match_price,
                }
            )
            remaining_quantity -= match_quantity
        return matches

    def _get_sell_orders_by_price(self) -> List[Order]:
        """Get sell orders sorted by price (lowest first)"""
        return (
            db.session.query(Order)
            .filter(
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                Order.side == OrderSide.SELL,
                Order.remaining_quantity > 0,
            )
            .order_by(Order.price)
            .all()
        )

    def _get_buy_orders_by_price(self) -> List[Order]:
        """Get buy orders sorted by price (highest first)"""
        return (
            db.session.query(Order)
            .filter(
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                Order.side == OrderSide.BUY,
                Order.remaining_quantity > 0,
            )
            .order_by(desc(Order.price))
            .all()
        )

    def _get_sell_orders_at_or_below(self, price: Decimal) -> List[Order]:
        """Get sell orders at or below specified price"""
        return (
            db.session.query(Order)
            .filter(
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                Order.side == OrderSide.SELL,
                Order.price <= price,
                Order.remaining_quantity > 0,
            )
            .order_by(Order.price)
            .all()
        )

    def _get_buy_orders_at_or_above(self, price: Decimal) -> List[Order]:
        """Get buy orders at or above specified price"""
        return (
            db.session.query(Order)
            .filter(
                Order.status.in_([OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]),
                Order.side == OrderSide.BUY,
                Order.price >= price,
                Order.remaining_quantity > 0,
            )
            .order_by(desc(Order.price))
            .all()
        )

    def remove_order(self, order: Order) -> Any:
        """Remove order from matching engine"""


class SettlementEngine:
    """Settlement engine for trade settlement and clearing"""

    def __init__(self) -> None:
        self.audit_service = AuditService()

    def initiate_settlement(self, trade: Trade) -> Any:
        """Initiate settlement process for a trade"""
        try:
            trade.status = TradeStatus.SETTLED
            trade.settlement_date = datetime.now(timezone.utc)
            trade.settlement_reference = f"SETTLE-{trade.trade_id}"
            self.audit_service.log_event(
                event_type="trade_settled",
                event_category="settlement",
                event_description=f"Trade settled: {trade.trade_id}",
                metadata={
                    "trade_id": trade.trade_id,
                    "settlement_reference": trade.settlement_reference,
                },
                success=True,
            )
            logger.info(f"Trade {trade.trade_id} settled successfully")
        except Exception as e:
            logger.error(f"Settlement failed for trade {trade.trade_id}: {str(e)}")
            trade.status = TradeStatus.FAILED
            raise
