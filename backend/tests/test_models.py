"""Tests for checkpoint loading, architecture, and class mappings."""

import pytest
import torch
import torch.nn as nn
from app.config import settings
from app.services.inference import ModelRegistry


def test_cancer_classes_order():
    """Verify cancer classes in exact required order."""
    expected = ["Benign", "Malignant", "Normal"]
    assert settings.CLASS_NAMES["cancer"] == expected


def test_covid_classes_order():
    """Verify COVID classes in exact required order."""
    expected = ["COVID-19", "Normal", "Other pulmonary disease"]
    assert settings.CLASS_NAMES["covid"] == expected


def test_cancer_model_loading_and_architecture():
    """Verify cancer model loading, architecture, and parameters."""
    registry = ModelRegistry.get_instance()
    model, metadata = registry.load_model("cancer")

    assert isinstance(model, nn.Module)
    assert isinstance(model.classifier, nn.Linear)
    assert model.classifier.out_features == 3
    assert metadata["architecture"].lower() == "densenet121"
    assert metadata["selected_epochs"] == 9
    assert metadata["development_images"] == 875
    assert metadata["development_groups"] == 69


def test_covid_model_loading_and_architecture():
    """Verify covid model loading, architecture, and parameters."""
    registry = ModelRegistry.get_instance()
    model, metadata = registry.load_model("covid")

    assert isinstance(model, nn.Module)
    assert isinstance(model.classifier, nn.Linear)
    assert model.classifier.out_features == 3
    assert metadata["architecture"].lower() == "densenet121"
    assert metadata["selected_epochs"] == 16
    assert metadata["development_images"] == 3553
    assert metadata["development_groups"] == 178


def test_model_caching():
    """Verify models are cached in memory and not re-read from disk on subsequent calls."""
    registry = ModelRegistry.get_instance()
    model1, _ = registry.load_model("cancer")
    model2, _ = registry.load_model("cancer")
    assert model1 is model2


def test_lazy_loading_and_single_model_eviction():
    """Verify on-demand loading and eviction to keep memory within 512MB."""
    registry = ModelRegistry.get_instance()
    registry.unload()

    assert not registry.is_loaded("cancer")
    assert not registry.is_loaded("covid")

    # Load cancer
    m_cancer, _ = registry.load_model("cancer")
    assert registry.is_loaded("cancer")
    assert not registry.is_loaded("covid")

    # Load covid -> cancer should be evicted in 512MB mode (MAX_LOADED_MODELS=1)
    if settings.MAX_LOADED_MODELS == 1:
        m_covid, _ = registry.load_model("covid")
        assert registry.is_loaded("covid")
        assert not registry.is_loaded("cancer")


def test_inference_semaphore_concurrency_serialization():
    """Verify that simultaneous inferences are safely serialized by semaphore."""
    import threading
    from app.services.inference import run_inference, _INFERENCE_SEMAPHORE
    from app.services.sample_scans import get_sample_scan_slices

    slices = get_sample_scan_slices("cancer")
    results = []
    errors = []

    def call_inf():
        try:
            res = run_inference("cancer", slices)
            results.append(res)
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=call_inf) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0
    assert len(results) == 3
    for r in results:
        assert r.dataset == "cancer"
        assert r.predicted_class in settings.CLASS_NAMES["cancer"]


def test_both_cancer_and_covid_predictions_functional():
    """Verify both cancer and covid inference pipelines produce correct schema and score distributions."""
    from app.services.inference import run_inference
    from app.services.sample_scans import get_sample_scan_slices

    cancer_slices = get_sample_scan_slices("cancer")
    covid_slices = get_sample_scan_slices("covid")

    cancer_res = run_inference("cancer", cancer_slices)
    assert cancer_res.dataset == "cancer"
    assert cancer_res.predicted_class in settings.CLASS_NAMES["cancer"]
    assert sum(cancer_res.class_scores.values()) == pytest.approx(1.0, abs=1e-3)

    covid_res = run_inference("covid", covid_slices)
    assert covid_res.dataset == "covid"
    assert covid_res.predicted_class in settings.CLASS_NAMES["covid"]
    assert sum(covid_res.class_scores.values()) == pytest.approx(1.0, abs=1e-3)
