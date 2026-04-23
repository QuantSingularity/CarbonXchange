"""
Tests for the Carbon Credits routes (/api/carbon-credits/...)
Covers GET, POST, PUT, retire, tokenize, verify-tx, and project endpoints.
"""

import os
from typing import Any

import pytest
from src.models.user import RiskLevel, User, UserRole, UserStatus

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db_session: Any) -> Any:
    user = User(
        email=f"admin_{os.urandom(4).hex()}@example.com",
        password="AdminPass123!",
        first_name="Admin",
        last_name="User",
        status=UserStatus.ACTIVE,
        risk_level=RiskLevel.LOW,
        role=UserRole.ADMIN,
    )
    from datetime import datetime, timezone

    user.email_verified_at = datetime.now(timezone.utc)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _login(client: Any, user: Any) -> str:
    """Return a JWT access token for the given user."""
    resp = client.post(
        "/api/auth/login",
        json={"email": user.email, "password": "AdminPass123!"},
        content_type="application/json",
    )
    if resp.status_code != 200:
        resp2 = client.post(
            "/api/auth/login",
            json={"email": user.email, "password": "TestPassword123!"},
            content_type="application/json",
        )
        data = resp2.get_json() or {}
    else:
        data = resp.get_json() or {}
    return data.get("access_token", "")


# ---------------------------------------------------------------------------
# GET /api/carbon-credits/
# ---------------------------------------------------------------------------


