
# ============================================================
# THORACIC AI - REPRODUCIBLE INFERENCE MODULE
# ============================================================

import io
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models

from PIL import Image, ImageOps
from torchvision.transforms import functional as TF


# ------------------------------------------------------------
# 1. CONFIGURATION
# ------------------------------------------------------------

APP_DIR = Path(__file__).resolve().parent
FINAL_MODEL_DIR = APP_DIR.parent

DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

IMAGE_SIZE = (224, 224)

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

CLASS_NAMES = {
    "cancer": [
        "Benign",
        "Malignant",
        "Normal"
    ],
    "covid": [
        "COVID-19",
        "Normal",
        "Other pulmonary disease"
    ]
}

CHECKPOINT_PATHS = {
    "cancer": (
        FINAL_MODEL_DIR
        / "cancer"
        / "final_densenet121.pth"
    ),
    "covid": (
        FINAL_MODEL_DIR
        / "covid"
        / "final_densenet121.pth"
    )
}


# ------------------------------------------------------------
# 2. LOAD MODEL
# ------------------------------------------------------------

def build_densenet121():

    model = models.densenet121(
        weights=None
    )

    input_features = model.classifier.in_features

    model.classifier = nn.Linear(
        input_features,
        3
    )

    return model


def load_model(dataset_name):

    if dataset_name not in CHECKPOINT_PATHS:
        raise ValueError(
            f"Unsupported dataset: {dataset_name}"
        )

    checkpoint_path = CHECKPOINT_PATHS[dataset_name]

    if not checkpoint_path.exists():
        raise FileNotFoundError(
            f"Model checkpoint not found: {checkpoint_path}"
        )

    try:
        checkpoint = torch.load(
            checkpoint_path,
            map_location=DEVICE,
            weights_only=True
        )
    except TypeError:
        # Compatibility with older PyTorch versions.
        checkpoint = torch.load(
            checkpoint_path,
            map_location=DEVICE
        )

    if "model_state_dict" not in checkpoint:
        raise KeyError(
            "Checkpoint does not contain model_state_dict."
        )

    model = build_densenet121()

    model.load_state_dict(
        checkpoint["model_state_dict"],
        strict=True
    )

    model = model.to(DEVICE)
    model.eval()

    metadata = {
        "dataset": checkpoint.get("dataset"),
        "architecture": checkpoint.get("architecture"),
        "selected_epochs": checkpoint.get("selected_epochs"),
        "development_images": checkpoint.get("development_images"),
        "development_groups": checkpoint.get("development_groups")
    }

    return model, metadata


# ------------------------------------------------------------
# 3. IMAGE PREPROCESSING
# ------------------------------------------------------------

def convert_to_rgb(image):

    # Composite alpha channel onto black background.
    if (
        "A" in image.getbands()
        or "transparency" in image.info
    ):

        rgba = image.convert("RGBA")

        background = Image.new(
            "RGB",
            rgba.size,
            (0, 0, 0)
        )

        background.paste(
            rgba,
            mask=rgba.getchannel("A")
        )

        image = background

    else:

        image = image.convert("RGB")

    return image


def preprocess_image(image, dataset_name):

    if dataset_name not in CLASS_NAMES:
        raise ValueError(
            f"Unknown dataset: {dataset_name}"
        )

    image = convert_to_rgb(image)

    # --------------------------------------------------------
    # Cancer Crop V2
    # Top 12%, bottom 10%, left/right 6%.
    # Applied uniformly to all cancer classes.
    # --------------------------------------------------------

    if dataset_name == "cancer":

        width, height = image.size

        left = int(width * 0.06)
        top = int(height * 0.12)

        right = int(width * 0.94)
        bottom = int(height * 0.90)

        if right <= left or bottom <= top:
            raise ValueError(
                "Image dimensions are too small for cancer cropping."
            )

        image = image.crop(
            (left, top, right, bottom)
        )

    # Preserve aspect ratio and pad to 224 x 224.
    image = ImageOps.pad(
        image,
        IMAGE_SIZE,
        method=Image.Resampling.LANCZOS,
        color=(0, 0, 0),
        centering=(0.5, 0.5)
    )

    tensor = TF.to_tensor(image)

    tensor = TF.normalize(
        tensor,
        mean=IMAGENET_MEAN,
        std=IMAGENET_STD
    )

    return tensor


# ------------------------------------------------------------
# 4. SINGLE-SCAN PREDICTION
# ------------------------------------------------------------

def predict_scan(
    dataset_name,
    image_payloads,
    model=None,
    batch_size=16
):

    if dataset_name not in CLASS_NAMES:
        raise ValueError(
            f"Unsupported dataset: {dataset_name}"
        )

    if not image_payloads:
        raise ValueError(
            "At least one CT image is required."
        )

    if model is None:
        model, _ = load_model(dataset_name)

    class_names = CLASS_NAMES[dataset_name]

    tensors = []
    filenames = []

    # --------------------------------------------------------
    # Preprocess each slice
    # --------------------------------------------------------

    for index, payload in enumerate(image_payloads):

        if isinstance(payload, tuple):

            filename, image_bytes = payload

        else:

            filename = f"slice_{index + 1}"
            image_bytes = payload

        try:

            with Image.open(
                io.BytesIO(image_bytes)
            ) as image:

                if image.width < 16 or image.height < 16:
                    raise ValueError(
                        "Image dimensions are too small."
                    )

                tensor = preprocess_image(
                    image,
                    dataset_name
                )

        except Exception as error:

            raise ValueError(
                f"Could not process {filename}: {error}"
            ) from error

        tensors.append(tensor)
        filenames.append(filename)

    # --------------------------------------------------------
    # Batch prediction
    # --------------------------------------------------------

    all_probabilities = []

    model.eval()

    with torch.inference_mode():

        for start in range(
            0,
            len(tensors),
            batch_size
        ):

            batch = torch.stack(
                tensors[start:start + batch_size]
            ).to(DEVICE)

            if DEVICE.type == "cuda":

                with torch.autocast(
                    device_type="cuda",
                    dtype=torch.float16
                ):

                    logits = model(batch)

            else:

                logits = model(batch)

            probabilities = torch.softmax(
                logits.float(),
                dim=1
            )

            all_probabilities.append(
                probabilities.cpu().numpy()
            )

    slice_probabilities = np.concatenate(
        all_probabilities,
        axis=0
    )

    # --------------------------------------------------------
    # Group-level aggregation
    # Arithmetic mean of slice probabilities.
    # --------------------------------------------------------

    mean_probabilities = (
        slice_probabilities.mean(axis=0)
    )

    predicted_index = int(
        np.argmax(mean_probabilities)
    )

    predicted_class = class_names[
        predicted_index
    ]

    # --------------------------------------------------------
    # Slice-level results
    # --------------------------------------------------------

    slice_predictions = []

    for index, probabilities in enumerate(
        slice_probabilities
    ):

        predicted_slice_index = int(
            np.argmax(probabilities)
        )

        slice_predictions.append({

            "filename": filenames[index],

            "predicted_class": class_names[
                predicted_slice_index
            ],

            "predicted_class_score": float(
                probabilities[predicted_slice_index]
            )

        })

    return {

        "dataset": dataset_name,

        "architecture": "DenseNet121",

        "number_of_slices": len(tensors),

        "predicted_class": predicted_class,

        "class_scores": {
            class_names[index]: float(
                mean_probabilities[index]
            )
            for index in range(len(class_names))
        },

        "slice_predictions": slice_predictions,

        "aggregation": "Mean of per-slice softmax scores"

    }
