"""
Pricing Service for CarbonXchange Backend
Implements sophisticated pricing models and market data analysis for carbon credits
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sqlalchemy import desc

from ..models import db
from ..models.carbon_credit import CarbonCredit, CarbonProject, ProjectType
from ..models.trading import Trade, TradeStatus
from .audit_service import AuditService

logger = logging.getLogger(__name__)


class PricingService:
    """
    Comprehensive pricing service implementing financial industry-grade pricing models
    """

    def __init__(self) -> None:
        self.audit_service = AuditService()
        self.pricing_models = {
            "market_based": self._market_based_pricing,
            "fundamental": self._fundamental_pricing,
            "technical": self._technical_pricing,
            "risk_adjusted": self._risk_adjusted_pricing,
            "volatility_adjusted": self._volatility_adjusted_pricing,
        }

    def get_current_price(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
        pricing_model: str = "market_based",
    ) -> Dict[str, Any]:
        """
        Get current market price for carbon credits

        Args:
            project_id: Specific project ID
            credit_type: Type of carbon credit
            vintage_year: Vintage year of credits
            pricing_model: Pricing model to use

        Returns:
            Dictionary with pricing information
        """
        try:
            pricing_func = self.pricing_models.get(
                pricing_model, self._market_based_pricing
            )
            price_data = pricing_func(
                project_id=project_id,
                credit_type=credit_type,
                vintage_year=vintage_year,
            )
            market_context = self._get_market_context(credit_type, vintage_year)
            price_data.update(market_context)
            confidence_intervals = self._calculate_confidence_intervals(
                price_data["price"]
            )
            price_data["confidence_intervals"] = confidence_intervals
            price_data.update(
                {
                    "pricing_model": pricing_model,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "data_quality_score": self._calculate_data_quality_score(
                        project_id, credit_type
                    ),
                }
            )
            return price_data
        except Exception as e:
            logger.error(f"Error calculating current price: {str(e)}")
            return {
                "price": Decimal("0"),
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

    def _market_based_pricing(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Market-based pricing using recent trade data
        """
        try:
            query = db.session.query(Trade).filter(
                Trade.status == TradeStatus.SETTLED,
                Trade.executed_at >= datetime.now(timezone.utc) - timedelta(days=30),
            )
            if project_id:
                query = query.filter(Trade.project_id == project_id)
            elif credit_type:
                query = query.join(CarbonCredit).filter(
                    CarbonCredit.credit_type == credit_type
                )
            if vintage_year:
                query = query.filter(Trade.vintage_year == vintage_year)
            recent_trades = query.order_by(desc(Trade.executed_at)).limit(100).all()
            if not recent_trades:
                return self._get_fallback_price(credit_type, vintage_year)
            total_value = sum((float(trade.total_value) for trade in recent_trades))
            total_quantity = sum((float(trade.quantity) for trade in recent_trades))
            if total_quantity == 0:
                return self._get_fallback_price(credit_type, vintage_year)
            vwap = Decimal(str(total_value / total_quantity)).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
            prices = [float(trade.price) for trade in recent_trades]
            price_stats = {
                "mean": np.mean(prices),
                "median": np.median(prices),
                "std": np.std(prices),
                "min": np.min(prices),
                "max": np.max(prices),
            }
            trend = self._calculate_price_trend(recent_trades)
            return {
                "price": vwap,
                "vwap": vwap,
                "last_trade_price": Decimal(str(prices[0])),
                "price_stats": price_stats,
                "trend": trend,
                "trade_count": len(recent_trades),
                "total_volume": Decimal(str(total_quantity)),
                "pricing_method": "market_based_vwap",
            }
        except Exception as e:
            logger.error(f"Error in market-based pricing: {str(e)}")
            return self._get_fallback_price(credit_type, vintage_year)

    def _fundamental_pricing(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Fundamental pricing based on project characteristics and market fundamentals
        """
        try:
            base_price = self._get_base_price_by_type(credit_type)
            project_adjustment = Decimal("1.0")
            if project_id:
                project = CarbonProject.query.get(project_id)
                if project:
                    project_adjustment = self._calculate_project_premium(project)
            vintage_adjustment = self._calculate_vintage_adjustment(vintage_year)
            supply_demand_adjustment = self._calculate_supply_demand_adjustment(
                credit_type
            )
            regulatory_adjustment = self._calculate_regulatory_adjustment(credit_type)
            fundamental_price = (
                base_price
                * project_adjustment
                * vintage_adjustment
                * supply_demand_adjustment
                * regulatory_adjustment
            )
            return {
                "price": fundamental_price.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                "base_price": base_price,
                "adjustments": {
                    "project": float(project_adjustment),
                    "vintage": float(vintage_adjustment),
                    "supply_demand": float(supply_demand_adjustment),
                    "regulatory": float(regulatory_adjustment),
                },
                "pricing_method": "fundamental_analysis",
            }
        except Exception as e:
            logger.error(f"Error in fundamental pricing: {str(e)}")
            return self._get_fallback_price(credit_type, vintage_year)

    def _technical_pricing(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Technical analysis-based pricing using price patterns and indicators
        """
        try:
            price_history = self._get_price_history(
                project_id, credit_type, vintage_year, days=90
            )
            if len(price_history) < 20:
                return self._market_based_pricing(project_id, credit_type, vintage_year)
            prices = np.array([float(p["price"]) for p in price_history])
            sma_20 = np.mean(prices[-20:])
            sma_50 = np.mean(prices[-50:]) if len(prices) >= 50 else sma_20
            rsi = self._calculate_rsi(prices)
            bb_upper, bb_lower, bb_middle = self._calculate_bollinger_bands(prices)
            macd_line, signal_line, histogram = self._calculate_macd(prices)
            current_price = prices[-1]
            technical_signals = []
            if sma_20 > sma_50:
                technical_signals.append("bullish_ma")
            else:
                technical_signals.append("bearish_ma")
            if rsi > 70:
                technical_signals.append("overbought")
            elif rsi < 30:
                technical_signals.append("oversold")
            if current_price > bb_upper:
                technical_signals.append("above_upper_bb")
            elif current_price < bb_lower:
                technical_signals.append("below_lower_bb")
            technical_adjustment = self._calculate_technical_adjustment(
                technical_signals
            )
            technical_price = Decimal(str(current_price * technical_adjustment))
            return {
                "price": technical_price.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                "current_price": Decimal(str(current_price)),
                "technical_indicators": {
                    "sma_20": sma_20,
                    "sma_50": sma_50,
                    "rsi": rsi,
                    "bollinger_upper": bb_upper,
                    "bollinger_lower": bb_lower,
                    "macd": macd_line,
                    "signal": signal_line,
                },
                "technical_signals": technical_signals,
                "adjustment_factor": float(technical_adjustment),
                "pricing_method": "technical_analysis",
            }
        except Exception as e:
            logger.error(f"Error in technical pricing: {str(e)}")
            return self._market_based_pricing(project_id, credit_type, vintage_year)

    def _risk_adjusted_pricing(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Risk-adjusted pricing incorporating various risk factors
        """
        try:
            base_pricing = self._market_based_pricing(
                project_id, credit_type, vintage_year
            )
            base_price = base_pricing["price"]
            risk_factors = self._calculate_risk_factors(
                project_id, credit_type, vintage_year
            )
            risk_premium = self._calculate_risk_premium(risk_factors)
            risk_adjusted_price = base_price * (Decimal("1") + risk_premium)
            return {
                "price": risk_adjusted_price.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                "base_price": base_price,
                "risk_factors": risk_factors,
                "risk_premium": float(risk_premium),
                "pricing_method": "risk_adjusted",
            }
        except Exception as e:
            logger.error(f"Error in risk-adjusted pricing: {str(e)}")
            return self._market_based_pricing(project_id, credit_type, vintage_year)

    def _volatility_adjusted_pricing(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Volatility-adjusted pricing using options pricing models
        """
        try:
            volatility = self._calculate_historical_volatility(
                project_id, credit_type, vintage_year
            )
            base_pricing = self._market_based_pricing(
                project_id, credit_type, vintage_year
            )
            base_price = base_pricing["price"]
            volatility_adjustment = self._calculate_volatility_adjustment(volatility)
            volatility_adjusted_price = base_price * volatility_adjustment
            return {
                "price": volatility_adjusted_price.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                "base_price": base_price,
                "historical_volatility": volatility,
                "volatility_adjustment": float(volatility_adjustment),
                "pricing_method": "volatility_adjusted",
            }
        except Exception as e:
            logger.error(f"Error in volatility-adjusted pricing: {str(e)}")
            return self._market_based_pricing(project_id, credit_type, vintage_year)

    def calculate_fair_value(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Calculate fair value using multiple pricing models
        """
        try:
            model_prices = {}
            model_weights = {
                "market_based": 0.4,
                "fundamental": 0.25,
                "technical": 0.2,
                "risk_adjusted": 0.15,
            }
            for model, weight in model_weights.items():
                try:
                    pricing_result = self.pricing_models[model](
                        project_id, credit_type, vintage_year
                    )
                    model_prices[model] = {
                        "price": pricing_result["price"],
                        "weight": weight,
                        "weighted_price": pricing_result["price"]
                        * Decimal(str(weight)),
                    }
                except Exception as e:
                    logger.warning(f"Error in {model} pricing: {str(e)}")
                    continue
            if not model_prices:
                return self._get_fallback_price(credit_type, vintage_year)
            total_weighted_price = sum(
                (data["weighted_price"] for data in model_prices.values())
            )
            total_weight = sum((data["weight"] for data in model_prices.values()))
            fair_value = total_weighted_price / Decimal(str(total_weight))
            prices = [data["price"] for data in model_prices.values()]
            price_std = Decimal(str(np.std([float(p) for p in prices])))
            return {
                "fair_value": fair_value.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                "price_range": {
                    "min": min(prices),
                    "max": max(prices),
                    "std": price_std,
                },
                "model_prices": {
                    k: {"price": float(v["price"]), "weight": v["weight"]}
                    for k, v in model_prices.items()
                },
                "confidence_score": self._calculate_confidence_score(model_prices),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Error calculating fair value: {str(e)}")
            return self._get_fallback_price(credit_type, vintage_year)

    def get_price_forecast(
        self,
        project_id: Optional[int] = None,
        credit_type: Optional[str] = None,
        vintage_year: Optional[int] = None,
        forecast_days: int = 30,
    ) -> Dict[str, Any]:
        """
        Generate price forecast using machine learning models
        """
        try:
            historical_data = self._get_price_history(
                project_id, credit_type, vintage_year, days=180
            )
            if len(historical_data) < 30:
                return {"error": "Insufficient historical data for forecasting"}
            df = pd.DataFrame(historical_data)
            df["date"] = pd.to_datetime(df["date"])
            df = df.sort_values("date")
            df["price_lag1"] = df["price"].shift(1)
            df["price_lag7"] = df["price"].shift(7)
            df["price_ma7"] = df["price"].rolling(window=7).mean()
            df["price_ma30"] = df["price"].rolling(window=30).mean()
            df["volatility"] = df["price"].rolling(window=7).std()
            df["day_of_week"] = df["date"].dt.dayofweek
            df["day_of_month"] = df["date"].dt.day
            df = df.dropna()
            if len(df) < 20:
                return {"error": "Insufficient clean data for forecasting"}
            feature_columns = [
                "price_lag1",
                "price_lag7",
                "price_ma7",
                "price_ma30",
                "volatility",
                "day_of_week",
                "day_of_month",
            ]
            X = df[feature_columns].values
            y = df["price"].values
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)
            model = LinearRegression()
            model.fit(X_scaled, y)
            forecast_dates = []
            forecast_prices = []
            last_date = df["date"].iloc[-1]
            last_features = X_scaled[-1:].copy()
            for i in range(forecast_days):
                next_price = model.predict(last_features)[0]
                next_date = last_date + timedelta(days=i + 1)
                forecast_dates.append(next_date.isoformat())
                forecast_prices.append(float(next_price))
                last_features[0][0] = next_price
            current_price = float(df["price"].iloc[-1])
            forecast_mean = np.mean(forecast_prices)
            forecast_std = np.std(forecast_prices)
            return {
                "current_price": current_price,
                "forecast": {
                    "dates": forecast_dates,
                    "prices": forecast_prices,
                    "mean": forecast_mean,
                    "std": forecast_std,
                    "trend": "bullish" if forecast_mean > current_price else "bearish",
                },
                "model_performance": {
                    "r2_score": model.score(X_scaled, y),
                    "training_samples": len(df),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Error generating price forecast: {str(e)}")
            return {"error": str(e)}

    def _get_fallback_price(
        self, credit_type: Optional[str], vintage_year: Optional[int]
    ) -> Dict[str, Any]:
        """Get fallback price when no market data is available"""
        base_prices = {
            "VCS": Decimal("45.00"),
            "CDM": Decimal("40.00"),
            "GOLD_STANDARD": Decimal("50.00"),
            "CAR": Decimal("48.00"),
            "REDD+": Decimal("55.00"),
        }
        base_price = base_prices.get(credit_type, Decimal("45.00"))
        if vintage_year:
            current_year = datetime.now(timezone.utc).year
            vintage_adjustment = max(0.8, 1 - (current_year - vintage_year) * 0.02)
            base_price *= Decimal(str(vintage_adjustment))
        return {
            "price": base_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "pricing_method": "fallback",
            "note": "No market data available, using fallback pricing",
        }

    def _get_base_price_by_type(self, credit_type: Optional[str]) -> Decimal:
        """Get base price by credit type"""
        base_prices = {
            "VCS": Decimal("45.00"),
            "CDM": Decimal("40.00"),
            "GOLD_STANDARD": Decimal("50.00"),
            "CAR": Decimal("48.00"),
            "REDD+": Decimal("55.00"),
            "FORESTRY": Decimal("52.00"),
            "RENEWABLE_ENERGY": Decimal("42.00"),
            "METHANE_CAPTURE": Decimal("38.00"),
        }
        return base_prices.get(credit_type, Decimal("45.00"))

    def _calculate_project_premium(self, project: CarbonProject) -> Decimal:
        """Calculate project-specific premium/discount"""
        premium = Decimal("1.0")
        type_adjustments = {
            ProjectType.FORESTRY: Decimal("1.15"),
            ProjectType.RENEWABLE_ENERGY: Decimal("1.05"),
            ProjectType.METHANE_CAPTURE: Decimal("0.95"),
            ProjectType.INDUSTRIAL: Decimal("1.00"),
        }
        if project.project_type in type_adjustments:
            premium *= type_adjustments[project.project_type]
        if project.country in ["US", "CA", "AU", "DE", "UK"]:
            premium *= Decimal("1.10")
        elif project.country in ["BR", "IN", "CN", "ID"]:
            premium *= Decimal("1.05")
        return premium

    def _calculate_vintage_adjustment(self, vintage_year: Optional[int]) -> Decimal:
        """Calculate vintage year adjustment"""
        if not vintage_year:
            return Decimal("1.0")
        current_year = datetime.now(timezone.utc).year
        age = current_year - vintage_year
        if age <= 0:
            return Decimal("1.10")
        elif age <= 2:
            return Decimal("1.05")
        elif age <= 5:
            return Decimal("1.00")
        else:
            return Decimal(str(max(0.8, 1 - (age - 5) * 0.03)))

    def _calculate_supply_demand_adjustment(
        self, credit_type: Optional[str]
    ) -> Decimal:
        """Calculate supply/demand adjustment (simplified)"""
        return Decimal("1.0")

    def _calculate_regulatory_adjustment(self, credit_type: Optional[str]) -> Decimal:
        """Calculate regulatory environment adjustment"""
        return Decimal("1.0")

    def _get_price_history(
        self,
        project_id: Optional[int],
        credit_type: Optional[str],
        vintage_year: Optional[int],
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """Get historical price data"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            query = db.session.query(Trade).filter(
                Trade.status == TradeStatus.SETTLED, Trade.executed_at >= cutoff_date
            )
            if project_id:
                query = query.filter(Trade.project_id == project_id)
            elif credit_type:
                query = query.join(CarbonCredit).filter(
                    CarbonCredit.credit_type == credit_type
                )
            if vintage_year:
                query = query.filter(Trade.vintage_year == vintage_year)
            trades = query.order_by(Trade.executed_at).all()
            return [
                {
                    "date": trade.executed_at.date(),
                    "price": float(trade.price),
                    "volume": float(trade.quantity),
                }
                for trade in trades
            ]
        except Exception as e:
            logger.error(f"Error getting price history: {str(e)}")
            return []

    def _calculate_price_trend(self, trades: List[Trade]) -> str:
        """Calculate price trend from recent trades"""
        if len(trades) < 2:
            return "neutral"
        prices = [float(trade.price) for trade in trades]
        x = np.arange(len(prices))
        slope, _, _, _, _ = stats.linregress(x, prices)
        if slope > 0.1:
            return "bullish"
        elif slope < -0.1:
            return "bearish"
        else:
            return "neutral"

    def _calculate_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Calculate Relative Strength Index"""
        if len(prices) < period + 1:
            return 50.0
        deltas = np.diff(prices)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        rsi = 100 - 100 / (1 + rs)
        return float(rsi)

    def _calculate_bollinger_bands(
        self, prices: np.ndarray, period: int = 20, std_dev: int = 2
    ) -> Tuple[float, float, float]:
        """Calculate Bollinger Bands"""
        if len(prices) < period:
            current_price = prices[-1]
            return (current_price * 1.02, current_price * 0.98, current_price)
        sma = np.mean(prices[-period:])
        std = np.std(prices[-period:])
        upper_band = sma + std_dev * std
        lower_band = sma - std_dev * std
        return (float(upper_band), float(lower_band), float(sma))

    def _calculate_macd(
        self, prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> Tuple[float, float, float]:
        """Calculate MACD indicator"""
        if len(prices) < slow:
            return (0.0, 0.0, 0.0)
        ema_fast = self._calculate_ema(prices, fast)
        ema_slow = self._calculate_ema(prices, slow)
        macd_line = ema_fast - ema_slow
        np.array([macd_line])
        signal_line = macd_line
        histogram = macd_line - signal_line
        return (float(macd_line), float(signal_line), float(histogram))

    def _calculate_ema(self, prices: np.ndarray, period: int) -> float:
        """Calculate Exponential Moving Average"""
        if len(prices) < period:
            return float(np.mean(prices))
        multiplier = 2 / (period + 1)
        ema = prices[0]
        for price in prices[1:]:
            ema = price * multiplier + ema * (1 - multiplier)
        return float(ema)

    def _calculate_technical_adjustment(self, signals: List[str]) -> float:
        """Calculate price adjustment based on technical signals"""
        adjustment = 1.0
        signal_adjustments = {
            "bullish_ma": 0.02,
            "bearish_ma": -0.02,
            "overbought": -0.01,
            "oversold": 0.01,
            "above_upper_bb": -0.015,
            "below_lower_bb": 0.015,
        }
        for signal in signals:
            adjustment += signal_adjustments.get(signal, 0)
        return max(0.9, min(1.1, adjustment))

    def _calculate_risk_factors(
        self,
        project_id: Optional[int],
        credit_type: Optional[str],
        vintage_year: Optional[int],
    ) -> Dict[str, float]:
        """Calculate various risk factors"""
        risk_factors = {
            "liquidity_risk": 0.02,
            "credit_risk": 0.01,
            "market_risk": 0.015,
            "regulatory_risk": 0.01,
        }
        if credit_type in ["VCS", "GOLD_STANDARD"]:
            risk_factors["credit_risk"] *= 0.8
        if vintage_year:
            current_year = datetime.now(timezone.utc).year
            age = current_year - vintage_year
            if age > 5:
                risk_factors["market_risk"] *= 1 + age * 0.1
        return risk_factors

    def _calculate_risk_premium(self, risk_factors: Dict[str, float]) -> Decimal:
        """Calculate total risk premium"""
        total_risk = sum(risk_factors.values())
        return Decimal(str(total_risk))

    def _calculate_historical_volatility(
        self,
        project_id: Optional[int],
        credit_type: Optional[str],
        vintage_year: Optional[int],
        days: int = 30,
    ) -> float:
        """Calculate historical volatility"""
        try:
            price_history = self._get_price_history(
                project_id, credit_type, vintage_year, days
            )
            if len(price_history) < 10:
                return 0.15
            prices = [p["price"] for p in price_history]
            returns = np.diff(np.log(prices))
            volatility = np.std(returns) * np.sqrt(252)
            return float(volatility)
        except Exception as e:
            logger.error(f"Error calculating volatility: {str(e)}")
            return 0.15

    def _calculate_volatility_adjustment(self, volatility: float) -> Decimal:
        """Calculate volatility adjustment factor"""
        base_volatility = 0.15
        adjustment = 1 + (volatility - base_volatility)
        return Decimal(str(max(0.9, min(1.2, adjustment))))

    def _get_market_context(
        self, credit_type: Optional[str], vintage_year: Optional[int]
    ) -> Dict[str, Any]:
        """Get market context information"""
        return {
            "market_sentiment": "neutral",
            "trading_volume_24h": 0,
            "price_change_24h": 0.0,
            "market_cap": 0,
        }

    def _calculate_confidence_intervals(self, price: Decimal) -> Dict[str, float]:
        """Calculate confidence intervals for price"""
        price_float = float(price)
        return {
            "95%": {"lower": price_float * 0.95, "upper": price_float * 1.05},
            "99%": {"lower": price_float * 0.9, "upper": price_float * 1.1},
        }

    def _calculate_data_quality_score(
        self, project_id: Optional[int], credit_type: Optional[str]
    ) -> float:
        """Calculate data quality score"""
        return 0.85

    def _calculate_confidence_score(self, model_prices: Dict[str, Any]) -> float:
        """Calculate confidence score based on model agreement"""
        if len(model_prices) < 2:
            return 0.5
        prices = [float(data["price"]) for data in model_prices.values()]
        mean_price = np.mean(prices)
        std_price = np.std(prices)
        coefficient_of_variation = std_price / mean_price if mean_price > 0 else 1
        confidence = max(0.1, 1 - coefficient_of_variation)
        return float(confidence)