class TestGetCarbonCredits:
    def test_requires_auth(self, client: Any) -> None:
        resp = client.get("/api/carbon-credits/")
        assert resp.status_code == 401

    def test_returns_paginated_list(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "credits" in data
        assert "total" in data
        assert "pages" in data
        assert "current_page" in data

    def test_filter_by_status(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/?status=available",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_invalid_status_returns_400(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/?status=invalid_status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_filter_by_vintage_year(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/?vintage_year=2023",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        for credit in data["credits"]:
            assert credit["vintage_year"] == 2023

    def test_pagination(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/?page=1&per_page=5",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["credits"]) <= 5


# ---------------------------------------------------------------------------
# GET /api/carbon-credits/<id>
# ---------------------------------------------------------------------------


class TestGetCarbonCredit:
    def test_get_existing_credit(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            f"/api/carbon-credits/{sample_credit.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == sample_credit.id

    def test_get_nonexistent_credit_returns_404(
        self, client: Any, sample_user: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/carbon-credits/ (admin only)
# ---------------------------------------------------------------------------


class TestCreateCarbonCredit:
    def test_non_admin_forbidden(
        self, client: Any, sample_user: Any, sample_project: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.post(
            "/api/carbon-credits/",
            json={
                "project_id": sample_project.id,
                "serial_number": "CC-NEW-001",
                "vintage_year": 2024,
                "quantity": 100,
                "price_per_unit": 30,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    def test_missing_fields_returns_400(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/",
            json={"project_id": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "Missing fields" in resp.get_json().get("error", "")

    def test_invalid_project_returns_404(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/",
            json={
                "project_id": 99999,
                "serial_number": "CC-NOPROJ-001",
                "vintage_year": 2024,
                "quantity": 100,
                "price_per_unit": 30,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_create_credit_success(
        self, client: Any, admin_user: Any, sample_project: Any
    ) -> None:
        token = _login(client, admin_user)
        serial = f"CC-TEST-{os.urandom(4).hex().upper()}"
        resp = client.post(
            "/api/carbon-credits/",
            json={
                "project_id": sample_project.id,
                "serial_number": serial,
                "vintage_year": 2024,
                "quantity": "50",
                "price_per_unit": "28.50",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "credit" in data
        assert data["credit"]["serial_number"] == serial
        # Blockchain tx hash should be present (simulation mode)
        assert "blockchain_tx" in data
        assert data["blockchain_tx"] is not None

    def test_duplicate_serial_returns_409(
        self, client: Any, admin_user: Any, sample_project: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/",
            json={
                "project_id": sample_project.id,
                "serial_number": sample_credit.serial_number,
                "vintage_year": 2024,
                "quantity": 50,
                "price_per_unit": 28,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 409

    def test_invalid_quantity_returns_400(
        self, client: Any, admin_user: Any, sample_project: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/",
            json={
                "project_id": sample_project.id,
                "serial_number": "CC-BAD-001",
                "vintage_year": 2024,
                "quantity": "not-a-number",
                "price_per_unit": 28,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# PUT /api/carbon-credits/<id>
# ---------------------------------------------------------------------------


class TestUpdateCarbonCredit:
    def test_update_price(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.put(
            f"/api/carbon-credits/{sample_credit.id}",
            json={"price_per_unit": "35.00"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "price_per_unit" in data["updated_fields"]

    def test_update_status(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.put(
            f"/api/carbon-credits/{sample_credit.id}",
            json={"status": "reserved"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

    def test_update_invalid_status_returns_400(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.put(
            f"/api/carbon-credits/{sample_credit.id}",
            json={"status": "flying"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_update_no_fields_returns_400(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.put(
            f"/api/carbon-credits/{sample_credit.id}",
            json={"unknown_field": "value"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_non_admin_forbidden(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.put(
            f"/api/carbon-credits/{sample_credit.id}",
            json={"price_per_unit": "99"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/carbon-credits/<id>/tokenize
# ---------------------------------------------------------------------------


class TestTokenizeCredit:
    def test_tokenize_returns_tx_hash(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            f"/api/carbon-credits/{sample_credit.id}/tokenize",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "blockchain_tx" in data
        assert data["blockchain_tx"].startswith("0x")

    def test_non_admin_forbidden(
        self, client: Any, sample_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.post(
            f"/api/carbon-credits/{sample_credit.id}/tokenize",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/carbon-credits/<id>/verify-tx
# ---------------------------------------------------------------------------


class TestVerifyTx:
    def test_verify_tx_after_tokenize(
        self, client: Any, admin_user: Any, sample_credit: Any
    ) -> None:
        token = _login(client, admin_user)
        # Tokenize first to set a tx hash
        client.post(
            f"/api/carbon-credits/{sample_credit.id}/tokenize",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp = client.get(
            f"/api/carbon-credits/{sample_credit.id}/verify-tx",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "verified" in data


# ---------------------------------------------------------------------------
# Blockchain status endpoint
# ---------------------------------------------------------------------------


class TestBlockchainStatus:
    def test_returns_network_info(self, client: Any, sample_user: Any) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            "/api/carbon-credits/blockchain/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "simulation_mode" in data
        assert "connected" in data


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


class TestProjectRoutes:
    def test_get_projects_public(self, client: Any) -> None:
        resp = client.get("/api/carbon-credits/projects")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "projects" in data

    def test_get_project_by_id(self, client: Any, sample_project: Any) -> None:
        resp = client.get(f"/api/carbon-credits/projects/{sample_project.id}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == sample_project.id

    def test_get_nonexistent_project_404(self, client: Any) -> None:
        resp = client.get("/api/carbon-credits/projects/99999")
        assert resp.status_code == 404

    def test_filter_projects_by_country(self, client: Any, sample_project: Any) -> None:
        resp = client.get(
            f"/api/carbon-credits/projects?country={sample_project.country}"
        )
        assert resp.status_code == 200

    def test_filter_invalid_project_type_400(self, client: Any) -> None:
        resp = client.get("/api/carbon-credits/projects?type=invalid_type")
        assert resp.status_code == 400

    def test_create_project_admin_only(self, client: Any, admin_user: Any) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/projects",
            json={
                "name": "New Mangrove Project",
                "project_type": "blue_carbon",
                "country": "ID",
                "total_credits": "5000",
                "description": "Mangrove restoration",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["project"]["name"] == "New Mangrove Project"

    def test_create_project_missing_fields_400(
        self, client: Any, admin_user: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/projects",
            json={"name": "Incomplete"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_create_project_invalid_type_400(
        self, client: Any, admin_user: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.post(
            "/api/carbon-credits/projects",
            json={
                "name": "Bad Type Project",
                "project_type": "flying_cars",
                "country": "US",
                "total_credits": 1000,
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400

    def test_update_project_status(
        self, client: Any, admin_user: Any, sample_project: Any
    ) -> None:
        token = _login(client, admin_user)
        resp = client.put(
            f"/api/carbon-credits/projects/{sample_project.id}",
            json={"status": "registered"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "status" in data["updated_fields"]

    def test_get_project_credits(
        self, client: Any, sample_user: Any, sample_project: Any, sample_credit: Any
    ) -> None:
        token = _login(client, sample_user)
        resp = client.get(
            f"/api/carbon-credits/projects/{sample_project.id}/credits",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "credits" in data
        assert "project" in data
