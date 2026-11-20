"""Integration tests for FastAPI endpoints."""

import io
from fastapi import status


def test_health_endpoint(client):
    """Test GET /api/health endpoint."""
    response = client.get("/api/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert "device" in data
    assert "torch_version" in data
    assert isinstance(data["models_loaded"]["cancer"], bool)
    assert isinstance(data["models_loaded"]["covid"], bool)


def test_models_metadata_endpoint(client):
    """Test GET /api/models endpoint."""
    response = client.get("/api/models")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["count"] == 2
    models = {m["dataset"]: m for m in data["models"]}

    assert "cancer" in models
    assert models["cancer"]["classes"] == ["Benign", "Malignant", "Normal"]
    assert models["cancer"]["selected_epochs"] == 9
    assert models["cancer"]["development_images"] == 875

    assert "covid" in models
    assert models["covid"]["classes"] == ["COVID-19", "Normal", "Other pulmonary disease"]
    assert models["covid"]["selected_epochs"] == 16
    assert models["covid"]["development_images"] == 3553


def test_metrics_endpoint(client):
    """Test GET /api/metrics endpoint returns CSV data accurately."""
    response = client.get("/api/metrics")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert "cancer" in data
    assert "covid" in data

    # Cancer metrics
    cancer_metrics = data["cancer"]
    assert cancer_metrics["dataset"] == "cancer"
    assert cancer_metrics["outer_confusion_matrix"]["labels"] == ["Benign", "Malignant", "Normal"]
    assert len(cancer_metrics["training_history"]) == 9

    # Covid metrics
    covid_metrics = data["covid"]
    assert covid_metrics["dataset"] == "covid"
    assert covid_metrics["outer_confusion_matrix"]["labels"] == ["COVID-19", "Normal", "Other pulmonary disease"]
    assert len(covid_metrics["training_history"]) == 16


def test_cancer_prediction_endpoint(client, synthetic_cancer_slice_bytes):
    """Test POST /api/predict/cancer with multipart images."""
    files = [
        ("files", ("slice_01.png", synthetic_cancer_slice_bytes, "image/png")),
        ("files", ("slice_02.png", synthetic_cancer_slice_bytes, "image/png"))
    ]
    response = client.post("/api/predict/cancer", files=files)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["dataset"] == "cancer"
    assert data["number_of_slices"] == 2
    assert data["predicted_class"] in ["Benign", "Malignant", "Normal"]
    assert len(data["slice_predictions"]) == 2
    assert data["is_single_slice"] is False
    assert data["case_id"].startswith("CASE-CAN-")


def test_covid_prediction_endpoint(client, synthetic_covid_slice_bytes):
    """Test POST /api/predict/covid with multipart images."""
    files = [
        ("files", ("slice_01.png", synthetic_covid_slice_bytes, "image/png"))
    ]
    response = client.post("/api/predict/covid", files=files)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    assert data["dataset"] == "covid"
    assert data["number_of_slices"] == 1
    assert data["predicted_class"] in ["COVID-19", "Normal", "Other pulmonary disease"]
    assert data["is_single_slice"] is True
    assert data["case_id"].startswith("CASE-COV-")


def test_predict_invalid_file_rejected(client, corrupt_image_bytes):
    """Test that invalid image files return 422 Unprocessable Entity."""
    files = [
        ("files", ("bad.png", corrupt_image_bytes, "image/png"))
    ]
    response = client.post("/api/predict/cancer", files=files)
    assert response.status_code == 422
    assert "Could not decode image" in response.json()["detail"]


def test_predict_unsupported_extension_rejected(client, synthetic_cancer_slice_bytes):
    """Test that unsupported extensions (.pdf) return 422."""
    files = [
        ("files", ("scan.pdf", synthetic_cancer_slice_bytes, "application/pdf"))
    ]
    response = client.post("/api/predict/cancer", files=files)
    assert response.status_code == 422
    assert "Unsupported file format" in response.json()["detail"]


def test_sample_scan_endpoints(client):
    """Test demo sample scan endpoints."""
    # Cancer sample info
    res = client.get("/api/sample-scans/cancer")
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["slice_count"] == 3

    # Predict cancer sample
    res_pred = client.post("/api/predict/sample/cancer")
    assert res_pred.status_code == status.HTTP_200_OK
    assert res_pred.json()["number_of_slices"] == 3
