"""CLI utility to grant Administrator privileges to a ThoracicAI user profile.

Usage:
    python -m app.cli.set_admin [email]

If [email] is omitted, the script reads ADMIN_EMAIL from backend configuration / .env.
"""

import sys
import uuid
from pathlib import Path

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import func
from app.config import settings
from app.db.session import SessionLocal
from app.models import Profile, AuditEvent



def set_admin_role(target_email: str) -> bool:
    clean_email = target_email.strip().lower()
    if not clean_email or "@" not in clean_email:
        print(f"[ERROR] Invalid email address: '{target_email}'")
        return False

    db = SessionLocal()
    try:
        from sqlalchemy import text
        # Check if auth.users exists (Supabase PostgreSQL)
        auth_user = None
        try:
            auth_user = db.execute(
                text("SELECT id, email FROM auth.users WHERE LOWER(email) = :email LIMIT 1"),
                {"email": clean_email}
            ).fetchone()
        except Exception:
            # Fallback for SQLite or local dev without auth schema
            db.rollback()

        if auth_user:
            user_id = str(auth_user[0])
            profile = db.query(Profile).filter(Profile.id == user_id).first()
            if profile:
                old_role = profile.role
                profile.role = "ADMIN"
                profile.is_active = True
                db.commit()
                db.refresh(profile)
                print(f"[SUCCESS] User '{clean_email}' (UUID: {user_id}) updated: role changed from {old_role} to ADMIN.")
            else:
                profile = Profile(
                    id=user_id,
                    email=clean_email,
                    display_name=clean_email.split("@")[0].capitalize(),
                    role="ADMIN",
                    is_active=True
                )
                db.add(profile)
                db.commit()
                print(f"[SUCCESS] User '{clean_email}' (UUID: {user_id}) registered in profiles table with ADMIN role.")

            # Record audit event
            audit = AuditEvent(
                id=str(uuid.uuid4()),
                actor_id=user_id,
                action="USER_ROLE_UPDATE",
                resource_type="profile",
                resource_id=user_id,
                details={
                    "target_email": clean_email,
                    "new_role": "ADMIN",
                    "source": "cli_set_admin"
                }
            )
            db.add(audit)
            db.commit()
            return True

        # Check existing profile in local SQLite or standalone profiles
        profile = db.query(Profile).filter(func.lower(Profile.email) == clean_email).first()
        if profile:
            old_role = profile.role
            profile.role = "ADMIN"
            profile.is_active = True
            db.commit()
            print(f"[SUCCESS] Local profile '{clean_email}' updated: role changed from {old_role} to ADMIN.")
            return True

        # If not in auth.users and using PostgreSQL with foreign key constraint:
        print(
            f"\n[NOTICE] User '{clean_email}' has not registered in Supabase Authentication yet.\n"
            f"To complete administrator setup:\n"
            f"  1. Register '{clean_email}' through the ThoracicAI sign-up UI (or Supabase Dashboard -> Authentication -> Users).\n"
            f"  2. Re-run this command: python -m app.cli.set_admin {clean_email}\n"
        )
        return False

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Database error during admin role assignment: {e}")
        return False
    finally:
        db.close()


def main():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        target_email = sys.argv[1].strip()
    elif settings.ADMIN_EMAIL and settings.ADMIN_EMAIL.strip():
        target_email = settings.ADMIN_EMAIL.strip()
    else:
        print("[ERROR] No email provided. Either pass an email argument:\n"
              "    python -m app.cli.set_admin your-admin@example.com\n"
              "or configure ADMIN_EMAIL in backend/.env")
        sys.exit(1)

    success = set_admin_role(target_email)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
