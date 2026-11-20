"""Service for persistent case management and research workflows."""

import math
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ..models import Case, CaseSlice, Profile, Report
from ..schemas import CaseDetailResponse, CaseListResponse, CaseSummaryItem, SlicePrediction
from .storage import StorageService


def generate_case_reference(dataset: str) -> str:
    """Generate professional case reference: CASE-CAN-XXXXXX or CASE-COV-XXXXXX."""
    prefix = "CAN" if dataset == "cancer" else "COV"
    short_uuid = uuid.uuid4().hex[:8].upper()
    return f"CASE-{prefix}-{short_uuid}"


class CaseService:
    """Case lifecycle management service."""

    @staticmethod
    def create_and_complete_case(
        db: Session,
        owner: Profile,
        dataset: str,
        number_of_slices: int,
        predicted_class: str,
        mean_scores: Dict[str, float],
        slice_predictions: List[SlicePrediction],
        inference_duration_ms: int,
        workspace_id: Optional[str] = None
    ) -> Case:
        """Atomically persist case and its slice predictions in the database."""
        case_ref = generate_case_reference(dataset)

        case = Case(
            case_reference=case_ref,
            owner_id=owner.id,
            workspace_id=workspace_id,
            dataset=dataset,
            status="Completed",
            model_architecture="DenseNet121",
            model_version="1.0.0",
            number_of_slices=number_of_slices,
            predicted_class=predicted_class,
            mean_scores=mean_scores,
            inference_duration_ms=inference_duration_ms,
            is_single_slice=(number_of_slices == 1)
        )
        db.add(case)
        db.flush()  # Generate case.id for slices

        for slice_pred in slice_predictions:
            db_slice = CaseSlice(
                case_id=case.id,
                slice_index=slice_pred.slice_index,
                filename=slice_pred.filename,
                predicted_class=slice_pred.predicted_class,
                class_scores=slice_pred.class_scores
            )
            db.add(db_slice)

        db.commit()
        db.refresh(case)
        return case

    @staticmethod
    def list_user_cases(
        db: Session,
        user: Profile,
        page: int = 1,
        page_size: int = 10,
        dataset: Optional[str] = None,
        status_filter: Optional[str] = None,
        search_query: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc"
    ) -> CaseListResponse:
        """Query cases with strict user isolation, filtering, sorting, and pagination."""
        query = db.query(Case)

        # Enforce strict user isolation: Researchers see only their own cases
        if user.role != "ADMIN":
            query = query.filter(Case.owner_id == user.id)

        if dataset and dataset in ("cancer", "covid"):
            query = query.filter(Case.dataset == dataset)

        if status_filter:
            query = query.filter(Case.status == status_filter)

        if search_query:
            pattern = f"%{search_query.strip()}%"
            query = query.filter(
                (Case.case_reference.ilike(pattern)) |
                (Case.predicted_class.ilike(pattern))
            )

        total = query.count()

        # Sorting
        sort_col = getattr(Case, sort_by, Case.created_at)
        if sort_order.lower() == "desc":
            query = query.order_by(desc(sort_col))
        else:
            query = query.order_by(sort_col)

        # Pagination
        offset = (page - 1) * page_size
        cases = query.offset(offset).limit(page_size).all()

        total_pages = math.ceil(total / page_size) if total > 0 else 1

        summary_items = [
            CaseSummaryItem(
                id=str(c.id),
                case_reference=c.case_reference,
                dataset=c.dataset,
                status=c.status,
                model_architecture=c.model_architecture,
                model_version=c.model_version,
                number_of_slices=c.number_of_slices,
                predicted_class=c.predicted_class,
                mean_scores=c.mean_scores,
                inference_duration_ms=c.inference_duration_ms,
                is_single_slice=c.is_single_slice,
                created_at=c.created_at,
                updated_at=c.updated_at
            )
            for c in cases
        ]

        return CaseListResponse(
            cases=summary_items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    @staticmethod
    def get_case_by_id(
        db: Session,
        case_id: str,
        user: Profile
    ) -> Optional[Case]:
        """Fetch a single case verifying user ownership."""
        query = db.query(Case).filter(Case.id == case_id)
        if user.role != "ADMIN":
            query = query.filter(Case.owner_id == user.id)
        return query.first()

    @staticmethod
    def delete_case(
        db: Session,
        case_id: str,
        user: Profile
    ) -> bool:
        """Delete case and cascade-delete slices and report files in storage."""
        case = CaseService.get_case_by_id(db, case_id, user)
        if not case:
            return False

        # Clean up any physical report files in storage
        reports = db.query(Report).filter(Report.case_id == case.id).all()
        for r in reports:
            StorageService.delete_report_file(r.storage_path)

        db.delete(case)
        db.commit()
        return True
