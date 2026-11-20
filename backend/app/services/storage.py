"""Secure storage service for private research reports."""

import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
import httpx

from ..config import settings


class StorageService:
    """Manages report file persistence across local filesystem and Supabase Storage."""

    @staticmethod
    def _get_local_file_path(filename: str) -> Path:
        settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        return settings.STORAGE_DIR / filename

    @classmethod
    def save_report_file(
        cls,
        filename: str,
        content: bytes,
        content_type: str = "application/pdf"
    ) -> str:
        """Save report file locally, to Google Cloud Storage, or to Supabase Storage. Returns storage_path."""
        is_production = settings.ENVIRONMENT == "production"
        is_gcs = settings.STORAGE_BACKEND == "gcs"

        # 1. Google Cloud Storage (if selected as primary backend)
        if is_gcs:
            if not settings.GCS_BUCKET_NAME:
                if is_production:
                    raise RuntimeError("Google Cloud Storage backend selected but GCS_BUCKET_NAME is not configured.")
            else:
                try:
                    from google.cloud import storage as gcs
                    client = gcs.Client(project=settings.GCP_PROJECT_ID or None)
                    bucket = client.bucket(settings.GCS_BUCKET_NAME)
                    blob = bucket.blob(filename)
                    blob.upload_from_string(content, content_type=content_type)
                    return f"gcs://{settings.GCS_BUCKET_NAME}/{filename}"
                except Exception as err:
                    if is_production:
                        # In production when GCS is selected, fail immediately with a sanitized error.
                        # Never expose secrets, credentials, or fallback to ephemeral container disk.
                        raise RuntimeError(
                            f"Google Cloud Storage upload failed for bucket '{settings.GCS_BUCKET_NAME}': operation aborted to prevent silent fallback."
                        ) from None
                    print(f"[StorageService] GCS upload failed, falling back: {err}")

        # In production when GCS is chosen, we NEVER reach Supabase or local disk
        if is_production and is_gcs:
            raise RuntimeError(
                f"Google Cloud Storage backend '{settings.GCS_BUCKET_NAME}' failed; fallback disabled in production."
            )

        # 2. Supabase Storage upload
        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                url = (
                    f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/"
                    f"{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
                )
                headers = {
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": content_type,
                    "x-upsert": "true"
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, headers=headers, content=content)
                    if resp.status_code in (200, 201):
                        return f"supabase://{settings.SUPABASE_STORAGE_BUCKET}/{filename}"
            except Exception as err:
                if is_production and settings.STORAGE_BACKEND == "supabase":
                    raise RuntimeError("Supabase Storage upload failed in production.") from None
                print(f"[StorageService] Supabase upload failed, falling back to local: {err}")

        # 3. Local fallback storage
        if is_production and (is_gcs or settings.STORAGE_BACKEND == "supabase"):
            raise RuntimeError(
                f"Storage backend '{settings.STORAGE_BACKEND}' failed in production; refusing fallback to ephemeral container disk."
            )

        local_path = cls._get_local_file_path(filename)
        with open(local_path, "wb") as f:
            f.write(content)
        return f"local://{filename}"

    @classmethod
    def read_report_file(cls, storage_path: str) -> Tuple[bytes, str]:
        """Read report bytes from storage path. Returns (content_bytes, mime_type)."""
        filename = storage_path.split("/")[-1]
        ext = Path(filename).suffix.lower()
        is_production = settings.ENVIRONMENT == "production"

        mime_type = "application/octet-stream"
        if ext == ".pdf":
            mime_type = "application/pdf"
        elif ext == ".csv":
            mime_type = "text/csv; charset=utf-8"
        elif ext == ".json":
            mime_type = "application/json; charset=utf-8"

        # Google Cloud Storage path
        if storage_path.startswith("gcs://"):
            try:
                from google.cloud import storage as gcs
                bucket_name = storage_path.replace("gcs://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("gcs://", "").split("/")[1:])
                client = gcs.Client(project=settings.GCP_PROJECT_ID or None)
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(obj_name)
                return blob.download_as_bytes(), mime_type
            except Exception as err:
                if is_production:
                    raise RuntimeError(
                        f"Failed to read report object from Google Cloud Storage: {filename}"
                    ) from None
                print(f"[StorageService] GCS read failed, checking local: {err}")

        # Supabase Storage path
        if storage_path.startswith("supabase://") and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                bucket = storage_path.replace("supabase://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("supabase://", "").split("/")[1:])
                url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{obj_name}"
                headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(url, headers=headers)
                    if resp.status_code == 200:
                        return resp.content, mime_type
            except Exception as err:
                if is_production:
                    raise RuntimeError(
                        f"Failed to read report object from Supabase Storage: {filename}"
                    ) from None
                print(f"[StorageService] Supabase read failed, checking local: {err}")

        # In production, if storage_path was a cloud path that failed above, do not check local disk
        if is_production and (storage_path.startswith("gcs://") or storage_path.startswith("supabase://")):
            raise FileNotFoundError(f"Report file '{filename}' could not be located in remote storage.")

        # Local storage path
        local_path = cls._get_local_file_path(filename)
        if not local_path.exists():
            raise FileNotFoundError(f"Report file not found: {filename}")

        with open(local_path, "rb") as f:
            content = f.read()

        return content, mime_type

    @classmethod
    def generate_signed_url(
        cls,
        storage_path: str,
        expires_in: int = settings.SIGNED_URL_EXPIRY_SECONDS
    ) -> str:
        """Generate short-lived signed download URL (Google Cloud Storage, Supabase, or local API endpoint)."""
        filename = storage_path.split("/")[-1]
        is_production = settings.ENVIRONMENT == "production"

        # Google Cloud Storage signed URL
        if storage_path.startswith("gcs://"):
            try:
                from google.cloud import storage as gcs
                import datetime
                bucket_name = storage_path.replace("gcs://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("gcs://", "").split("/")[1:])
                client = gcs.Client(project=settings.GCP_PROJECT_ID or None)
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(obj_name)
                return blob.generate_signed_url(
                    version="v4",
                    expiration=datetime.timedelta(seconds=expires_in),
                    method="GET"
                )
            except Exception as err:
                if is_production:
                    raise RuntimeError(
                        f"Google Cloud Storage signed URL generation failed for report: {filename}"
                    ) from None
                print(f"[StorageService] GCS signed URL generation error: {err}")
                return None

        if storage_path.startswith("supabase://") and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                bucket = storage_path.replace("supabase://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("supabase://", "").split("/")[1:])
                url = (
                    f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/sign/"
                    f"{bucket}/{obj_name}"
                )
                headers = {
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                }
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, headers=headers, json={"expiresIn": expires_in})
                    if resp.status_code == 200:
                        data = resp.json()
                        signed_path = data.get("signedURL")
                        if signed_path:
                            return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1{signed_path}"
            except Exception as err:
                if is_production and settings.STORAGE_BACKEND == "supabase":
                    raise RuntimeError(
                        f"Supabase Storage signed URL generation failed for report: {filename}"
                    ) from None
                print(f"[StorageService] Supabase signed URL failed: {err}")
                return None

        # Local API path only when storage backend is local
        if settings.STORAGE_BACKEND == "local" or storage_path.startswith("local://"):
            return f"/api/reports/download/{filename}"

        return None

    @classmethod
    def delete_report_file(cls, storage_path: str) -> None:
        """Remove physical report file from storage."""
        filename = storage_path.split("/")[-1]
        is_production = settings.ENVIRONMENT == "production"

        if storage_path.startswith("gcs://"):
            try:
                from google.cloud import storage as gcs
                bucket_name = storage_path.replace("gcs://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("gcs://", "").split("/")[1:])
                client = gcs.Client(project=settings.GCP_PROJECT_ID or None)
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(obj_name)
                blob.delete()
                return
            except Exception as err:
                if is_production:
                    raise RuntimeError(
                        f"Failed to delete report object from Google Cloud Storage: {filename}"
                    ) from None
                print(f"[StorageService] GCS file deletion error: {err}")

        if storage_path.startswith("supabase://") and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                bucket = storage_path.replace("supabase://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("supabase://", "").split("/")[1:])
                url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{obj_name}"
                headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
                with httpx.Client(timeout=10.0) as client:
                    resp = client.delete(url, headers=headers)
                    if is_production and resp.status_code not in (200, 204):
                        raise RuntimeError(f"Failed to delete report from Supabase Storage: {filename}")
                return
            except Exception as err:
                if is_production:
                    raise RuntimeError(
                        f"Failed to delete report object from Supabase Storage: {filename}"
                    ) from None
                print(f"[StorageService] Supabase file deletion error: {err}")

        local_path = cls._get_local_file_path(filename)
        if local_path.exists():
            try:
                local_path.unlink()
            except Exception as err:
                if is_production and (storage_path.startswith("gcs://") or storage_path.startswith("supabase://")):
                    raise RuntimeError(f"Failed to delete report file: {filename}") from None
                print(f"[StorageService] Local file deletion error: {err}")
