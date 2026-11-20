"""Case management API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..db.session import get_db
from ..models import Profile
from ..schemas import CaseDetailResponse, CaseListResponse, ReportSummaryItem, SlicePrediction
from ..services.audit import log_audit_event
from ..services.case_service import CaseService
from ..services.storage import StorageService

router = APIRouter(prefix="/cases", tags=["Case Management"])


@router.get("", response_model=CaseListResponse)
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    dataset: Optional[str] = Query(None, pattern="^(cancer|covid)$"),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("created_at", pattern="^(created_at|case_reference|number_of_slices)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> CaseListResponse:
    """List historical CT research cases for the authenticated user."""
    return CaseService.list_user_cases(
        db=db,
        user=current_user,
        page=page,
        page_size=page_size,
        dataset=dataset,
        status_filter=status,
        search_query=search,
        sort_by=sort_by,
        sort_order=sort_order
    )


@router.get("/{case_id}", response_model=CaseDetailResponse)
def get_case_details(
    case_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> CaseDetailResponse:
    """Retrieve full research case findings, per-slice inferences, and report links."""
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research case '{case_id}' was not found or access is restricted."
        )

    # Format slice predictions
    slice_items = [
        SlicePrediction(
            slice_index=s.slice_index,
            filename=s.filename,
            predicted_class=s.predicted_class,
            predicted_class_score=s.class_scores.get(s.predicted_class, 0.0),
            class_scores=s.class_scores
        )
        for s in case.slices
    ]

    # Format associated reports
    report_items = [
        ReportSummaryItem(
            id=str(r.id),
            case_id=str(case.id),
            case_reference=case.case_reference,
            dataset=case.dataset,
            report_format=r.report_format,
            generation_status=r.generation_status,
            file_size_bytes=r.file_size_bytes,
            download_url=StorageService.generate_signed_url(r.storage_path),
            created_at=r.created_at
        )
        for r in case.reports
    ]

    return CaseDetailResponse(
        id=str(case.id),
        case_reference=case.case_reference,
        dataset=case.dataset,
        status=case.status,
        model_architecture=case.model_architecture,
        model_version=case.model_version,
        number_of_slices=case.number_of_slices,
        predicted_class=case.predicted_class,
        mean_scores=case.mean_scores,
        inference_duration_ms=case.inference_duration_ms,
        is_single_slice=case.is_single_slice,
        created_at=case.created_at,
        updated_at=case.updated_at,
        slice_predictions=slice_items,
        reports=report_items
    )


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(
    case_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete a research case and its associated slices and report files."""
    deleted = CaseService.delete_case(db, case_id, current_user)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research case '{case_id}' not found or access is restricted."
        )

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="CASE_DELETE",
        resource_type="case",
        resource_id=case_id
    )
    return None
