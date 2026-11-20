"""Configuration module for ThoracicAI Research Backend."""

import os
from pathlib import Path
from typing import Dict, List
import torch

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent

# Locate model weights: check backend/weights first, then model_development/final_models
def _resolve_checkpoint(dataset: str) -> Path:
    candidates = [
        BASE_DIR / "weights" / dataset / "final_densenet121.pth",
        WORKSPACE_DIR / "model_development" / "final_models" / dataset / "final_densenet121.pth",
        Path("model_development/final_models") / dataset / "final_densenet121.pth",
    ]
    for path in candidates:
        if path.exists():
            return path
    # Default to standard path in backend weights
    return BASE_DIR / "weights" / dataset / "final_densenet121.pth"


class Settings:
    PROJECT_NAME: str = "ThoracicAI — CT Research & Classification Workbench"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"

    # Device configuration
    DEVICE: torch.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Image constants
    IMAGE_SIZE: tuple[int, int] = (224, 224)
    IMAGENET_MEAN: list[float] = [0.485, 0.456, 0.406]
    IMAGENET_STD: list[float] = [0.229, 0.224, 0.225]

    # Cancer Crop V2 percentages
    CANCER_CROP_TOP_PCT: float = 0.12
    CANCER_CROP_BOTTOM_PCT: float = 0.10
    CANCER_CROP_LEFT_PCT: float = 0.06
    CANCER_CROP_RIGHT_PCT: float = 0.06

    # Model Class mappings in exact order
    CLASS_NAMES: Dict[str, List[str]] = {
        "cancer": [
            "Benign",
            "Malignant",
            "Normal"
        ],
        "covid": [
            "COVID-19",
            "Normal",
            "Other pulmonary disease"
        ]
    }

    # Model checkpoints
    CHECKPOINT_PATHS: Dict[str, Path] = {
        "cancer": _resolve_checkpoint("cancer"),
        "covid": _resolve_checkpoint("covid")
    }

    # Upload validation limits
    SUPPORTED_EXTENSIONS: set[str] = {
        ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"
    }
    SUPPORTED_MIME_TYPES: set[str] = {
        "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp", "image/x-ms-bmp"
    }
    MIN_DIMENSION: int = 16
    MAX_FILE_BYTES: int = 50 * 1024 * 1024       # 50 MB per single file
    MAX_TOTAL_BYTES: int = 500 * 1024 * 1024     # 500 MB max aggregate upload
    MAX_IMAGE_COUNT: int = 120                   # Up to 120 slices per case

    # Inference batching
    INFERENCE_BATCH_SIZE: int = 16

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"  # Open for development
    ]


settings = Settings()
