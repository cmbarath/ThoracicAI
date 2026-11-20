"""Admin API endpoints for system metrics, user governance, and audit logging."""

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
import torch

from ..config import settings
from ..core.auth import require_admin
from ..db.session import get_db
from ..models import AuditEvent, Case, Profile, Report
from ..schemas import (
    AdminStatsResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserUpdateRoleRequest,
    AdminUserUpdateStatusRequest,
    AuditEventItem,
    AuditListResponse
)
from ..services.audit import log_audit_event
from ..services.inference import ModelRegistry

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AdminStatsResponse:
    """Retrieve system-wide aggregated statistics for admin dashboard."""
    total_users = db.query(func.count(Profile.id)).scalar() or 0
    active_users = db.query(func.count(Profile.id)).filter(Profile.is_active == True).scalar() or 0
    total_cases = db.query(func.count(Case.id)).scalar() or 0
    completed_cases = db.query(func.count(Case.id)).filter(Case.status == "Completed").scalar() or 0
    failed_cases = db.query(func.count(Case.id)).filter(Case.status == "Failed").scalar() or 0
    total_reports = db.query(func.count(Report.id)).scalar() or 0
    cancer_cases = db.query(func.count(Case.id)).filter(Case.dataset == "cancer").scalar() or 0
    covid_cases = db.query(func.count(Case.id)).filter(Case.dataset == "covid").scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_cases=total_cases,
        completed_cases=completed_cases,
        failed_cases=failed_cases,
        total_reports=total_reports,
        cancer_cases=cancer_cases,
        covid_cases=covid_cases
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_admin_users(
    admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AdminUserListResponse:
    """List all user profiles with their case and report statistics."""
    users = db.query(Profile).order_by(Profile.created_at.desc()).all()

    # Pre-aggregate case and report counts per user
    case_counts = dict(
        db.query(Case.owner_id, func.count(Case.id))
        .group_by(Case.owner_id)
        .all()
    )
    report_counts = dict(
        db.query(Report.owner_id, func.count(Report.id))
        .group_by(Report.owner_id)
        .all()
    )

    items = [
        AdminUserItem(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            is_active=u.is_active,
            cases_count=case_counts.get(u.id, 0),
            reports_count=report_counts.get(u.id, 0),
            created_at=u.created_at
        )
        for u in users
    ]

    return AdminUserListResponse(users=items, total=len(items))


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    payload: AdminUserUpdateStatusRequest,
    admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Enable or disable a user account."""
    if user_id == admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account."
        )

    target_user = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    prev_status = target_user.is_active
    target_user.is_active = payload.is_active
    db.commit()

    log_audit_event(
        db=db,
        action="USER_STATUS_UPDATE",
        resource_type="profile",
        actor=admin,
        resource_id=user_id,
        details={
            "previous_status": prev_status,
            "new_status": payload.is_active,
            "target_email": target_user.email
        }
    )

    return {
        "message": f"User account {'activated' if payload.is_active else 'deactivated'} successfully.",
        "user_id": user_id,
        "is_active": target_user.is_active
    }


@router.patch("/users/{user_id}/role")
def update_user_role(
    user_id: str,
    payload: AdminUserUpdateRoleRequest,
    admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update role for a user account (ADMIN or RESEARCHER)."""
    target_user = db.query(Profile).filter(Profile.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    prev_role = target_user.role
    target_user.role = payload.role
    db.commit()

    log_audit_event(
        db=db,
        action="USER_ROLE_UPDATE",
        resource_type="profile",
        actor=admin,
        resource_id=user_id,
        details={
            "previous_role": prev_role,
            "new_role": payload.role,
            "target_email": target_user.email
        }
    )

    return {
        "message": f"User role updated to {payload.role}.",
        "user_id": user_id,
        "role": target_user.role
    }


@router.get("/audit-logs", response_model=AuditListResponse)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    admin: Profile = Depends(require_admin),
    db: Session = Depends(get_db)
) -> AuditListResponse:
    """Retrieve paginated audit event logs."""
    query = db.query(AuditEvent)

    if action:
        query = query.filter(AuditEvent.action == action)

    total = query.count()
    offset = (page - 1) * page_size
    events = query.order_by(AuditEvent.timestamp.desc()).offset(offset).limit(page_size).all()

    items = [
        AuditEventItem(
            id=e.id,
            actor_id=e.actor_id,
            actor_email=e.actor.email if e.actor else None,
            action=e.action,
            resource_type=e.resource_type,
            resource_id=e.resource_id,
            request_id=e.request_id,
            ip_address=e.ip_address,
            details=e.details,
            timestamp=e.timestamp
        )
        for e in events
    ]

    return AuditListResponse(
        events=items,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/health")
def get_admin_system_health(
    admin: Profile = Depends(require_admin)
):
    """Detailed compute and memory health diagnostics for admin."""
    registry = ModelRegistry.get_instance()
    cuda_available = torch.cuda.is_available()

    gpu_info = None
    if cuda_available:
        gpu_info = {
            "device_name": torch.cuda.get_device_name(0),
            "allocated_mb": round(torch.cuda.memory_allocated(0) / (1024 * 1024), 2),
            "reserved_mb": round(torch.cuda.memory_reserved(0) / (1024 * 1024), 2),
        }

    return {
        "status": "healthy",
        "pytorch_version": torch.__version__,
        "device": str(settings.DEVICE),
        "cuda_available": cuda_available,
        "gpu_info": gpu_info,
        "models": {
            "cancer": {
                "loaded": registry.is_loaded("cancer"),
                "architecture": "DenseNet121",
                "classes": settings.CLASS_NAMES["cancer"]
            },
            "covid": {
                "loaded": registry.is_loaded("covid"),
                "architecture": "DenseNet121",
                "classes": settings.CLASS_NAMES["covid"]
            }
        },
        "storage": {
            "mode": "supabase_storage" if settings.SUPABASE_ANON_KEY else "local_disk",
            "local_dir": str(settings.STORAGE_DIR)
        }
    }
