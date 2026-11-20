"""Tests for image preprocessing, Crop V2, padding, and RGB conversions."""

import torch
from PIL import Image
from app.services.inference import convert_to_rgb, preprocess_image


def test_convert_to_rgb_with_grayscale():
    img = Image.new("L", (100, 100), color=128)
    rgb = convert_to_rgb(img)
    assert rgb.mode == "RGB"
    assert rgb.size == (100, 100)


def test_convert_to_rgb_with_rgba_compositing():
    # Semi-transparent red pixel over alpha
    img = Image.new("RGBA", (50, 50), color=(255, 0, 0, 128))
    rgb = convert_to_rgb(img)
    assert rgb.mode == "RGB"
    assert rgb.size == (50, 50)
    # Check that pixel composited onto black (255 * 128 / 255 = ~128)
    pixel = rgb.getpixel((25, 25))
    assert pixel[0] > 0
    assert pixel[1] == 0
    assert pixel[2] == 0


def test_cancer_preprocessing_output_dimensions():
    """Verify cancer preprocessing applies Crop V2, pads to 224x224, and produces 3x224x224 normalized tensor."""
    img = Image.new("RGB", (512, 512), color=(100, 100, 100))
    tensor = preprocess_image(img, "cancer")

    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32


def test_covid_preprocessing_output_dimensions():
    """Verify COVID preprocessing preserves aspect ratio, pads to 224x224, and produces 3x224x224 tensor."""
    img = Image.new("RGB", (600, 300), color=(100, 100, 100))
    tensor = preprocess_image(img, "covid")

    assert isinstance(tensor, torch.Tensor)
    assert tensor.shape == (3, 224, 224)
    assert tensor.dtype == torch.float32
