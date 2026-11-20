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
        id=current_user.id,
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

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="PROFILE_UPDATE",
        resource_type="profile",
        resource_id=current_user.id,
        details={"display_name": current_user.display_name}
    )

    return UserProfileResponse(
        id=current_user.id,
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

    # Check if profile already exists or create
    profile = db.query(Profile).filter(Profile.email == payload.email).first()
    if not profile:
        import uuid
        profile = Profile(
            id=str(uuid.uuid4()),
            email=payload.email,
            display_name=payload.display_name or "Researcher",
            role=payload.role if payload.role in ("ADMIN", "RESEARCHER") else "RESEARCHER",
            is_active=True
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    else:
        # Update role if requested and ensure profile is active
        if payload.role and payload.role in ("ADMIN", "RESEARCHER"):
            profile.role = payload.role
        if not profile.is_active:
            profile.is_active = True
        db.commit()
        db.refresh(profile)

    token = create_access_token(
        user_id=profile.id,
        email=profile.email,
        role=profile.role
    )

    log_audit_event(
        db=db,
        actor_id=profile.id,
        action="AUTH_LOGIN",
        resource_type="session",
        resource_id=profile.id,
        details={"method": "dev_token"}
    )

    return TokenResponse(
        access_token=token,
        token_type="Bearer",
        user=UserProfileResponse(
            id=profile.id,
            email=profile.email,
            display_name=profile.display_name,
            role=profile.role,
            is_active=profile.is_active,
            created_at=profile.created_at,
            updated_at=profile.updated_at
        )
    )
