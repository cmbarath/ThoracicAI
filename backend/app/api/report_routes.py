"""Report management and secure download API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..db.session import get_db
from ..models import Profile
from ..schemas import ReportCreateRequest, ReportListResponse, ReportSummaryItem
from ..services.audit import log_audit_event
from ..services.case_service import CaseService
from ..services.report_service import ReportService
from ..services.storage import StorageService

router = APIRouter(tags=["Reports"])


@router.post("/cases/{case_id}/reports", response_model=ReportSummaryItem)
def generate_report(
    case_id: str,
    payload: ReportCreateRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ReportSummaryItem:
    """Generate a formal research report (PDF, CSV, JSON) for a completed case."""
    case = CaseService.get_case_by_id(db, case_id, current_user)
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Research case '{case_id}' was not found or access is restricted."
        )

    report = ReportService.create_report(
        db=db,
        case=case,
        user=current_user,
        report_format=payload.report_format
    )

    signed_url = StorageService.generate_signed_url(report.storage_path)

    return ReportSummaryItem(
        id=str(report.id),
        case_id=str(case.id),
        case_reference=case.case_reference,
        dataset=case.dataset,
        report_format=report.report_format,
        generation_status=report.generation_status,
        file_size_bytes=report.file_size_bytes,
        download_url=signed_url,
        created_at=report.created_at
    )


@router.get("/reports", response_model=ReportListResponse)
def list_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    dataset: Optional[str] = Query(None, pattern="^(cancer|covid)$"),
    format: Optional[str] = Query(None, pattern="^(PDF|CSV|JSON)$"),
    search: Optional[str] = Query(None),
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ReportListResponse:
    """List generated research reports in the user's Report Centre."""
    return ReportService.list_user_reports(
        db=db,
        user=current_user,
        page=page,
        page_size=page_size,
        dataset=dataset,
        report_format=format,
        search_query=search
    )


@router.get("/reports/{report_id}", response_model=ReportSummaryItem)
def get_report_metadata(
    report_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> ReportSummaryItem:
    """Fetch report details and fresh signed download URL."""
    report = ReportService.get_report_by_id(db, report_id, current_user)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' was not found or access is restricted."
        )

    signed_url = StorageService.generate_signed_url(report.storage_path)

    return ReportSummaryItem(
        id=str(report.id),
        case_id=str(report.case_id),
        case_reference=report.case.case_reference,
        dataset=report.case.dataset,
        report_format=report.report_format,
        generation_status=report.generation_status,
        file_size_bytes=report.file_size_bytes,
        download_url=signed_url,
        created_at=report.created_at
    )


@router.get("/reports/{report_id}/download")
def download_report(
    report_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Securely stream report content verifying user ownership."""
    report = ReportService.get_report_by_id(db, report_id, current_user)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' was not found or access is restricted."
        )

    try:
        content, mime_type = StorageService.read_report_file(report.storage_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The report file could not be located in storage."
        )

    log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="REPORT_DOWNLOAD",
        resource_type="report",
        resource_id=report.id,
        details={"format": report.report_format}
    )

    filename = report.storage_path.split("/")[-1]
    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.get("/reports/download/{filename}")
def download_local_file(
    filename: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Direct streaming endpoint for local storage files with ownership verification."""
    # Find report by filename
    report = (
        db.query(Report)
        .filter(Report.storage_path.like(f"%{filename}"))
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    # Check ownership
    if current_user.role != "ADMIN" and report.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this report is restricted."
        )

    try:
        content, mime_type = StorageService.read_report_file(report.storage_path)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file missing from disk."
        )

    return Response(
        content=content,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-cache, no-store",
            "X-Content-Type-Options": "nosniff"
        }
    )


@router.delete("/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(
    report_id: str,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a generated report from storage and the database."""
    deleted = ReportService.delete_report(db, report_id, current_user)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_id}' was not found or access is restricted."
        )
    return None
