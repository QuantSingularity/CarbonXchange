"""
Test configuration and fixtures for CarbonXchange Backend
"""

import os
import tempfile
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import pytest
from src.main import create_app
from src.models import db
from src.models.carbon_credit import (
    CarbonCredit,
    CarbonProject,
    CreditStatus,
    ProjectStatus,
    ProjectType,
)
from src.models.trading import Portfolio
from src.models.user import KYCStatus, RiskLevel, User, UserKYC, UserProfile, UserStatus


@pytest.fixture(scope="session")
def app() -> Any:
    """Create application for testing"""
    db_fd, db_path = tempfile.mkstemp()
    app = create_app("testing")
    app.config.update(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "SQLALCHEMY_TRACK_MODIFICATIONS": False,
            "SECRET_KEY": "test-secret-key-32-chars-minimum!",
            "JWT_SECRET_KEY": "test-jwt-secret-key-32-chars-min!!",
            "WTF_CSRF_ENABLED": False,
            "AUDIT_LOG_ENABLED": True,
        }
    )
    with app.app_context():
        db.create_all()
        yield app
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app: Any) -> Any:
    """Create test client"""
    return app.test_client()


@pytest.fixture
def runner(app: Any) -> Any:
    """Create test CLI runner"""
    return app.test_cli_runner()


@pytest.fixture
def db_session(app: Any) -> Any:
    """Create database session for testing"""
    with app.app_context():
        yield db.session
        db.session.rollback()


@pytest.fixture
def sample_user(db_session: Any, app: Any) -> Any:
    """Create sample user for testing"""
    with app.app_context():
        user = User(
            email="test@example.com",
            password="TestPassword123!",
            first_name="Test",
            last_name="User",
            status=UserStatus.ACTIVE,
            risk_level=RiskLevel.MEDIUM,
        )
        user.email_verified_at = datetime.now(timezone.utc)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user


@pytest.fixture
def sample_user_profile(db_session: Any, sample_user: Any, app: Any) -> Any:
    """Create sample user profile"""
    with app.app_context():
        profile = UserProfile(
            user_id=sample_user.id,
            country="USA",
            timezone="UTC",
        )
        db_session.add(profile)
        db_session.commit()
        return profile


@pytest.fixture
def sample_kyc(db_session: Any, sample_user: Any, app: Any) -> Any:
    """Create sample KYC record"""
    with app.app_context():
        kyc = UserKYC(
            user_id=sample_user.id,
            status=KYCStatus.APPROVED,
            identity_verified=True,
            address_verified=True,
            email_verified=True,
            approved_at=datetime.now(timezone.utc),
        )
        db_session.add(kyc)
        db_session.commit()
        return kyc


@pytest.fixture
def sample_project(db_session: Any, app: Any) -> Any:
    """Create a sample carbon project"""
    with app.app_context():
        project = CarbonProject(
            name="Test Reforestation Project",
            project_type=ProjectType.REFORESTATION,
            status=ProjectStatus.ACTIVE,
            country="BR",
            description="A test reforestation project",
            total_credits=Decimal("10000"),
            available_credits=Decimal("8000"),
        )
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        return project


@pytest.fixture
def sample_credit(db_session: Any, sample_project: Any, app: Any) -> Any:
    """Create a sample carbon credit"""
    with app.app_context():
        credit = CarbonCredit(
            project_id=sample_project.id,
            serial_number="CC-TEST-001",
            vintage_year=2023,
            quantity=Decimal("100"),
            status=CreditStatus.AVAILABLE,
            price_per_unit=Decimal("25.00"),
        )
        db_session.add(credit)
        db_session.commit()
        db_session.refresh(credit)
        return credit


@pytest.fixture
def sample_portfolio(db_session: Any, sample_user: Any, app: Any) -> Any:
    """Create a sample portfolio"""
    with app.app_context():
        from src.models.trading import PortfolioType

        portfolio = Portfolio(
            user_id=sample_user.id,
            name="Test Portfolio",
            portfolio_type=PortfolioType.PERSONAL,
        )
        db_session.add(portfolio)
        db_session.commit()
        db_session.refresh(portfolio)
        return portfolio


def make_user(db_session, app, **overrides):
    """Helper to create a user with defaults"""
    defaults = {
        "email": f"user_{os.urandom(4).hex()}@example.com",
        "password": "TestPassword123!",
        "first_name": "Test",
        "last_name": "User",
        "status": UserStatus.ACTIVE,
        "risk_level": RiskLevel.MEDIUM,
    }
    defaults.update(overrides)
    with app.app_context():
        user = User(**defaults)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user
