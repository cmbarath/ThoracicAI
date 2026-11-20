"""PyTorch inference service reproducing the exact reference implementation."""

import gc
import io
import threading
import time
import uuid
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import torch
import torch.nn as nn
import torchvision.models as models
from torchvision.transforms import functional as TF
from PIL import Image, ImageOps

from ..config import settings
from ..schemas import PredictionResponse, SlicePrediction

# Optimize PyTorch CPU runtime for 1 vCPU / 512MB RAM environments
if settings.DEVICE.type == "cpu":
    torch.set_num_threads(1)
    try:
        torch.set_num_interop_threads(1)
    except RuntimeError:
        pass

# Global inference semaphore to guarantee single active forward pass in memory-constrained environments
_INFERENCE_SEMAPHORE = threading.Semaphore(settings.INFERENCE_SEMAPHORE_LIMIT)


class ModelRegistry:
    """Singleton model registry to manage models in memory safely."""
    _instance: Optional["ModelRegistry"] = None

    def __init__(self):
        self._models: Dict[str, nn.Module] = {}
        self._metadata: Dict[str, Dict[str, Any]] = {}
        self._device = settings.DEVICE
        self._lock = threading.Lock()

    @classmethod
    def get_instance(cls) -> "ModelRegistry":
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance

    @staticmethod
    def build_densenet121() -> nn.Module:
        """Instantiate DenseNet121 with 3-class linear head."""
        model = models.densenet121(weights=None)
        in_features = model.classifier.in_features
        model.classifier = nn.Linear(in_features, 3)
        return model

    def load_model(self, dataset_name: str) -> Tuple[nn.Module, Dict[str, Any]]:
        """Load and cache the trained DenseNet121 model with memory optimization."""
        with self._lock:
            if dataset_name in self._models:
                return self._models[dataset_name], self._metadata[dataset_name]

            if dataset_name not in settings.CHECKPOINT_PATHS:
                raise ValueError(f"Unsupported dataset: {dataset_name}")

            checkpoint_path = settings.CHECKPOINT_PATHS[dataset_name]
            if not checkpoint_path.exists():
                raise FileNotFoundError(f"Model checkpoint not found: {checkpoint_path}")

            # Evict inactive models when max_loaded_models is reached (Render 512MB RAM mode)
            if len(self._models) >= settings.MAX_LOADED_MODELS:
                for key in list(self._models.keys()):
                    if key != dataset_name:
                        del self._models[key]
                        del self._metadata[key]
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

            try:
                checkpoint = torch.load(checkpoint_path, map_location=self._device, weights_only=True)
            except TypeError:
                checkpoint = torch.load(checkpoint_path, map_location=self._device)

            if "model_state_dict" not in checkpoint:
                raise KeyError("Checkpoint does not contain model_state_dict.")

            model = self.build_densenet121()
            model.load_state_dict(checkpoint["model_state_dict"], strict=True)
            model = model.to(self._device)
            model.eval()

            # Freeze parameters to prevent gradient buffer allocation
            for param in model.parameters():
                param.requires_grad = False

            metadata = {
                "dataset": checkpoint.get("dataset", dataset_name),
                "architecture": checkpoint.get("architecture", "DenseNet121"),
                "selected_epochs": checkpoint.get("selected_epochs"),
                "development_images": checkpoint.get("development_images"),
                "development_groups": checkpoint.get("development_groups"),
            }

            # Delete checkpoint dictionary and collect garbage to release deserialization RAM
            del checkpoint
            gc.collect()

            self._models[dataset_name] = model
            self._metadata[dataset_name] = metadata
            return model, metadata

    def is_loaded(self, dataset_name: str) -> bool:
        with self._lock:
            return dataset_name in self._models

    def unload(self, dataset_name: Optional[str] = None) -> None:
        """Unload specific model or all models from memory and invoke garbage collection."""
        with self._lock:
            if dataset_name:
                if dataset_name in self._models:
                    del self._models[dataset_name]
                    del self._metadata[dataset_name]
            else:
                self._models.clear()
                self._metadata.clear()
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def preload_all(self) -> None:
        """Preload both checkpoints into memory (only if PRELOAD_MODELS_ON_STARTUP is enabled)."""
        if not settings.PRELOAD_MODELS_ON_STARTUP:
            print("[ModelRegistry] Preloading disabled; models will be loaded on demand.")
            return

        for ds in ("cancer", "covid"):
            try:
                self.load_model(ds)
            except Exception as err:
                print(f"[ModelRegistry] Warning: Could not preload '{ds}' model: {err}")


