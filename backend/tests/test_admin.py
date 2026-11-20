"""Automated tests for Admin dashboard, governance, and audit logging."""

from fastapi.testclient import TestClient


def get_auth_token(client: TestClient, email: str, name: str, role: str = "RESEARCHER") -> str:
    resp = client.post(
        "/api/auth/dev-token",
        json={"email": email, "display_name": name, "role": role}
    )
    return resp.json()["access_token"]


def test_admin_stats_access(client: TestClient):
    """Verify admin can access system-wide statistics."""
    admin_token = get_auth_token(client, "admin_user@thoracicai.org", "Administrator", role="ADMIN")

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total_users" in data
    assert "total_cases" in data
    assert "total_reports" in data


def test_non_admin_forbidden_on_admin_routes(client: TestClient):
    """Verify standard RESEARCHER is rejected with 403 Forbidden on admin endpoints."""
    researcher_token = get_auth_token(client, "regular_user@thoracicai.org", "Standard Researcher", role="RESEARCHER")

    resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {researcher_token}"})
    assert resp.status_code == 403


def test_admin_user_management_lifecycle(client: TestClient):
    """Verify admin listing users, toggling active status, and changing roles."""
    admin_token = get_auth_token(client, "admin_ops@thoracicai.org", "Ops Admin", role="ADMIN")
    target_token = get_auth_token(client, "managed_user@thoracicai.org", "Managed User", role="RESEARCHER")

    # Get target user ID from /api/auth/me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {target_token}"})
    assert me_resp.status_code == 200, me_resp.text
    target_id = me_resp.json()["id"]

    # Admin lists users
    list_resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert list_resp.status_code == 200
    assert any(u["id"] == target_id for u in list_resp.json()["users"])

    # Admin deactivates target user
    deact_resp = client.patch(
        f"/api/admin/users/{target_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False}
    )
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Deactivated user attempts to access /api/auth/me -> 403 Forbidden
    blocked_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {target_token}"})
    assert blocked_resp.status_code == 403

    # Admin reactivates target user
    react_resp = client.patch(
        f"/api/admin/users/{target_id}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": True}
    )
    assert react_resp.status_code == 200
    assert react_resp.json()["is_active"] is True

    # Admin promotes target user to ADMIN
    role_resp = client.patch(
        f"/api/admin/users/{target_id}/role",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"role": "ADMIN"}
    )
    assert role_resp.status_code == 200
    assert role_resp.json()["role"] == "ADMIN"


def test_admin_cannot_deactivate_self(client: TestClient):
    """Verify safety check preventing admin from deactivating their own account."""
    admin_token = get_auth_token(client, "self_deact_admin@thoracicai.org", "Self Admin", role="ADMIN")
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}).json()

    resp = client.patch(
        f"/api/admin/users/{me['id']}/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"is_active": False}
    )
    assert resp.status_code == 400
    assert "cannot deactivate their own account" in resp.json()["detail"]


def test_admin_audit_logs(client: TestClient):
    """Verify audit logs are recorded and retrievable by admin."""
    admin_token = get_auth_token(client, "audit_admin@thoracicai.org", "Audit Admin", role="ADMIN")

    resp = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "events" in data
    assert isinstance(data["events"], list)


def test_admin_system_health(client: TestClient):
    """Verify admin detailed health check endpoint."""
    admin_token = get_auth_token(client, "health_admin@thoracicai.org", "Health Admin", role="ADMIN")

    resp = client.get("/api/admin/health", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "models" in data
    assert isinstance(data["models"]["cancer"]["loaded"], bool)
    assert isinstance(data["models"]["covid"]["loaded"], bool)
