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
        """Save report file locally or to Supabase Storage. Returns storage_path."""
        # 1. If Supabase Storage is configured, attempt upload
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
                print(f"[StorageService] Supabase upload failed, falling back to local: {err}")

        # 2. Local fallback storage
        local_path = cls._get_local_file_path(filename)
        with open(local_path, "wb") as f:
            f.write(content)
        return f"local://{filename}"

    @classmethod
    def read_report_file(cls, storage_path: str) -> Tuple[bytes, str]:
        """Read report bytes from storage path. Returns (content_bytes, mime_type)."""
        filename = storage_path.split("/")[-1]
        ext = Path(filename).suffix.lower()

        mime_type = "application/octet-stream"
        if ext == ".pdf":
            mime_type = "application/pdf"
        elif ext == ".csv":
            mime_type = "text/csv; charset=utf-8"
        elif ext == ".json":
            mime_type = "application/json; charset=utf-8"

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
                print(f"[StorageService] Supabase read failed, checking local: {err}")

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
        """Generate short-lived signed download URL (Supabase or local API signed endpoint)."""
        filename = storage_path.split("/")[-1]

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
                print(f"[StorageService] Supabase signed URL failed: {err}")

        # Local API signed path
        return f"/api/reports/download/{filename}"

    @classmethod
    def delete_report_file(cls, storage_path: str) -> None:
        """Remove physical report file from storage."""
        filename = storage_path.split("/")[-1]

        if storage_path.startswith("supabase://") and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
            try:
                bucket = storage_path.replace("supabase://", "").split("/")[0]
                obj_name = "/".join(storage_path.replace("supabase://", "").split("/")[1:])
                url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{bucket}/{obj_name}"
                headers = {"Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"}
                with httpx.Client(timeout=10.0) as client:
                    client.delete(url, headers=headers)
            except Exception as err:
                print(f"[StorageService] Supabase file deletion error: {err}")

        local_path = cls._get_local_file_path(filename)
        if local_path.exists():
            try:
                local_path.unlink()
            except Exception as err:
                print(f"[StorageService] Local file deletion error: {err}")
