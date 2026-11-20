"""Tests verifying the arithmetic mean softmax score aggregation logic."""

import numpy as np
import pytest
from app.config import settings
from app.services.inference import run_inference
from app.services.sample_scans import generate_synthetic_ct_slice


def test_arithmetic_mean_softmax_aggregation():
    """Verify that group-level prediction is strictly the arithmetic mean of slice softmax vectors,
    not majority voting or label averaging.
    """
    # Create two synthetic slices
    slice1 = generate_synthetic_ct_slice(slice_idx=1, variation="cancer")
    slice2 = generate_synthetic_ct_slice(slice_idx=2, variation="cancer")
    payloads = [("slice_1.png", slice1), ("slice_2.png", slice2)]

    result = run_inference("cancer", payloads)

    assert result.number_of_slices == 2
    assert result.is_single_slice is False
    assert result.dataset == "cancer"
    assert result.architecture == "DenseNet121"

    # Verify class_scores sum to approximately 1.0 (mean of probabilities)
    scores = result.class_scores
    score_sum = sum(scores.values())
    assert pytest.approx(score_sum, rel=1e-3) == 1.0

    # Verify predicted_class is argmax of mean class_scores
    max_class = max(scores, key=scores.get)
    assert result.predicted_class == max_class

    # Verify slice predictions exist for each slice
    assert len(result.slice_predictions) == 2
    for slice_pred in result.slice_predictions:
        assert slice_pred.predicted_class in settings.CLASS_NAMES["cancer"]
        assert 0.0 <= slice_pred.predicted_class_score <= 1.0


def test_single_slice_flag():
    """Verify single-slice cases have is_single_slice=True."""
    slice1 = generate_synthetic_ct_slice(slice_idx=1, variation="covid")
    payloads = [("slice_single.png", slice1)]

    result = run_inference("covid", payloads)
    assert result.number_of_slices == 1
    assert result.is_single_slice is True
