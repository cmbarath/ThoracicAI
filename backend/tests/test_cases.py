"""Automated tests for persistent case management and user isolation."""

from fastapi.testclient import TestClient


def get_auth_token(client: TestClient, email: str, name: str, role: str = "RESEARCHER") -> str:
    """Helper to mint a dev authentication token."""
    resp = client.post(
        "/api/auth/dev-token",
        json={"email": email, "display_name": name, "role": role}
    )
    return resp.json()["access_token"]


def test_authenticated_prediction_creates_persistent_case(client: TestClient):
    """Verify that running prediction with an authenticated user persists a case."""
    token = get_auth_token(client, "user_case_test@research.org", "Case Tester")

    # Run cancer sample prediction authenticated
    resp = client.post(
        "/api/predict/sample/cancer",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["case_id"].startswith("CASE-CAN-")
    assert data["case_reference"].startswith("CASE-CAN-")
    assert data["case_database_id"] is not None

    # Fetch user's cases and verify it appears in their list
    cases_resp = client.get(
        "/api/cases",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cases_resp.status_code == 200
    cases_data = cases_resp.json()
    assert cases_data["total"] >= 1
    found = any(c["id"] == data["case_database_id"] for c in cases_data["cases"])
    assert found is True


def test_case_detail_retrieval(client: TestClient):
    """Verify retrieving full case details including all slice predictions."""
    token = get_auth_token(client, "detail_tester@research.org", "Detail Tester")

    # Run covid sample prediction
    pred_resp = client.post(
        "/api/predict/sample/covid",
        headers={"Authorization": f"Bearer {token}"}
    )
    case_db_id = pred_resp.json()["case_database_id"]

    # Retrieve case by ID
    get_resp = client.get(
        f"/api/cases/{case_db_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_resp.status_code == 200
    detail = get_resp.json()
    assert detail["id"] == case_db_id
    assert detail["dataset"] == "covid"
    assert detail["number_of_slices"] == 3
    assert len(detail["slice_predictions"]) == 3
    assert detail["slice_predictions"][0]["filename"] is not None


def test_user_isolation_on_cases(client: TestClient):
    """Verify User A cannot access or delete User B's case (strict isolation)."""
    token_a = get_auth_token(client, "user_a@research.org", "User A")
    token_b = get_auth_token(client, "user_b@research.org", "User B")

    # User A creates a case
    pred_resp = client.post(
        "/api/predict/sample/cancer",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    case_a_id = pred_resp.json()["case_database_id"]

    # User B attempts to access User A's case -> 404 / Forbidden
    b_get_resp = client.get(
        f"/api/cases/{case_a_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert b_get_resp.status_code == 404

    # User B attempts to delete User A's case -> 404 / Forbidden
    b_del_resp = client.delete(
        f"/api/cases/{case_a_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert b_del_resp.status_code == 404

    # User A can view their own case
    a_get_resp = client.get(
        f"/api/cases/{case_a_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert a_get_resp.status_code == 200


def test_case_filtering_and_search(client: TestClient):
    """Verify filtering by dataset and searching by reference."""
    token = get_auth_token(client, "searcher@research.org", "Search User")

    # Create cancer case
    c_resp = client.post("/api/predict/sample/cancer", headers={"Authorization": f"Bearer {token}"})
    cancer_ref = c_resp.json()["case_reference"]

    # Create covid case
    client.post("/api/predict/sample/covid", headers={"Authorization": f"Bearer {token}"})

    # Filter by cancer
    cancer_filter_resp = client.get(
        "/api/cases?dataset=cancer",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cancer_filter_resp.status_code == 200
    for c in cancer_filter_resp.json()["cases"]:
        assert c["dataset"] == "cancer"

    # Search by exact reference substring
    search_resp = client.get(
        f"/api/cases?search={cancer_ref}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert search_resp.status_code == 200
    assert any(c["case_reference"] == cancer_ref for c in search_resp.json()["cases"])
