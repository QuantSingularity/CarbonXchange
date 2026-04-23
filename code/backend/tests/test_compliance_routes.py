"""
Tests for Compliance routes (/api/compliance/...)
Aligned to actual ComplianceRecord and RegulatoryReport model schemas.
"""

import os
import uuid as uuid_mod
from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from src.models import db
from src.models.compliance import (
    ComplianceRecord,
    ComplianceStatus,
    RegulatoryFramework,
    RegulatoryReport,
    ReportStatus,
    ReportType,
)
from src.models.user import RiskLevel, User, UserRole, UserStatus

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

ADMIN_PASS = "AdminPass123!"
OFFICER_PASS = "OfficerPass123!"
USER_PASS = "TestPassword123!"


@pytest.fixture
def admin_user(db_session: Any) -> Any:
    user = User(
        email=f"cadmin_{os.urandom(4).hex()}@example.com",
        password=ADMIN_PASS,
        first_name="Compliance",
        last_name="Admin",
        status=UserStatus.ACTIVE,
        risk_level=RiskLevel.LOW,
        role=UserRole.ADMIN,
    )
    user.email_verified_at = datetime.now(timezone.utc)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_compliance_record(db_session: Any, sample_user: Any) -> Any:
    record = ComplianceRecord(
        record_id=f"COMP-TEST-{uuid_mod.uuid4().hex[:8].upper()}",
        user_id=sample_user.id,
        entity_type="user",
        entity_id=str(sample_user.id),
        framework=RegulatoryFramework.AML_CTF,
        rule_reference="AML-5AMLD-Art12",
        rule_description="Routine AML screening check",
        status=ComplianceStatus.PENDING_REVIEW,
    )
    db_session.add(record)
    db_session.commit()
    db_session.refresh(record)
    return record


@pytest.fixture
def sample_report(db_session: Any, admin_user: Any) -> Any:
    future = datetime.now(timezone.utc) + timedelta(days=30)
    report = RegulatoryReport(
        report_id=f"RPT-TEST-{uuid_mod.uuid4().hex[:8].upper()}",
        report_type=ReportType.TRANSACTION_REPORT,
        framework=RegulatoryFramework.AML_CTF,
        title="Q1 Transaction Report",
        reporting_period_start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        reporting_period_end=datetime(2024, 3, 31, tzinfo=timezone.utc),
        due_date=future,
        status=ReportStatus.DRAFT,
        prepared_by=admin_user.id,
        description="Quarterly AML report",
    )
    db_session.add(report)
    db_session.commit()
    db_session.refresh(report)
    return report


def _login(client: Any, user: Any, password: str) -> str:
    resp = client.post(
        "/api/auth/login",
        json={"email": user.email, "password": password},
        content_type="application/json",
    )
    data = resp.get_json() or {}
    return data.get("access_token", "")


# ---------------------------------------------------------------------------
# Compliance Records – GET
# ---------------------------------------------------------------------------


