"""
CarbonXchange Backend - Production-Ready Flask Application
Financial industry-grade carbon credit trading platform
"""

import logging
import os
import sys
from datetime import datetime, timezone
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import redis
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from src.config import get_config
from src.models import db, migrate
from src.routes.admin import admin_bp
from src.routes.auth import auth_bp
from src.routes.carbon_credits import carbon_credits_bp
from src.routes.compliance import compliance_bp
from src.routes.forecast import forecast_bp
from src.routes.market import market_bp
from src.routes.trading import trading_bp
from src.routes.user import user_bp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def create_app(config_name: Optional[str] = None) -> Flask:
    """Application factory pattern"""
    app = Flask(
        __name__, static_folder=os.path.join(os.path.dirname(__file__), "static")
    )
    if isinstance(config_name, dict):
        config_class = get_config(None)
        app.config.from_object(config_class)
        app.config.update(config_name)
        try:
            config_class.init_app(app)
        except Exception:
            pass
    else:
        config_class = get_config(config_name)
        app.config.from_object(config_class)
        config_class.init_app(app)
    db.init_app(app)
    migrate.init_app(app, db)
    CORS(
        app,
        origins=app.config["CORS_ORIGINS"],
        methods=app.config["CORS_METHODS"],
        allow_headers=app.config["CORS_ALLOW_HEADERS"],
        supports_credentials=True,
    )
    JWTManager(app)
    redis_client = None
    try:
        redis_client = redis.from_url(app.config["RATELIMIT_STORAGE_URL"])
        redis_client.ping()  # Test connection
        Limiter(
            get_remote_address,
            app=app,
            storage_uri=app.config["RATELIMIT_STORAGE_URL"],
            default_limits=[app.config["RATELIMIT_DEFAULT"]],
        )
        logger.info("Rate limiting enabled with Redis storage")
    except Exception as e:
        logger.warning(f"Redis not available for rate limiting: {e}")
        Limiter(
            get_remote_address,
            app=app,
            storage_uri="memory://",
            default_limits=[app.config["RATELIMIT_DEFAULT"]],
        )
        logger.info("Rate limiting using in-memory storage (Redis not available)")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(user_bp, url_prefix="/api/users")
    app.register_blueprint(carbon_credits_bp, url_prefix="/api/carbon-credits")
    app.register_blueprint(trading_bp, url_prefix="/api/trading")
    app.register_blueprint(market_bp, url_prefix="/api/market")
    app.register_blueprint(compliance_bp, url_prefix="/api/compliance")
    app.register_blueprint(forecast_bp, url_prefix="/api/forecast")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")

    @app.before_request
    def log_request():
        g.start_time = datetime.now(timezone.utc)
        logger.info(
            f"Request: {request.method} {request.path} from {request.remote_addr}"
        )

    @app.after_request
    def log_response(response):
        if hasattr(g, "start_time"):
            duration = (
                datetime.now(timezone.utc) - g.start_time
            ).total_seconds() * 1000
            logger.info(f"Response: {response.status_code} in {duration:.2f}ms")
        return response

    @app.errorhandler(400)
    def bad_request(error):
        return (
            jsonify(
                {
                    "error": "Bad Request",
                    "message": "The request could not be understood by the server",
                    "status_code": 400,
                }
            ),
            400,
        )

    @app.errorhandler(401)
    def unauthorized(error):
        return (
            jsonify(
                {
                    "error": "Unauthorized",
                    "message": "Authentication is required to access this resource",
                    "status_code": 401,
                }
            ),
            401,
        )

    @app.errorhandler(403)
    def forbidden(error):
        return (
            jsonify(
                {
                    "error": "Forbidden",
                    "message": "You do not have permission to access this resource",
                    "status_code": 403,
                }
            ),
            403,
        )

    @app.errorhandler(404)
    def not_found(error):
        return (
            jsonify(
                {
                    "error": "Not Found",
                    "message": "The requested resource was not found",
                    "status_code": 404,
                }
            ),
            404,
        )

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return (
            jsonify(
                {
                    "error": "Rate Limit Exceeded",
                    "message": "Too many requests. Please try again later.",
                    "status_code": 429,
                }
            ),
            429,
        )

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Internal server error: {error}")
        return (
            jsonify(
                {
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred",
                    "status_code": 500,
                }
            ),
            500,
        )

    @app.route("/api/health")
    def health_check():
        """Comprehensive health check endpoint"""
        try:
            db.session.execute(db.text("SELECT 1"))
            db_status = "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            db_status = "unhealthy"
        redis_status = "not_configured"
        if redis_client:
            try:
                redis_client.ping()
                redis_status = "healthy"
            except Exception as e:
                logger.warning(f"Redis health check failed: {e}")
                redis_status = "unhealthy"
        health_data = {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0",
            "environment": app.config.get("ENV", "unknown"),
            "services": {
                "database": db_status,
                "redis": redis_status,
                "api": "healthy",
            },
            "uptime": "N/A",
        }
        status_code = 200 if health_data["status"] == "healthy" else 503
        return (jsonify(health_data), status_code)

    @app.route("/api/info")
    def api_info():
        """API information endpoint"""
        return jsonify(
            {
                "name": "CarbonXchange Backend API",
                "version": "1.0.0",
                "description": "Production-ready carbon credit trading platform API",
                "environment": app.config.get("ENV", "unknown"),
                "features": [
                    "User Management & KYC",
                    "Carbon Credit Trading",
                    "Portfolio Management",
                    "Market Data & Analytics",
                    "Compliance & Reporting",
                    "Blockchain Integration",
                    "AI Price and Demand Forecasting",
                ],
                "endpoints": {
                    "auth": "/api/auth",
                    "users": "/api/users",
                    "carbon_credits": "/api/carbon-credits",
                    "trading": "/api/trading",
                    "market": "/api/market",
                    "compliance": "/api/compliance",
                    "forecast": "/api/forecast",
                    "admin": "/api/admin",
                },
            }
        )

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve(path):
        """Serve frontend application"""
        static_folder_path = app.static_folder
        if static_folder_path is None:
            return (jsonify({"error": "Static folder not configured"}), 404)
        if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
            return send_from_directory(static_folder_path, path)
        else:
            index_path = os.path.join(static_folder_path, "index.html")
            if os.path.exists(index_path):
                return send_from_directory(static_folder_path, "index.html")
            else:
                return jsonify(
                    {
                        "message": "CarbonXchange Backend API",
                        "version": "1.0.0",
                        "documentation": "/api/info",
                        "health": "/api/health",
                    }
                )

    with app.app_context():
        try:
            db.create_all()
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error(f"Failed to create database tables: {e}")
    return app


app = create_app()
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    logger.info(f"Starting CarbonXchange Backend on port {port}")
    logger.info(f"Environment: {app.config.get('ENV', 'unknown')}")
    logger.info(f"Debug mode: {debug}")
    app.run(host="0.0.0.0", port=port, debug=debug)
