"""
Trading routes for CarbonXchange Backend
Implements comprehensive trading functionality with financial industry standards
"""

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc

from ..models import db
from ..models.trading import Order, OrderSide, OrderStatus, OrderType, Portfolio, Trade
from ..models.user import User
from ..services.audit_service import AuditService
from ..services.compliance_service import ComplianceService
from ..services.risk_service import RiskService
from ..services.trading_service import TradingService
from ..utils import validate_request_data

logger = logging.getLogger(__name__)
trading_bp = Blueprint("trading", __name__)
trading_service = TradingService()
risk_service = RiskService()
compliance_service = ComplianceService()
audit_service = AuditService()


@trading_bp.route("/orders", methods=["POST"])
@jwt_required()
def create_order() -> Any:
    """Create a new trading order"""
    try:
        current_user_uuid = get_jwt_identity()
        user = User.query.filter_by(uuid=current_user_uuid).first()
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json()
        required_fields = ["order_type", "side", "quantity", "credit_type"]
        if not validate_request_data(data, required_fields):
            return jsonify({"error": "Missing required fields"}), 400

        try:
            order_type = OrderType(data["order_type"])
            side = OrderSide(data["side"])
        except ValueError:
            return jsonify({"error": "Invalid order type or side"}), 400

        try:
            quantity = Decimal(str(data["quantity"]))
            if quantity <= 0:
                raise ValueError("Quantity must be positive")
        except (InvalidOperation, ValueError):
            return jsonify({"error": "Invalid quantity"}), 400

        price = None
        if order_type in [OrderType.LIMIT, OrderType.STOP_LIMIT]:
            if "price" not in data:
                return jsonify({"error": "Price required for limit orders"}), 400
            try:
                price = Decimal(str(data["price"]))
                if price <= 0:
                    raise ValueError("Price must be positive")
            except (InvalidOperation, ValueError):
                return jsonify({"error": "Invalid price"}), 400

        if not user.is_verified or user.status.value not in ["active"]:
            return jsonify({"error": "Account not authorized for trading"}), 403

        risk_check = risk_service.check_order_risk(
            user.id,
            {
                "order_type": order_type.value,
                "side": side.value,
                "quantity": float(quantity),
                "price": float(price) if price else None,
                "credit_type": data["credit_type"],
            },
        )
        if not risk_check["approved"]:
            audit_service.log_event(
                user_id=user.id,
                event_type="order_rejected",
                event_category="trading",
                event_description=f"Order rejected due to risk: {risk_check['reason']}",
                success=False,
            )
            return jsonify({"error": f"Order rejected: {risk_check['reason']}"}), 400

        compliance_check = compliance_service.check_order_compliance(
            user.id,
            {
                "order_type": order_type.value,
                "side": side.value,
                "quantity": float(quantity),
                "price": float(price) if price else None,
                "credit_type": data["credit_type"],
            },
        )
        if not compliance_check["approved"]:
            return jsonify({"error": "Order rejected: compliance check failed"}), 400

        order = Order(
            user_id=user.id,
            order_type=order_type,
            side=side,
            quantity=quantity,
            price=price,
            credit_type=data["credit_type"],
            status=OrderStatus.PENDING,
        )
        db.session.add(order)
        db.session.flush()

        trading_service.submit_order(order)
        db.session.commit()

        audit_service.log_event(
            user_id=user.id,
            event_type="order_created",
            event_category="trading",
            event_description=f"Order {order.order_id} created: {side.value} {quantity} {data['credit_type']}",
            success=True,
        )

        return (
            jsonify(
                {
                    "message": "Order created successfully",
                    "order": order.to_dict(),
                }
            ),
            201,
        )

    except Exception as e:
        logger.error(f"Create order error: {e}")
        db.session.rollback()
        return jsonify({"error": "Failed to create order", "message": str(e)}), 500


@trading_bp.route("/orders", methods=["GET"])
@jwt_required()
def get_orders() -> Any:
    """Get user's orders"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    status_filter = request.args.get("status")
    side_filter = request.args.get("side")

    query = Order.query.filter_by(user_id=user.id)
    if status_filter:
        try:
            query = query.filter(Order.status == OrderStatus(status_filter))
        except ValueError:
            return jsonify({"error": f"Invalid status: {status_filter}"}), 400
    if side_filter:
        try:
            query = query.filter(Order.side == OrderSide(side_filter))
        except ValueError:
            return jsonify({"error": f"Invalid side: {side_filter}"}), 400

    pagination = query.order_by(desc(Order.created_at)).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify(
        {
            "orders": [o.to_dict() for o in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@trading_bp.route("/orders/<string:order_id>", methods=["GET"])
@jwt_required()
def get_order(order_id: str) -> Any:
    """Get a specific order"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    order = Order.query.filter_by(order_id=order_id, user_id=user.id).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404

    return jsonify(order.to_dict(include_sensitive=True))


@trading_bp.route("/orders/<string:order_id>/cancel", methods=["POST"])
@jwt_required()
def cancel_order(order_id: str) -> Any:
    """Cancel an order"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    order = Order.query.filter_by(order_id=order_id, user_id=user.id).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404

    if not order.is_active:
        return jsonify({"error": "Order cannot be cancelled in its current state"}), 400

    try:
        trading_service.cancel_order(order)
        order.cancel(reason="User requested cancellation")
        db.session.commit()

        audit_service.log_event(
            user_id=user.id,
            event_type="order_cancelled",
            event_category="trading",
            event_description=f"Order {order_id} cancelled by user",
            success=True,
        )
        return jsonify(
            {"message": "Order cancelled successfully", "order": order.to_dict()}
        )
    except Exception as e:
        db.session.rollback()
        logger.error(f"Cancel order error: {e}")
        return jsonify({"error": "Failed to cancel order"}), 500


@trading_bp.route("/trades", methods=["GET"])
@jwt_required()
def get_trades() -> Any:
    """Get user's trades"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    buy_orders = Order.query.filter_by(user_id=user.id).with_entities(Order.id)
    sell_orders = Order.query.filter_by(user_id=user.id).with_entities(Order.id)

    from sqlalchemy import or_

    trades = (
        Trade.query.filter(
            or_(
                Trade.buy_order_id.in_(buy_orders),
                Trade.sell_order_id.in_(sell_orders),
            )
        )
        .order_by(desc(Trade.created_at))
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify(
        {
            "trades": [t.to_dict() for t in trades.items],
            "total": trades.total,
            "pages": trades.pages,
            "current_page": page,
        }
    )


@trading_bp.route("/portfolio", methods=["GET"])
@jwt_required()
def get_portfolio() -> Any:
    """Get user's portfolio"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    portfolios = Portfolio.query.filter_by(user_id=user.id).all()
    return jsonify(
        {
            "portfolios": [p.to_dict() for p in portfolios],
            "total": len(portfolios),
        }
    )


@trading_bp.route("/portfolio/holdings", methods=["GET"])
@jwt_required()
def get_holdings() -> Any:
    """Get user's portfolio holdings"""
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    portfolios = Portfolio.query.filter_by(user_id=user.id).all()
    all_holdings = []
    for portfolio in portfolios:
        for holding in portfolio.holdings:
            h = holding.to_dict()
            h["portfolio_name"] = portfolio.name
            all_holdings.append(h)

    return jsonify({"holdings": all_holdings, "total": len(all_holdings)})
