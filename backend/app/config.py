"""Configuration module for ThoracicAI Research & Classification Platform."""

import os
from pathlib import Path
from typing import Dict, List, Optional, Set
import torch
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent


def _resolve_checkpoint(dataset: str) -> Path:
    candidates = [
        BASE_DIR / "weights" / dataset / "final_densenet121.pth",
        WORKSPACE_DIR / "model_development" / "final_models" / dataset / "final_densenet121.pth",
        Path("model_development/final_models") / dataset / "final_densenet121.pth",
    ]
    for path in candidates:
        if path.exists():
            return path
    return BASE_DIR / "weights" / dataset / "final_densenet121.pth"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "ThoracicAI — Secure CT Research & Classification Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"

    # Database Configuration (Supabase PostgreSQL in production, SQLite fallback in dev/test)
    DATABASE_URL: Optional[str] = None
    SUPABASE_DB_HOST: str = ""
    SUPABASE_DB_PASSWORD: str = ""
    Project_ID: str = ""

    # Supabase Auth & JWT Configuration
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = "thoracicai-development-jwt-secret-key-at-least-32-chars-long"
    JWT_ALGORITHM: str = "HS256"
    JWT_AUDIENCE: str = "authenticated"
    JWT_ALLOWED_ALGORITHMS: List[str] = ["HS256", "RS256", "ES256"]
    JWT_ISSUER: Optional[str] = None

    @property
    def EXPECTED_ISSUER(self) -> str:
        if self.JWT_ISSUER:
            return self.JWT_ISSUER
        if self.SUPABASE_URL:
            clean_url = self.SUPABASE_URL.split("/rest/v1")[0].rstrip("/")
            return f"{clean_url}/auth/v1"
        return "thoracicai-auth"

    # Administrator Email Configuration
    ADMIN_EMAIL: str = ""

    @property
    def EFFECTIVE_DATABASE_URL(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.Project_ID and self.SUPABASE_DB_HOST and self.SUPABASE_DB_PASSWORD:
            import urllib.parse
            encoded_pw = urllib.parse.quote_plus(self.SUPABASE_DB_PASSWORD)
            return f"postgresql://postgres.{self.Project_ID}:{encoded_pw}@aws-0-{self.SUPABASE_DB_HOST}.pooler.supabase.com:5432/postgres"
        return f"sqlite:///{BASE_DIR / 'thoracicai.db'}"

    @property
    def EFFECTIVE_ANON_KEY(self) -> str:
        return self.SUPABASE_ANON_KEY or self.SUPABASE_KEY or ""

    # Report Storage & Cloud Providers
    STORAGE_DIR: Path = BASE_DIR / "storage" / "reports"
    STORAGE_BACKEND: str = "supabase"  # "supabase", "gcs", or "local"
    SUPABASE_STORAGE_BUCKET: str = "reports"
    GCS_BUCKET_NAME: str = "thoracicai-storage-2026"
    GCP_PROJECT_ID: str = "project-9242b60b-f224-4c35-b04"
    SIGNED_URL_EXPIRY_SECONDS: int = 900  # 15 minutes

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
    SUPPORTED_EXTENSIONS: Set[str] = {
        ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"
    }
    SUPPORTED_MIME_TYPES: Set[str] = {
        "image/png", "image/jpeg", "image/tiff", "image/bmp", "image/webp", "image/x-ms-bmp"
    }
    MIN_DIMENSION: int = 16
    MAX_FILE_BYTES: int = 50 * 1024 * 1024       # 50 MB per single file
    MAX_TOTAL_BYTES: int = 500 * 1024 * 1024     # 500 MB max aggregate upload
    MAX_IMAGE_COUNT: int = 120                   # Up to 120 slices per case

    # Inference batching & Concurrency Limits
    INFERENCE_BATCH_SIZE: int = 8
    PRELOAD_MODELS_ON_STARTUP: bool = False
    MAX_LOADED_MODELS: int = 1
    INFERENCE_SEMAPHORE_LIMIT: int = 1
    INFERENCE_TIMEOUT_SECONDS: float = 30.0

    # Security & Rate Limiting
    RATE_LIMIT_INFERENCE: str = "20/minute"
    RATE_LIMIT_STANDARD: str = "120/minute"

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://thoracicai.vercel.app",
        "https://thoracic-ai.vercel.app",
        "*"
    ]


settings = Settings()

# Ensure storage directory exists
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
