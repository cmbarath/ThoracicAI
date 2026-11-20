"""Main FastAPI application entrypoint for ThoracicAI SaaS platform."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import torch
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import settings
from .db.session import init_db
from .api.routes import router as api_router
from .api.auth_routes import router as auth_router
from .api.case_routes import router as case_router
from .api.report_routes import router as report_router
from .api.admin_routes import router as admin_router
from .services.inference import ModelRegistry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event to initialize compute device, DB schema, and configure model loading."""
    print("[ThoracicAI] Initializing platform backend...")

    # Configure PyTorch CPU single-thread runtime (Render 512MB & Cloud Run 1 vCPU optimization)
    if settings.DEVICE.type == "cpu":
        torch.set_num_threads(1)
        try:
            torch.set_num_interop_threads(1)
        except RuntimeError:
            pass
        print("[ThoracicAI] PyTorch CPU thread count pinned to 1 for memory efficiency.")

    try:
        init_db()
        print("[ThoracicAI] Database tables initialized.")
    except Exception as err:
        print(f"[ThoracicAI] Note: Database initialization deferred or handled externally: {err}")

    print(f"[ThoracicAI] Compute device: {settings.DEVICE}")

    registry = ModelRegistry.get_instance()
    if settings.PRELOAD_MODELS_ON_STARTUP:
        registry.preload_all()
        print("[ThoracicAI] DenseNet121 model checkpoints preloaded successfully.")
    else:
        print("[ThoracicAI] On-demand lazy model loading active (Render Free 512MB RAM mode).")

    yield
    print("[ThoracicAI] Shutting down service.")


def get_client_ip(request: Request) -> str:
    """Extract real client IP taking Cloud Run and Render proxies into account."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description=(
        "ThoracicAI — Secure CT Research & Classification Platform. "
        "Unified multi-user workbench for thoracic CT disease classification "
        "using trained DenseNet121 models. Experimental research use only."
    ),
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Safe exception handler preventing leak of system internals."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An error occurred during request processing.",
            "detail": str(exc),
            "disclaimer": "Experimental research prototype. Not for clinical diagnostic use."
        }
    )


# Include API routers under /api
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(case_router, prefix=settings.API_V1_PREFIX)
app.include_router(report_router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "title": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "online",
        "documentation": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
        "models": f"{settings.API_V1_PREFIX}/models",
        "cases": f"{settings.API_V1_PREFIX}/cases",
        "reports": f"{settings.API_V1_PREFIX}/reports",
        "admin": f"{settings.API_V1_PREFIX}/admin/stats",
        "disclaimer": "Experimental research prototype. Not for clinical diagnostic use."
    }
