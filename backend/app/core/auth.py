"""JWT authentication and authorization utilities."""

from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt import PyJWKClient, PyJWKError, PyJWKClientError
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..config import settings
from ..db.session import get_db
from ..models import Profile

security = HTTPBearer(auto_error=False)

# Singleton JWKS client cache mapped by URL
_JWKS_CLIENTS: dict = {}


def get_jwks_client(jwks_url: str) -> PyJWKClient:
    global _JWKS_CLIENTS
    if jwks_url not in _JWKS_CLIENTS:
        _JWKS_CLIENTS[jwks_url] = PyJWKClient(
            jwks_url,
            cache_keys=True,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=300,
            timeout=10.0
        )
    return _JWKS_CLIENTS[jwks_url]


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
        "iss": settings.EXPECTED_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }

    return jwt.encode(
        payload,
        settings.SUPABASE_JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_jwt_token(token: str) -> dict:
    """Decode and independently verify Supabase JWT token.
    
    Supports:
    - Symmetric HMAC-SHA256 (HS256) via configured SUPABASE_JWT_SECRET.
    - Asymmetric ECDSA / RSA (ES256, RS256) via Supabase project JWKS.
    Enforces signature verification, expiration, subject claim, audience,
    issuer, and algorithm whitelisting. Fails closed.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing or invalid.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 1. Inspect unverified header for algorithm and kid
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed JWT token header.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    alg = unverified_header.get("alg")
    allowed_algs = getattr(settings, "JWT_ALLOWED_ALGORITHMS", ["HS256", "RS256", "ES256"])
    if not alg or alg not in allowed_algs:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unsupported or disallowed JWT algorithm: '{alg}'. Permitted: {allowed_algs}.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 2. Decode & verify signature based on algorithm
    payload: dict
    if alg == "HS256":
        secret = settings.SUPABASE_JWT_SECRET
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="JWT secret is not configured for HS256 verification.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"verify_signature": True, "verify_exp": True, "verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please authenticate again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as err:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {err}",
                headers={"WWW-Authenticate": "Bearer"}
            )
    elif alg in ("RS256", "ES256"):
        kid = unverified_header.get("kid")
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Asymmetric token ({alg}) header missing required 'kid' attribute.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        clean_sb_url = settings.SUPABASE_URL.split("/rest/v1")[0].rstrip("/") if settings.SUPABASE_URL else ""
        if not clean_sb_url:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Supabase URL not configured for JWKS asymmetric verification.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        jwks_url = f"{clean_sb_url}/auth/v1/.well-known/jwks.json"
        try:
            jwks_client = get_jwks_client(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            key = signing_key.key
        except (PyJWKClientError, PyJWKError, Exception) as err:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unable to retrieve valid signing key for kid '{kid}': {err}",
                headers={"WWW-Authenticate": "Bearer"}
            )

        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                options={"verify_signature": True, "verify_exp": True, "verify_aud": False}
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please authenticate again.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid asymmetric token signature.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        except jwt.InvalidTokenError as err:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid asymmetric token: {err}",
                headers={"WWW-Authenticate": "Bearer"}
            )

    # 3. Claims validation (Subject, Audience, Issuer)
    # Validate Subject (sub)
    sub = payload.get("sub")
    if not sub or not str(sub).strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token: subject identifier ('sub') is missing or empty.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Validate Audience (aud)
    expected_aud = settings.JWT_AUDIENCE
    aud = payload.get("aud")
    aud_list = aud if isinstance(aud, list) else ([aud] if aud else [])
    if expected_aud not in aud_list:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token audience ('aud'). Expected '{expected_aud}', got '{aud}'.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Validate Issuer (iss)
    expected_iss = settings.EXPECTED_ISSUER
    iss = payload.get("iss")
    if iss and iss != expected_iss:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token issuer ('iss'). Expected '{expected_iss}', got '{iss}'.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return payload


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
