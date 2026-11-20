"""Research report database model."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

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
    owner_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    report_format: Mapped[str] = mapped_column(String(16), nullable=False)  # 'PDF' | 'CSV' | 'JSON'
    storage_path: Mapped[str] = mapped_column(String(512), nullable=False)
    generation_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="COMPLETED"  # 'PENDING' | 'COMPLETED' | 'FAILED'
    )
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=get_utc_now)

    case = relationship("Case", back_populates="reports")
    owner = relationship("Profile", back_populates="reports")