class TestGetComplianceRecords:
    def test_requires_auth(self, client: Any) -> None:
        resp = client.get("/api/compliance/records")
        assert resp.status_code == 401

    def test_user_sees_own_records(
        self, client: Any, sample_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            "/api/compliance/records",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "records" in data
        for rec in data["records"]:
            assert rec["user_id"] == sample_user.id

    def test_admin_sees_all_records(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/records",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["total"] >= 1

    def test_admin_filter_by_user_id(
        self,
        client: Any,
        admin_user: Any,
        sample_user: Any,
        sample_compliance_record: Any,
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            f"/api/compliance/records?user_id={sample_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_filter_invalid_status_400(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/records?status=not_real",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_get_specific_record(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            f"/api/compliance/records/{sample_compliance_record.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == sample_compliance_record.id

    def test_user_cannot_view_other_user_record(
        self, client: Any, sample_user: Any, admin_user: Any
    ) -> None:
        # Create a record owned by admin_user
        rec = ComplianceRecord(
            record_id=f"COMP-PRIV-{uuid_mod.uuid4().hex[:8].upper()}",
            user_id=admin_user.id,
            entity_type="user",
            entity_id=str(admin_user.id),
            framework=RegulatoryFramework.KYC,
            rule_reference="KYC-001",
            rule_description="Admin KYC",
            status=ComplianceStatus.COMPLIANT,
        )
        db.session.add(rec)
        db.session.commit()

        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            f"/api/compliance/records/{rec.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Compliance Records – POST
# ---------------------------------------------------------------------------


class TestCreateComplianceRecord:
    def test_create_record_success(
        self, client: Any, admin_user: Any, sample_user: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/records",
            json={
                "user_id": sample_user.id,
                "entity_type": "user",
                "entity_id": str(sample_user.id),
                "framework": "aml_ctf",
                "rule_reference": "AML-5AMLD-Art12",
                "rule_description": "Routine AML screening",
                "status": "pending_review",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "record" in data
        assert data["record"]["user_id"] == sample_user.id

    def test_create_record_missing_fields_400(
        self, client: Any, admin_user: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/records",
            json={"entity_type": "user"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "Missing fields" in resp.get_json().get("error", "")

    def test_create_record_invalid_framework_400(
        self, client: Any, admin_user: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/records",
            json={
                "entity_type": "user",
                "entity_id": "1",
                "framework": "not_a_framework",
                "rule_reference": "REF-001",
                "rule_description": "Test",
                "status": "compliant",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_create_record_invalid_user_404(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/records",
            json={
                "user_id": 99999,
                "entity_type": "user",
                "entity_id": "99999",
                "framework": "aml_ctf",
                "rule_reference": "REF-001",
                "rule_description": "Test",
                "status": "compliant",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_non_admin_forbidden(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.post(
            "/api/compliance/records",
            json={
                "entity_type": "user",
                "entity_id": "1",
                "framework": "aml_ctf",
                "rule_reference": "REF-001",
                "rule_description": "Test",
                "status": "compliant",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Compliance Records – PUT
# ---------------------------------------------------------------------------


class TestUpdateComplianceRecord:
    def test_update_status(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.put(
            f"/api/compliance/records/{sample_compliance_record.id}",
            json={"status": "compliant"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "status" in data["updated_fields"]
        assert data["record"]["status"] == "compliant"

    def test_update_assessment_notes(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.put(
            f"/api/compliance/records/{sample_compliance_record.id}",
            json={"assessment_notes": "Reviewed and cleared"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "assessment_notes" in data["updated_fields"]

    def test_update_invalid_status_400(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.put(
            f"/api/compliance/records/{sample_compliance_record.id}",
            json={"status": "flying_away"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_update_no_valid_fields_400(
        self, client: Any, admin_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.put(
            f"/api/compliance/records/{sample_compliance_record.id}",
            json={"unknown_field": "xyz"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_non_admin_forbidden(
        self, client: Any, sample_user: Any, sample_compliance_record: Any
    ) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.put(
            f"/api/compliance/records/{sample_compliance_record.id}",
            json={"status": "compliant"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Compliance Status
# ---------------------------------------------------------------------------


class TestComplianceStatus:
    def test_get_own_status(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            "/api/compliance/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "user_id" in data
        assert "kyc_status" in data
        assert "risk_level" in data
        assert "trading_enabled" in data
        assert data["user_id"] == sample_user.id

    def test_admin_get_other_user_status(
        self, client: Any, admin_user: Any, sample_user: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            f"/api/compliance/status/{sample_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "open_compliance_issues" in data
        assert "email" in data

    def test_non_admin_cannot_view_other_status(
        self, client: Any, sample_user: Any, admin_user: Any
    ) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            f"/api/compliance/status/{admin_user.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_status_user_not_found_404(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/status/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Regulatory Reports – GET
# ---------------------------------------------------------------------------


class TestGetReports:
    def test_non_admin_forbidden(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            "/api/compliance/reports",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_admin_can_list_reports(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/reports",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "reports" in data
        assert data["total"] >= 1

    def test_filter_by_status_draft(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/reports?status=draft",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_filter_invalid_status_400(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/reports?status=not_valid",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_filter_by_report_type(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/reports?type=transaction_report",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_get_specific_report(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            f"/api/compliance/reports/{sample_report.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == sample_report.id


# ---------------------------------------------------------------------------
# Regulatory Reports – POST / lifecycle
# ---------------------------------------------------------------------------


class TestCreateReport:
    def _due_date(self) -> str:
        return (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()

    def test_create_report_success(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/reports",
            json={
                "report_type": "transaction_report",
                "framework": "aml_ctf",
                "title": "Test Quarterly Report",
                "reporting_period_start": "2024-01-01",
                "reporting_period_end": "2024-03-31",
                "due_date": self._due_date(),
                "description": "Test report",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "report" in data
        assert data["report"]["status"] == "draft"
        assert data["report"]["title"] == "Test Quarterly Report"

    def test_create_report_missing_fields_400(
        self, client: Any, admin_user: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/reports",
            json={"title": "Incomplete"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "Missing fields" in resp.get_json().get("error", "")

    def test_create_invalid_report_type_400(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            "/api/compliance/reports",
            json={
                "report_type": "flying_report",
                "framework": "aml_ctf",
                "title": "Bad Type",
                "reporting_period_start": "2024-01-01",
                "reporting_period_end": "2024-03-31",
                "due_date": self._due_date(),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_non_admin_forbidden(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.post(
            "/api/compliance/reports",
            json={
                "report_type": "transaction_report",
                "framework": "aml_ctf",
                "title": "Test",
                "reporting_period_start": "2024-01-01",
                "reporting_period_end": "2024-03-31",
                "due_date": self._due_date(),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


class TestReportLifecycle:
    def test_submit_report(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.post(
            f"/api/compliance/reports/{sample_report.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["report"]["status"] == "pending_review"

    def test_submit_non_draft_409(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        # Submit once
        client.post(
            f"/api/compliance/reports/{sample_report.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        # Submit again → conflict
        resp = client.post(
            f"/api/compliance/reports/{sample_report.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    def test_approve_report_after_submit(
        self, client: Any, admin_user: Any, sample_report: Any
    ) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        client.post(
            f"/api/compliance/reports/{sample_report.id}/submit",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.post(
            f"/api/compliance/reports/{sample_report.id}/approve",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["report"]["status"] == "approved"

    def test_approve_draft_report_409(self, client: Any, admin_user: Any) -> None:
        """Cannot approve a fresh DRAFT report."""
        # Create a fresh report
        future = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
        token = _login(client, admin_user, ADMIN_PASS)
        create_resp = client.post(
            "/api/compliance/reports",
            json={
                "report_type": "audit_report",
                "framework": "sox",
                "title": "Draft Only Report",
                "reporting_period_start": "2024-01-01",
                "reporting_period_end": "2024-06-30",
                "due_date": future,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert create_resp.status_code == 201
        report_id = create_resp.get_json()["report"]["id"]

        resp = client.post(
            f"/api/compliance/reports/{report_id}/approve",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# AML Summary
# ---------------------------------------------------------------------------


class TestAMLSummary:
    def test_admin_can_access(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user, ADMIN_PASS)
        resp = client.get(
            "/api/compliance/aml/summary",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "total_users" in data
        assert "kyc_approved_users" in data
        assert "open_compliance_issues" in data
        assert "kyc_approval_rate" in data

    def test_regular_user_forbidden(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user, USER_PASS)
        resp = client.get(
            "/api/compliance/aml/summary",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
