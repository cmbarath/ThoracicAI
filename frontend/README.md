# ThoracicAI Frontend — CT Research & Classification Workbench

The ThoracicAI frontend is a modern, responsive web application for CT examination analysis, multi-slice disease classification, and research metric exploration.

## 1. Technology Stack

- **Framework**: React 19 with Vite 8
- **Language**: TypeScript (strict type safety)
- **Styling**: Tailwind CSS (custom dark navy/slate theme with cyan highlights)
- **Icons**: Lucide React
- **Data Visualizations**: Recharts (interactive score distributions, confusion matrix heatmaps, training convergence curves)
- **API Communication**: REST via native fetch with Vite reverse proxy

## 2. Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── CaseReportModal.tsx         # Printable & exportable case summary dialog
│   │   ├── ConfusionMatrix.tsx         # Heatmap visualizer for confusion matrices
│   │   ├── DisclaimerBanner.tsx        # Research-use disclaimers
│   │   ├── ImageUploader.tsx           # Multi-file drag & drop with thumbnail preview
│   │   ├── Navbar.tsx                  # Global header with live backend status ping
│   │   ├── ScoreDistributionChart.tsx  # Horizontal Recharts distribution
│   │   ├── SliceTable.tsx              # Per-slice inspection table with CSV export
│   │   └── TrainingHistoryChart.tsx    # Convergence curves over training epochs
│   ├── pages/
│   │   ├── Dashboard.tsx               # Overview dashboard & workflow launcher
│   │   ├── MethodologyPage.tsx         # Dataset audit, Crop V2, architecture & model card
│   │   ├── PerformancePage.tsx         # Official nested CV & test metrics tables/matrices
│   │   └── WorkflowPage.tsx            # Unified workflow view for Cancer and COVID
│   ├── services/
│   │   └── api.ts                      # Typed backend API client
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces matching backend contracts
│   ├── App.tsx                         # Core application router and layout
│   ├── main.tsx                        # React DOM mounting
│   └── index.css                       # Tailwind layers and custom styling
├── vite.config.ts                      # Vite configuration & /api reverse proxy
├── package.json
└── README.md
```

## 3. Key User Workflows

### A. Dashboard
- Displays dual-model overview, architecture specifications, and dataset partitions.
- Summarizes Nested CV Macro F1 vs Independent Test Macro F1.
- Provides direct navigation to both classification workflows and research metrics.

### B. Cancer Classification Workflow
- Targets: **Benign**, **Malignant**, and **Normal** classes.
- Automatic **Cancer Crop V2** indicator.
- Anonymous random Case ID generator (`CASE-CAN-XXXXXX`).
- Multi-slice upload supporting PNG, JPG, TIFF, BMP, WebP up to 120 slices per case.
- One-click **"Load Sample Series"** button for immediate testing.
- Aggregated case classification banner, mean softmax score distribution chart, and individual slice table with full probability breakdown.
- Export options: Slice CSV download, JSON export, and printable case summary.

### C. COVID / Pulmonary Disease Workflow
- Targets: **COVID-19**, **Normal**, and **Other pulmonary disease**.
- Preserves full anatomical aspect ratio without cropping.
- Identical multi-slice ingestion, processing, and export workflows.

### D. Benchmarks & Performance
- Interactive tabs for Cancer and COVID models.
- Class-wise classification reports (Precision, Recall, F1-Score, Support).
- Visual confusion matrices for both untouched independent test evaluation and pooled nested CV.
- Training loss and accuracy convergence curves distinguishing head warm-up from full fine-tuning.
- 3-fold outer cross-validation breakdown.

### E. Methodology & Model Card
- Comprehensive documentation of duplicate-image leakage containment, group-aware cross-validation, Crop V2 rationale, ImageNet normalization, DenseNet121 architecture, and arithmetic mean softmax aggregation mathematics.

## 4. Local Development

### Prerequisites
- Node.js 18+ (tested on Node v24)
- npm 9+

### Installation
```bash
cd frontend
npm install
```

### Start Development Server
```bash
npm run dev
```
The application will launch at: `http://localhost:5173`
All `/api` requests are automatically proxied to the backend at `http://localhost:8000`.

### Production Build
```bash
npm run build
```
Build output is generated in `frontend/dist/`.
