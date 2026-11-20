export interface SlicePrediction {
  slice_index: number;
  filename: string;
  predicted_class: string;
  predicted_class_score: number;
  class_scores: Record<string, number>;
}

export interface PredictionResponse {
  case_id: string;
  case_reference?: string;
  case_database_id?: string;
  dataset: 'cancer' | 'covid';
  architecture: string;
  number_of_slices: number;
  predicted_class: string;
  class_scores: Record<string, number>;
  slice_predictions: SlicePrediction[];
  aggregation: string;
  processing_status: string;
  is_single_slice: boolean;
  inference_duration_ms?: number;
  disclaimer: string;
  timestamp: string;
}

export interface PreprocessingInfo {
  rgb_conversion: string;
  resize_mode: string;
  normalization: string;
  crop_v2?: {
    top_pct: number;
    bottom_pct: number;
    left_pct: number;
    right_pct: number;
  } | null;
}

export interface ModelMetadataItem {
  dataset: 'cancer' | 'covid';
  display_name: string;
  architecture: string;
  classes: string[];
  development_images: number;
  development_groups: number;
  selected_epochs: number;
  nested_cv_macro_f1: number;
  test_group_accuracy: number;
  test_macro_f1: number;
  test_weighted_f1: number;
  test_nll: number;
  checkpoint_loaded: boolean;
  preprocessing: PreprocessingInfo;
}

export interface ModelsResponse {
  models: ModelMetadataItem[];
  count: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  device: string;
  torch_version: string;
  models_loaded: {
    cancer: boolean;
    covid: boolean;
  };
  timestamp: string;
}

export interface ConfusionMatrixData {
  labels: string[];
  matrix: number[][];
}

export interface ClassificationReportRow {
  label: string;
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface TrainingHistoryItem {
  dataset: string;
  architecture: string;
  phase: string;
  epoch: number;
  train_loss: number;
  train_accuracy: number;
}

export interface OuterFoldMetric {
  dataset: string;
  architecture: string;
  outer_fold: number;
  inner_train_groups: number;
  inner_validation_groups: number;
  outer_training_groups: number;
  outer_evaluation_groups: number;
  selected_epoch: number;
  selected_phase: string;
  inner_validation_group_nll: number;
  inner_validation_group_macro_f1: number;
  outer_group_accuracy: number;
  outer_group_macro_f1: number;
  outer_group_nll: number;
}

export interface DatasetMetrics {
  dataset: 'cancer' | 'covid';
  architecture: string;
  nested_cv_summary: {
    dataset: string;
    architecture: string;
    outer_folds: number;
    total_outer_oof_groups: number;
    pooled_outer_group_accuracy: number;
    pooled_outer_group_macro_f1: number;
    mean_outer_fold_macro_f1: number;
    std_outer_fold_macro_f1: number;
    mean_selected_epoch: number;
  };
  outer_fold_metrics: OuterFoldMetric[];
  outer_confusion_matrix: ConfusionMatrixData;
  test_summary: {
    dataset: string;
    architecture: string;
    training_epochs: number;
    test_images: number;
    test_groups: number;
    test_group_accuracy: number;
    test_group_macro_f1: number;
    test_group_nll: number;
    test_group_weighted_f1: number;
  };
  test_classification_report: ClassificationReportRow[];
  test_confusion_matrix: ConfusionMatrixData;
  training_history: TrainingHistoryItem[];
}

export interface AllMetricsResponse {
  cancer: DatasetMetrics;
  covid: DatasetMetrics;
}

export interface UploadedSlicePreview {
  id: string;
  file: File;
  previewUrl: string;
  sizeBytes: number;
}

// ============================================================
// AUTH & USER TYPES
// ============================================================

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'ADMIN' | 'RESEARCHER';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// CASE MANAGEMENT TYPES
// ============================================================

export interface CaseItem {
  id: string;
  case_reference: string;
  dataset: 'cancer' | 'covid';
  status: string;
  model_architecture: string;
  model_version: string;
  number_of_slices: number;
  predicted_class: string;
  mean_scores: Record<string, number>;
  inference_duration_ms: number;
  is_single_slice: boolean;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends CaseItem {
  slice_predictions: SlicePrediction[];
  reports: ReportItem[];
}

export interface CaseListResponse {
  cases: CaseItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================
// REPORT TYPES
// ============================================================

export interface ReportItem {
  id: string;
  case_id: string;
  case_reference: string;
  dataset: 'cancer' | 'covid';
  report_format: 'PDF' | 'CSV' | 'JSON';
  generation_status: string;
  file_size_bytes: number;
  download_url?: string;
  created_at: string;
}

export interface ReportListResponse {
  reports: ReportItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================
// ADMIN TYPES
// ============================================================

export interface AdminStats {
  total_users: number;
  active_users: number;
  total_cases: number;
  completed_cases: number;
  failed_cases: number;
  total_reports: number;
  cancer_cases: number;
  covid_cases: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: 'ADMIN' | 'RESEARCHER';
  is_active: boolean;
  cases_count: number;
  reports_count: number;
  created_at: string;
}

export interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

export interface AuditLogItem {
  id: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  request_id?: string;
  ip_address?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface AuditListResponse {
  events: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminHealthResponse {
  status: string;
  pytorch_version: string;
  device: string;
  cuda_available: boolean;
  gpu_info?: {
    device_name: string;
    allocated_mb: number;
    reserved_mb: number;
  } | null;
  models: {
    cancer: { loaded: boolean; architecture: string; classes: string[] };
    covid: { loaded: boolean; architecture: string; classes: string[] };
  };
  storage: {
    mode: string;
    local_dir: string;
  };
}
