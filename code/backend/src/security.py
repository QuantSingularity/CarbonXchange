"""
Security utilities and middleware for CarbonXchange Backend
Implements comprehensive security features for financial applications
"""

import functools
import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime
from typing import Any, Callable, Optional

from flask import current_app, g, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request
from werkzeug.exceptions import Forbidden, Unauthorized

from .models import db
from .models.transaction import AuditAction, AuditLog
from .models.user import User, UserRole, UserStatus

logger = logging.getLogger(__name__)


class SecurityError(Exception):
    """Base security exception"""


class InsufficientPermissions(SecurityError):
    """Raised when user lacks required permissions"""


class RateLimitExceeded(SecurityError):
    """Raised when rate limit is exceeded"""


def require_roles(*roles: UserRole) -> Any:
    """Decorator to require specific user roles"""

    def decorator(f: Callable) -> Callable:

        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            verify_jwt_in_request()
            current_user_uuid = get_jwt_identity()
            user = User.query.filter_by(uuid=current_user_uuid).first()
            if not user:
                raise Unauthorized("User not found")
            if user.role not in roles:
                logger.warning(
                    f"Access denied for user {user.email} - required roles: {[r.value for r in roles]}, user role: {user.role.value}"
                )
                raise Forbidden(
                    f"Access denied. Required roles: {[r.value for r in roles]}"
                )
            g.current_user = user
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_kyc_approval(f: Callable) -> Callable:
    """Decorator to require KYC approval"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        current_user_uuid = get_jwt_identity()
        user = User.query.filter_by(uuid=current_user_uuid).first()
        if not user:
            raise Unauthorized("User not found")
        if not user.is_kyc_approved:
            logger.warning(f"KYC required for user {user.email}")
            raise Forbidden("KYC approval required for this operation")
        g.current_user = user
        return f(*args, **kwargs)

    return decorated_function


def require_active_account(f: Callable) -> Callable:
    """Decorator to require active account status"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        current_user_uuid = get_jwt_identity()
        user = User.query.filter_by(uuid=current_user_uuid).first()
        if not user:
            raise Unauthorized("User not found")
        if user.status != UserStatus.ACTIVE:
            logger.warning(
                f"Inactive account access attempt: {user.email} - status: {user.status.value}"
            )
            raise Forbidden(f"Account is {user.status.value}. Please contact support.")
        g.current_user = user
        return f(*args, **kwargs)

    return decorated_function


def audit_log_required(action: AuditAction, resource_type: str) -> Any:
    """Decorator to automatically log API actions"""

    def decorator(f: Callable) -> Callable:

        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            start_time = time.time()
            user_id = None
            outcome = "success"
            error_message = None
            try:
                try:
                    verify_jwt_in_request(optional=True)
                    current_user_uuid = get_jwt_identity()
                    if current_user_uuid:
                        user = User.query.filter_by(uuid=current_user_uuid).first()
                        if user:
                            user_id = user.id
                except Exception:
                    pass
                result = f(*args, **kwargs)
                return result
            except Exception as e:
                outcome = "failure"
                error_message = str(e)
                raise
            finally:
                try:
                    response_time_ms = int((time.time() - start_time) * 1000)
                    audit_log = AuditLog.log_event(
                        user_id=user_id,
                        action=action,
                        resource_type=resource_type,
                        event_name=f"{action.value.title()} {resource_type}",
                        description=(
                            error_message
                            if error_message
                            else f"API call to {request.endpoint}"
                        ),
                        outcome=outcome,
                        risk_level="low" if outcome == "success" else "medium",
                        ip_address=request.remote_addr,
                        user_agent=request.headers.get("User-Agent"),
                        request_method=request.method,
                        request_url=request.url,
                        response_time_ms=response_time_ms,
                    )
                    db.session.add(audit_log)
                    db.session.commit()
                except Exception as log_error:
                    logger.error(f"Failed to create audit log: {log_error}")

        return decorated_function

    return decorator


