"""FastAPI router implementing core REST endpoints for inference and metrics."""

from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
import torch

from ..config import settings
from ..core.auth import get_optional_user
from ..db.session import get_db
from ..models import Profile
from ..schemas import (
    AllMetricsResponse,
    HealthResponse,
    ModelMetadataItem,
    ModelsResponse,
    PredictionResponse,
    PreprocessingInfo,
    SampleScanInfo
)
from ..services.audit import log_audit_event
from ..services.case_service import CaseService
from ..services.inference import ModelRegistry, run_inference
from ..services.metrics_service import get_all_metrics
from ..services.sample_scans import get_sample_scan_slices
from ..services.validation import validate_upload_files

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def get_health() -> HealthResponse:
    """Service health status and runtime environment metadata."""
    registry = ModelRegistry.get_instance()
    loaded_status = {
        "cancer": registry.is_loaded("cancer"),
        "covid": registry.is_loaded("covid")
    }
    return HealthResponse(
        status="healthy",
        service="ThoracicAI CT Research API",
        version=settings.PROJECT_VERSION,
        device=str(settings.DEVICE),
        torch_version=torch.__version__,
        models_loaded=loaded_status
    )


@router.get("/models", response_model=ModelsResponse, tags=["Models"])
def get_models() -> ModelsResponse:
    """Retrieve metadata, parameters, and preprocessing configs for both models."""
    registry = ModelRegistry.get_instance()

    items: List[ModelMetadataItem] = [
        ModelMetadataItem(
            dataset="cancer",
            display_name="Cancer Classification Workflow",
            architecture="DenseNet121",
            classes=settings.CLASS_NAMES["cancer"],
            development_images=875,
            development_groups=69,
            selected_epochs=9,
            nested_cv_macro_f1=0.7212,
            test_group_accuracy=0.7692,
            test_macro_f1=0.7091,
            test_weighted_f1=0.7818,
            test_nll=0.3576,
            checkpoint_loaded=registry.is_loaded("cancer"),
            preprocessing=PreprocessingInfo(
                crop_v2={
                    "top_pct": settings.CANCER_CROP_TOP_PCT * 100,
                    "bottom_pct": settings.CANCER_CROP_BOTTOM_PCT * 100,
                    "left_pct": settings.CANCER_CROP_LEFT_PCT * 100,
                    "right_pct": settings.CANCER_CROP_RIGHT_PCT * 100,
                }
            )
        ),
        ModelMetadataItem(
            dataset="covid",
            display_name="COVID / Pulmonary Disease Classification Workflow",
            architecture="DenseNet121",
            classes=settings.CLASS_NAMES["covid"],
            development_images=3553,
            development_groups=178,
            selected_epochs=16,
            nested_cv_macro_f1=0.8242,
            test_group_accuracy=0.78125,
            test_macro_f1=0.7775,
            test_weighted_f1=0.7810,
            test_nll=0.4980,
            checkpoint_loaded=registry.is_loaded("covid"),
            preprocessing=PreprocessingInfo(
                crop_v2=None
            )
        )
    ]

    return ModelsResponse(models=items, count=len(items))


