"""
Authentication Service for CarbonXchange Backend
Implements enterprise-grade authentication with financial industry security standards
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import pyotp
import redis
from flask import current_app, request
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token

from ..models import db
from ..models.user import User, UserSession, UserStatus
from .audit_service import AuditService

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Custom authentication error"""


class AuthorizationError(Exception):
    """Custom authorization error"""


class AuthService:
    """
    Comprehensive authentication service implementing financial industry security standards
    """

    def __init__(self) -> None:
        self.redis_client = None
        self.audit_service = AuditService()
        self._init_redis()

    def _init_redis(self) -> Any:
        """Initialize Redis connection for session management"""
        try:
            redis_url = current_app.config.get("REDIS_URL")
            if redis_url:
                self.redis_client = redis.from_url(redis_url)
                self.redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis not available for session management: {e}")

    def register_user(
        self,
        email: str,
        password: str,
        first_name: str,
        last_name: str,
        phone_number: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Register a new user with comprehensive validation and security measures

        Args:
            email: User email address
            password: User password
            first_name: User first name
            last_name: User last name
            phone_number: Optional phone number
            **kwargs: Additional user attributes

        Returns:
            Dictionary containing user data and tokens

        Raises:
            AuthenticationError: If registration fails
        """
        try:
            existing_user = User.query.filter_by(email=email.lower().strip()).first()
            if existing_user:
                self.audit_service.log_event(
                    event_type="registration_failed",
                    event_category="authentication",
                    event_description=f"Registration attempt with existing email: {email}",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message="Email already registered",
                )
                raise AuthenticationError("Email address is already registered")
            user = User(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                phone_number=phone_number,
                **kwargs,
            )
            if current_app.config.get("KYC_VERIFICATION_REQUIRED", True):
                user.status = UserStatus.PENDING
            else:
                user.status = UserStatus.ACTIVE
                user.is_verified = True
            db.session.add(user)
            db.session.commit()
            access_token = self._create_access_token(user)
            refresh_token = self._create_refresh_token(user)
            session = self._create_session(user, access_token, refresh_token)
            self.audit_service.log_event(
                user_id=user.id,
                event_type="user_registered",
                event_category="authentication",
                event_description=f"New user registered: {user.email}",
                ip_address=self._get_client_ip(),
                session_id=session.session_token,
                success=True,
            )
            logger.info(f"New user registered: {user.email}")
            return {
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": current_app.config[
                    "JWT_ACCESS_TOKEN_EXPIRES"
                ].total_seconds(),
            }
        except AuthenticationError:
            raise
        except Exception as e:
            db.session.rollback()
            logger.error(f"Registration error: {str(e)}")
            raise AuthenticationError("Registration failed due to internal error")

    def authenticate_user(
        self, email: str, password: str, mfa_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate user with comprehensive security checks

        Args:
            email: User email address
            password: User password
            mfa_code: Optional MFA code for two-factor authentication

        Returns:
            Dictionary containing user data and tokens

        Raises:
            AuthenticationError: If authentication fails
        """
        try:
            user = User.query.filter_by(email=email.lower().strip()).first()
            if not user:
                self.audit_service.log_event(
                    event_type="login_failed",
                    event_category="authentication",
                    event_description=f"Login attempt with non-existent email: {email}",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message="Invalid credentials",
                )
                raise AuthenticationError("Invalid email or password")
            if user.status in [UserStatus.SUSPENDED, UserStatus.CLOSED]:
                self.audit_service.log_event(
                    user_id=user.id,
                    event_type="login_blocked",
                    event_category="authentication",
                    event_description=f"Login blocked for {user.status.value} account",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message=f"Account is {user.status.value}",
                )
                raise AuthenticationError(f"Account is {user.status.value}")
            if user.is_locked:
                self.audit_service.log_event(
                    user_id=user.id,
                    event_type="login_blocked",
                    event_category="authentication",
                    event_description="Login blocked for locked account",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message="Account is temporarily locked",
                )
                raise AuthenticationError(
                    "Account is temporarily locked due to multiple failed login attempts"
                )
            if not user.check_password(password):
                self.audit_service.log_event(
                    user_id=user.id,
                    event_type="login_failed",
                    event_category="authentication",
                    event_description="Login failed - invalid password",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message="Invalid credentials",
                )
                db.session.commit()
                raise AuthenticationError("Invalid email or password")
            if user.mfa_enabled:
                if not mfa_code:
                    raise AuthenticationError("MFA code required")
                if not self._verify_mfa_code(user, mfa_code):
                    self.audit_service.log_event(
                        user_id=user.id,
                        event_type="mfa_failed",
                        event_category="authentication",
                        event_description="MFA verification failed",
                        ip_address=self._get_client_ip(),
                        success=False,
                        error_message="Invalid MFA code",
                    )
                    raise AuthenticationError("Invalid MFA code")
            user.last_login_at = datetime.now(timezone.utc)
            user.last_login_ip = self._get_client_ip()
            user.last_activity_at = datetime.now(timezone.utc)
            user.failed_login_attempts = 0
            access_token = self._create_access_token(user)
            refresh_token = self._create_refresh_token(user)
            session = self._create_session(user, access_token, refresh_token)
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="login_success",
                event_category="authentication",
                event_description="User logged in successfully",
                ip_address=self._get_client_ip(),
                session_id=session.session_token,
                success=True,
            )
            logger.info(f"User logged in: {user.email}")
            return {
                "user": user.to_dict(),
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_type": "Bearer",
                "expires_in": current_app.config[
                    "JWT_ACCESS_TOKEN_EXPIRES"
                ].total_seconds(),
                "mfa_enabled": user.mfa_enabled,
            }
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            raise AuthenticationError("Authentication failed due to internal error")

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh access token using refresh token

        Args:
            refresh_token: Valid refresh token

        Returns:
            Dictionary containing new tokens

        Raises:
            AuthenticationError: If refresh fails
        """
        try:
            decoded_token = decode_token(refresh_token)
            user_id = decoded_token["sub"]
            user = User.query.get(user_id)
            if not user or not user.is_active:
                raise AuthenticationError("Invalid refresh token")
            session = UserSession.query.filter_by(
                user_id=user.id, refresh_token=refresh_token, is_active=True
            ).first()
            if not session or session.is_expired():
                raise AuthenticationError("Invalid or expired refresh token")
            new_access_token = self._create_access_token(user)
            new_refresh_token = self._create_refresh_token(user)
            session.session_token = self._generate_session_token()
            session.refresh_token = new_refresh_token
            session.last_activity_at = datetime.now(timezone.utc)
            session.expires_at = (
                datetime.now(timezone.utc)
                + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"]
            )
            user.last_activity_at = datetime.now(timezone.utc)
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="token_refreshed",
                event_category="authentication",
                event_description="Access token refreshed",
                ip_address=self._get_client_ip(),
                session_id=session.session_token,
                success=True,
            )
            return {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token,
                "token_type": "Bearer",
                "expires_in": current_app.config[
                    "JWT_ACCESS_TOKEN_EXPIRES"
                ].total_seconds(),
            }
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise AuthenticationError("Token refresh failed")

    def logout_user(self, user_id: int, session_token: Optional[str] = None) -> bool:
        """
        Logout user and invalidate session

        Args:
            user_id: User ID
            session_token: Optional session token to logout specific session

        Returns:
            True if logout successful
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return False
            if session_token:
                session = UserSession.query.filter_by(
                    user_id=user_id, session_token=session_token, is_active=True
                ).first()
                if session:
                    session.terminate()
            else:
                sessions = UserSession.query.filter_by(
                    user_id=user_id, is_active=True
                ).all()
                for session in sessions:
                    session.terminate()
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="logout",
                event_category="authentication",
                event_description="User logged out",
                ip_address=self._get_client_ip(),
                session_id=session_token,
                success=True,
            )
            logger.info(f"User logged out: {user.email}")
            return True
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return False

    def setup_mfa(self, user_id: int) -> Dict[str, Any]:
        """
        Setup multi-factor authentication for user

        Args:
            user_id: User ID

        Returns:
            Dictionary containing MFA setup information
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise AuthenticationError("User not found")
            secret = pyotp.random_base32()
            user.mfa_secret = secret
            totp = pyotp.TOTP(secret)
            qr_url = totp.provisioning_uri(name=user.email, issuer_name="CarbonXchange")
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="mfa_setup",
                event_category="security",
                event_description="MFA setup initiated",
                ip_address=self._get_client_ip(),
                success=True,
            )
            return {
                "secret": secret,
                "qr_url": qr_url,
                "backup_codes": self._generate_backup_codes(user),
            }
        except Exception as e:
            logger.error(f"MFA setup error: {str(e)}")
            raise AuthenticationError("MFA setup failed")

    def enable_mfa(self, user_id: int, verification_code: str) -> bool:
        """
        Enable MFA after verification

        Args:
            user_id: User ID
            verification_code: MFA verification code

        Returns:
            True if MFA enabled successfully
        """
        try:
            user = User.query.get(user_id)
            if not user or not user.mfa_secret:
                raise AuthenticationError("MFA not set up")
            if not self._verify_mfa_code(user, verification_code):
                raise AuthenticationError("Invalid verification code")
            user.mfa_enabled = True
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="mfa_enabled",
                event_category="security",
                event_description="MFA enabled for account",
                ip_address=self._get_client_ip(),
                success=True,
            )
            logger.info(f"MFA enabled for user: {user.email}")
            return True
        except Exception as e:
            logger.error(f"MFA enable error: {str(e)}")
            raise AuthenticationError("Failed to enable MFA")

    def disable_mfa(self, user_id: int, password: str, verification_code: str) -> bool:
        """
        Disable MFA with password and code verification

        Args:
            user_id: User ID
            password: User password
            verification_code: MFA verification code

        Returns:
            True if MFA disabled successfully
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise AuthenticationError("User not found")
            if not user.check_password(password):
                raise AuthenticationError("Invalid password")
            if user.mfa_enabled and (
                not self._verify_mfa_code(user, verification_code)
            ):
                raise AuthenticationError("Invalid verification code")
            user.mfa_enabled = False
            user.mfa_secret = None
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="mfa_disabled",
                event_category="security",
                event_description="MFA disabled for account",
                ip_address=self._get_client_ip(),
                success=True,
            )
            logger.info(f"MFA disabled for user: {user.email}")
            return True
        except Exception as e:
            logger.error(f"MFA disable error: {str(e)}")
            raise AuthenticationError("Failed to disable MFA")

    def change_password(
        self, user_id: int, current_password: str, new_password: str
    ) -> bool:
        """
        Change user password with validation

        Args:
            user_id: User ID
            current_password: Current password
            new_password: New password

        Returns:
            True if password changed successfully
        """
        try:
            user = User.query.get(user_id)
            if not user:
                raise AuthenticationError("User not found")
            if not user.check_password(current_password):
                self.audit_service.log_event(
                    user_id=user.id,
                    event_type="password_change_failed",
                    event_category="security",
                    event_description="Password change failed - invalid current password",
                    ip_address=self._get_client_ip(),
                    success=False,
                    error_message="Invalid current password",
                )
                raise AuthenticationError("Invalid current password")
            user.set_password(new_password)
            current_session_token = self._get_current_session_token()
            sessions = UserSession.query.filter_by(
                user_id=user_id, is_active=True
            ).all()
            for session in sessions:
                if session.session_token != current_session_token:
                    session.terminate()
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="password_changed",
                event_category="security",
                event_description="Password changed successfully",
                ip_address=self._get_client_ip(),
                success=True,
            )
            logger.info(f"Password changed for user: {user.email}")
            return True
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Password change error: {str(e)}")
            raise AuthenticationError("Password change failed")

    def reset_password_request(self, email: str) -> bool:
        """
        Request password reset

        Args:
            email: User email address

        Returns:
            True if reset request processed
        """
        try:
            user = User.query.filter_by(email=email.lower().strip()).first()
            if not user:
                return True
            reset_token = secrets.token_urlsafe(32)
            datetime.now(timezone.utc) + timedelta(hours=1)
            if self.redis_client:
                self.redis_client.setex(f"password_reset:{reset_token}", 3600, user.id)
            self.audit_service.log_event(
                user_id=user.id,
                event_type="password_reset_requested",
                event_category="security",
                event_description="Password reset requested",
                ip_address=self._get_client_ip(),
                success=True,
                metadata={
                    "reset_token_hash": hashlib.sha256(reset_token.encode()).hexdigest()
                },
            )
            logger.info(f"Password reset requested for user: {user.email}")
            return True
        except Exception as e:
            logger.error(f"Password reset request error: {str(e)}")
            return False

    def reset_password(self, reset_token: str, new_password: str) -> bool:
        """
        Reset password using reset token

        Args:
            reset_token: Password reset token
            new_password: New password

        Returns:
            True if password reset successfully
        """
        try:
            if not self.redis_client:
                raise AuthenticationError("Password reset not available")
            user_id = self.redis_client.get(f"password_reset:{reset_token}")
            if not user_id:
                raise AuthenticationError("Invalid or expired reset token")
            user = User.query.get(int(user_id))
            if not user:
                raise AuthenticationError("Invalid reset token")
            user.set_password(new_password)
            sessions = UserSession.query.filter_by(
                user_id=user.id, is_active=True
            ).all()
            for session in sessions:
                session.terminate()
            self.redis_client.delete(f"password_reset:{reset_token}")
            db.session.commit()
            self.audit_service.log_event(
                user_id=user.id,
                event_type="password_reset_completed",
                event_category="security",
                event_description="Password reset completed",
                ip_address=self._get_client_ip(),
                success=True,
            )
            logger.info(f"Password reset completed for user: {user.email}")
            return True
        except AuthenticationError:
            raise
        except Exception as e:
            logger.error(f"Password reset error: {str(e)}")
            raise AuthenticationError("Password reset failed")

    def get_user_sessions(self, user_id: int) -> list:
        """
        Get active sessions for user

        Args:
            user_id: User ID

        Returns:
            List of active sessions
        """
        try:
            sessions = (
                UserSession.query.filter_by(user_id=user_id, is_active=True)
                .order_by(UserSession.last_activity_at.desc())
                .all()
            )
            return [session.to_dict() for session in sessions]
        except Exception as e:
            logger.error(f"Get sessions error: {str(e)}")
            return []

    def terminate_session(self, user_id: int, session_id: int) -> bool:
        """
        Terminate specific session

        Args:
            user_id: User ID
            session_id: Session ID to terminate

        Returns:
            True if session terminated
        """
        try:
            session = UserSession.query.filter_by(
                id=session_id, user_id=user_id, is_active=True
            ).first()
            if session:
                session.terminate()
                db.session.commit()
                self.audit_service.log_event(
                    user_id=user_id,
                    event_type="session_terminated",
                    event_category="security",
                    event_description=f"Session {session_id} terminated",
                    ip_address=self._get_client_ip(),
                    success=True,
                )
                return True
            return False
        except Exception as e:
            logger.error(f"Terminate session error: {str(e)}")
            return False

    def _create_access_token(self, user: User) -> str:
        """Create JWT access token"""
        additional_claims = {
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "status": user.status.value,
            "is_verified": user.is_verified,
        }
        return create_access_token(
            identity=user.id, additional_claims=additional_claims
        )

    def _create_refresh_token(self, user: User) -> str:
        """Create JWT refresh token"""
        return create_refresh_token(identity=user.id)

    def _create_session(
        self, user: User, access_token: str, refresh_token: str
    ) -> UserSession:
        """Create session record"""
        session = UserSession(
            user_id=user.id,
            session_token=self._generate_session_token(),
            refresh_token=refresh_token,
            device_fingerprint=self._get_device_fingerprint(),
            user_agent=request.headers.get("User-Agent", ""),
            ip_address=self._get_client_ip(),
            expires_at=datetime.now(timezone.utc)
            + current_app.config["JWT_REFRESH_TOKEN_EXPIRES"],
        )
        db.session.add(session)
        return session

    def _generate_session_token(self) -> str:
        """Generate unique session token"""
        return secrets.token_urlsafe(32)

    def _verify_mfa_code(self, user: User, code: str) -> bool:
        """Verify MFA code"""
        if not user.mfa_secret:
            return False
        totp = pyotp.TOTP(user.mfa_secret)
        return totp.verify(code, valid_window=1)

    def _generate_backup_codes(self, user: User) -> list:
        """Generate MFA backup codes"""
        codes = []
        for _ in range(10):
            codes.append(secrets.token_hex(4).upper())
        return codes

    def _get_client_ip(self) -> str:
        """Get client IP address"""
        if request:
            return request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
        return "unknown"

    def _get_device_fingerprint(self) -> str:
        """Generate device fingerprint"""
        if request:
            user_agent = request.headers.get("User-Agent", "")
            accept_language = request.headers.get("Accept-Language", "")
            accept_encoding = request.headers.get("Accept-Encoding", "")
            fingerprint_data = f"{user_agent}:{accept_language}:{accept_encoding}"
            return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]
        return "unknown"

    def _get_current_session_token(self) -> Optional[str]:
        """Get current session token from request"""
        return None