class SecurityHeaders:
    """Security headers middleware"""

    @staticmethod
    def apply_security_headers(response: Any) -> Any:
        """Apply security headers to response"""
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if request.is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        csp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';"
        response.headers["Content-Security-Policy"] = csp
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=()"
        )
        return response


class InputValidator:
    """Input validation utilities"""

    @staticmethod
    def validate_uuid(uuid_string: str) -> bool:
        """Validate UUID format"""
        import re

        uuid_pattern = re.compile(
            "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
            re.IGNORECASE,
        )
        return bool(uuid_pattern.match(uuid_string))

    @staticmethod
    def validate_wallet_address(address: str) -> bool:
        """Validate Ethereum wallet address"""
        import re

        if not address or len(address) != 42:
            return False
        pattern = re.compile("^0x[a-fA-F0-9]{40}$")
        return bool(pattern.match(address))

    @staticmethod
    def sanitize_string(input_string: str, max_length: int = 255) -> str:
        """Sanitize string input"""
        if not input_string:
            return ""
        sanitized = "".join(
            (char for char in input_string if ord(char) >= 32 or char in "\t\n\r")
        )
        return sanitized[:max_length].strip()

    @staticmethod
    def validate_decimal_precision(
        value: str, max_digits: int, decimal_places: int
    ) -> bool:
        """Validate decimal precision for financial calculations"""
        try:
            from decimal import Decimal, InvalidOperation

            decimal_value = Decimal(value)
            sign, digits, exponent = decimal_value.as_tuple()
            if len(digits) > max_digits:
                return False
            # exponent can be 'n', 'N', 'F' for special values or int for normal values
            if isinstance(exponent, int) and exponent < -decimal_places:
                return False
            return True
        except (InvalidOperation, ValueError):
            return False


