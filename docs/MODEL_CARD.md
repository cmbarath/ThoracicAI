# ThoracicAI - Model Card

## Project
ThoracicAI is an experimental CT-image classification research platform.

It uses two independent ImageNet-pretrained DenseNet121 models.

## Cancer model

Classes:
- Benign
- Malignant
- Normal

Development dataset:
- 875 images
- 69 leakage groups

Final training:
- DenseNet121
- 9 epochs

Nested group CV pooled OOF Macro F1:
- 0.7212

Independent test:
- 198 images
- 13 leakage groups
- Group accuracy: 0.7692
- Group Macro F1: 0.7091
- Group weighted F1: 0.7818
- Group NLL: 0.3576

## COVID / pulmonary model

Classes:
- COVID-19
- Normal
- Other pulmonary disease

Development dataset:
- 3,553 eligible images
- 178 leakage groups

Final training:
- DenseNet121
- 16 epochs

Nested group CV pooled OOF Macro F1:
- 0.8242

Independent test:
- 615 images
- 32 leakage groups
- Group accuracy: 0.78125
- Group Macro F1: 0.7775
- Group weighted F1: 0.7810
- Group NLL: 0.4980

## Preprocessing

Both models:
- RGB conversion
- Resize/pad to 224 x 224
- ImageNet normalization
- Mean of slice-level softmax outputs for group-level aggregation

Cancer model:
- Cancer Crop V2
- Remove top 12%, bottom 10%, left 6%, right 6%

COVID model:
- No cancer-specific crop

## Inference

The deployed model predictions are aggregated by averaging
the softmax scores of images supplied for one case.

Softmax scores have not been calibrated.

## Limitations

- This is an experimental research prototype.
- It is not clinically validated.
- It must not be used for diagnosis or treatment decisions.
- The cancer test set contains only 13 leakage groups.
- The COVID test set contains only 32 leakage groups.
- Leakage-connected components are based on duplicate-image
  connections and are not confirmed real-world patient identities.
- Performance may change on other hospitals, scanners,
  image acquisition protocols or populations.
- Cancer cropping is not guaranteed to remove all identifying
  annotations.
- Current inference is designed for static images. DICOM and
  NIfTI workflows have not been validated.

## Data governance

Do not upload or publish raw medical images, patient manifests,
patient metadata or private source data with the application.