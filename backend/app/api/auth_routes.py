"""Authentication and user profile endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..config import settings
from ..core.auth import create_access_token, get_current_user
from ..db.session import get_db
from ..models import Profile
from ..schemas import ProfileUpdateRequest, UserProfileResponse
from ..services.audit import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication & Profile"])


class DevTokenRequest(BaseModel):
    email: EmailStr
    display_name: Optional[str] = "Development Researcher"
    role: Optional[str] = "RESEARCHER"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    user: UserProfileResponse


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(current_user: Profile = Depends(get_current_user)) -> UserProfileResponse:
    """Retrieve profile and permissions for currently authenticated user."""
    return UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.patch("/me", response_model=UserProfileResponse)
def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> UserProfileResponse:
    """Update profile information for currently authenticated user."""
    current_user.display_name = payload.display_name.strip()
    db.commit()
    db.refresh(current_user)

    user_id_str = str(current_user.id)
    log_audit_event(
        db=db,
        actor_id=user_id_str,
        action="PROFILE_UPDATE",
        resource_type="profile",
        resource_id=user_id_str,
        details={"display_name": current_user.display_name}
    )

    return UserProfileResponse(
        id=user_id_str,
        email=current_user.email,
        display_name=current_user.display_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.post("/dev-token", response_model=TokenResponse)
def generate_dev_token(
    payload: DevTokenRequest,
    db: Session = Depends(get_db)
) -> TokenResponse:
    """Generate authenticated session token for development or automated testing.
    Disabled in production unless explicitly permitted.
    """
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Development token generation is disabled in production."
        )

    from sqlalchemy import text
    import uuid

    clean_email = payload.email.lower().strip()
    profile = db.query(Profile).filter(Profile.email == clean_email).first()

    if not profile:
        # Check if auth.users exists (Supabase PostgreSQL) and create auth user
        try:
            auth_user = db.execute(
                text("SELECT id FROM auth.users WHERE LOWER(email) = :email LIMIT 1"),
                {"email": clean_email}
            ).fetchone()
            if not auth_user:
                user_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO auth.users (id, email, aud, role, is_sso_user, is_anonymous)
                        VALUES (:id, :email, 'authenticated', 'authenticated', false, false)
                    """),
                    {"id": user_id, "email": clean_email}
                )
                db.commit()
            # Fetch profile auto-created by Supabase trigger
            profile = db.query(Profile).filter(Profile.email == clean_email).first()
        except Exception:
            db.rollback()

    if not profile:
        # Fallback for local SQLite test environments without auth schema
        profile = Profile(
            id=str(uuid.uuid4()),
            email=clean_email,
            display_name=payload.display_name or "Researcher",
            role=payload.role if payload.role in ("ADMIN", "RESEARCHER") else "RESEARCHER",
            is_active=True
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        # Update role and display name
        if payload.role and payload.role in ("ADMIN", "RESEARCHER"):
            profile.role = payload.role
        if payload.display_name:
            profile.display_name = payload.display_name
        profile.is_active = True
        db.commit()
        db.refresh(profile)

    user_id_str = str(profile.id)
    token = create_access_token(
        user_id=user_id_str,
        email=profile.email,
        role=profile.role
    )

    log_audit_event(
        db=db,
        actor_id=user_id_str,
        action="AUTH_LOGIN",
        resource_type="session",
        resource_id=user_id_str,
        details={"method": "dev_token"}
    )

    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        user=UserProfileResponse(
            id=user_id_str,
            email=profile.email,
            display_name=profile.display_name,
            role=profile.role,
            is_active=profile.is_active,
            created_at=profile.created_at,
            updated_at=profile.updated_at
        )
    )


class AuthConfigResponse(BaseModel):
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    auth_enabled: bool = False


@router.get("/config", response_model=AuthConfigResponse)
def get_auth_config() -> AuthConfigResponse:
    """Provide public authentication connection details to frontend clients.
    Exposes only public URL and anon key; private secrets are never exposed.
    """
    raw_url = settings.SUPABASE_URL or ""
    clean_url = raw_url.split("/rest/v1")[0].rstrip("/") if raw_url else None
    anon_key = settings.EFFECTIVE_ANON_KEY or None
    return AuthConfigResponse(
        supabase_url=clean_url,
        supabase_anon_key=anon_key,
        auth_enabled=bool(clean_url and anon_key)
    )

