"""Tests for file validation, error handling, and unsupported file rejection."""

import pytest
from app.services.validation import (
    ValidationError,
    validate_file_extension,
    validate_image_payload
)


def test_allowed_extensions():
    """Verify that all allowed static formats pass extension validation."""
    valid_names = [
        "scan.png", "scan.jpg", "scan.jpeg",
        "scan.tif", "scan.tiff", "scan.bmp", "scan.webp"
    ]
    for name in valid_names:
        validate_file_extension(name)  # Should not raise


def test_rejected_extensions():
    """Verify that unsupported extensions are rejected."""
    invalid_names = [
        "scan.pdf", "scan.dcm", "scan.nii",
        "scan.nii.gz", "scan.txt", "scan.exe", "scan.csv"
    ]
    for name in invalid_names:
        with pytest.raises(ValidationError) as exc_info:
            validate_file_extension(name)
        assert "Unsupported file format" in str(exc_info.value)


def test_corrupt_image_rejection(corrupt_image_bytes):
    """Verify that corrupt byte streams raise ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        validate_image_payload("corrupt.png", corrupt_image_bytes, "cancer")
    assert "Could not decode image" in str(exc_info.value)


def test_empty_file_rejection():
    """Verify empty byte payload is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        validate_image_payload("empty.png", b"", "cancer")
    assert "empty" in str(exc_info.value)


def test_tiny_image_rejection(tiny_image_bytes):
    """Verify image with dimensions under 16x16 is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        validate_image_payload("tiny.png", tiny_image_bytes, "covid")
    assert "below the minimum required resolution" in str(exc_info.value)
