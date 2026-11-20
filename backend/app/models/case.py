"""Research case and slice database models."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    case_reference: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False
    )
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    workspace_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("workspaces.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    dataset: Mapped[str] = mapped_column(String(32), nullable=False)  # 'cancer' | 'covid'
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="Completed"  # 'Draft' | 'Queued' | 'Processing' | 'Completed' | 'Failed' | 'Report pending' | 'Report completed'
    )
    model_architecture: Mapped[str] = mapped_column(String(64), default="DenseNet121")
    model_version: Mapped[str] = mapped_column(String(32), default="1.0.0")
    number_of_slices: Mapped[int] = mapped_column(Integer, default=0)
    predicted_class: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    mean_scores: Mapped[Optional[Dict[str, float]]] = mapped_column(JSON, nullable=True)
    inference_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_single_slice: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=get_utc_now,
        onupdate=get_utc_now
    )

    # Relationships
    owner = relationship("Profile", back_populates="cases")
    slices: Mapped[List["CaseSlice"]] = relationship(
        "CaseSlice",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="CaseSlice.slice_index"
    )
    reports = relationship("Report", back_populates="case", cascade="all, delete-orphan")


class CaseSlice(Base):
    __tablename__ = "case_slices"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    slice_index: Mapped[int] = mapped_column(Integer, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    predicted_class: Mapped[str] = mapped_column(String(64), nullable=False)
    class_scores: Mapped[Dict[str, float]] = mapped_column(JSON, nullable=False)

    case = relationship("Case", back_populates="slices")