class CryptoUtils:
    """Cryptographic utilities"""

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate cryptographically secure random token"""
        return secrets.token_urlsafe(length)

    @staticmethod
    def hash_sensitive_data(data: str, salt: Optional[str] = None) -> tuple:
        """Hash sensitive data with salt"""
        if salt is None:
            salt = secrets.token_hex(16)
        import base64

        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(), length=32, salt=salt.encode(), iterations=100000
        )
        key = base64.urlsafe_b64encode(kdf.derive(data.encode()))
        return (key.decode(), salt)

    @staticmethod
    def verify_signature(message: str, signature: str, secret_key: str) -> bool:
        """Verify HMAC signature"""
        try:
            expected_signature = hmac.new(
                secret_key.encode(), message.encode(), hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(signature, expected_signature)
        except Exception:
            return False

    @staticmethod
    def encrypt_sensitive_field(data: str, key: bytes) -> str:
        """Encrypt sensitive field data"""
        from cryptography.fernet import Fernet

        f = Fernet(key)
        encrypted_data = f.encrypt(data.encode())
        return encrypted_data.decode()

    @staticmethod
    def decrypt_sensitive_field(encrypted_data: str, key: bytes) -> str:
        """Decrypt sensitive field data"""
        from cryptography.fernet import Fernet

        f = Fernet(key)
        decrypted_data = f.decrypt(encrypted_data.encode())
        return decrypted_data.decode()


class RiskAssessment:
    """Risk assessment utilities"""

    @staticmethod
    def calculate_transaction_risk_score(
        amount: float,
        user_history_score: int,
        counterparty_score: int,
        transaction_type: str,
        geographic_risk: int = 0,
    ) -> int:
        """Calculate transaction risk score (0-100)"""
        if amount > 100000:
            amount_risk = 30
        elif amount > 50000:
            amount_risk = 20
        elif amount > 10000:
            amount_risk = 10
        else:
            amount_risk = 5
        user_risk = max(0, 20 - user_history_score)
        counterparty_risk = max(0, 20 - counterparty_score)
        type_risk_map = {
            "deposit": 5,
            "withdrawal": 15,
            "trade_buy": 10,
            "trade_sell": 10,
            "transfer_out": 20,
            "retirement": 5,
        }
        type_risk = type_risk_map.get(transaction_type, 10)
        total_risk = min(
            100,
            amount_risk + user_risk + counterparty_risk + type_risk + geographic_risk,
        )
        return total_risk

    @staticmethod
    def assess_login_risk(
        user_id: int, ip_address: str, user_agent: str, failed_attempts: int = 0
    ) -> tuple:
        """Assess login risk and return risk level and score"""
        risk_score = 0
        risk_factors = []
        if failed_attempts > 0:
            risk_score += min(30, failed_attempts * 10)
            risk_factors.append(f"Failed attempts: {failed_attempts}")
        if risk_score >= 70:
            risk_level = "critical"
        elif risk_score >= 50:
            risk_level = "high"
        elif risk_score >= 30:
            risk_level = "medium"
        else:
            risk_level = "low"
        return (risk_level, risk_score, risk_factors)


class AdvancedSecurityManager:
    """Advanced security manager for financial applications"""

    def __init__(self, app: Any = None) -> None:
        self.app = app
        self.redis_client = None
        if app is not None:
            self.init_app(app)

    def init_app(self, app: Any) -> Any:
        """Initialize advanced security manager"""
        self.app = app
        try:
            import redis

            self.redis_client = redis.from_url(
                app.config.get("REDIS_URL", "redis://localhost:6379/0")
            )
            self.redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis not available for advanced security features: {e}")

    def generate_mfa_secret(self, user_email: str) -> dict:
        """Generate MFA secret and QR code"""
        try:
            import base64
            from io import BytesIO

            import pyotp
            import qrcode

            secret = pyotp.random_base32()
            totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
                name=user_email, issuer_name="CarbonXchange"
            )
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(totp_uri)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            qr_code_data = base64.b64encode(buffer.getvalue()).decode()
            return {
                "secret": secret,
                "qr_code": f"data:image/png;base64,{qr_code_data}",
                "manual_entry_key": secret,
            }
        except ImportError:
            logger.warning("MFA dependencies not available")
            return {
                "secret": secrets.token_hex(16),
                "qr_code": None,
                "manual_entry_key": None,
            }

    def verify_mfa_token(self, secret: str, token: str) -> bool:
        """Verify MFA token"""
        try:
            import pyotp

            totp = pyotp.TOTP(secret)
            return totp.verify(token, valid_window=1)
        except ImportError:
            logger.warning("MFA verification not available")
            return False
        except Exception as e:
            logger.error(f"MFA verification error: {e}")
            return False

    def check_rate_limit(self, key: str, limit: int, window: int = 3600) -> bool:
        """Advanced rate limiting with sliding window"""
        if not self.redis_client:
            return True
        try:
            now = time.time()
            pipeline = self.redis_client.pipeline()
            pipeline.zremrangebyscore(f"rate_limit:{key}", 0, now - window)
            pipeline.zcard(f"rate_limit:{key}")
            pipeline.zadd(f"rate_limit:{key}", {str(now): now})
            pipeline.expire(f"rate_limit:{key}", window)
            results = pipeline.execute()
            current_count = results[1]
            return current_count < limit
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            return True

    def detect_anomalous_behavior(
        self, user_id: int, action: str, context: dict
    ) -> dict:
        """Detect anomalous user behavior patterns"""
        if not self.redis_client:
            return {"anomaly_score": 0, "risk_level": "low"}
        try:
            behavior_key = f"user_behavior:{user_id}"
            recent_actions = self.redis_client.lrange(f"{behavior_key}:actions", 0, 99)
            anomaly_score = 0
            current_hour = datetime.now().hour
            typical_hours = [
                int(h)
                for h in self.redis_client.smembers(f"{behavior_key}:hours") or []
            ]
            if typical_hours and current_hour not in typical_hours:
                anomaly_score += 20
            action_count_today = len(
                [a for a in recent_actions if action in a.decode()]
            )
            if action_count_today > 10:
                anomaly_score += 30
            current_ip = request.remote_addr if request else None
            if current_ip:
                known_ips = self.redis_client.smembers(f"{behavior_key}:ips")
                if known_ips and current_ip.encode() not in known_ips:
                    anomaly_score += 25
            self.redis_client.lpush(
                f"{behavior_key}:actions", f"{action}:{time.time()}"
            )
            self.redis_client.ltrim(f"{behavior_key}:actions", 0, 99)
            self.redis_client.sadd(f"{behavior_key}:hours", current_hour)
            if current_ip:
                self.redis_client.sadd(f"{behavior_key}:ips", current_ip)
            if anomaly_score >= 60:
                risk_level = "critical"
            elif anomaly_score >= 40:
                risk_level = "high"
            elif anomaly_score >= 20:
                risk_level = "medium"
            else:
                risk_level = "low"
            return {
                "anomaly_score": anomaly_score,
                "risk_level": risk_level,
                "factors": {
                    "unusual_time": (
                        current_hour not in typical_hours if typical_hours else False
                    ),
                    "high_frequency": action_count_today > 10,
                    "new_location": current_ip
                    and current_ip.encode() not in (known_ips or set()),
                },
            }
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
            return {"anomaly_score": 0, "risk_level": "low"}


def require_mfa_verification(f: Any) -> Any:
    """Require MFA verification for sensitive operations"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if not claims.get("mfa_verified"):
            return (
                jsonify({"error": "MFA verification required for this operation"}),
                403,
            )
        return f(*args, **kwargs)

    return decorated_function


