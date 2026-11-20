"""Pydantic schemas for request validation and response serialization."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# HEALTH & METADATA SCHEMAS
# ============================================================

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "ThoracicAI Secure CT Research Platform"
    version: str = "1.0.0"
    device: str
    torch_version: str
    database_connected: bool = True
    models_loaded: Dict[str, bool]
    timestamp: datetime = Field(default_factory=get_utc_now)


class PreprocessingInfo(BaseModel):
    rgb_conversion: str = "RGBA composite onto black or direct RGB"
    resize_mode: str = "Aspect ratio preserved padding to 224x224 (LANCZOS)"
    normalization: str = "ImageNet mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]"
    crop_v2: Optional[Dict[str, float]] = None


class ModelMetadataItem(BaseModel):
    dataset: str
    display_name: str
    architecture: str = "DenseNet121"
    classes: List[str]
    development_images: int
    development_groups: int
    selected_epochs: int
    nested_cv_macro_f1: float
    test_group_accuracy: float
    test_macro_f1: float
    test_weighted_f1: float
    test_nll: float
    checkpoint_loaded: bool
    preprocessing: PreprocessingInfo


class ModelsResponse(BaseModel):
    models: List[ModelMetadataItem]
    count: int


# ============================================================
# USER & PROFILE SCHEMAS
# ============================================================

class UserProfileResponse(BaseModel):
    id: str
    email: str
    display_name: str
    role: str  # 'ADMIN' | 'RESEARCHER'
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProfileUpdateRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=100)


# ============================================================
# INFERENCE & PREDICTION SCHEMAS
# ============================================================

class SlicePrediction(BaseModel):
    slice_index: int
    filename: str
    predicted_class: str
    predicted_class_score: float
    class_scores: Dict[str, float]


class PredictionResponse(BaseModel):
    case_id: str
    case_reference: Optional[str] = None
    case_database_id: Optional[str] = None
    dataset: str
    architecture: str = "DenseNet121"
    number_of_slices: int
    predicted_class: str
    class_scores: Dict[str, float]
    slice_predictions: List[SlicePrediction]
    aggregation: str = "Arithmetic mean of per-slice softmax score vectors"
    processing_status: str = "completed"
    is_single_slice: bool
    inference_duration_ms: Optional[int] = None
    disclaimer: str = (
        "Research prototype only. Not a medical device. "
        "Scores are uncalibrated model outputs, not clinical probabilities."
    )
    timestamp: datetime = Field(default_factory=get_utc_now)


# ============================================================
# CASE MANAGEMENT SCHEMAS
# ============================================================

class CaseSummaryItem(BaseModel):
    id: str
    case_reference: str
    dataset: str
    status: str
    model_architecture: str
    model_version: str
    number_of_slices: int
    predicted_class: Optional[str] = None
    mean_scores: Optional[Dict[str, float]] = None
    inference_duration_ms: Optional[int] = None
    is_single_slice: bool
    inference_duration_ms: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class CaseDetailResponse(CaseSummaryItem):
    slice_predictions: List[SlicePrediction]
    reports: List["ReportSummaryItem"] = []


class CaseListResponse(BaseModel):
    cases: List[CaseSummaryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================
# REPORT SCHEMAS
# ============================================================

class ReportCreateRequest(BaseModel):
    report_format: str = Field(..., pattern="^(PDF|CSV|JSON)$")


class ReportSummaryItem(BaseModel):
    id: str
    case_id: str
    case_reference: str
    dataset: str
    report_format: str
    generation_status: str
    file_size_bytes: int
    download_url: Optional[str] = None
    created_at: datetime


class ReportListResponse(BaseModel):
    reports: List[ReportSummaryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================
# ADMIN SCHEMAS
# ============================================================

class AdminUserItem(BaseModel):
    id: str
    email: str
    display_name: str
    role: str
    is_active: bool
    cases_count: int
    reports_count: int
    created_at: datetime


class AdminUserListResponse(BaseModel):
    users: List[AdminUserItem]
    total: int


class AdminUserUpdateRoleRequest(BaseModel):
    role: str = Field(..., pattern="^(ADMIN|RESEARCHER)$")


class AdminUserUpdateStatusRequest(BaseModel):
    is_active: bool


class AdminStatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_cases: int
    completed_cases: int
    failed_cases: int
    total_reports: int
    cancer_cases: int
    covid_cases: int


class AuditEventItem(BaseModel):
    id: str
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    request_id: Optional[str] = None
    ip_address: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime


class AuditListResponse(BaseModel):
    events: List[AuditEventItem]
    total: int
    page: int
    page_size: int


# ============================================================
# BENCHMARK & EVALUATION SCHEMAS
# ============================================================

class ConfusionMatrixData(BaseModel):
    labels: List[str]
    matrix: List[List[int]]


class ClassificationReportRow(BaseModel):
    label: str
    precision: float
    recall: float
    f1_score: float
    support: float


class DatasetMetrics(BaseModel):
    dataset: str
    architecture: str
    nested_cv_summary: Dict[str, Any]
    outer_fold_metrics: List[Dict[str, Any]]
    outer_confusion_matrix: ConfusionMatrixData
    test_summary: Dict[str, Any]
    test_classification_report: List[ClassificationReportRow]
    test_confusion_matrix: ConfusionMatrixData
    training_history: List[Dict[str, Any]]


class AllMetricsResponse(BaseModel):
    cancer: DatasetMetrics
    covid: DatasetMetrics


class SampleScanInfo(BaseModel):
    dataset: str
    name: str
    description: str
    slice_count: int
    expected_research_class: str
    filenames: List[str]
