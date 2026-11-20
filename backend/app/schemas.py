"""Pydantic schemas for request validation and response serialization."""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "ThoracicAI CT Research API"
    version: str = "1.0.0"
    device: str
    torch_version: str
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


class SlicePrediction(BaseModel):
    slice_index: int
    filename: str
    predicted_class: str
    predicted_class_score: float
    class_scores: Dict[str, float]


class PredictionResponse(BaseModel):
    case_id: str
    dataset: str
    architecture: str = "DenseNet121"
    number_of_slices: int
    predicted_class: str
    class_scores: Dict[str, float]
    slice_predictions: List[SlicePrediction]
    aggregation: str = "Arithmetic mean of per-slice softmax score vectors"
    processing_status: str = "completed"
    is_single_slice: bool
    disclaimer: str = (
        "Research prototype only. Not a medical device. "
        "Scores are uncalibrated model outputs, not clinical probabilities."
    )
    timestamp: datetime = Field(default_factory=get_utc_now)


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
