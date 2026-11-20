"""Report management service for generating, listing, and downloading reports."""

import math
import uuid
from typing import Optional
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models import Case, Profile, Report
from ..schemas import ReportListResponse, ReportSummaryItem
from .audit import log_audit_event
from .report_generator import ReportGenerator
from .storage import StorageService


class ReportService:
    """Service for managing clinical research reports."""

    @staticmethod
    def create_report(
        db: Session,
        case: Case,
        user: Profile,
        report_format: str
    ) -> Report:
        """Generate, store, and record a report in the database."""
        report_format = report_format.upper()
        report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"

        # Fetch slice predictions from database
        slice_data = [
            {
                "slice_index": s.slice_index,
                "filename": s.filename,
                "predicted_class": s.predicted_class,
                "predicted_class_score": s.class_scores.get(s.predicted_class, 0.0),
                "class_scores": s.class_scores
            }
            for s in case.slices
        ]

        # Generate file content
        ext = report_format.lower()
        if report_format == "PDF":
            content = ReportGenerator.generate_pdf(
                report_id=report_id,
                case_reference=case.case_reference,
                dataset=case.dataset,
                architecture=case.model_architecture,
                model_version=case.model_version,
                number_of_slices=case.number_of_slices,
                predicted_class=case.predicted_class or "Unknown",
                mean_scores=case.mean_scores or {},
                slice_predictions=slice_data,
                created_at=case.created_at
            )
            content_type = "application/pdf"
        elif report_format == "CSV":
            content = ReportGenerator.generate_csv(
                case_reference=case.case_reference,
                dataset=case.dataset,
                architecture=case.model_architecture,
                model_version=case.model_version,
                predicted_class=case.predicted_class or "Unknown",
                mean_scores=case.mean_scores or {},
                slice_predictions=slice_data
            )
            content_type = "text/csv; charset=utf-8"
        elif report_format == "JSON":
            content = ReportGenerator.generate_json(
                report_id=report_id,
                case_reference=case.case_reference,
                dataset=case.dataset,
                architecture=case.model_architecture,
                model_version=case.model_version,
                number_of_slices=case.number_of_slices,
                predicted_class=case.predicted_class or "Unknown",
                mean_scores=case.mean_scores or {},
                slice_predictions=slice_data,
                created_at=case.created_at
            )
            content_type = "application/json; charset=utf-8"
        else:
            raise ValueError(f"Unsupported report format: {report_format}")

        filename = f"{case.case_reference}_{report_id}.{ext}"

        # Save to storage
        storage_path = StorageService.save_report_file(
            filename=filename,
            content=content,
            content_type=content_type
        )

        # Record in DB
        report = Report(
            id=str(uuid.uuid4()),
            case_id=case.id,
            owner_id=user.id,
            report_format=report_format,
            storage_path=storage_path,
            generation_status="COMPLETED",
            file_size_bytes=len(content)
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # Audit
        log_audit_event(
            db=db,
            actor_id=user.id,
            action="REPORT_GENERATE",
            resource_type="report",
            resource_id=report.id,
            details={"case_reference": case.case_reference, "format": report_format}
        )

        return report

    @staticmethod
    def list_user_reports(
        db: Session,
        user: Profile,
        page: int = 1,
        page_size: int = 10,
        dataset: Optional[str] = None,
        report_format: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> ReportListResponse:
        """List reports with strict user ownership enforcement and filters."""
        query = db.query(Report).join(Case, Report.case_id == Case.id)

        if user.role != "ADMIN":
            query = query.filter(Report.owner_id == user.id)

        if dataset and dataset in ("cancer", "covid"):
            query = query.filter(Case.dataset == dataset)

        if report_format:
            query = query.filter(Report.report_format == report_format.upper())

        if search_query:
            pattern = f"%{search_query.strip()}%"
            query = query.filter(
                (Case.case_reference.ilike(pattern)) |
                (Report.id.ilike(pattern))
            )

        total = query.count()
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        offset = (page - 1) * page_size

        reports = query.order_by(desc(Report.created_at)).offset(offset).limit(page_size).all()

        items = []
        for r in reports:
            signed_url = StorageService.generate_signed_url(r.storage_path)
            items.append(
                ReportSummaryItem(
                    id=r.id,
                    case_id=r.case_id,
                    case_reference=r.case.case_reference,
                    dataset=r.case.dataset,
                    report_format=r.report_format,
                    generation_status=r.generation_status,
                    file_size_bytes=r.file_size_bytes,
                    download_url=signed_url,
                    created_at=r.created_at
                )
            )

        return ReportListResponse(
            reports=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def get_report_by_id(
        db: Session,
        report_id: str,
        user: Profile
    ) -> Optional[Report]:
        """Fetch report verifying user ownership."""
        query = db.query(Report).filter(Report.id == report_id)
        if user.role != "ADMIN":
            query = query.filter(Report.owner_id == user.id)
        return query.first()

    @staticmethod
    def delete_report(
        db: Session,
        report_id: str,
        user: Profile
    ) -> bool:
        """Delete report from database and storage."""
        report = ReportService.get_report_by_id(db, report_id, user)
        if not report:
            return False

        StorageService.delete_report_file(report.storage_path)
        db.delete(report)
        db.commit()

        log_audit_event(
            db=db,
            actor_id=user.id,
            action="REPORT_DELETE",
            resource_type="report",
            resource_id=report_id
        )
        return True
