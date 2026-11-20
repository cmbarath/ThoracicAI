# ThoracicAI — Model Card

## 1. Overview & Model Architecture

- **Project**: ThoracicAI — CT Research & Classification Workbench
- **Model Backbone**: DenseNet-121 (Densely Connected Convolutional Networks)
- **Pretraining**: ImageNet-1K (`torchvision.models.densenet121`)
- **Classifier Head**: Replaced 1000-class linear layer with a custom 3-class linear head (`nn.Linear(in_features=1024, out_features=3)`)
- **Input Dimensions**: 3-channel RGB image tensor of size $3 \times 224 \times 224$
- **Target Tasks**:
  1. **Cancer Classification Workflow**: Benign, Malignant, Normal
  2. **COVID-19 / Pulmonary Disease Workflow**: COVID-19, Normal, Other pulmonary disease

Both models operate completely independently with separate checkpoint weights and distinct class label spaces.

---

## 2. Dataset Auditing & Leakage Grouping

During exploratory dataset audits, exact and perceptual image duplicate analyses revealed extensive duplicate slices distributed across different folders and nominal patient IDs.

To prevent severe train/test contamination (data leakage):
1. Duplicate relationships were modeled as an undirected graph.
2. Connected components were extracted to define **leakage groups**.
3. Group-aware partitioning ensured all slices belonging to any connected component were allocated exclusively to either the development split or the untouched test split.

### Cohort Distributions

| Dataset | Split | Eligible Images | Leakage Groups | Classes |
| :--- | :--- | :--- | :--- | :--- |
| **Cancer** | Development (Train/Val) | 875 | 69 | Benign, Malignant, Normal |
| **Cancer** | Independent Test | 198 | 13 | Benign (2), Malignant (5), Normal (6) |
| **COVID** | Development (Train/Val) | 3,553 | 178 | COVID-19, Normal, Other pulmonary |
| **COVID** | Independent Test | 615 | 32 | COVID-19 (12), Normal (8), Other (12) |

---

## 3. Preprocessing Specifications

### Common Operations
- **Color Conversion**: Grayscale and palette images are converted to 3-channel RGB. Images with alpha channels or transparency tags composite the RGBA channels onto a solid black `(0, 0, 0)` background.
- **Aspect Ratio Resizing & Padding**: Slices are resized to fit within $224 \times 224$ using high-order LANCZOS interpolation, and padded symmetrically with black borders to preserve anatomical geometry.
- **Normalization**: Normalized using standard ImageNet parameters:
  - Mean: `[0.485, 0.456, 0.406]`
  - Standard Deviation: `[0.229, 0.224, 0.225]`

### Model-Specific Differences

#### Cancer Model: Cancer Crop V2
- Top margin removal: **12%**
- Bottom margin removal: **10%**
- Left margin removal: **6%**
- Right margin removal: **6%**
- **Rationale**: Removes burned-in scanner orientation letters, bed edges, calibration rulers, and machine metadata tags that could otherwise act as confounding shortcuts.

#### COVID / Pulmonary Model: Aspect Ratio Padding (No Crop)
- **Rationale**: COVID-19 and infectious pneumonias manifest predominantly in subpleural, peripheral regions of the lung parenchyma. Spatial cropping would excise the very ground-glass opacities and consolidations critical for correct model inference.

---

## 4. Multi-Slice Case Aggregation Mathematics

For a CT examination containing $S$ slices $\{s_1, \dots, s_S\}$:
1. Slices are evaluated independently through the model to obtain logits $\mathbf{z}_s \in \mathbb{R}^3$.
2. Per-slice softmax probabilities are computed:
   $$p(c \mid s_i) = \frac{\exp(z_{i, c})}{\sum_{k=1}^K \exp(z_{i, k})}$$
3. Case-level scores are computed as the **arithmetic mean of slice softmax vectors**:
   $$\bar{p}(c) = \frac{1}{S} \sum_{i=1}^S p(c \mid s_i)$$
