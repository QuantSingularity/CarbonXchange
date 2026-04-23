"""
Carbon Credits routes for CarbonXchange Backend
Full CRUD for carbon credits and projects, with blockchain tokenisation hooks.
"""

import logging
from decimal import Decimal, InvalidOperation
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models import db
from ..models.carbon_credit import (
    CarbonCredit,
    CarbonProject,
    CreditStatus,
    ProjectStatus,
    ProjectType,
)
from ..models.user import User, UserRole
from ..security import require_roles
from ..services.blockchain_service import BlockchainService
from ..services.carbon_credit_service import CarbonCreditService

logger = logging.getLogger(__name__)
carbon_credits_bp = Blueprint("carbon_credits", __name__)
_blockchain = BlockchainService()
_cc_service = CarbonCreditService()


# ---------------------------------------------------------------------------
# Credits
# ---------------------------------------------------------------------------


@carbon_credits_bp.route("/", methods=["GET"])
@jwt_required()
def get_carbon_credits() -> Any:
    """Get carbon credits with filtering and pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    status_filter = request.args.get("status")
    project_id = request.args.get("project_id", type=int)
    vintage_year = request.args.get("vintage_year", type=int)

    query = CarbonCredit.query
    if status_filter:
        try:
            query = query.filter(CarbonCredit.status == CreditStatus(status_filter))
        except ValueError:
            return jsonify({"error": f"Invalid status: {status_filter}"}), 400
    if project_id:
        query = query.filter_by(project_id=project_id)
    if vintage_year:
        query = query.filter_by(vintage_year=vintage_year)

    pagination = query.order_by(CarbonCredit.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify(
        {
            "credits": [c.to_dict() for c in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@carbon_credits_bp.route("/<int:credit_id>", methods=["GET"])
@jwt_required()
def get_carbon_credit(credit_id: int) -> Any:
    """Get a specific carbon credit."""
    credit = CarbonCredit.query.get_or_404(credit_id)
    return jsonify(credit.to_dict())


@carbon_credits_bp.route("/", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def create_carbon_credit() -> Any:
    """
    Issue a new carbon credit.

    Required JSON fields: project_id, serial_number, vintage_year,
                          quantity, price_per_unit
    Optional:             standard, certification_body, methodology
    """
    data = request.get_json(silent=True) or {}

    required = [
        "project_id",
        "serial_number",
        "vintage_year",
        "quantity",
        "price_per_unit",
    ]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    project = CarbonProject.query.get(data["project_id"])
    if not project:
        return jsonify({"error": "Project not found"}), 404

    if CarbonCredit.query.filter_by(serial_number=data["serial_number"]).first():
        return jsonify({"error": "Serial number already exists"}), 409

    try:
        quantity = Decimal(str(data["quantity"]))
        price = Decimal(str(data["price_per_unit"]))
    except InvalidOperation:
        return (
            jsonify({"error": "quantity and price_per_unit must be valid numbers"}),
            400,
        )

    credit = CarbonCredit(
        project_id=data["project_id"],
        serial_number=data["serial_number"],
        vintage_year=int(data["vintage_year"]),
        quantity=quantity,
        price_per_unit=price,
        status=CreditStatus.PENDING,
    )
    for optional_field in ("standard", "certification_body", "methodology"):
        if optional_field in data:
            setattr(credit, optional_field, data[optional_field])

    db.session.add(credit)
    db.session.commit()
    db.session.refresh(credit)

    # Kick off blockchain tokenisation (non-blocking; failure does not roll back)
    metadata = {
        "credit_id": credit.id,
        "serial_number": credit.serial_number,
        "project_id": credit.project_id,
        "vintage_year": credit.vintage_year,
    }
    tx_hash = _blockchain.tokenize_carbon_credit(credit.id, quantity, metadata)
    if tx_hash:
        credit.blockchain_tx_hash = tx_hash
        db.session.commit()

    logger.info(
        "Created carbon credit id=%s serial=%s", credit.id, credit.serial_number
    )
    return jsonify({"credit": credit.to_dict(), "blockchain_tx": tx_hash}), 201


@carbon_credits_bp.route("/<int:credit_id>", methods=["PUT"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def update_carbon_credit(credit_id: int) -> Any:
    """Update mutable fields of a carbon credit (status, price, notes)."""
    credit = CarbonCredit.query.get_or_404(credit_id)
    data = request.get_json(silent=True) or {}

    updatable = ["status", "price_per_unit", "notes", "certification_body"]
    updated_fields = []

    for field in updatable:
        if field not in data:
            continue
        if field == "status":
            try:
                credit.status = CreditStatus(data["status"])
                updated_fields.append("status")
            except ValueError:
                return jsonify({"error": f"Invalid status: {data['status']}"}), 400
        elif field == "price_per_unit":
            try:
                credit.price_per_unit = Decimal(str(data["price_per_unit"]))
                updated_fields.append("price_per_unit")
            except InvalidOperation:
                return jsonify({"error": "price_per_unit must be a valid number"}), 400
        else:
            setattr(credit, field, data[field])
            updated_fields.append(field)

    if not updated_fields:
        return jsonify({"error": "No updatable fields provided"}), 400

    db.session.commit()
    logger.info("Updated credit id=%s fields=%s", credit_id, updated_fields)
    return jsonify({"credit": credit.to_dict(), "updated_fields": updated_fields})


@carbon_credits_bp.route("/<int:credit_id>/retire", methods=["POST"])
@jwt_required()
def retire_carbon_credit(credit_id: int) -> Any:
    """
    Retire a carbon credit (permanent removal from circulation).

    The requesting user must own or be admin. The retirement is recorded
    on-chain via the blockchain service.
    """
    current_user_uuid = get_jwt_identity()
    user = User.query.filter_by(uuid=current_user_uuid).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    credit = CarbonCredit.query.get_or_404(credit_id)

    if credit.status != CreditStatus.AVAILABLE:
        return (
            jsonify(
                {"error": f"Credit cannot be retired (status={credit.status.value})"}
            ),
            409,
        )

    # Non-admins can only retire credits they hold
    if user.role not in (UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER):
        if not hasattr(credit, "owner_id") or credit.owner_id != user.id:
            return jsonify({"error": "You do not own this credit"}), 403

    wallet = (
        getattr(user, "wallet_address", None)
        or "0x0000000000000000000000000000000000000000"
    )
    tx_hash = _blockchain.retire_tokens(wallet, credit.id, credit.quantity)

    credit.status = CreditStatus.RETIRED
    if tx_hash:
        credit.blockchain_tx_hash = tx_hash
    db.session.commit()

    logger.info("Retired credit id=%s by user=%s tx=%s", credit_id, user.id, tx_hash)
    return jsonify(
        {
            "credit": credit.to_dict(),
            "blockchain_tx": tx_hash,
            "message": "Credit successfully retired",
        }
    )


@carbon_credits_bp.route("/<int:credit_id>/tokenize", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN)
def tokenize_carbon_credit(credit_id: int) -> Any:
    """Manually (re-)tokenize a carbon credit on the blockchain."""
    credit = CarbonCredit.query.get_or_404(credit_id)
    metadata = {
        "credit_id": credit.id,
        "serial_number": credit.serial_number,
        "project_id": credit.project_id,
        "vintage_year": credit.vintage_year,
    }
    tx_hash = _blockchain.tokenize_carbon_credit(credit.id, credit.quantity, metadata)
    if not tx_hash:
        return jsonify({"error": "Blockchain tokenisation failed"}), 502

    credit.blockchain_tx_hash = tx_hash
    db.session.commit()
    return jsonify({"credit_id": credit_id, "blockchain_tx": tx_hash})


@carbon_credits_bp.route("/<int:credit_id>/verify-tx", methods=["GET"])
@jwt_required()
def verify_credit_transaction(credit_id: int) -> Any:
    """Verify the on-chain transaction for a credit."""
    credit = CarbonCredit.query.get_or_404(credit_id)
    if not getattr(credit, "blockchain_tx_hash", None):
        return (
            jsonify({"error": "No blockchain transaction recorded for this credit"}),
            404,
        )

    result = _blockchain.verify_transaction(credit.blockchain_tx_hash)
    return jsonify(result)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@carbon_credits_bp.route("/projects", methods=["GET"])
def get_projects() -> Any:
    """Get carbon projects with filtering and pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    project_type = request.args.get("type")
    status_filter = request.args.get("status")
    country = request.args.get("country")

    query = CarbonProject.query
    if project_type:
        try:
            query = query.filter(
                CarbonProject.project_type == ProjectType(project_type)
            )
        except ValueError:
            return jsonify({"error": f"Invalid project type: {project_type}"}), 400
    if status_filter:
        try:
            query = query.filter(CarbonProject.status == ProjectStatus(status_filter))
        except ValueError:
            return jsonify({"error": f"Invalid status: {status_filter}"}), 400
    if country:
        query = query.filter(CarbonProject.country == country)

    pagination = query.order_by(CarbonProject.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify(
        {
            "projects": [p.to_dict() for p in pagination.items],
            "total": pagination.total,
            "pages": pagination.pages,
            "current_page": page,
        }
    )


@carbon_credits_bp.route("/projects/<int:project_id>", methods=["GET"])
def get_project(project_id: int) -> Any:
    """Get a specific carbon project."""
    project = CarbonProject.query.get_or_404(project_id)
    return jsonify(project.to_dict())


@carbon_credits_bp.route("/projects", methods=["POST"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def create_project() -> Any:
    """
    Register a new carbon project.

    Required JSON fields: name, project_type, country, total_credits
    Optional:             description, methodology, standard, certifier
    """
    data = request.get_json(silent=True) or {}

    required = ["name", "project_type", "country", "total_credits"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    try:
        project_type = ProjectType(data["project_type"])
    except ValueError:
        valid = [t.value for t in ProjectType]
        return jsonify({"error": f"Invalid project_type. Valid: {valid}"}), 400

    try:
        total_credits = Decimal(str(data["total_credits"]))
    except InvalidOperation:
        return jsonify({"error": "total_credits must be a valid number"}), 400

    project = CarbonProject(
        name=data["name"],
        project_type=project_type,
        country=data["country"],
        total_credits=total_credits,
        available_credits_count=total_credits,
        status=ProjectStatus.DEVELOPMENT,
        description=data.get("description", ""),
    )
    for optional_field in ("methodology", "standard", "certifier"):
        if optional_field in data:
            setattr(project, optional_field, data[optional_field])

    db.session.add(project)
    db.session.commit()
    db.session.refresh(project)

    logger.info("Created project id=%s name=%s", project.id, project.name)
    return jsonify({"project": project.to_dict()}), 201


@carbon_credits_bp.route("/projects/<int:project_id>", methods=["PUT"])
@jwt_required()
@require_roles(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER)
def update_project(project_id: int) -> Any:
    """Update mutable fields of a carbon project."""
    project = CarbonProject.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}

    updatable = ["name", "description", "status", "country", "methodology", "standard"]
    updated_fields = []

    for field in updatable:
        if field not in data:
            continue
        if field == "status":
            try:
                project.status = ProjectStatus(data["status"])
                updated_fields.append("status")
            except ValueError:
                return jsonify({"error": f"Invalid status: {data['status']}"}), 400
        else:
            setattr(project, field, data[field])
            updated_fields.append(field)

    if not updated_fields:
        return jsonify({"error": "No updatable fields provided"}), 400

    db.session.commit()
    logger.info("Updated project id=%s fields=%s", project_id, updated_fields)
    return jsonify({"project": project.to_dict(), "updated_fields": updated_fields})


@carbon_credits_bp.route("/projects/<int:project_id>/credits", methods=["GET"])
@jwt_required()
def get_project_credits(project_id: int) -> Any:
    """Get all credits for a project."""
    project = CarbonProject.query.get_or_404(project_id)
    credits = CarbonCredit.query.filter_by(project_id=project_id).all()
    return jsonify(
        {
            "project": project.to_dict(),
            "credits": [c.to_dict() for c in credits],
            "total": len(credits),
        }
    )


# ---------------------------------------------------------------------------
# Blockchain network info
# ---------------------------------------------------------------------------


@carbon_credits_bp.route("/blockchain/status", methods=["GET"])
@jwt_required()
def blockchain_status() -> Any:
    """Return blockchain network diagnostics."""
    return jsonify(_blockchain.get_network_info())
