"""Audit logging service."""

import uuid
from datetime import date, datetime
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from ..models import AuditEvent


def _clean_json_val(val: Any) -> Any:
    """Recursively serialize UUIDs and datetimes to JSON-safe primitives."""
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, dict):
        return {str(k): _clean_json_val(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [_clean_json_val(x) for x in val]
    return val


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

    cleaned_details = _clean_json_val(details) if details is not None else None

    event = AuditEvent(
        id=str(uuid.uuid4()),
        actor_id=str(actor_id) if actor_id else None,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        request_id=str(request_id) if request_id else None,
        ip_address=ip_address,
        details=cleaned_details
    )
    db.add(event)
    try:
        db.commit()
        db.refresh(event)
    except Exception as err:
        db.rollback()
        print(f"[AuditLogger] Warning: Failed to commit audit event: {err}")
    return event
