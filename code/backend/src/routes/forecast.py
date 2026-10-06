import logging
import math
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from ..models.user import UserRole
from ..security import require_roles
from ..services.forecasting_service import ForecastingService, TrainingInProgressError

logger = logging.getLogger(__name__)
forecast_bp = Blueprint("forecast", __name__)
forecasting_service = ForecastingService()

SEASONS = {"winter", "spring", "summer", "autumn"}
ERROR_STATUS = {
    "model_unavailable": 503,
    "insufficient_data": 422,
    "unknown_model": 400,
}


def _disabled() -> Any:
    return jsonify({"error": "AI forecasting is disabled"}), 503


@forecast_bp.route("/status", methods=["GET"])
@jwt_required()
def get_status() -> Any:
    if not forecasting_service.enabled():
        return _disabled()
    return jsonify(forecasting_service.status())


@forecast_bp.route("/price", methods=["GET"])
@forecast_bp.route("/price/<string:symbol>", methods=["GET"])
@jwt_required()
def get_price_forecast(symbol: Any = None) -> Any:
    if not forecasting_service.enabled():
        return _disabled()
    horizon = request.args.get(
        "horizon", forecasting_service.default_horizon(), type=int
    )
    model_name = request.args.get("model", "ensemble")
    try:
        result = forecasting_service.forecast_price(symbol, horizon, model_name)
    except Exception as exc:
        logger.error("Price forecast failed: %s", exc)
        return jsonify({"error": "Forecast failed"}), 500
    if "error" in result:
        status = ERROR_STATUS.get(result.get("code", ""), 400)
        return jsonify(result), status
    return jsonify(result)


@forecast_bp.route("/demand", methods=["POST"])
@jwt_required()
def predict_demand() -> Any:
    if not forecasting_service.enabled():
        return _disabled()
    data = request.get_json(silent=True) or {}
    try:
        price = float(data["price"])
        volume = float(data["volume"])
        season = str(data["season"]).lower()
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "price, volume and season are required"}), 400
    if not (math.isfinite(price) and math.isfinite(volume)) or price < 0 or volume < 0:
        return jsonify({"error": "price and volume must be non-negative numbers"}), 400
    if season not in SEASONS:
        return jsonify({"error": f"season must be one of {sorted(SEASONS)}"}), 400
    result = forecasting_service.predict_demand(price, volume, season)
    if "error" in result:
        return jsonify(result), ERROR_STATUS.get(result.get("code", ""), 400)
    return jsonify(result)


@forecast_bp.route("/train", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN)
def train_models() -> Any:
    if not forecasting_service.enabled():
        return _disabled()
    data = request.get_json(silent=True) or {}
    target = data.get("model", "price")
    try:
        if target == "price":
            result = forecasting_service.train_price_model(
                source=data.get("source", "database"), symbol=data.get("symbol")
            )
        elif target == "demand":
            result = forecasting_service.train_demand_model()
        else:
            return jsonify({"error": "model must be 'price' or 'demand'"}), 400
    except TrainingInProgressError as exc:
        return jsonify({"error": str(exc)}), 409
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        logger.error("Model training failed: %s", exc)
        return jsonify({"error": "Training failed"}), 500
    return jsonify({"message": "Training completed", "result": result})