4. Final predicted research class:
   $$\hat{y} = \arg\max_{c \in \{1, \dots, K\}} \bar{p}(c)$$

*Note: Hard discrete label voting is avoided because it discards probability mass gradations and causes arbitrary tie-breaking.*

---

## 5. Performance Benchmarks

### Cancer DenseNet121 Model

- **Nested Group Cross-Validation (3 outer folds, 69 groups)**:
  - Pooled Out-of-Fold Macro F1: **0.7212**
  - Pooled Out-of-Fold Accuracy: **76.81%**
  - Mean Outer Fold Macro F1: $0.7141 \pm 0.0832$
  - Selected Epochs: Mean $8.33$

- **Independent Test Evaluation (13 untouched groups, 198 images)**:
  - Group Macro F1: **0.7091**
  - Group Accuracy: **76.92%** (10 / 13 groups)
  - Group Support-Weighted F1: **0.7818**
  - Group Negative Log-Likelihood (Loss): **0.3576**

#### Cancer Independent Test Class Breakdown
| Class | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| **Benign** | 0.3333 | 0.5000 | 0.4000 | 2 groups |
| **Malignant** | 1.0000 | 1.0000 | 1.0000 | 5 groups |
| **Normal** | 0.8000 | 0.6667 | 0.7273 | 6 groups |
| **Macro Average** | **0.7111** | **0.7222** | **0.7091** | 13 groups |
| **Weighted Average** | **0.8051** | **0.7692** | **0.7818** | 13 groups |

---

### COVID / Pulmonary DenseNet121 Model

- **Nested Group Cross-Validation (3 outer folds, 178 groups)**:
  - Pooled Out-of-Fold Macro F1: **0.8242**
  - Pooled Out-of-Fold Accuracy: **83.15%**
  - Mean Outer Fold Macro F1: $0.8248 \pm 0.0438$
  - Selected Epochs: Mean $17.0$

- **Independent Test Evaluation (32 untouched groups, 615 images)**:
  - Group Macro F1: **0.7775**
  - Group Accuracy: **78.13%** (25 / 32 groups)
  - Group Support-Weighted F1: **0.7810**
  - Group Negative Log-Likelihood (Loss): **0.4980**

#### COVID Independent Test Class Breakdown
| Class | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| **COVID-19** | 0.8182 | 0.7500 | 0.7826 | 12 groups |
| **Normal** | 0.7500 | 0.7500 | 0.7500 | 8 groups |
| **Other pulmonary** | 0.7692 | 0.8333 | 0.8000 | 12 groups |
| **Macro Average** | **0.7791** | **0.7778** | **0.7775** | 32 groups |
| **Weighted Average** | **0.7828** | **0.7813** | **0.7810** | 32 groups |

---

## 6. Limitations & Ethical Considerations

1. **Non-Clinical Research Prototype**: This software is strictly intended for scientific exploration, algorithmic benchmarking, and portfolio demonstration. It has not been approved by the FDA, CE, or any regulatory medical authority.
2. **Uncalibrated Output Scores**: Softmax values reflect relative mathematical logits from cross-entropy optimization and do not represent calibrated true posterior probabilities or epidemiological disease risks.
3. **Small Independent Test Cohorts**: Test evaluations are based on 13 cancer leakage groups and 32 COVID leakage groups. Variations in slice acquisition protocols, contrast agents, scanner manufacturers (GE, Siemens, Philips), and patient demographics may affect generalization.
4. **Format Boundary**: The inference pipeline is validated for static image formats (PNG, JPG, TIFF, BMP, WebP). DICOM voxel windowing (Hounsfield Unit conversion) and 3D volumetric NIfTI representations are not currently integrated.
5. **Privacy by Design**: The application maintains zero persistent storage of submitted scans. Uploaded images are processed strictly in RAM and discarded immediately. No patient names, MRNs, or identifying information are logged.
