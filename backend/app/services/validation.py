"""Image file and payload validation service."""

import io
from pathlib import Path
from typing import List, Tuple
from fastapi import HTTPException, UploadFile, status
from PIL import Image

from ..config import settings


class ValidationError(Exception):
    """Custom validation exception."""
    pass


def validate_file_extension(filename: str) -> None:
    """Validate that the file has an allowed static image extension."""
    suffix = Path(filename).suffix.lower()
    if suffix not in settings.SUPPORTED_EXTENSIONS:
        raise ValidationError(
            f"Unsupported file format '{suffix}' in file '{filename}'. "
            f"Supported static formats: {', '.join(sorted(settings.SUPPORTED_EXTENSIONS))}. "
            "Note: DICOM and NIfTI formats are not supported in this static image workflow."
        )


def validate_image_payload(filename: str, file_bytes: bytes, dataset_name: str) -> Tuple[str, Image.Image]:
    """Validate image bytes: format, decode capability, dimensions, and crop viability."""
    if len(file_bytes) == 0:
        raise ValidationError(f"File '{filename}' is empty (0 bytes).")

    if len(file_bytes) > settings.MAX_FILE_BYTES:
        raise ValidationError(
            f"File '{filename}' exceeds maximum allowed file size of "
            f"{settings.MAX_FILE_BYTES // (1024 * 1024)} MB."
        )

    validate_file_extension(filename)

    try:
        # Open and load into memory to catch truncation or corruption
        image = Image.open(io.BytesIO(file_bytes))
        image.load()
    except Exception as exc:
        raise ValidationError(
            f"Could not decode image '{filename}'. The file may be corrupt or not a valid image. Detail: {exc}"
        ) from exc

    if image.width < settings.MIN_DIMENSION or image.height < settings.MIN_DIMENSION:
        raise ValidationError(
            f"Image '{filename}' dimensions ({image.width}x{image.height}) are below the "
            f"minimum required resolution of {settings.MIN_DIMENSION}x{settings.MIN_DIMENSION}."
        )

    # For cancer, verify dimensions are large enough for Cancer Crop V2
    if dataset_name == "cancer":
        left = int(image.width * settings.CANCER_CROP_LEFT_PCT)
        top = int(image.height * settings.CANCER_CROP_TOP_PCT)
        right = int(image.width * (1.0 - settings.CANCER_CROP_RIGHT_PCT))
        bottom = int(image.height * (1.0 - settings.CANCER_CROP_BOTTOM_PCT))

        if right <= left or bottom <= top:
            raise ValidationError(
                f"Image '{filename}' dimensions ({image.width}x{image.height}) are too small "
                "for Cancer Crop V2 extraction."
            )

    return filename, image


async def validate_upload_files(
    files: List[UploadFile],
    dataset_name: str
) -> List[Tuple[str, bytes]]:
    """Validate and read multipart file uploads asynchronously."""
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one CT image slice is required."
        )

    if len(files) > settings.MAX_IMAGE_COUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Upload exceeds maximum allowable slice count of {settings.MAX_IMAGE_COUNT} images."
        )

    total_bytes = 0
    validated_payloads: List[Tuple[str, bytes]] = []

    for file in files:
        filename = file.filename or "unknown_slice.png"
        content = await file.read()
        total_bytes += len(content)

        if total_bytes > settings.MAX_TOTAL_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total upload size exceeds the maximum limit of {settings.MAX_TOTAL_BYTES // (1024 * 1024)} MB."
            )

        try:
            validate_image_payload(filename, content, dataset_name)
        except ValidationError as err:
            raise HTTPException(
                status_code=422,
                detail=str(err)
            ) from err

        validated_payloads.append((filename, content))

    return validated_payloads
