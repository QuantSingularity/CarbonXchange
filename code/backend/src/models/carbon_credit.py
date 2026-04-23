"""
Carbon Credit models for CarbonXchange Backend
Implements comprehensive carbon credit and project management with enhanced trading features
"""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from sqlalchemy import JSON, Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship

from . import db


class ProjectType(Enum):
    """Carbon project type enumeration"""

    RENEWABLE_ENERGY = "renewable_energy"
    REFORESTATION = "reforestation"
    AFFORESTATION = "afforestation"
    METHANE_CAPTURE = "methane_capture"
    ENERGY_EFFICIENCY = "energy_efficiency"
    INDUSTRIAL_PROCESS = "industrial_process"
    TRANSPORTATION = "transportation"
    AGRICULTURE = "agriculture"
    WASTE_MANAGEMENT = "waste_management"
    BLUE_CARBON = "blue_carbon"
    DIRECT_AIR_CAPTURE = "direct_air_capture"
    BIOCHAR = "biochar"
    NATURE_BASED_SOLUTIONS = "nature_based_solutions"
    COOKSTOVES = "cookstoves"
    LANDFILL_GAS = "landfill_gas"


class ProjectStatus(Enum):
    """Carbon project status enumeration"""

    DEVELOPMENT = "development"
    VALIDATION = "validation"
    REGISTERED = "registered"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    UNDER_REVIEW = "under_review"


class CreditStatus(Enum):
    """Carbon credit status enumeration"""

    PENDING = "pending"
    VERIFIED = "verified"
    ISSUED = "issued"
    AVAILABLE = "available"
    RESERVED = "reserved"
    TRADED = "traded"
    RETIRED = "retired"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    LOCKED = "locked"


class CreditStandard(Enum):
    """Carbon credit standard enumeration"""

    VCS = "vcs"
    CDM = "cdm"
    GOLD_STANDARD = "gold_standard"
    CAR = "car"
    ACR = "acr"
    PLAN_VIVO = "plan_vivo"
    CCBS = "ccbs"
    REDD_PLUS = "redd_plus"
    JI = "ji"
    CORSIA = "corsia"


class VerificationStatus(Enum):
    """Verification status enumeration"""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PENDING_REVIEW = "pending_review"
    VERIFIED = "verified"
    REJECTED = "rejected"
    EXPIRED = "expired"


