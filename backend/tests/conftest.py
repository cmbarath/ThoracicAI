"""Test fixtures for ThoracicAI backend test suite."""

import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.services.sample_scans import generate_synthetic_ct_slice


@pytest.fixture(scope="session")
def client():
    """Session-scoped FastAPI test client with lifespan executed."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def valid_rgb_image_bytes() -> bytes:
    """Generate valid 256x256 RGB image."""
    img = Image.new("RGB", (256, 256), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def valid_rgba_image_bytes() -> bytes:
    """Generate valid 256x256 RGBA image with alpha channel."""
    img = Image.new("RGBA", (256, 256), color=(100, 100, 100, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def tiny_image_bytes() -> bytes:
    """Generate image smaller than 16x16."""
    img = Image.new("RGB", (10, 10), color=(100, 100, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def corrupt_image_bytes() -> bytes:
    """Generate corrupt byte stream."""
    return b"NOT_A_VALID_IMAGE_HEADER_CORRUPTED_BYTES"


@pytest.fixture
def synthetic_cancer_slice_bytes() -> bytes:
    """Generate synthetic cancer thoracic slice."""
    return generate_synthetic_ct_slice(slice_idx=1, variation="cancer")


@pytest.fixture
def synthetic_covid_slice_bytes() -> bytes:
    """Generate synthetic covid thoracic slice."""
    return generate_synthetic_ct_slice(slice_idx=1, variation="covid")