@router.post(
    "/predict/cancer",
    response_model=PredictionResponse,
    tags=["Inference"],
    summary="Cancer DenseNet121 multi-slice inference"
)
async def predict_cancer(
    files: List[UploadFile] = File(
        ...,
        description="One or more CT scan slice images (PNG, JPG, TIFF, BMP, WebP)"
    ),
    current_user: Optional[Profile] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> PredictionResponse:
    """Execute Cancer DenseNet121 inference with Cancer Crop V2 and arithmetic mean aggregation."""
    validated_payloads = await validate_upload_files(files, dataset_name="cancer")

    try:
        result = run_inference(
            dataset_name="cancer",
            image_payloads=validated_payloads
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {err}"
        ) from err

    if current_user:
        case = CaseService.create_and_complete_case(
            db=db,
            owner=current_user,
            dataset="cancer",
            number_of_slices=result.number_of_slices,
            predicted_class=result.predicted_class,
            mean_scores=result.class_scores,
            slice_predictions=result.slice_predictions,
            inference_duration_ms=result.inference_duration_ms or 0
        )
        result.case_id = case.case_reference
        result.case_reference = case.case_reference
        result.case_database_id = case.id

        log_audit_event(
            db=db,
            action="CASE_CREATE",
            resource_type="case",
            actor=current_user,
            resource_id=case.id,
            details={
                "case_reference": case.case_reference,
                "dataset": "cancer",
                "predicted_class": result.predicted_class,
                "number_of_slices": result.number_of_slices
            }
        )

    return result


@router.post(
    "/predict/covid",
    response_model=PredictionResponse,
    tags=["Inference"],
    summary="COVID / Pulmonary DenseNet121 multi-slice inference"
)
async def predict_covid(
    files: List[UploadFile] = File(
        ...,
        description="One or more CT scan slice images (PNG, JPG, TIFF, BMP, WebP)"
    ),
    current_user: Optional[Profile] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> PredictionResponse:
    """Execute COVID / Pulmonary DenseNet121 inference with arithmetic mean aggregation."""
    validated_payloads = await validate_upload_files(files, dataset_name="covid")

    try:
        result = run_inference(
            dataset_name="covid",
            image_payloads=validated_payloads
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference execution failed: {err}"
        ) from err

    if current_user:
        case = CaseService.create_and_complete_case(
            db=db,
            owner=current_user,
            dataset="covid",
            number_of_slices=result.number_of_slices,
            predicted_class=result.predicted_class,
            mean_scores=result.class_scores,
            slice_predictions=result.slice_predictions,
            inference_duration_ms=result.inference_duration_ms or 0
        )
        result.case_id = case.case_reference
        result.case_reference = case.case_reference
        result.case_database_id = case.id

        log_audit_event(
            db=db,
            action="CASE_CREATE",
            resource_type="case",
            actor=current_user,
            resource_id=case.id,
            details={
                "case_reference": case.case_reference,
                "dataset": "covid",
                "predicted_class": result.predicted_class,
                "number_of_slices": result.number_of_slices
            }
        )

    return result


@router.get("/metrics", response_model=AllMetricsResponse, tags=["Metrics"])
def get_metrics() -> AllMetricsResponse:
    """Return nested cross-validation and independent test evaluation metrics."""
    return get_all_metrics()


@router.get("/sample-scans/{dataset}", response_model=SampleScanInfo, tags=["Demo Samples"])
def get_sample_scan_info(dataset: str) -> SampleScanInfo:
    """Retrieve metadata about the pre-configured sample CT slice series."""
    if dataset not in ("cancer", "covid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset must be 'cancer' or 'covid'."
        )

    slices = get_sample_scan_slices(dataset)
    filenames = [filename for filename, _ in slices]

    return SampleScanInfo(
        dataset=dataset,
        name=f"Sample {dataset.capitalize()} 3-Slice Series",
        description="Synthetic thoracic CT series spanning apical, mid-thoracic, and basal slices.",
        slice_count=len(slices),
        expected_research_class="Research Demo Scan",
        filenames=filenames
    )


@router.post("/predict/sample/{dataset}", response_model=PredictionResponse, tags=["Demo Samples"])
def predict_sample_scan(
    dataset: str,
    current_user: Optional[Profile] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> PredictionResponse:
    """Run prediction directly on synthetic sample CT slices for testing."""
    if dataset not in ("cancer", "covid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dataset must be 'cancer' or 'covid'."
        )

    slices = get_sample_scan_slices(dataset)
    result = run_inference(dataset_name=dataset, image_payloads=slices)

    if current_user:
        case = CaseService.create_and_complete_case(
            db=db,
            owner=current_user,
            dataset=dataset,
            number_of_slices=result.number_of_slices,
            predicted_class=result.predicted_class,
            mean_scores=result.class_scores,
            slice_predictions=result.slice_predictions,
            inference_duration_ms=result.inference_duration_ms or 0
        )
        result.case_id = case.case_reference
        result.case_reference = case.case_reference
        result.case_database_id = case.id

    return result
