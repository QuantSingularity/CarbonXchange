"""
Compliance routes for CarbonXchange Backend
Full CRUD for compliance records, reports, and AML/KYC status management.
Aligned exactly with ComplianceRecord and RegulatoryReport model schemas.
"""

import logging
import uuid as uuid_mod
from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import db
from ..models.compliance import (
    ComplianceRecord,
    ComplianceStatus,
    RegulatoryFramework,
    RegulatoryReport,
    ReportStatus,
    ReportType,
)
from ..models.user import User, UserRole
from ..security import require_roles

logger = logging.getLogger(__name__)
compliance_bp = Blueprint("compliance", __name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_current_user() -> Any:
    uid = get_jwt_identity()
    return User.query.filter_by(uuid=uid).first()


def _make_record_id() -> str:
    return (
        f"COMP-{datetime.now().strftime('%Y%m%d')}-{uuid_mod.uuid4().hex[:8].upper()}"
    )


def _make_report_id() -> str:
    return f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid_mod.uuid4().hex[:8].upper()}"


# ---------------------------------------------------------------------------
# Compliance Records
# ---------------------------------------------------------------------------


@compliance_bp.route("/records", methods=["GET"])
@jwt_required()
def get_compliance_records() -> Any:
    """
    Get compliance records.
    Admins / compliance officers see all; regular users see only their own.
    """
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    status_filter = request.args.get("status")

    if user.role in (UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR):
        query = ComplianceRecord.query
        user_id_filter = request.args.get("user_id", type=int)
        if user_id_filter:
            query = query.filter_by(user_id=user_id_filter)
    else:
        query = ComplianceRecord.query.filter_by(user_id=user.id)

    if status_filter:
        try:
            query = query.filter(
                ComplianceRecord.status == ComplianceStatus(status_filter)
            )
        except ValueError:
            valid = [s.value for s in ComplianceStatus]
            return jsonify({"error": f"Invalid status. Valid: {valid}"}), 400

    pagination = query.order_by(ComplianceRecord.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify(
        {
            "records": [r.to_dict(include_sensitive=True) for r in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@compliance_bp.route("/records/<int:record_id>", methods=["GET"])
@jwt_required()
def get_compliance_record(record_id: int) -> Any:
    """Get a specific compliance record."""
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    record = ComplianceRecord.query.get_or_404(record_id)
    if record.user_id != user.id and user.role not in (
        UserRole.ADMIN,
        UserRole.COMPLIANCE_OFFICER,
        UserRole.AUDITOR,
    ):
        return jsonify({"error": "Access denied"}), 403

    return jsonify(record.to_dict(include_sensitive=True))


@compliance_bp.route("/records", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def create_compliance_record() -> Any:
    """
    Create a compliance record.

    Required JSON fields:
      user_id          – target user (int, optional – omit for entity-level records)
      entity_type      – e.g. "user", "trade", "order"
      entity_id        – string identifier of the entity
      framework        – RegulatoryFramework value
      rule_reference   – e.g. "AML-5AMLD-Art12"
      rule_description – human-readable description of the rule
      status           – ComplianceStatus value

    Optional:
      severity, risk_level, violation_description, assessment_notes
    """
    data = request.get_json(silent=True) or {}

    required = [
        "entity_type",
        "entity_id",
        "framework",
        "rule_reference",
        "rule_description",
        "status",
    ]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        framework = RegulatoryFramework(data["framework"])
    except ValueError:
        valid = [f.value for f in RegulatoryFramework]
        return jsonify({"error": f"Invalid framework. Valid: {valid}"}), 400

    try:
        status = ComplianceStatus(data["status"])
    except ValueError:
        valid = [s.value for s in ComplianceStatus]
        return jsonify({"error": f"Invalid status. Valid: {valid}"}), 400

    user_id = data.get("user_id")
    if user_id:
        target = User.query.get(user_id)
        if not target:
            return jsonify({"error": "Target user not found"}), 404

    officer = _get_current_user()

    record = ComplianceRecord(
        record_id=_make_record_id(),
        user_id=user_id,
        entity_type=data["entity_type"],
        entity_id=str(data["entity_id"]),
        framework=framework,
        rule_reference=data["rule_reference"],
        rule_description=data["rule_description"],
        status=status,
        assessed_by=officer.id if officer else None,
    )

    for opt in ("severity", "risk_level", "violation_description", "assessment_notes"):
        if opt in data:
            setattr(record, opt, data[opt])

    db.session.add(record)
    db.session.commit()
    db.session.refresh(record)

    logger.info(
        "Created compliance record id=%s entity=%s/%s",
        record.record_id,
        data["entity_type"],
        data["entity_id"],
    )
    return jsonify({"record": record.to_dict(include_sensitive=True)}), 201


@compliance_bp.route("/records/<int:record_id>", methods=["PUT"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def update_compliance_record(record_id: int) -> Any:
    """Update the status or notes of a compliance record."""
    record = ComplianceRecord.query.get_or_404(record_id)
    data = request.get_json(silent=True) or {}

    updatable = ["status", "assessment_notes", "remediation_notes", "remediation_plan"]
    updated_fields = []

    for field in updatable:
        if field not in data:
            continue
        if field == "status":
            try:
                record.status = ComplianceStatus(data["status"])
                updated_fields.append("status")
            except ValueError:
                valid = [s.value for s in ComplianceStatus]
                return jsonify({"error": f"Invalid status. Valid: {valid}"}), 400
        else:
            setattr(record, field, data[field])
            updated_fields.append(field)

    if not updated_fields:
        return jsonify({"error": "No updatable fields provided"}), 400

    db.session.commit()
    logger.info("Updated compliance record id=%s fields=%s", record_id, updated_fields)
    return jsonify(
        {
            "record": record.to_dict(include_sensitive=True),
            "updated_fields": updated_fields,
        }
    )


# ---------------------------------------------------------------------------
# Regulatory Reports
# ---------------------------------------------------------------------------


@compliance_bp.route("/reports", methods=["GET"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR)
def get_reports() -> Any:
    """Get regulatory compliance reports with optional filters."""
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    status_filter = request.args.get("status")
    report_type = request.args.get("type")
    framework = request.args.get("framework")

    query = RegulatoryReport.query

    if status_filter:
        try:
            query = query.filter(RegulatoryReport.status == ReportStatus(status_filter))
        except ValueError:
            valid = [s.value for s in ReportStatus]
            return jsonify({"error": f"Invalid status. Valid: {valid}"}), 400

    if report_type:
        try:
            query = query.filter(
                RegulatoryReport.report_type == ReportType(report_type)
            )
        except ValueError:
            valid = [t.value for t in ReportType]
            return jsonify({"error": f"Invalid report type. Valid: {valid}"}), 400

    if framework:
        try:
            query = query.filter(
                RegulatoryReport.framework == RegulatoryFramework(framework)
            )
        except ValueError:
            valid = [f.value for f in RegulatoryFramework]
            return jsonify({"error": f"Invalid framework. Valid: {valid}"}), 400

    pagination = query.order_by(RegulatoryReport.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify(
        {
            "reports": [r.to_dict() for r in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@compliance_bp.route("/reports/<int:report_id>", methods=["GET"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR)
def get_report(report_id: int) -> Any:
    """Get a specific regulatory report."""
    report = RegulatoryReport.query.get_or_404(report_id)
    return jsonify(report.to_dict())


@compliance_bp.route("/reports", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def create_report() -> Any:
    """
    Create a new regulatory report.

    Required JSON fields:
      report_type            – ReportType value
      framework              – RegulatoryFramework value
      title                  – report title
      reporting_period_start – ISO date string e.g. "2024-01-01"
      reporting_period_end   – ISO date string e.g. "2024-03-31"
      due_date               – ISO date string for submission deadline

    Optional:
      description, report_data (dict), regulator
    """
    data = request.get_json(silent=True) or {}

    required = [
        "report_type",
        "framework",
        "title",
        "reporting_period_start",
        "reporting_period_end",
        "due_date",
    ]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        report_type = ReportType(data["report_type"])
    except ValueError:
        return jsonify({"error": f"Invalid report_type: {data['report_type']}"}), 400

    try:
        framework = RegulatoryFramework(data["framework"])
    except ValueError:
        return jsonify({"error": f"Invalid framework: {data['framework']}"}), 400

    def _parse_dt(s: str) -> datetime:
        try:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            raise ValueError(f"Cannot parse date: {s!r}")

    try:
        period_start = _parse_dt(data["reporting_period_start"])
        period_end = _parse_dt(data["reporting_period_end"])
        due_date = _parse_dt(data["due_date"])
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    officer = _get_current_user()
    if not officer:
        return jsonify({"error": "Authenticated user not found"}), 404

    import json as _json

    report_data_raw = data.get("report_data")
    report_data_str = _json.dumps(report_data_raw) if report_data_raw else None

    report = RegulatoryReport(
        report_id=_make_report_id(),
        report_type=report_type,
        framework=framework,
        title=data["title"],
        description=data.get("description", ""),
        reporting_period_start=period_start,
        reporting_period_end=period_end,
        due_date=due_date,
        status=ReportStatus.DRAFT,
        prepared_by=officer.id,
        regulator=data.get("regulator"),
        report_data=report_data_str,
    )

    db.session.add(report)
    db.session.commit()
    db.session.refresh(report)

    logger.info(
        "Created regulatory report id=%s type=%s", report.report_id, report_type.value
    )
    return jsonify({"report": report.to_dict()}), 201


@compliance_bp.route("/reports/<int:report_id>/submit", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def submit_report(report_id: int) -> Any:
    """Submit a draft report for review."""
    report = RegulatoryReport.query.get_or_404(report_id)

    if report.status != ReportStatus.DRAFT:
        return (
            jsonify(
                {
                    "error": (
                        f"Only DRAFT reports can be submitted "
                        f"(current: {report.status.value})"
                    )
                }
            ),
            409,
        )

    officer = _get_current_user()
    report.status = ReportStatus.PENDING_REVIEW
    report.submitted_by = officer.id if officer else None
    report.submission_date = datetime.now(timezone.utc)
    db.session.commit()

    logger.info("Submitted report id=%s", report_id)
    return jsonify(
        {"report": report.to_dict(), "message": "Report submitted for review"}
    )


@compliance_bp.route("/reports/<int:report_id>/approve", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN)
def approve_report(report_id: int) -> Any:
    """Approve a pending-review report."""
    report = RegulatoryReport.query.get_or_404(report_id)

    if report.status != ReportStatus.PENDING_REVIEW:
        return (
            jsonify(
                {
                    "error": (
                        f"Only PENDING_REVIEW reports can be approved "
                        f"(current: {report.status.value})"
                    )
                }
            ),
            409,
        )

    approver = _get_current_user()
    report.status = ReportStatus.APPROVED
    report.approved_by = approver.id if approver else None
    report.approval_date = datetime.now(timezone.utc)
    db.session.commit()

    logger.info(
        "Approved report id=%s by user=%s",
        report_id,
        approver.id if approver else "?",
    )
    return jsonify({"report": report.to_dict(), "message": "Report approved"})


# ---------------------------------------------------------------------------
# Compliance Status
# ---------------------------------------------------------------------------


@compliance_bp.route("/status", methods=["GET"])
@jwt_required()
def get_compliance_status() -> Any:
    """Get the current user's compliance status."""
    user = _get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(
        {
            "user_id": user.id,
            "kyc_status": (
                user.kyc_records[-1].status.value if user.kyc_records else "not_started"
            ),
            "is_kyc_approved": user.is_kyc_approved,
            "risk_level": user.risk_level.value,
            "trading_enabled": user.is_verified and user.status.value == "active",
        }
    )


@compliance_bp.route("/status/<int:user_id>", methods=["GET"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR)
def get_user_compliance_status(user_id: int) -> Any:
    """Get compliance status for a specific user (admin/compliance only)."""
    user = User.query.get_or_404(user_id)
    open_records = ComplianceRecord.query.filter(
        ComplianceRecord.user_id == user_id,
        ComplianceRecord.status.in_(
            [ComplianceStatus.PENDING_REVIEW, ComplianceStatus.UNDER_INVESTIGATION]
        ),
    ).count()

    return jsonify(
        {
            "user_id": user.id,
            "email": user.email,
            "kyc_status": (
                user.kyc_records[-1].status.value if user.kyc_records else "not_started"
            ),
            "is_kyc_approved": user.is_kyc_approved,
            "risk_level": user.risk_level.value,
            "trading_enabled": user.is_verified and user.status.value == "active",
            "open_compliance_issues": open_records,
        }
    )


# ---------------------------------------------------------------------------
# AML / Sanctions summary
# ---------------------------------------------------------------------------


@compliance_bp.route("/aml/summary", methods=["GET"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def aml_summary() -> Any:
    """Return a high-level AML compliance summary."""
    total_users = User.query.count()
    kyc_approved = User.query.filter_by(is_kyc_approved=True).count()
    open_records = ComplianceRecord.query.filter(
        ComplianceRecord.status.in_(
            [ComplianceStatus.PENDING_REVIEW, ComplianceStatus.UNDER_INVESTIGATION]
        )
    ).count()
    total_records = ComplianceRecord.query.count()

    return jsonify(
        {
            "total_users": total_users,
            "kyc_approved_users": kyc_approved,
            "kyc_approval_rate": (
                round(kyc_approved / total_users, 4) if total_users else 0
            ),
            "open_compliance_issues": open_records,
            "total_compliance_records": total_records,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
