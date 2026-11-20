# ThoracicAI Backend — Research Inference & Evaluation Engine

The ThoracicAI backend is a high-performance Python FastAPI service hosting two independent DenseNet121 convolutional neural networks for CT slice analysis.

## 1. System Architecture

The service provides a clean, decoupled modular layout:

```
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # REST API routes (/health, /models, /predict/cancer, etc.)
│   ├── core/                     # Core configs and constants
│   ├── services/
│   │   ├── __init__.py
│   │   ├── inference.py          # PyTorch DenseNet121 inference & softmax mean aggregation
│   │   ├── metrics_service.py    # Official CSV metrics and matrix parser
│   │   ├── sample_scans.py       # Deterministic synthetic CT scan generator for demos/testing
│   │   └── validation.py         # Static image decoding & format validation
│   ├── config.py                 # Application settings, path resolution, crop parameters
│   ├── main.py                   # FastAPI app entrypoint, CORS, lifespan preload
│   └── schemas.py                # Pydantic v2 data models & response contracts
├── weights/                      # Trained model checkpoints
│   ├── cancer/final_densenet121.pth
│   └── covid/final_densenet121.pth
├── tests/                        # Comprehensive PyTest test suite (24 tests)
│   ├── conftest.py
│   ├── test_aggregation.py
│   ├── test_api.py
│   ├── test_models.py
│   ├── test_preprocessing.py
│   └── test_validation.py
├── requirements.txt
└── README.md
```

## 2. Models & Preprocessing

Both networks use an ImageNet-pretrained DenseNet-121 backbone with a modified 3-class linear classifier:

### Workflow A: Cancer Model
- **Checkpoint**: `weights/cancer/final_densenet121.pth`
- **Classes**: `["Benign", "Malignant", "Normal"]`
- **Preprocessing (Cancer Crop V2)**:
  1. Alpha channel composited onto black background (or direct RGB conversion).
  2. Crop 12% top, 10% bottom, 6% left, 6% right to discard scanner borders and artifacts.
  3. Aspect-ratio preserved padding to 224 × 224 (LANCZOS interpolation).
  4. ImageNet normalization: Mean `[0.485, 0.456, 0.406]`, Std `[0.229, 0.224, 0.225]`.

### Workflow B: COVID / Pulmonary Model
- **Checkpoint**: `weights/covid/final_densenet121.pth`
- **Classes**: `["COVID-19", "Normal", "Other pulmonary disease"]`
- **Preprocessing**:
  1. Alpha channel composited onto black background (or direct RGB conversion).
  2. **No spatial cropping** (preserves subpleural peripheral lung fields).
  3. Aspect-ratio preserved padding to 224 × 224 (LANCZOS interpolation).
  4. ImageNet normalization.

### Model Caching
Models are loaded once at application startup into a singleton `ModelRegistry` and held in memory to prevent cold-start latency. Both CPU and CUDA devices are supported automatically.

## 3. Multi-Slice Case Aggregation

For each case comprising $N$ CT image slices $s_1, \dots, s_N$:
1. Each slice is independently validated and preprocessed.
2. The model outputs logits $\mathbf{z}_i \in \mathbb{R}^3$, converted to softmax score vectors $\mathbf{p}_i = \text{softmax}(\mathbf{z}_i)$.
3. The overall case score vector is the **arithmetic mean of per-slice softmax vectors**:
   $$\bar{\mathbf{p}} = \frac{1}{N} \sum_{i=1}^N \mathbf{p}_i$$
4. The predicted research class is $\arg\max_{c} \bar{p}_c$.
5. No discrete hard-label averaging or majority voting is used.

## 4. API Endpoints

### `GET /api/health`
Returns system status, device (`cuda` or `cpu`), PyTorch version, and loaded model flags.

### `GET /api/models`
Returns model metadata, class hierarchies, dataset sizes, nested CV metrics, and preprocessing parameters.

### `POST /api/predict/cancer`
Accepts `multipart/form-data` with one or more files in the `files` field.
Supported static image formats: `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`, `.bmp`, `.webp`.

**Sample JSON Response:**
```json
{
  "case_id": "CASE-CAN-A8F19B02",
  "dataset": "cancer",
  "architecture": "DenseNet121",
  "number_of_slices": 3,
  "predicted_class": "Malignant",
  "class_scores": {
    "Benign": 0.0152,
    "Malignant": 0.9521,
    "Normal": 0.0327
  },
  "slice_predictions": [
    {
      "slice_index": 1,
      "filename": "slice_01.png",
      "predicted_class": "Malignant",
      "predicted_class_score": 0.9610,
      "class_scores": { "Benign": 0.011, "Malignant": 0.961, "Normal": 0.028 }
    }
  ],
  "aggregation": "Arithmetic mean of per-slice softmax score vectors",
  "processing_status": "completed",
  "is_single_slice": false,
  "disclaimer": "Research prototype only. Not a medical device..."
}
```

### `POST /api/predict/covid`
Accepts `multipart/form-data` with one or more CT slice files for COVID-19 / pulmonary disease classification.

### `GET /api/metrics`
Returns verified nested CV summaries, outer fold breakdowns, confusion matrices, and test classification reports parsed from source CSV artifacts.

### `GET /api/sample-scans/{dataset}`
Returns metadata for synthetic multi-slice test scans (`cancer` or `covid`).

### `POST /api/predict/sample/{dataset}`
Executes inference directly on built-in synthetic test slices for testing and UI demonstrations.

## 5. Local Setup & Execution

### Prerequisites
- Python 3.10+
- PyTorch 2.0+

### Installation
```bash
cd backend
pip install -r requirements.txt
```

### Run Server
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive Swagger API documentation is available at: `http://127.0.0.1:8000/docs`

## 6. Running Tests

Run the full pytest suite:
```bash
pytest -v
```
All 24 test cases cover checkpoint loading, class ordering, preprocessing geometry, alpha channel compositing, arithmetic mean aggregation, file validation, corrupt file rejection, and REST API routes.
