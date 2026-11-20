"""Automated tests for ReportLab PDF, CSV, and JSON report generation and storage."""

from fastapi.testclient import TestClient


def get_auth_token(client: TestClient, email: str, name: str, role: str = "RESEARCHER") -> str:
    resp = client.post(
        "/api/auth/dev-token",
        json={"email": email, "display_name": name, "role": role}
    )
    return resp.json()["access_token"]


def test_pdf_report_generation_and_download(client: TestClient):
    """Verify ReportLab PDF generation, headers, and download."""
    token = get_auth_token(client, "pdf_tester@research.org", "PDF Tester")

    # Create a case first
    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    # Generate PDF report
    rep_resp = client.post(
        f"/api/cases/{case_id}/reports",
        headers={"Authorization": f"Bearer {token}"},
        json={"report_format": "PDF"}
    )
    assert rep_resp.status_code == 200
    report_info = rep_resp.json()
    assert report_info["report_format"] == "PDF"
    assert report_info["file_size_bytes"] > 1000
    report_id = report_info["id"]

    # Download report via API download route
    dl_resp = client.get(
        f"/api/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert dl_resp.content.startswith(b"%PDF-")  # Valid PDF signature


def test_csv_report_generation(client: TestClient):
    """Verify CSV export contains correct headers and metadata."""
    token = get_auth_token(client, "csv_tester@research.org", "CSV Tester")

    pred_resp = client.post("/api/predict/sample/covid", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    rep_resp = client.post(
        f"/api/cases/{case_id}/reports",
        headers={"Authorization": f"Bearer {token}"},
        json={"report_format": "CSV"}
    )
    assert rep_resp.status_code == 200
    report_id = rep_resp.json()["id"]

    dl_resp = client.get(
        f"/api/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert dl_resp.status_code == 200
    csv_text = dl_resp.text
    assert "ThoracicAI Research Classification Export" in csv_text
    assert "Slice Index" in csv_text
    assert "Predicted Class" in csv_text


def test_json_report_generation(client: TestClient):
    """Verify JSON export contains structured schema and metrics."""
    token = get_auth_token(client, "json_tester@research.org", "JSON Tester")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    rep_resp = client.post(
        f"/api/cases/{case_id}/reports",
        headers={"Authorization": f"Bearer {token}"},
        json={"report_format": "JSON"}
    )
    assert rep_resp.status_code == 200
    report_id = rep_resp.json()["id"]

    dl_resp = client.get(
        f"/api/reports/{report_id}/download",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert dl_resp.status_code == 200
    data = dl_resp.json()
    assert "case_reference" in data
    assert data["model"]["dataset"] == "cancer"
    assert "slice_predictions" in data


def test_report_user_isolation(client: TestClient):
    """Verify User B cannot download or delete User A's reports."""
    token_a = get_auth_token(client, "rep_user_a@research.org", "User A")
    token_b = get_auth_token(client, "rep_user_b@research.org", "User B")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token_a}"})
    case_id = pred_resp.json()["case_database_id"]

    rep_resp = client.post(
        f"/api/cases/{case_id}/reports",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"report_format": "PDF"}
    )
    report_id = rep_resp.json()["id"]

    # User B tries to download User A's report -> 404
    b_dl = client.get(f"/api/reports/{report_id}/download", headers={"Authorization": f"Bearer {token_b}"})
    assert b_dl.status_code == 404

    # User B tries to delete User A's report -> 404
    b_del = client.delete(f"/api/reports/{report_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert b_del.status_code == 404


def _get_mock_gcs_env():
    from unittest.mock import MagicMock
    mock_google = MagicMock()
    mock_cloud = MagicMock()
    mock_storage = MagicMock()
    mock_google.cloud = mock_cloud
    mock_cloud.storage = mock_storage
    modules = {
        "google": mock_google,
        "google.cloud": mock_cloud,
        "google.cloud.storage": mock_storage
    }
    return mock_storage, modules


def test_gcs_production_upload_failure_aborts_without_fallback(monkeypatch):
    """In production with GCS backend, upload failure must raise RuntimeError and never fall back to local disk."""
    import pytest
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "GCS_BUCKET_NAME", "thoracicai-storage-2026")

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.upload_from_string.side_effect = Exception("Google Cloud Storage 403 Forbidden")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        with pytest.raises(RuntimeError) as exc_info:
            StorageService.save_report_file("test_fail.pdf", b"test content")

        assert "Google Cloud Storage upload failed" in str(exc_info.value)
        assert "operation aborted to prevent silent fallback" in str(exc_info.value)


def test_gcs_dev_upload_failure_allows_fallback(monkeypatch):
    """In development with GCS backend, upload failure gracefully falls back to local disk."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "GCS_BUCKET_NAME", "thoracicai-storage-2026")
    monkeypatch.setattr(settings, "SUPABASE_URL", "")  # Disable supabase to test local fallback

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.upload_from_string.side_effect = Exception("Simulated connection error")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        res = StorageService.save_report_file("test_dev_fallback.pdf", b"dev content")
        assert res.startswith("local://")


def test_gcs_production_read_failure_aborts(monkeypatch):
    """In production, reading a GCS report that fails raises RuntimeError rather than falling back to local."""
    import pytest
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.download_as_bytes.side_effect = Exception("Blob not found in GCS")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        with pytest.raises(RuntimeError) as exc_info:
            StorageService.read_report_file("gcs://thoracicai-storage-2026/missing.pdf")
        assert "Failed to read report object from Google Cloud Storage" in str(exc_info.value)


def test_gcs_production_signing_failure_aborts(monkeypatch):
    """In production, signed URL generation failure for GCS raises RuntimeError rather than returning local proxy."""
    import pytest
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.generate_signed_url.side_effect = Exception("signBlob permission missing")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        with pytest.raises(RuntimeError) as exc_info:
            StorageService.generate_signed_url("gcs://thoracicai-storage-2026/test.pdf")
        assert "Google Cloud Storage signed URL generation failed" in str(exc_info.value)


def test_gcs_production_delete_failure_aborts(monkeypatch):
    """In production, deletion failure for GCS raises RuntimeError."""
    import pytest
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.delete.side_effect = Exception("GCS object delete error")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        with pytest.raises(RuntimeError) as exc_info:
            StorageService.delete_report_file("gcs://thoracicai-storage-2026/test.pdf")
        assert "Failed to delete report object from Google Cloud Storage" in str(exc_info.value)


def test_gcs_successful_save_returns_gcs_uri(monkeypatch):
    """When GCS succeeds, the returned path must be a valid gcs:// URI."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    from app.services.storage import StorageService

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "GCS_BUCKET_NAME", "thoracicai-storage-2026")

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    with patch.dict("sys.modules", modules):
        uri = StorageService.save_report_file("valid.pdf", b"test data")
        assert uri == "gcs://thoracicai-storage-2026/valid.pdf"
        mock_blob.upload_from_string.assert_called_once_with(b"test data", content_type="application/pdf")


def test_authenticated_gcs_report_download_success(client: TestClient, monkeypatch):
    """Verify that an authenticated user can download their report streamed from GCS."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    token = get_auth_token(client, "gcs_user@research.org", "GCS User")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.download_as_bytes.return_value = b"%PDF-1.4 Simulated GCS PDF Content"
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch.dict("sys.modules", modules):
        rep_resp = client.post(
            f"/api/cases/{case_id}/reports",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_format": "PDF"}
        )
        assert rep_resp.status_code == 200
        report_id = rep_resp.json()["id"]
        assert rep_resp.json()["download_url"] == f"/api/reports/{report_id}/download"

        dl_resp = client.get(
            f"/api/reports/{report_id}/download",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert dl_resp.status_code == 200
        assert dl_resp.content == b"%PDF-1.4 Simulated GCS PDF Content"
        assert dl_resp.headers["content-type"] == "application/pdf"


def test_unauthorized_report_download_rejected(client: TestClient):
    """Verify that unauthenticated download requests are rejected with 401."""
    dl_resp = client.get("/api/reports/REP-NONEXISTENT/download")
    assert dl_resp.status_code == 401


def test_cross_user_gcs_report_download_rejected(client: TestClient, monkeypatch):
    """Verify that User B cannot download User A's GCS report (rejected with 404)."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    token_a = get_auth_token(client, "user_a_gcs@research.org", "User A")
    token_b = get_auth_token(client, "user_b_gcs@research.org", "User B")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token_a}"})
    case_id = pred_resp.json()["case_database_id"]

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.download_as_bytes.return_value = b"%PDF-1.4 User A Private Data"
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch.dict("sys.modules", modules):
        rep_resp = client.post(
            f"/api/cases/{case_id}/reports",
            headers={"Authorization": f"Bearer {token_a}"},
            json={"report_format": "PDF"}
        )
        report_id = rep_resp.json()["id"]

        dl_b = client.get(
            f"/api/reports/{report_id}/download",
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert dl_b.status_code == 404


def test_admin_can_download_any_user_gcs_report(client: TestClient, monkeypatch):
    """Verify that an ADMIN can download any user's GCS report."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    token_user = get_auth_token(client, "regular_user@research.org", "Regular User", role="RESEARCHER")
    token_admin = get_auth_token(client, "admin_user@research.org", "Admin User", role="ADMIN")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token_user}"})
    case_id = pred_resp.json()["case_database_id"]

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.download_as_bytes.return_value = b"%PDF-1.4 Report Content for Admin"
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch.dict("sys.modules", modules):
        rep_resp = client.post(
            f"/api/cases/{case_id}/reports",
            headers={"Authorization": f"Bearer {token_user}"},
            json={"report_format": "PDF"}
        )
        report_id = rep_resp.json()["id"]

        dl_admin = client.get(
            f"/api/reports/{report_id}/download",
            headers={"Authorization": f"Bearer {token_admin}"}
        )
        assert dl_admin.status_code == 200
        assert dl_admin.content == b"%PDF-1.4 Report Content for Admin"


def test_gcs_read_failure_returns_safe_502(client: TestClient, monkeypatch):
    """Verify that a GCS download failure returns HTTP 502 with sanitized message."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    token = get_auth_token(client, "fail_reader@research.org", "Fail Reader")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch.dict("sys.modules", modules):
        rep_resp = client.post(
            f"/api/cases/{case_id}/reports",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_format": "PDF"}
        )
        report_id = rep_resp.json()["id"]

        mock_blob.download_as_bytes.side_effect = Exception("Internal GCS 503 Service Unavailable")

        dl_resp = client.get(
            f"/api/reports/{report_id}/download",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert dl_resp.status_code == 502
        data = dl_resp.json()
        assert "Failed to read report object from Google Cloud Storage" in data["detail"]
        assert "password" not in dl_resp.text.lower()
        assert "token" not in dl_resp.text.lower()


def test_report_creation_does_not_depend_on_signed_urls(client: TestClient, monkeypatch):
    """Verify report creation succeeds even if signed URL generation is completely disabled/broken."""
    from unittest.mock import MagicMock, patch
    from app.config import settings
    token = get_auth_token(client, "no_sign_user@research.org", "No Sign User")

    pred_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    case_id = pred_resp.json()["case_database_id"]

    mock_storage, modules = _get_mock_gcs_env()
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    mock_blob.generate_signed_url.side_effect = Exception("IAM signBlob disabled")
    mock_bucket.blob.return_value = mock_blob
    mock_client.return_value.bucket.return_value = mock_bucket
    mock_storage.Client = mock_client

    monkeypatch.setattr(settings, "STORAGE_BACKEND", "gcs")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    with patch.dict("sys.modules", modules):
        rep_resp = client.post(
            f"/api/cases/{case_id}/reports",
            headers={"Authorization": f"Bearer {token}"},
            json={"report_format": "PDF"}
        )
        assert rep_resp.status_code == 200
        report_data = rep_resp.json()
        assert len(report_data["id"]) > 10
        assert report_data["download_url"] == f"/api/reports/{report_data['id']}/download"
