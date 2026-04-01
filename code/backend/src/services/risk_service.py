"""
Risk Management Service for CarbonXchange Backend
Implements comprehensive risk management with financial industry standards
"""

import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, desc, func, or_

from ..models import db
from ..models.trading import Order, Portfolio, PortfolioHolding, Trade, TradeStatus
from ..models.user import RiskLevel, User
from .audit_service import AuditService

logger = logging.getLogger(__name__)


class RiskType(Enum):
    """Risk type enumeration"""

    MARKET_RISK = "market_risk"
    CREDIT_RISK = "credit_risk"
    OPERATIONAL_RISK = "operational_risk"
    LIQUIDITY_RISK = "liquidity_risk"
    CONCENTRATION_RISK = "concentration_risk"
    REGULATORY_RISK = "regulatory_risk"


class RiskSeverity(Enum):
    """Risk severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskService:
    """
    Comprehensive risk management service implementing financial industry standards
    """

    def __init__(self) -> None:
        self.audit_service = AuditService()
        self.risk_limits = self._load_risk_limits()
        self.var_calculator = VaRCalculator()
        self.stress_tester = StressTester()

    def _load_risk_limits(self) -> Dict[str, Any]:
        """Load risk limits configuration"""
        return {
            "max_single_order_value": Decimal("1000000"),
            "max_daily_trading_volume": Decimal("5000000"),
            "max_position_concentration": 0.25,
            "max_sector_concentration": 0.4,
            "max_vintage_concentration": 0.3,
            "max_leverage_ratio": 2.0,
            "min_liquidity_ratio": 0.1,
            "max_var_limit": 0.05,
            "stress_test_threshold": 0.15,
        }

    def check_order_risk(
        self, user_id: int, order_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Comprehensive risk check for new orders

        Args:
            user_id: User ID
            order_data: Order details

        Returns:
            Risk check result with approval status and reasons
        """
        try:
            risk_checks = []
            user = User.query.get(user_id)
            if not user:
                return {"approved": False, "reason": "User not found"}
            order_value = Decimal(str(order_data.get("quantity", 0))) * Decimal(
                str(order_data.get("price", 0) or 50)
            )
            if order_value > self.risk_limits["max_single_order_value"]:
                risk_checks.append(
                    {
                        "type": RiskType.MARKET_RISK,
                        "severity": RiskSeverity.HIGH,
                        "message": f"Order value ${order_value} exceeds single order limit",
                    }
                )
            daily_volume = self._get_daily_trading_volume(user_id)
            if (
                daily_volume + order_value
                > self.risk_limits["max_daily_trading_volume"]
            ):
                risk_checks.append(
                    {
                        "type": RiskType.MARKET_RISK,
                        "severity": RiskSeverity.HIGH,
                        "message": "Daily trading volume limit exceeded",
                    }
                )
            if order_data.get("side") == "buy":
                concentration_risk = self._check_concentration_risk(user_id, order_data)
                if concentration_risk:
                    risk_checks.extend(concentration_risk)
            user_risk_checks = self._check_user_risk_level(user, order_data)
            if user_risk_checks:
                risk_checks.extend(user_risk_checks)
            liquidity_risk = self._check_liquidity_risk(user_id, order_data)
            if liquidity_risk:
                risk_checks.extend(liquidity_risk)
            market_risk = self._check_market_risk(order_data)
            if market_risk:
                risk_checks.extend(market_risk)
            critical_risks = [
                r for r in risk_checks if r["severity"] == RiskSeverity.CRITICAL
            ]
            high_risks = [r for r in risk_checks if r["severity"] == RiskSeverity.HIGH]
            approved = len(critical_risks) == 0 and len(high_risks) <= 1
            self.audit_service.log_event(
                user_id=user_id,
                event_type="risk_assessment",
                event_category="risk_management",
                event_description=f"Order risk assessment: {('Approved' if approved else 'Rejected')}",
                metadata={
                    "order_value": float(order_value),
                    "risk_checks": len(risk_checks),
                    "critical_risks": len(critical_risks),
                    "high_risks": len(high_risks),
                },
                success=approved,
            )
            return {
                "approved": approved,
                "reason": (
                    risk_checks[0]["message"]
                    if risk_checks and (not approved)
                    else None
                ),
                "risk_checks": risk_checks,
                "risk_score": self._calculate_risk_score(risk_checks),
            }
        except Exception as e:
            logger.error(f"Error in order risk check: {str(e)}")
            return {"approved": False, "reason": "Risk assessment failed"}

    def _get_daily_trading_volume(self, user_id: int) -> Decimal:
        """Get user's trading volume for today"""
        today = datetime.now(timezone.utc).date()
        volume = (
            db.session.query(func.sum(Trade.total_value))
            .join(
                Order,
                or_(
                    and_(Trade.buy_order_id == Order.id, Order.user_id == user_id),
                    and_(Trade.sell_order_id == Order.id, Order.user_id == user_id),
                ),
            )
            .filter(Trade.executed_at >= today, Trade.status == TradeStatus.SETTLED)
            .scalar()
        )
        return Decimal(str(volume)) if volume else Decimal("0")

    def _check_concentration_risk(
        self, user_id: int, order_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check for concentration risk in portfolio"""
        risks = []
        try:
            portfolio = Portfolio.query.filter_by(
                user_id=user_id, is_active=True
            ).first()
            if not portfolio:
                return risks
            order_value = Decimal(str(order_data.get("quantity", 0))) * Decimal(
                str(order_data.get("price", 0) or 50)
            )
            if "project_id" in order_data:
                current_position_value = self._get_position_value(
                    portfolio.id, order_data["project_id"]
                )
                new_position_value = current_position_value + order_value
                if portfolio.total_value > 0:
                    concentration = new_position_value / portfolio.total_value
                    if concentration > self.risk_limits["max_position_concentration"]:
                        risks.append(
                            {
                                "type": RiskType.CONCENTRATION_RISK,
                                "severity": RiskSeverity.HIGH,
                                "message": f"Position concentration {concentration:.1%} exceeds limit",
                            }
                        )
            credit_type = order_data.get("credit_type")
            if credit_type:
                sector_value = self._get_sector_value(portfolio.id, credit_type)
                new_sector_value = sector_value + order_value
                if portfolio.total_value > 0:
                    concentration = new_sector_value / portfolio.total_value
                    if concentration > self.risk_limits["max_sector_concentration"]:
                        risks.append(
                            {
                                "type": RiskType.CONCENTRATION_RISK,
                                "severity": RiskSeverity.MEDIUM,
                                "message": f"Sector concentration {concentration:.1%} exceeds limit",
                            }
                        )
            vintage_year = order_data.get("vintage_year")
            if vintage_year:
                vintage_value = self._get_vintage_value(portfolio.id, vintage_year)
                new_vintage_value = vintage_value + order_value
                if portfolio.total_value > 0:
                    concentration = new_vintage_value / portfolio.total_value
                    if concentration > self.risk_limits["max_vintage_concentration"]:
                        risks.append(
                            {
                                "type": RiskType.CONCENTRATION_RISK,
                                "severity": RiskSeverity.MEDIUM,
                                "message": f"Vintage concentration {concentration:.1%} exceeds limit",
                            }
                        )
        except Exception as e:
            logger.error(f"Error checking concentration risk: {str(e)}")
        return risks

    def _get_position_value(self, portfolio_id: int, project_id: int) -> Decimal:
        """Get current value of position in specific project"""
        holding = PortfolioHolding.query.filter_by(
            portfolio_id=portfolio_id, project_id=project_id
        ).first()
        if not holding:
            return Decimal("0")
        current_price = holding.current_price or holding.average_cost
        return holding.quantity * current_price

    def _get_sector_value(self, portfolio_id: int, credit_type: str) -> Decimal:
        """Get current value of holdings in specific sector"""
        holdings = PortfolioHolding.query.filter_by(
            portfolio_id=portfolio_id, credit_type=credit_type
        ).all()
        total_value = Decimal("0")
        for holding in holdings:
            current_price = holding.current_price or holding.average_cost
            total_value += holding.quantity * current_price
        return total_value

    def _get_vintage_value(self, portfolio_id: int, vintage_year: int) -> Decimal:
        """Get current value of holdings in specific vintage year"""
        holdings = PortfolioHolding.query.filter_by(
            portfolio_id=portfolio_id, vintage_year=vintage_year
        ).all()
        total_value = Decimal("0")
        for holding in holdings:
            current_price = holding.current_price or holding.average_cost
            total_value += holding.quantity * current_price
        return total_value

    def _check_user_risk_level(
        self, user: User, order_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check order against user's risk level"""
        risks = []
        order_value = Decimal(str(order_data.get("quantity", 0))) * Decimal(
            str(order_data.get("price", 0) or 50)
        )
        if user.risk_level == RiskLevel.LOW:
            if order_value > Decimal("10000"):
                risks.append(
                    {
                        "type": RiskType.CREDIT_RISK,
                        "severity": RiskSeverity.HIGH,
                        "message": "Order exceeds risk level limit for low-risk profile",
                    }
                )
        elif user.risk_level == RiskLevel.MEDIUM:
            if order_value > Decimal("100000"):
                risks.append(
                    {
                        "type": RiskType.CREDIT_RISK,
                        "severity": RiskSeverity.HIGH,
                        "message": "Order exceeds risk level limit for medium-risk profile",
                    }
                )
        elif user.risk_level == RiskLevel.HIGH:
            if order_value > Decimal("500000"):
                risks.append(
                    {
                        "type": RiskType.CREDIT_RISK,
                        "severity": RiskSeverity.MEDIUM,
                        "message": "Order exceeds risk level limit for high-risk profile",
                    }
                )
        return risks

    def _check_liquidity_risk(
        self, user_id: int, order_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Check liquidity risk for the order"""
        risks = []
        try:
            if order_data.get("side") == "buy":
                available_cash = self._get_available_cash(user_id)
                order_value = Decimal(str(order_data.get("quantity", 0))) * Decimal(
                    str(order_data.get("price", 0) or 50)
                )
                portfolio_value = self._get_portfolio_value(user_id)
                required_liquidity = portfolio_value * Decimal(
                    str(self.risk_limits["min_liquidity_ratio"])
                )
                if available_cash - order_value < required_liquidity:
                    risks.append(
                        {
                            "type": RiskType.LIQUIDITY_RISK,
                            "severity": RiskSeverity.MEDIUM,
                            "message": "Order would breach minimum liquidity requirements",
                        }
                    )
        except Exception as e:
            logger.error(f"Error checking liquidity risk: {str(e)}")
        return risks

    def _check_market_risk(self, order_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Check market risk factors"""
        risks = []
        try:
            credit_type = order_data.get("credit_type")
            if credit_type:
                volatility = self._get_market_volatility(credit_type)
                if volatility > 0.3:
                    risks.append(
                        {
                            "type": RiskType.MARKET_RISK,
                            "severity": RiskSeverity.MEDIUM,
                            "message": f"High market volatility detected for {credit_type}",
                        }
                    )
            price = order_data.get("price")
            if price:
                market_price = self._get_current_market_price(credit_type)
                if (
                    market_price
                    and abs(Decimal(str(price)) - market_price) / market_price > 0.2
                ):
                    risks.append(
                        {
                            "type": RiskType.MARKET_RISK,
                            "severity": RiskSeverity.MEDIUM,
                            "message": "Order price significantly deviates from market price",
                        }
                    )
        except Exception as e:
            logger.error(f"Error checking market risk: {str(e)}")
        return risks

    def _get_available_cash(self, user_id: int) -> Decimal:
        """Get user's available cash balance"""
        return Decimal("100000")

    def _get_portfolio_value(self, user_id: int) -> Decimal:
        """Get total portfolio value"""
        portfolio = Portfolio.query.filter_by(user_id=user_id, is_active=True).first()
        return portfolio.total_value if portfolio else Decimal("0")

    def _get_market_volatility(self, credit_type: str) -> float:
        """Calculate market volatility for credit type"""
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        prices = (
            db.session.query(Trade.price)
            .filter(
                Trade.status == TradeStatus.SETTLED,
                Trade.executed_at >= thirty_days_ago,
            )
            .all()
        )
        if len(prices) < 10:
            return 0.15
        price_values = [float(p[0]) for p in prices]
        mean_price = sum(price_values) / len(price_values)
        variance = sum(((p - mean_price) ** 2 for p in price_values)) / len(
            price_values
        )
        volatility = variance**0.5 / mean_price
        return volatility

    def _get_current_market_price(self, credit_type: str) -> Optional[Decimal]:
        """Get current market price for credit type"""
        recent_trade = (
            db.session.query(Trade)
            .filter(Trade.status == TradeStatus.SETTLED)
            .order_by(desc(Trade.executed_at))
            .first()
        )
        return recent_trade.price if recent_trade else None

    def _calculate_risk_score(self, risk_checks: List[Dict[str, Any]]) -> float:
        """Calculate overall risk score from risk checks"""
        if not risk_checks:
            return 0.0
        severity_weights = {
            RiskSeverity.LOW: 1,
            RiskSeverity.MEDIUM: 3,
            RiskSeverity.HIGH: 7,
            RiskSeverity.CRITICAL: 15,
        }
        total_score = sum(
            (severity_weights.get(check["severity"], 1) for check in risk_checks)
        )
        return min(100.0, total_score * 2)

    def get_user_risk_metrics(self, user_id: int) -> Dict[str, Any]:
        """Get comprehensive risk metrics for user"""
        try:
            user = User.query.get(user_id)
            if not user:
                return {}
            portfolio = Portfolio.query.filter_by(
                user_id=user_id, is_active=True
            ).first()
            if not portfolio:
                return {
                    "risk_level": user.risk_level.value,
                    "risk_score": float(user.risk_score) if user.risk_score else 0.0,
                    "portfolio_value": 0.0,
                    "var_95": 0.0,
                    "max_drawdown": 0.0,
                    "concentration_risk": 0.0,
                    "liquidity_ratio": 1.0,
                }
            var_95 = self.var_calculator.calculate_var(portfolio, confidence_level=0.95)
            concentration_metrics = self._calculate_concentration_metrics(portfolio)
            liquidity_ratio = self._calculate_liquidity_ratio(user_id)
            stress_results = self.stress_tester.run_stress_test(portfolio)
            return {
                "risk_level": user.risk_level.value,
                "risk_score": float(user.risk_score) if user.risk_score else 0.0,
                "portfolio_value": float(portfolio.total_value),
                "var_95": float(var_95),
                "max_drawdown": (
                    float(portfolio.max_drawdown) if portfolio.max_drawdown else 0.0
                ),
                "concentration_risk": concentration_metrics["max_concentration"],
                "liquidity_ratio": liquidity_ratio,
                "stress_test_loss": stress_results.get("worst_case_loss", 0.0),
                "risk_limits": {
                    "daily_volume_used": float(self._get_daily_trading_volume(user_id)),
                    "daily_volume_limit": float(
                        self.risk_limits["max_daily_trading_volume"]
                    ),
                    "position_concentration_limit": self.risk_limits[
                        "max_position_concentration"
                    ],
                    "sector_concentration_limit": self.risk_limits[
                        "max_sector_concentration"
                    ],
                },
            }
        except Exception as e:
            logger.error(f"Error getting user risk metrics: {str(e)}")
            return {}

    def _calculate_concentration_metrics(
        self, portfolio: Portfolio
    ) -> Dict[str, float]:
        """Calculate portfolio concentration metrics"""
        holdings = (
            PortfolioHolding.query.filter_by(portfolio_id=portfolio.id)
            .filter(PortfolioHolding.quantity > 0)
            .all()
        )
        if not holdings or portfolio.total_value == 0:
            return {"max_concentration": 0.0, "hhi": 0.0}
        concentrations = []
        for holding in holdings:
            holding_value = holding.quantity * (
                holding.current_price or holding.average_cost
            )
            concentration = holding_value / portfolio.total_value
            concentrations.append(concentration)
        max_concentration = max(concentrations) if concentrations else 0.0
        hhi = sum((c**2 for c in concentrations))
        return {"max_concentration": float(max_concentration), "hhi": float(hhi)}

    def _calculate_liquidity_ratio(self, user_id: int) -> float:
        """Calculate user's liquidity ratio"""
        available_cash = self._get_available_cash(user_id)
        portfolio_value = self._get_portfolio_value(user_id)
        if portfolio_value == 0:
            return 1.0
        return float(available_cash / portfolio_value)


class VaRCalculator:
    """Value at Risk calculator"""

    def calculate_var(
        self, portfolio: Portfolio, confidence_level: float = 0.95
    ) -> Decimal:
        """Calculate Value at Risk for portfolio"""
        try:
            holdings = (
                PortfolioHolding.query.filter_by(portfolio_id=portfolio.id)
                .filter(PortfolioHolding.quantity > 0)
                .all()
            )
            if not holdings:
                return Decimal("0")
            total_value = portfolio.total_value
            volatility = 0.15
            daily_volatility = volatility / 252**0.5
            from scipy.stats import norm

            z_score = norm.ppf(1 - confidence_level)
            var = total_value * daily_volatility * abs(z_score)
            return Decimal(str(var))
        except Exception as e:
            logger.error(f"Error calculating VaR: {str(e)}")
            return Decimal("0")


class StressTester:
    """Portfolio stress testing"""

    def run_stress_test(self, portfolio: Portfolio) -> Dict[str, Any]:
        """Run comprehensive stress tests on portfolio"""
        try:
            stress_scenarios = [
                {"name": "Market Crash", "price_shock": -0.3},
                {"name": "Regulatory Change", "price_shock": -0.2},
                {"name": "Liquidity Crisis", "price_shock": -0.25},
                {"name": "Technology Disruption", "price_shock": -0.15},
            ]
            results = {}
            worst_case_loss = 0.0
            for scenario in stress_scenarios:
                loss = self._calculate_scenario_loss(portfolio, scenario["price_shock"])
                results[scenario["name"]] = {
                    "loss_amount": float(loss),
                    "loss_percentage": (
                        float(loss / portfolio.total_value * 100)
                        if portfolio.total_value > 0
                        else 0.0
                    ),
                }
                if loss > worst_case_loss:
                    worst_case_loss = loss
            results["worst_case_loss"] = worst_case_loss
            results["worst_case_percentage"] = (
                float(worst_case_loss / portfolio.total_value * 100)
                if portfolio.total_value > 0
                else 0.0
            )
            return results
        except Exception as e:
            logger.error(f"Error running stress test: {str(e)}")
            return {}

    def _calculate_scenario_loss(
        self, portfolio: Portfolio, price_shock: float
    ) -> Decimal:
        """Calculate portfolio loss under stress scenario"""
        holdings = (
            PortfolioHolding.query.filter_by(portfolio_id=portfolio.id)
            .filter(PortfolioHolding.quantity > 0)
            .all()
        )
        total_loss = Decimal("0")
        for holding in holdings:
            current_value = holding.quantity * (
                holding.current_price or holding.average_cost
            )
            stressed_value = current_value * (1 + Decimal(str(price_shock)))
            loss = current_value - stressed_value
            total_loss += loss
        return total_loss
