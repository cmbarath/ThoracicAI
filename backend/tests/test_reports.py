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
