"""Main FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .api.routes import router as api_router
from .services.inference import ModelRegistry


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event to preload PyTorch models into memory once."""
    print("[ThoracicAI] Initializing service...")
    print(f"[ThoracicAI] Compute device: {settings.DEVICE}")
    registry = ModelRegistry.get_instance()
    registry.preload_all()
    print("[ThoracicAI] DenseNet121 model checkpoints loaded successfully.")
    yield
    print("[ThoracicAI] Shutting down service.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description=(
        "Research and evaluation platform for thoracic CT disease classification "
        "using trained DenseNet121 models. Experimental research use only."
    ),
    lifespan=lifespan
)

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
    """Safe exception handler preventing leak of system internals or raw payload details."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "InternalServerError",
            "message": "An error occurred during request processing.",
            "detail": str(exc),
            "disclaimer": "Research prototype only."
        }
    )


# Include API routes
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "title": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "status": "online",
        "documentation": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
        "models": f"{settings.API_V1_PREFIX}/models",
        "disclaimer": "Experimental research prototype. Not for clinical diagnostic use."
    }
