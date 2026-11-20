"""Automated tests for Supabase Auth, JWT verification, and user profiles."""

from datetime import datetime, timezone, timedelta
import jwt
import pytest
from fastapi.testclient import TestClient

from fastapi import HTTPException
from app.config import settings
from app.core.auth import create_access_token, decode_jwt_token
from app.db.session import SessionLocal
from app.models import Profile


def test_jwt_mint_and_verify():
    """Verify that JWT creation and signature verification work with valid claims."""
    token = create_access_token(
        user_id="user-123",
        email="researcher@thoracicai.org",
        role="RESEARCHER",
        expires_delta=timedelta(hours=1)
    )
    claims = decode_jwt_token(token)
    assert claims["sub"] == "user-123"
    assert claims["email"] == "researcher@thoracicai.org"
    assert claims["app_metadata"]["role"] == "RESEARCHER"


def test_jwt_expired_token_rejected():
    """Verify that an expired JWT raises HTTPException 401."""
    expired_token = create_access_token(
        user_id="user-expired",
        email="expired@thoracicai.org",
        expires_delta=timedelta(seconds=-10)
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_jwt_token(expired_token)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower()


def test_jwt_invalid_signature_rejected():
    """Verify that a token signed with the wrong key is rejected with 401."""
    tampered_token = jwt.encode(
        {"sub": "hacker", "exp": datetime.now(timezone.utc) + timedelta(hours=1), "aud": settings.JWT_AUDIENCE},
        "wrong-secret-key-at-least-32-chars-long",
        algorithm=settings.JWT_ALGORITHM
    )
    with pytest.raises(HTTPException) as exc_info:
        decode_jwt_token(tampered_token)
    assert exc_info.value.status_code == 401


def test_auth_me_endpoint(client: TestClient):
    """Verify /api/auth/me returns the profile for an authenticated user."""
    # Obtain a dev token
    resp = client.post(
        "/api/auth/dev-token",
        json={"email": "alice@research.org", "display_name": "Dr. Alice Smith", "role": "RESEARCHER"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # Call /api/auth/me
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    profile = me_resp.json()
    assert profile["email"] == "alice@research.org"
    assert profile["display_name"] == "Dr. Alice Smith"
    assert profile["role"] == "RESEARCHER"
    assert profile["is_active"] is True


def test_auth_me_unauthenticated_rejected(client: TestClient):
    """Verify /api/auth/me returns 401 when missing Authorization header."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_auth_profile_update(client: TestClient):
    """Verify display_name update via PATCH /api/auth/me."""
    resp = client.post(
        "/api/auth/dev-token",
        json={"email": "bob@research.org", "display_name": "Bob Old Name", "role": "RESEARCHER"}
    )
    token = resp.json()["access_token"]

    patch_resp = client.patch(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"display_name": "Dr. Robert New Name"}
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["display_name"] == "Dr. Robert New Name"
