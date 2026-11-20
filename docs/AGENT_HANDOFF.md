# ThoracicAI - Antigravity Handoff

This package contains:

1. Two trained DenseNet121 checkpoints.
2. The reference PyTorch inference implementation.
3. The existing Streamlit prototype.
4. Final training histories.
5. Nested group CV aggregate metrics.
6. Independent test aggregate metrics and confusion matrices.
7. Model card and limitations.

IMPORTANT:

- The two models are independent.
- Cancer and COVID have different label spaces.
- Do not train, alter, or fine-tune either checkpoint.
- Do not change preprocessing.
- Preserve arithmetic mean aggregation of per-slice softmax scores.
- Do not call these scores calibrated probabilities.
- Do not describe results as clinical diagnostic accuracy.
- Do not add DICOM/NIfTI support without a separately validated pipeline.
- Do not require the original dataset for inference.
- Do not store uploaded medical images by default.
- The existing app.py is a Streamlit reference, not the target production UI.

The original inference.py resolves model weights relative to its
own folder. Preserve this relationship or update its paths
and test model loading after refactoring.

Build the target application as a React + TypeScript frontend
with a Python FastAPI/PyTorch backend.

See MODEL_CARD.md for the dataset and performance context.