class CarbonProject(db.Model):
    """Carbon project model representing emission reduction projects"""

    __tablename__ = "carbon_projects"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    project_type: "Column[Any]" = Column(
        SQLEnum(ProjectType), nullable=False, index=True
    )
    status = Column(
        SQLEnum(ProjectStatus),
        nullable=False,
        default=ProjectStatus.DEVELOPMENT,
        index=True,
    )
    project_id = Column(String(100), unique=True, nullable=True, index=True)
    registry_id = Column(String(100), nullable=True, index=True)
    standard: "Column[Any]" = Column(SQLEnum(CreditStandard), nullable=True, index=True)
    country = Column(String(3), nullable=False, index=True)
    region = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 8), nullable=True)
    longitude = Column(Numeric(11, 8), nullable=True)
    methodology = Column(String(100), nullable=True)
    baseline_scenario = Column(Text, nullable=True)
    additionality_test = Column(Text, nullable=True)
    monitoring_plan = Column(Text, nullable=True)
    safeguards = Column(JSON, nullable=True)
    annual_emission_reductions = Column(Numeric(15, 4), nullable=True)
    total_emission_reductions = Column(Numeric(15, 4), nullable=True)
    actual_reductions_to_date = Column(Numeric(15, 4), nullable=False, default=0)
    project_start_date = Column(DateTime, nullable=True)
    project_end_date = Column(DateTime, nullable=True)
    crediting_period_start = Column(DateTime, nullable=True)
    crediting_period_end = Column(DateTime, nullable=True)
    validation_date = Column(DateTime, nullable=True)
    validator = Column(String(255), nullable=True)
    validation_status = Column(
        SQLEnum(VerificationStatus),
        nullable=False,
        default=VerificationStatus.NOT_STARTED,
    )
    last_verification_date = Column(DateTime, nullable=True)
    verifier = Column(String(255), nullable=True)
    verification_status = Column(
        SQLEnum(VerificationStatus),
        nullable=False,
        default=VerificationStatus.NOT_STARTED,
    )
    next_verification_due = Column(DateTime, nullable=True)
    developer_name = Column(String(255), nullable=True)
    developer_contact = Column(String(255), nullable=True)
    developer_website = Column(String(500), nullable=True)
    developer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    project_cost = Column(Numeric(15, 2), nullable=True)
    project_currency = Column(String(3), nullable=False, default="USD")
    funding_status = Column(String(50), nullable=True)
    project_document_url = Column(String(500), nullable=True)
    monitoring_report_url = Column(String(500), nullable=True)
    validation_report_url = Column(String(500), nullable=True)
    verification_report_url = Column(String(500), nullable=True)
    sdg_contributions = Column(JSON, nullable=True)
    co_benefits = Column(JSON, nullable=True)
    biodiversity_impact = Column(Text, nullable=True)
    community_impact = Column(Text, nullable=True)
    permanence_risk = Column(String(20), nullable=True)
    leakage_risk = Column(String(20), nullable=True)
    additionality_risk = Column(String(20), nullable=True)
    overall_risk_rating = Column(String(20), nullable=True)
    estimated_credit_price = Column(Numeric(10, 2), nullable=True)
    minimum_credit_price = Column(Numeric(10, 2), nullable=True)
    price_currency = Column(String(3), nullable=False, default="USD")
    total_credits = Column(Numeric(15, 4), nullable=True, default=0)
    available_credits_count = Column(Numeric(15, 4), nullable=True, default=0)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    credits = relationship(
        "CarbonCredit", back_populates="project", cascade="all, delete-orphan"
    )
    certificates = relationship(
        "CreditCertificate", back_populates="project", cascade="all, delete-orphan"
    )
    developer = relationship("User", foreign_keys=[developer_id])

    @hybrid_property
    def is_active(self) -> Any:
        """Check if project is active"""
        return self.status == ProjectStatus.ACTIVE

    @hybrid_property
    def total_credits_issued(self) -> Any:
        """Get total credits issued for this project"""
        return sum(
            (
                credit.quantity
                for credit in self.credits
                if credit.status
                in [
                    CreditStatus.ISSUED,
                    CreditStatus.AVAILABLE,
                    CreditStatus.TRADED,
                    CreditStatus.RETIRED,
                ]
            )
        )

    @hybrid_property
    def available_credits(self) -> Any:
        """Get available credits for trading"""
        return sum(
            (
                credit.quantity
                for credit in self.credits
                if credit.status == CreditStatus.AVAILABLE
            )
        )

    @hybrid_property
    def retired_credits(self) -> Any:
        """Get total retired credits"""
        return sum(
            (
                credit.quantity
                for credit in self.credits
                if credit.status == CreditStatus.RETIRED
            )
        )

    @hybrid_property
    def completion_percentage(self) -> Any:
        """Get project completion percentage"""
        if not self.total_emission_reductions or self.total_emission_reductions == 0:
            return 0
        return min(
            100, self.actual_reductions_to_date / self.total_emission_reductions * 100
        )

    @hybrid_property
    def is_verified(self) -> Any:
        """Check if project is verified"""
        return self.verification_status == VerificationStatus.VERIFIED

    def update_risk_rating(self) -> Any:
        """Update overall risk rating based on individual risk factors"""
        risks = [self.permanence_risk, self.leakage_risk, self.additionality_risk]
        risk_scores = {"low": 1, "medium": 2, "high": 3}
        valid_risks = [risk for risk in risks if risk is not None]
        if not valid_risks:
            self.overall_risk_rating = None
            return
        avg_score = sum((risk_scores.get(risk, 2) for risk in valid_risks)) / len(
            valid_risks
        )
        if avg_score <= 1.5:
            self.overall_risk_rating = "low"
        elif avg_score <= 2.5:
            self.overall_risk_rating = "medium"
        else:
            self.overall_risk_rating = "high"

    def to_dict(self, include_sensitive: Any = False) -> Any:
        """Convert project to dictionary"""
        data = {
            "id": self.id,
            "uuid": self.uuid,
            "name": self.name,
            "description": self.description,
            "project_type": self.project_type.value,
            "status": self.status.value,
            "project_id": self.project_id,
            "standard": self.standard.value if self.standard else None,
            "country": self.country,
            "region": self.region,
            "methodology": self.methodology,
            "annual_emission_reductions": (
                float(self.annual_emission_reductions)
                if self.annual_emission_reductions
                else None
            ),
            "total_emission_reductions": (
                float(self.total_emission_reductions)
                if self.total_emission_reductions
                else None
            ),
            "actual_reductions_to_date": float(self.actual_reductions_to_date),
            "completion_percentage": float(self.completion_percentage),
            "project_start_date": (
                self.project_start_date.isoformat() if self.project_start_date else None
            ),
            "project_end_date": (
                self.project_end_date.isoformat() if self.project_end_date else None
            ),
            "developer_name": self.developer_name,
            "validation_status": self.validation_status.value,
            "verification_status": self.verification_status.value,
            "is_verified": self.is_verified,
            "total_credits_issued": (
                float(self.total_credits_issued) if self.total_credits_issued else 0
            ),
            "available_credits": (
                float(self.available_credits) if self.available_credits else 0
            ),
            "retired_credits": (
                float(self.retired_credits) if self.retired_credits else 0
            ),
            "permanence_risk": self.permanence_risk,
            "leakage_risk": self.leakage_risk,
            "overall_risk_rating": self.overall_risk_rating,
            "estimated_credit_price": (
                float(self.estimated_credit_price)
                if self.estimated_credit_price
                else None
            ),
            "price_currency": self.price_currency,
            "sdg_contributions": self.sdg_contributions,
            "co_benefits": self.co_benefits,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_sensitive:
            data.update(
                {
                    "project_cost": (
                        float(self.project_cost) if self.project_cost else None
                    ),
                    "developer_contact": self.developer_contact,
                    "developer_id": self.developer_id,
                    "latitude": float(self.latitude) if self.latitude else None,
                    "longitude": float(self.longitude) if self.longitude else None,
                    "validation_date": (
                        self.validation_date.isoformat()
                        if self.validation_date
                        else None
                    ),
                    "validator": self.validator,
                    "last_verification_date": (
                        self.last_verification_date.isoformat()
                        if self.last_verification_date
                        else None
                    ),
                    "verifier": self.verifier,
                    "next_verification_due": (
                        self.next_verification_due.isoformat()
                        if self.next_verification_due
                        else None
                    ),
                    "funding_status": self.funding_status,
                    "minimum_credit_price": (
                        float(self.minimum_credit_price)
                        if self.minimum_credit_price
                        else None
                    ),
                }
            )
        return data

    def __repr__(self) -> Any:
        return f"<CarbonProject {self.name}>"


class CarbonCredit(db.Model):
    """Carbon credit model representing individual credit units"""

    __tablename__ = "carbon_credits"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    serial_number = Column(String(100), unique=True, nullable=False, index=True)
    batch_id = Column(String(100), nullable=True, index=True)
    project_id = Column(
        Integer, ForeignKey("carbon_projects.id"), nullable=False, index=True
    )
    quantity = Column(Numeric(15, 4), nullable=False)
    vintage_year = Column(Integer, nullable=False, index=True)
    status = Column(
        SQLEnum(CreditStatus), nullable=False, default=CreditStatus.PENDING, index=True
    )
    issued_date = Column(DateTime, nullable=True)
    issued_to = Column(String(255), nullable=True)
    registry_account = Column(String(100), nullable=True)
    current_owner_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    original_owner_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    owner_wallet_address = Column(String(42), nullable=True, index=True)
    is_tradeable = Column(Boolean, nullable=False, default=True)
    last_trade_date = Column(DateTime, nullable=True)
    last_trade_price = Column(Numeric(10, 4), nullable=True)
    last_trade_currency = Column(String(3), nullable=False, default="USD")
    market_price = Column(Numeric(10, 4), nullable=True)
    reserve_price = Column(Numeric(10, 4), nullable=True)
    price_per_unit = Column(Numeric(10, 4), nullable=True)
    credit_type = Column(String(100), nullable=True, index=True)
    retired_date = Column(DateTime, nullable=True)
    retired_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    retirement_reason = Column(String(255), nullable=True)
    retirement_certificate = Column(String(500), nullable=True)
    retirement_beneficiary = Column(String(255), nullable=True)
    token_id = Column(String(100), nullable=True, unique=True, index=True)
    blockchain_tx_hash = Column(String(66), nullable=True, index=True)
    smart_contract_address = Column(String(42), nullable=True)
    is_tokenized = Column(Boolean, nullable=False, default=False)
    buffer_pool_percentage = Column(Numeric(5, 2), nullable=True)
    leakage_percentage = Column(Numeric(5, 2), nullable=True)
    permanence_risk = Column(String(20), nullable=True)
    additionality_verified = Column(Boolean, nullable=False, default=False)
    verification_body = Column(String(255), nullable=True)
    verification_date = Column(DateTime, nullable=True)
    verification_report_url = Column(String(500), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    co_benefits = Column(JSON, nullable=True)
    compliance_standards = Column(JSON, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    project = relationship("CarbonProject", back_populates="credits")
    current_owner = relationship("User", foreign_keys=[current_owner_id])
    original_owner = relationship("User", foreign_keys=[original_owner_id])
    retired_by = relationship("User", foreign_keys=[retired_by_id])
    certificates = relationship(
        "CreditCertificate", back_populates="credit", cascade="all, delete-orphan"
    )
    transactions = relationship(
        "CreditTransaction", back_populates="credit", cascade="all, delete-orphan"
    )

    @hybrid_property
    def is_available(self) -> Any:
        """Check if credit is available for trading"""
        return self.status == CreditStatus.AVAILABLE and self.is_tradeable

    @hybrid_property
    def is_retired(self) -> Any:
        """Check if credit is retired"""
        return self.status == CreditStatus.RETIRED

    @hybrid_property
    def is_expired(self) -> Any:
        """Check if credit has expired"""
        if self.expiry_date is None:
            return False
        return datetime.now(timezone.utc) > self.expiry_date

    @hybrid_property
    def age_in_years(self) -> Any:
        """Get age of credit in years"""
        current_year = datetime.now(timezone.utc).year
        return current_year - self.vintage_year

    @hybrid_property
    def is_valid(self) -> Any:
        """Check if credit is currently valid"""
        now = datetime.now(timezone.utc)
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return not self.is_expired

    def retire(
        self, retired_by_id: Any, reason: Any = None, beneficiary: Any = None
    ) -> Any:
        """Retire the carbon credit"""
        self.status = CreditStatus.RETIRED
        self.retired_date = datetime.now(timezone.utc)
        self.retired_by_id = retired_by_id
        self.retirement_reason = reason
        self.retirement_beneficiary = beneficiary
        self.is_tradeable = False
        transaction = CreditTransaction(
            credit_id=self.id,
            transaction_type="retirement",
            from_user_id=self.current_owner_id,
            to_user_id=None,
            quantity=self.quantity,
            price=None,
            transaction_date=datetime.now(timezone.utc),
            notes=f"Credit retired: {reason}" if reason else "Credit retired",
        )
        db.session.add(transaction)

    def transfer_ownership(
        self,
        new_owner_id: Any,
        transaction_price: Any = None,
        wallet_address: Any = None,
    ) -> Any:
        """Transfer ownership of the credit"""
        old_owner_id = self.current_owner_id
        self.current_owner_id = new_owner_id
        self.owner_wallet_address = wallet_address
        self.updated_at = datetime.now(timezone.utc)
        if transaction_price:
            self.last_trade_price = transaction_price
            self.last_trade_date = datetime.now(timezone.utc)
        transaction = CreditTransaction(
            credit_id=self.id,
            transaction_type="transfer",
            from_user_id=old_owner_id,
            to_user_id=new_owner_id,
            quantity=self.quantity,
            price=transaction_price,
            transaction_date=datetime.now(timezone.utc),
        )
        db.session.add(transaction)

    def lock_credit(self, reason: Any = None) -> Any:
        """Lock credit to prevent trading"""
        self.status = CreditStatus.LOCKED
        self.is_tradeable = False
        transaction = CreditTransaction(
            credit_id=self.id,
            transaction_type="lock",
            from_user_id=self.current_owner_id,
            to_user_id=self.current_owner_id,
            quantity=self.quantity,
            price=None,
            transaction_date=datetime.now(timezone.utc),
            notes=f"Credit locked: {reason}" if reason else "Credit locked",
        )
        db.session.add(transaction)

    def unlock_credit(self) -> Any:
        """Unlock credit to allow trading"""
        if self.status == CreditStatus.LOCKED:
            self.status = CreditStatus.AVAILABLE
            self.is_tradeable = True
            transaction = CreditTransaction(
                credit_id=self.id,
                transaction_type="unlock",
                from_user_id=self.current_owner_id,
                to_user_id=self.current_owner_id,
                quantity=self.quantity,
                price=None,
                transaction_date=datetime.now(timezone.utc),
                notes="Credit unlocked",
            )
            db.session.add(transaction)

    def to_dict(self, include_sensitive: Any = False) -> Any:
        """Convert credit to dictionary"""
        data = {
            "id": self.id,
            "uuid": self.uuid,
            "serial_number": self.serial_number,
            "batch_id": self.batch_id,
            "project_id": self.project_id,
            "quantity": float(self.quantity),
            "vintage_year": self.vintage_year,
            "status": self.status.value,
            "is_tradeable": self.is_tradeable,
            "is_available": self.is_available,
            "is_retired": self.is_retired,
            "is_expired": self.is_expired,
            "is_valid": self.is_valid,
            "age_in_years": self.age_in_years,
            "last_trade_price": (
                float(self.last_trade_price) if self.last_trade_price else None
            ),
            "market_price": float(self.market_price) if self.market_price else None,
            "last_trade_currency": self.last_trade_currency,
            "permanence_risk": self.permanence_risk,
            "additionality_verified": self.additionality_verified,
            "verification_body": self.verification_body,
            "verification_date": (
                self.verification_date.isoformat() if self.verification_date else None
            ),
            "co_benefits": self.co_benefits,
            "compliance_standards": self.compliance_standards,
            "is_tokenized": self.is_tokenized,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if include_sensitive:
            data.update(
                {
                    "current_owner_id": self.current_owner_id,
                    "original_owner_id": self.original_owner_id,
                    "owner_wallet_address": self.owner_wallet_address,
                    "reserve_price": (
                        float(self.reserve_price) if self.reserve_price else None
                    ),
                    "token_id": self.token_id,
                    "blockchain_tx_hash": self.blockchain_tx_hash,
                    "smart_contract_address": self.smart_contract_address,
                    "buffer_pool_percentage": (
                        float(self.buffer_pool_percentage)
                        if self.buffer_pool_percentage
                        else None
                    ),
                    "leakage_percentage": (
                        float(self.leakage_percentage)
                        if self.leakage_percentage
                        else None
                    ),
                    "retired_date": (
                        self.retired_date.isoformat() if self.retired_date else None
                    ),
                    "retired_by_id": self.retired_by_id,
                    "retirement_reason": self.retirement_reason,
                    "retirement_beneficiary": self.retirement_beneficiary,
                }
            )
        return data

    def __repr__(self) -> Any:
        return f"<CarbonCredit {self.serial_number}>"


class CreditTransaction(db.Model):
    """Carbon credit transaction history"""

    __tablename__ = "credit_transactions"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    credit_id = Column(
        Integer, ForeignKey("carbon_credits.id"), nullable=False, index=True
    )
    transaction_type = Column(String(50), nullable=False, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    quantity = Column(Numeric(15, 4), nullable=False)
    price = Column(Numeric(10, 4), nullable=True)
    total_amount = Column(Numeric(15, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD")
    transaction_date = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )
    settlement_date = Column(DateTime, nullable=True)
    transaction_hash = Column(String(66), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    external_reference = Column(String(100), nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    credit = relationship("CarbonCredit", back_populates="transactions")
    from_user = relationship("User", foreign_keys=[from_user_id])
    to_user = relationship("User", foreign_keys=[to_user_id])

    def to_dict(self) -> Any:
        """Convert transaction to dictionary"""
        return {
            "id": self.id,
            "uuid": self.uuid,
            "credit_id": self.credit_id,
            "transaction_type": self.transaction_type,
            "from_user_id": self.from_user_id,
            "to_user_id": self.to_user_id,
            "quantity": float(self.quantity),
            "price": float(self.price) if self.price else None,
            "total_amount": float(self.total_amount) if self.total_amount else None,
            "currency": self.currency,
            "transaction_date": self.transaction_date.isoformat(),
            "settlement_date": (
                self.settlement_date.isoformat() if self.settlement_date else None
            ),
            "transaction_hash": self.transaction_hash,
            "notes": self.notes,
            "external_reference": self.external_reference,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self) -> Any:
        return f"<CreditTransaction {self.uuid}: {self.transaction_type}>"


class CreditCertificate(db.Model):
    """Certificate model for carbon credit verification and compliance"""

    __tablename__ = "credit_certificates"
    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    certificate_number = Column(String(100), unique=True, nullable=False, index=True)
    certificate_type = Column(String(50), nullable=False, index=True)
    project_id = Column(
        Integer, ForeignKey("carbon_projects.id"), nullable=True, index=True
    )
    credit_id = Column(
        Integer, ForeignKey("carbon_credits.id"), nullable=True, index=True
    )
    issuer = Column(String(255), nullable=False)
    issued_date = Column(DateTime, nullable=False)
    valid_from = Column(DateTime, nullable=False)
    valid_until = Column(DateTime, nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    methodology_used = Column(String(100), nullable=True)
    verifier_name = Column(String(255), nullable=True)
    verifier_accreditation = Column(String(100), nullable=True)
    verification_date = Column(DateTime, nullable=True)
    verification_standard = Column(String(100), nullable=True)
    certificate_document_url = Column(String(500), nullable=True)
    certificate_hash = Column(String(64), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    revoked_date = Column(DateTime, nullable=True)
    revocation_reason = Column(Text, nullable=True)
    created_at = Column(
        DateTime, nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    project = relationship("CarbonProject", back_populates="certificates")
    credit = relationship("CarbonCredit", back_populates="certificates")

    @hybrid_property
    def is_valid(self) -> Any:
        """Check if certificate is currently valid"""
        now = datetime.now(timezone.utc)
        if not self.is_active or self.revoked_date:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return now >= self.valid_from

    @hybrid_property
    def days_until_expiry(self) -> Any:
        """Get days until certificate expires"""
        if self.valid_until is None:
            return None
        delta = self.valid_until - datetime.now(timezone.utc)
        return delta.days if delta.days > 0 else 0

    def revoke(self, reason: Any) -> Any:
        """Revoke the certificate"""
        self.is_active = False
        self.revoked_date = datetime.now(timezone.utc)
        self.revocation_reason = reason

    def to_dict(self) -> Any:
        """Convert certificate to dictionary"""
        return {
            "id": self.id,
            "uuid": self.uuid,
            "certificate_number": self.certificate_number,
            "certificate_type": self.certificate_type,
            "project_id": self.project_id,
            "credit_id": self.credit_id,
            "issuer": self.issuer,
            "title": self.title,
            "description": self.description,
            "scope": self.scope,
            "methodology_used": self.methodology_used,
            "verifier_name": self.verifier_name,
            "verifier_accreditation": self.verifier_accreditation,
            "verification_date": (
                self.verification_date.isoformat() if self.verification_date else None
            ),
            "verification_standard": self.verification_standard,
            "issued_date": self.issued_date.isoformat(),
            "valid_from": self.valid_from.isoformat(),
            "valid_until": self.valid_until.isoformat() if self.valid_until else None,
            "is_valid": self.is_valid,
            "days_until_expiry": self.days_until_expiry,
            "is_active": self.is_active,
            "revoked_date": (
                self.revoked_date.isoformat() if self.revoked_date else None
            ),
            "revocation_reason": self.revocation_reason,
            "certificate_document_url": self.certificate_document_url,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