def advanced_rate_limit(limit: int, window: int = 3600) -> Any:
    """Advanced rate limiting decorator"""

    def decorator(f):

        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            key = f"{request.remote_addr}:{request.endpoint}"
            security_manager = getattr(current_app, "advanced_security_manager", None)
            if security_manager and (
                not security_manager.check_rate_limit(key, limit, window)
            ):
                return (
                    jsonify({"error": "Rate limit exceeded", "retry_after": window}),
                    429,
                )
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def anomaly_detection(f: Any) -> Any:
    """Anomaly detection decorator"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            current_user_uuid = get_jwt_identity()
            user = User.query.filter_by(uuid=current_user_uuid).first()
            if user:
                security_manager = getattr(
                    current_app, "advanced_security_manager", None
                )
                if security_manager:
                    anomaly_result = security_manager.detect_anomalous_behavior(
                        user.id,
                        request.endpoint or "unknown",
                        {"method": request.method, "ip": request.remote_addr},
                    )
                    if anomaly_result["risk_level"] in ["high", "critical"]:
                        logger.warning(
                            f"Anomalous behavior detected for user {user.email}: {anomaly_result}"
                        )
                        if anomaly_result["risk_level"] == "critical":
                            return (
                                jsonify(
                                    {
                                        "error": "Additional verification required due to unusual activity",
                                        "anomaly_score": anomaly_result[
                                            "anomaly_score"
                                        ],
                                    }
                                ),
                                403,
                            )
        except Exception as e:
            logger.error(f"Anomaly detection error: {e}")
        return f(*args, **kwargs)

    return decorated_function


def init_security(app: Any) -> Any:
    """Initialize security features for the Flask app"""
    advanced_security_manager = AdvancedSecurityManager(app)
    app.advanced_security_manager = advanced_security_manager

    @app.after_request
    def apply_security_headers(response):
        return SecurityHeaders.apply_security_headers(response)

    @app.before_request
    def security_context():
        g.request_id = CryptoUtils.generate_secure_token(8)
        g.request_start_time = time.time()

    logger.info("Security features initialized")
