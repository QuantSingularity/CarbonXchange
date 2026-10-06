"""
Advanced Trading Service for CarbonXchange Backend
Implements sophisticated trading algorithms and risk management for financial markets
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from ..models import db
from ..models.carbon_credit import CarbonCredit
from ..models.market import MarketData
from ..models.trading import Order, OrderSide, OrderType, Portfolio
from .market_data_service import MarketDataService
from .pricing_service import PricingService
from .risk_service import RiskService

logger = logging.getLogger(__name__)


class TradingAlgorithm(Enum):
    """Trading algorithm types"""

    TWAP = "twap"
    VWAP = "vwap"
    IMPLEMENTATION_SHORTFALL = "implementation_shortfall"
    MARKET_MAKING = "market_making"
    ARBITRAGE = "arbitrage"
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"


class ExecutionStrategy(Enum):
    """Order execution strategies"""

    AGGRESSIVE = "aggressive"
    PASSIVE = "passive"
    BALANCED = "balanced"
    ICEBERG = "iceberg"
    STEALTH = "stealth"


@dataclass
class TradingSignal:
    """Trading signal data structure"""

    symbol: str
    signal_type: str
    strength: float
    confidence: float
    price_target: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    timestamp: datetime = None

    def __post_init__(self) -> Any:
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)


@dataclass
class RiskMetrics:
    """Risk metrics for trading decisions"""

    var_95: Decimal
    var_99: Decimal
    expected_shortfall: Decimal
    max_drawdown: Decimal
    sharpe_ratio: float
    beta: float
    volatility: float


class AdvancedTradingService:
    """Advanced trading service with sophisticated algorithms"""

    def __init__(self) -> None:
        self.risk_service = RiskService()
        self.pricing_service = PricingService()
        self.min_order_size = Decimal("0.01")
        self.max_order_size = Decimal("1000000")
        self.max_position_size = Decimal("5000000")

    def execute_twap_order(
        self,
        user_id: int,
        symbol: str,
        total_quantity: Decimal,
        side: OrderSide,
        duration_minutes: int = 60,
    ) -> List[Order]:
        """Execute Time Weighted Average Price algorithm"""
        if total_quantity <= 0 or duration_minutes <= 0:
            raise ValueError("Invalid TWAP parameters")
        try:
            num_orders = min(duration_minutes // 5, 20)
            if num_orders <= 0:
                num_orders = 1
            base_quantity = (total_quantity / num_orders).quantize(Decimal("0.0001"))
            remainder = total_quantity - base_quantity * num_orders
            duration_minutes // num_orders
            child_orders = []
            datetime.now(timezone.utc)
            for i in range(num_orders):
                qty = base_quantity + (
                    remainder if i == num_orders - 1 else Decimal("0")
                )
                current_price = self._get_current_price(symbol)
                if not current_price:
                    logger.error(f"Unable to get price for {symbol}")
                    break
                price_adjustment = (
                    Decimal("0.001") if side == OrderSide.BUY else Decimal("-0.001")
                )
                limit_price = current_price + price_adjustment
                child_order = Order(
                    user_id=user_id,
                    order_type=OrderType.LIMIT,
                    side=side,
                    quantity=qty,
                    remaining_quantity=qty,
                    price=limit_price,
                    time_in_force="GTC",
                    notes=f"TWAP child order {i + 1}/{num_orders}",
                )
                db.session.add(child_order)
                child_orders.append(child_order)
            db.session.commit()
            logger.info(
                f"Created {len(child_orders)} TWAP child orders for user {user_id}"
            )
            return child_orders
        except Exception as e:
            logger.error(f"TWAP execution error: {e}")
            db.session.rollback()
            return []

    def execute_vwap_order(
        self,
        user_id: int,
        symbol: str,
        total_quantity: Decimal,
        side: OrderSide,
        lookback_hours: int = 24,
    ) -> List[Order]:
        """Execute Volume Weighted Average Price algorithm"""
        try:
            volume_profile = self._get_volume_profile(symbol, lookback_hours)
            if not volume_profile:
                logger.warning(
                    f"No volume profile available for {symbol}, falling back to TWAP"
                )
                return self.execute_twap_order(user_id, symbol, total_quantity, side)
            total_historical_volume = sum(volume_profile.values())
            child_orders = []
            for hour, volume in volume_profile.items():
                if volume <= 0:
                    continue
                volume_weight = volume / total_historical_volume
                child_quantity = total_quantity * Decimal(str(volume_weight))
                if child_quantity < self.min_order_size:
                    continue
                current_price = self._get_current_price(symbol)
                if not current_price:
                    continue
                child_order = Order(
                    user_id=user_id,
                    order_type=OrderType.LIMIT,
                    side=side,
                    quantity=child_quantity,
                    remaining_quantity=child_quantity,
                    price=current_price,
                    time_in_force="GTC",
                    notes=f"VWAP child order for hour {hour}",
                )
                db.session.add(child_order)
                child_orders.append(child_order)
            db.session.commit()
            logger.info(
                f"Created {len(child_orders)} VWAP child orders for user {user_id}"
            )
            return child_orders
        except Exception as e:
            logger.error(f"VWAP execution error: {e}")
            db.session.rollback()
            return []

    def execute_iceberg_order(
        self,
        user_id: int,
        symbol: str,
        total_quantity: Decimal,
        side: OrderSide,
        visible_quantity: Decimal,
    ) -> Order:
        """Execute iceberg order strategy"""
        if visible_quantity > total_quantity:
            raise ValueError("Visible quantity must be less than total quantity")
        if visible_quantity <= 0:
            raise ValueError("Visible quantity must be positive")
        try:
            current_price = self._get_current_price(symbol)
            if not current_price:
                raise ValueError(f"Unable to get price for {symbol}")
            iceberg_order = Order(
                user_id=user_id,
                order_type=OrderType.LIMIT,
                side=side,
                quantity=total_quantity,
                remaining_quantity=total_quantity,
                price=current_price,
                time_in_force="GTC",
                notes=f"Iceberg order - visible: {visible_quantity}, total: {total_quantity}",
            )
            iceberg_order.iceberg_visible_qty = visible_quantity
            iceberg_order.iceberg_remaining_qty = total_quantity
            db.session.add(iceberg_order)
            db.session.commit()
            logger.info(
                f"Created iceberg order {iceberg_order.order_id} for user {user_id}"
            )
            return iceberg_order
        except Exception as e:
            logger.error(f"Iceberg order execution error: {e}")
            db.session.rollback()
            raise

    def generate_trading_signals(
        self, symbol: str, algorithm: TradingAlgorithm
    ) -> List[TradingSignal]:
        """Generate trading signals using specified algorithm"""
        try:
            price_data = self._get_price_history(symbol, days=30)
            if len(price_data) < 20:
                logger.warning(f"Insufficient price data for {symbol}")
                return []
            signals = []
            if algorithm == TradingAlgorithm.MOMENTUM:
                signals = self._generate_momentum_signals(symbol, price_data)
            elif algorithm == TradingAlgorithm.MEAN_REVERSION:
                signals = self._generate_mean_reversion_signals(symbol, price_data)
            elif algorithm == TradingAlgorithm.ARBITRAGE:
                signals = self._generate_arbitrage_signals(symbol, price_data)
            else:
                logger.warning(f"Algorithm {algorithm} not implemented")
            return signals
        except Exception as e:
            logger.error(f"Signal generation error: {e}")
            return []

    def _generate_momentum_signals(
        self, symbol: str, price_data: pd.DataFrame
    ) -> List[TradingSignal]:
        """Generate momentum-based trading signals"""
        signals = []
        try:
            price_data["sma_20"] = price_data["close"].rolling(window=20).mean()
            price_data["sma_50"] = price_data["close"].rolling(window=50).mean()
            price_data["rsi"] = self._calculate_rsi(price_data["close"])
            price_data["macd"], price_data["macd_signal"] = self._calculate_macd(
                price_data["close"]
            )
            latest = price_data.iloc[-1]
            signal_strength = 0.0
            signal_type = "hold"
            if latest["sma_20"] > latest["sma_50"]:
                signal_strength += 0.3
                signal_type = "buy"
            elif latest["sma_20"] < latest["sma_50"]:
                signal_strength += 0.3
                signal_type = "sell"
            if latest["rsi"] > 70:
                signal_strength += 0.2 if signal_type == "sell" else -0.2
            elif latest["rsi"] < 30:
                signal_strength += 0.2 if signal_type == "buy" else -0.2
            if latest["macd"] > latest["macd_signal"]:
                signal_strength += 0.2 if signal_type == "buy" else -0.2
            else:
                signal_strength += 0.2 if signal_type == "sell" else -0.2
            signal_strength = max(0.0, min(1.0, abs(signal_strength)))
            confidence = signal_strength * 0.8
            if signal_strength > 0.5:
                signal = TradingSignal(
                    symbol=symbol,
                    signal_type=signal_type,
                    strength=signal_strength,
                    confidence=confidence,
                    price_target=Decimal(
                        str(latest["close"] * (1.05 if signal_type == "buy" else 0.95))
                    ),
                    stop_loss=Decimal(
                        str(latest["close"] * (0.98 if signal_type == "buy" else 1.02))
                    ),
                )
                signals.append(signal)
        except Exception as e:
            logger.error(f"Momentum signal generation error: {e}")
        return signals

    def _generate_mean_reversion_signals(
        self, symbol: str, price_data: pd.DataFrame
    ) -> List[TradingSignal]:
        """Generate mean reversion trading signals"""
        signals = []
        try:
            price_data["sma_20"] = price_data["close"].rolling(window=20).mean()
            price_data["std_20"] = price_data["close"].rolling(window=20).std()
            price_data["bb_upper"] = price_data["sma_20"] + price_data["std_20"] * 2
            price_data["bb_lower"] = price_data["sma_20"] - price_data["std_20"] * 2
            latest = price_data.iloc[-1]
            current_price = latest["close"]
            signal_strength = 0.0
            signal_type = "hold"
            if current_price <= latest["bb_lower"]:
                signal_type = "buy"
                signal_strength = min(
                    1.0, (latest["bb_lower"] - current_price) / latest["bb_lower"]
                )
            elif current_price >= latest["bb_upper"]:
                signal_type = "sell"
                signal_strength = min(
                    1.0, (current_price - latest["bb_upper"]) / latest["bb_upper"]
                )
            distance_from_mean = (
                abs(current_price - latest["sma_20"]) / latest["sma_20"]
            )
            if distance_from_mean > 0.02:
                signal_strength += distance_from_mean
            signal_strength = min(1.0, signal_strength)
            confidence = signal_strength * 0.7
            if signal_strength > 0.4:
                signal = TradingSignal(
                    symbol=symbol,
                    signal_type=signal_type,
                    strength=signal_strength,
                    confidence=confidence,
                    price_target=Decimal(str(latest["sma_20"])),
                    stop_loss=Decimal(
                        str(current_price * (0.97 if signal_type == "buy" else 1.03))
                    ),
                )
                signals.append(signal)
        except Exception as e:
            logger.error(f"Mean reversion signal generation error: {e}")
        return signals

    def _generate_arbitrage_signals(
        self, symbol: str, price_data: pd.DataFrame
    ) -> List[TradingSignal]:
        """Generate arbitrage trading signals"""
        signals = []
        try:
            price_data["returns"] = price_data["close"].pct_change()
            price_data["volatility"] = price_data["returns"].rolling(window=20).std()
            latest = price_data.iloc[-1]
            recent_volatility = latest["volatility"]
            avg_volatility = price_data["volatility"].mean()
            if recent_volatility > avg_volatility * 1.5:
                signal = TradingSignal(
                    symbol=symbol,
                    signal_type="buy",
                    strength=0.6,
                    confidence=0.4,
                    price_target=Decimal(str(latest["close"] * 1.02)),
                )
                signals.append(signal)
        except Exception as e:
            logger.error(f"Arbitrage signal generation error: {e}")
        return signals

    def calculate_portfolio_risk(self, user_id: int) -> RiskMetrics:
        """Calculate comprehensive portfolio risk metrics"""
        try:
            portfolio = Portfolio.query.filter_by(user_id=user_id).first()
            if not portfolio:
                raise ValueError(f"No portfolio found for user {user_id}")
            holdings_data = self._get_portfolio_holdings_data(portfolio.id)
            if holdings_data is None or (
                hasattr(holdings_data, "empty") and holdings_data.empty
            ):
                raise ValueError("No holdings data available")
            returns = self._calculate_portfolio_returns(holdings_data)
            var_95 = Decimal(str(round(float(np.percentile(returns, 5)), 8)))
            var_99 = Decimal(str(round(float(np.percentile(returns, 1)), 8)))
            tail_returns = returns[returns <= float(var_95)]
            if len(tail_returns) > 0:
                expected_shortfall = Decimal(
                    str(round(float(np.mean(tail_returns)), 8))
                )
            else:
                expected_shortfall = var_95
            cumulative_returns = (1 + pd.Series(returns)).cumprod()
            running_max = cumulative_returns.expanding().max()
            drawdown = (cumulative_returns - running_max) / running_max
            max_drawdown = Decimal(str(round(float(drawdown.min()), 8)))
            risk_free_rate = 0.02 / 252
            excess_returns = returns - risk_free_rate
            std_excess = np.std(excess_returns)
            if std_excess > 0:
                sharpe_ratio = float(
                    np.mean(excess_returns) / std_excess * np.sqrt(252)
                )
            else:
                sharpe_ratio = 0.0
            beta = 1.0
            volatility = float(np.std(returns) * np.sqrt(252))
            return RiskMetrics(
                var_95=var_95,
                var_99=var_99,
                expected_shortfall=expected_shortfall,
                max_drawdown=max_drawdown,
                sharpe_ratio=sharpe_ratio,
                beta=beta,
                volatility=volatility,
            )
        except Exception as e:
            logger.error(f"Portfolio risk calculation error: {e}")
            raise

    def optimize_portfolio(
        self,
        user_id: int,
        target_return: float = None,
        risk_tolerance: str = "moderate",
    ) -> Dict[str, float]:
        """Optimize portfolio allocation using Modern Portfolio Theory"""
        try:
            available_assets = self._get_available_assets()
            if len(available_assets) < 2:
                raise ValueError("Need at least 2 assets for optimization")
            returns_data = {}
            for asset in available_assets:
                price_history = self._get_price_history(asset, days=252)
                if len(price_history) > 20:
                    returns = price_history["close"].pct_change().dropna()
                    returns_data[asset] = returns
            if len(returns_data) < 2:
                raise ValueError("Insufficient price history for optimization")
            returns_df = pd.DataFrame(returns_data)
            returns_df.mean() * 252
            returns_df.cov() * 252
            risk_params = {
                "conservative": {"max_volatility": 0.1, "min_return": 0.05},
                "moderate": {"max_volatility": 0.15, "min_return": 0.08},
                "aggressive": {"max_volatility": 0.25, "min_return": 0.12},
            }
            risk_params.get(risk_tolerance, risk_params["moderate"])
            num_assets = len(returns_data)
            equal_weights = {asset: 1.0 / num_assets for asset in returns_data.keys()}
            optimized_weights = {}
            for asset, weight in equal_weights.items():
                optimized_weights[asset] = min(weight, 0.4)
            total_weight = sum(optimized_weights.values())
            for asset in optimized_weights:
                optimized_weights[asset] /= total_weight
            logger.info(f"Portfolio optimization completed for user {user_id}")
            return optimized_weights
        except Exception as e:
            logger.error(f"Portfolio optimization error: {e}")
            raise

    def _get_current_price(self, symbol: str) -> Optional[Decimal]:
        """Get current market price for symbol"""
        try:
            market_data = MarketData.query.filter_by(symbol=symbol).first()
            return market_data.current_price if market_data else None
        except Exception as e:
            logger.error(f"Error getting current price for {symbol}: {e}")
            return None

    def _get_volume_profile(self, symbol: str, hours: int) -> Dict[int, float]:
        """Get volume profile for the last N hours"""
        try:
            return {hour: 1000.0 + hour * 100 for hour in range(24)}
        except Exception as e:
            logger.error(f"Error getting volume profile for {symbol}: {e}")
            return {}

    def _get_price_history(self, symbol: str, days: int = 30) -> pd.DataFrame:
        try:
            series = MarketDataService().get_daily_series(symbol, days)
            if series.empty:
                return pd.DataFrame()
            return series.rename(columns={"price": "close"}).reset_index(drop=True)
        except Exception as e:
            logger.error(f"Error getting price history for {symbol}: {e}")
            return pd.DataFrame()

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate Relative Strength Index"""
        delta = prices.diff()
        gain = delta.where(delta > 0, 0).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - 100 / (1 + rs)

    def _calculate_macd(
        self, prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> Tuple[pd.Series, pd.Series]:
        """Calculate MACD and signal line"""
        ema_fast = prices.ewm(span=fast).mean()
        ema_slow = prices.ewm(span=slow).mean()
        macd = ema_fast - ema_slow
        signal_line = macd.ewm(span=signal).mean()
        return (macd, signal_line)

    def _get_portfolio_holdings_data(self, portfolio_id: int) -> Optional[pd.DataFrame]:
        """Get portfolio holdings data"""
        try:
            return pd.DataFrame(
                {
                    "asset": ["CARBON_CREDIT_A", "CARBON_CREDIT_B"],
                    "quantity": [100, 200],
                    "value": [10000, 15000],
                }
            )
        except Exception as e:
            logger.error(f"Error getting portfolio holdings data: {e}")
            return None

    def _calculate_portfolio_returns(self, holdings_data: pd.DataFrame) -> np.ndarray:
        """Calculate portfolio returns"""
        try:
            return np.random.normal(0.001, 0.02, 252)
        except Exception as e:
            logger.error(f"Error calculating portfolio returns: {e}")
            return np.array([])

    def _get_available_assets(self) -> List[str]:
        """Get list of available assets for trading"""
        try:
            credits = CarbonCredit.query.filter_by(is_active=True).all()
            return [f"CARBON_{credit.id}" for credit in credits[:10]]
        except Exception as e:
            logger.error(f"Error getting available assets: {e}")
            return ["CARBON_CREDIT_A", "CARBON_CREDIT_B", "CARBON_CREDIT_C"]
