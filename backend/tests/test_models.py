"""Tests for checkpoint loading, architecture, and class mappings."""

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
