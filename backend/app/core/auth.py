"""JWT authentication and authorization utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..config import settings
from ..db.session import get_db
from ..models import Profile

security = HTTPBearer(auto_error=False)


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    user_id: str,
    email: str,
    role: str = "RESEARCHER",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a signed JWT token matching Supabase Auth format."""
    now = get_utc_now()
    expire = now + (expires_delta or timedelta(hours=24))

    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "app_metadata": {
            "role": role
        },
        "user_metadata": {
            "role": role
        },
        "aud": settings.JWT_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }

    return jwt.encode(
        payload,
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_jwt_token(token: str) -> dict:
    """Decode and independently verify Supabase JWT token signature and expiry.
    Falls back to Supabase Auth API verification if the token was signed with
    the live Supabase cloud project JWT key.
    """
    try:
        # First attempt: fast local HMAC verification with configured secret
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": False  # Avoid strict mismatch if custom audience used
            }
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please authenticate again.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except jwt.InvalidTokenError:
        # Second attempt: verify with Supabase Auth endpoint if configured
        clean_sb_url = settings.SUPABASE_URL.split("/rest/v1")[0].rstrip("/") if settings.SUPABASE_URL else ""
        anon_key = settings.EFFECTIVE_ANON_KEY
        if clean_sb_url and anon_key:
            try:
                import httpx
                resp = httpx.get(
                    f"{clean_sb_url}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": anon_key
                    },
                    timeout=5.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "sub": data.get("id"),
                        "email": data.get("email"),
                        "user_metadata": data.get("user_metadata", {}),
                        "app_metadata": data.get("app_metadata", {}),
                        "aud": "authenticated"
                    }
            except Exception:
                pass

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token signature or session expired.",
            headers={"WWW-Authenticate": "Bearer"}
        )


def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> Profile:
    """Validate Bearer token and return authenticated Profile."""
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials are required.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_jwt_token(auth_header.credentials)
    user_id: str = payload.get("sub")
    email: str = payload.get("email", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: subject identifier missing."
        )

    # Fetch profile from database
    profile = db.query(Profile).filter(Profile.id == user_id).first()

    # If profile by ID wasn't found, check if a profile exists by email (e.g. from CLI preprovisioning)
    if not profile and email:
        profile = db.query(Profile).filter(Profile.email == email.strip().lower()).first()
        if profile:
            # Re-associate with authoritative Supabase auth ID
            profile.id = user_id
            db.commit()
            db.refresh(profile)

    # Check admin email eligibility
    is_admin_email = bool(
        settings.ADMIN_EMAIL and email and email.strip().lower() == settings.ADMIN_EMAIL.strip().lower()
    )

    if not profile:
        from sqlalchemy import text
        # Ensure auth.users has entry if running against Supabase PostgreSQL
        try:
            auth_user = db.execute(
                text("SELECT id FROM auth.users WHERE id = :id LIMIT 1"),
                {"id": user_id}
            ).fetchone()
            if not auth_user and email:
                db.execute(
                    text("""
                        INSERT INTO auth.users (id, email, aud, role, is_sso_user, is_anonymous)
                        VALUES (:id, :email, 'authenticated', 'authenticated', false, false)
                    """),
                    {"id": user_id, "email": email.strip().lower()}
                )
                db.commit()
                profile = db.query(Profile).filter(Profile.id == user_id).first()
        except Exception:
            db.rollback()

        if not profile:
            # Provision profile if missing (first-time login via Supabase Auth or SQLite fallback)
            role = "ADMIN" if is_admin_email else payload.get("user_metadata", {}).get("role", "RESEARCHER")
            if role not in ("ADMIN", "RESEARCHER"):
                role = "RESEARCHER"

            display_name = payload.get("user_metadata", {}).get(
                "display_name",
                email.split("@")[0].capitalize() if email else "Researcher"
            )

            profile = Profile(
                id=user_id,
                email=email or f"{user_id}@thoracicai.local",
                display_name=display_name,
                role=role,
                is_active=True
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)

    if not profile.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Please contact an administrator."
        )

    return profile


def get_optional_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security),
    db: Session = Depends(get_db)
) -> Optional[Profile]:
    """Optional user resolver for public demonstration endpoints."""
    if not auth_header or not auth_header.credentials:
        return None
    try:
        return get_current_user(auth_header, db)
    except HTTPException:
        return None


def require_admin(
    current_user: Profile = Depends(get_current_user)
) -> Profile:
    """Enforce Administrator role authorization."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required for this operation."
        )
    return current_user
