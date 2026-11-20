"""Audit logging service."""

from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from ..models import AuditEvent


def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    actor_id: Optional[str] = None,
    actor: Optional[Any] = None,
    resource_id: Optional[str] = None,
    request_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> AuditEvent:
    """Record a persistent audit log event."""
    if actor is not None and actor_id is None:
        actor_id = getattr(actor, "id", None)

    event = AuditEvent(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        request_id=request_id,
        ip_address=ip_address,
        details=details
    )
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except Exception as err:
        db.rollback()
        print(f"[AuditLogger] Warning: Failed to commit audit event: {err}")
    return event