def convert_to_rgb(image: Image.Image) -> Image.Image:
    """Composite alpha channel onto black background or convert to standard RGB."""
    if "A" in image.getbands() or "transparency" in image.info:
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, (0, 0, 0))
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def preprocess_image(image: Image.Image, dataset_name: str) -> torch.Tensor:
    """Preprocess single CT slice image according to model requirements."""
    if dataset_name not in settings.CLASS_NAMES:
        raise ValueError(f"Unknown dataset: {dataset_name}")

    image = convert_to_rgb(image)

    # Cancer Crop V2: Top 12%, bottom 10%, left 6%, right 6%
    if dataset_name == "cancer":
        width, height = image.size
        left = int(width * settings.CANCER_CROP_LEFT_PCT)
        top = int(height * settings.CANCER_CROP_TOP_PCT)
        right = int(width * (1.0 - settings.CANCER_CROP_RIGHT_PCT))
        bottom = int(height * (1.0 - settings.CANCER_CROP_BOTTOM_PCT))

        if right <= left or bottom <= top:
            raise ValueError("Image dimensions are too small for cancer cropping.")

        image = image.crop((left, top, right, bottom))

    # Preserve aspect ratio and pad with black borders to 224x224
    image = ImageOps.pad(
        image,
        settings.IMAGE_SIZE,
        method=Image.Resampling.LANCZOS,
        color=(0, 0, 0),
        centering=(0.5, 0.5)
    )

    tensor = TF.to_tensor(image)
    tensor = TF.normalize(
        tensor,
        mean=settings.IMAGENET_MEAN,
        std=settings.IMAGENET_STD
    )
    return tensor


def run_inference(
    dataset_name: str,
    image_payloads: List[Tuple[str, bytes]],
    batch_size: int = settings.INFERENCE_BATCH_SIZE,
    case_reference: Optional[str] = None
) -> PredictionResponse:
    """Execute end-to-end multi-slice inference and arithmetic mean softmax score aggregation.
    Guarded by an application-level semaphore to prevent memory exhaustion under concurrency.
    """
    acquired = _INFERENCE_SEMAPHORE.acquire(timeout=settings.INFERENCE_TIMEOUT_SECONDS)
    if not acquired:
        raise RuntimeError("Inference engine is currently busy processing another scan. Please try again.")

    try:
        start_time = time.perf_counter()

        registry = ModelRegistry.get_instance()
        model, _ = registry.load_model(dataset_name)
        class_names = settings.CLASS_NAMES[dataset_name]

        tensors: List[torch.Tensor] = []
        filenames: List[str] = []

        # Preprocess all slices
        for index, (filename, file_bytes) in enumerate(image_payloads):
            try:
                with Image.open(io.BytesIO(file_bytes)) as img:
                    tensor = preprocess_image(img, dataset_name)
            except Exception as err:
                raise ValueError(f"Failed preprocessing {filename}: {err}") from err

            tensors.append(tensor)
            filenames.append(filename)

        all_probabilities: List[np.ndarray] = []
        device = settings.DEVICE

        model.eval()
        with torch.inference_mode():
            for start in range(0, len(tensors), batch_size):
                batch = torch.stack(tensors[start:start + batch_size]).to(device)

                if device.type == "cuda":
                    with torch.autocast(device_type="cuda", dtype=torch.float16):
                        logits = model(batch)
                else:
                    logits = model(batch)

                probabilities = torch.softmax(logits.float(), dim=1)
                all_probabilities.append(probabilities.cpu().numpy())
                del batch, logits, probabilities

        slice_probabilities = np.concatenate(all_probabilities, axis=0)

        # Group-level aggregation: Arithmetic mean of per-slice softmax scores
        mean_probabilities = slice_probabilities.mean(axis=0)
        predicted_index = int(np.argmax(mean_probabilities))
        predicted_class = class_names[predicted_index]

        # Individual slice predictions
        slice_predictions: List[SlicePrediction] = []
        for index, probs in enumerate(slice_probabilities):
            top_slice_index = int(np.argmax(probs))
            slice_pred_scores = {
                class_names[c_idx]: float(probs[c_idx])
                for c_idx in range(len(class_names))
            }
            slice_predictions.append(
                SlicePrediction(
                    slice_index=index + 1,
                    filename=filenames[index],
                    predicted_class=class_names[top_slice_index],
                    predicted_class_score=float(probs[top_slice_index]),
                    class_scores=slice_pred_scores
                )
            )

        # Calculate duration
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Random anonymous Case ID or assigned case_reference
        if not case_reference:
            prefix = "CAN" if dataset_name == "cancer" else "COV"
            case_reference = f"CASE-{prefix}-{uuid.uuid4().hex[:8].upper()}"

        resp = PredictionResponse(
            case_id=case_reference,
            case_reference=case_reference,
            dataset=dataset_name,
            architecture="DenseNet121",
            number_of_slices=len(tensors),
            predicted_class=predicted_class,
            class_scores={
                class_names[c_idx]: float(mean_probabilities[c_idx])
                for c_idx in range(len(class_names))
            },
            slice_predictions=slice_predictions,
            aggregation="Arithmetic mean of per-slice softmax score vectors",
            processing_status="completed",
            is_single_slice=(len(tensors) == 1),
            inference_duration_ms=duration_ms
        )

        return resp
    finally:
        _INFERENCE_SEMAPHORE.release()
