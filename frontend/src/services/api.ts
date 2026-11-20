import type {
  AdminHealthResponse,
  AdminStats,
  AdminUserListResponse,
  AllMetricsResponse,
  AuditListResponse,
  CaseDetail,
  CaseListResponse,
  HealthResponse,
  ModelsResponse,
  PredictionResponse,
  ReportItem,
  ReportListResponse,
  UserProfile,
} from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('thoracicai_token');
}

export function setAuthToken(token: string | null): void {
  if (token) {
    localStorage.setItem('thoracicai_token', token);
  } else {
    localStorage.removeItem('thoracicai_token');
  }
}

function getAuthHeaders(isJson = true): HeadersInit {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================
// SYSTEM & BENCHMARKS
// ============================================================

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch(`${API_BASE}/models`);
  if (!res.ok) {
    throw new Error(`Failed fetching models: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMetrics(): Promise<AllMetricsResponse> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) {
    throw new Error(`Failed fetching metrics: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================
// INFERENCE
// ============================================================

export async function runPredictCancer(files: File[]): Promise<PredictionResponse> {
  if (files.length === 0) {
    throw new Error('Please select at least one CT slice image.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const headers = getAuthHeaders(false);

  const res = await fetch(`${API_BASE}/predict/cancer`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Cancer prediction failed: ${res.statusText}`);
  }

  return res.json();
}

export async function runPredictCovid(files: File[]): Promise<PredictionResponse> {
  if (files.length === 0) {
    throw new Error('Please select at least one CT slice image.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const headers = getAuthHeaders(false);

  const res = await fetch(`${API_BASE}/predict/covid`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `COVID prediction failed: ${res.statusText}`);
  }

  return res.json();
}

export async function runPredictSample(dataset: 'cancer' | 'covid'): Promise<PredictionResponse> {
  const headers = getAuthHeaders(true);

  const res = await fetch(`${API_BASE}/predict/sample/${dataset}`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Sample prediction failed: ${res.statusText}`);
  }

  return res.json();
}

// ============================================================
// AUTH & PROFILE
// ============================================================

export async function fetchCurrentUser(): Promise<UserProfile> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed fetching user profile');
  }
  return res.json();
}

export async function updateProfile(displayName: string): Promise<UserProfile> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed updating profile');
  }
  return res.json();
}

export async function requestDevToken(email: string, displayName: string, role = 'RESEARCHER') {
  const res = await fetch(`${API_BASE}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, display_name: displayName, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Dev token creation failed');
  }
  return res.json();
}

// ============================================================
// CASE MANAGEMENT
// ============================================================

export async function fetchCases(params?: {
  page?: number;
  pageSize?: number;
  dataset?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<CaseListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('page_size', params.pageSize.toString());
  if (params?.dataset) query.append('dataset', params.dataset);
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.sortBy) query.append('sort_by', params.sortBy);
  if (params?.sortOrder) query.append('sort_order', params.sortOrder);

  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/cases?${query.toString()}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch cases');
  }
  return res.json();
}

export async function fetchCaseById(caseId: string): Promise<CaseDetail> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/cases/${caseId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch case details');
  }
  return res.json();
}

export async function deleteCase(caseId: string): Promise<void> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/cases/${caseId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to delete case');
  }
}

// ============================================================
// REPORT GENERATION & STORAGE
// ============================================================

export async function generateCaseReport(
  caseId: string,
  format: 'PDF' | 'CSV' | 'JSON'
): Promise<ReportItem> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/cases/${caseId}/reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ report_format: format }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Report generation failed');
  }
  return res.json();
}

export async function fetchReports(params?: {
  page?: number;
  pageSize?: number;
  dataset?: string;
  format?: string;
  search?: string;
}): Promise<ReportListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('page_size', params.pageSize.toString());
  if (params?.dataset) query.append('dataset', params.dataset);
  if (params?.format) query.append('format', params.format);
  if (params?.search) query.append('search', params.search);

  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/reports?${query.toString()}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch reports');
  }
  return res.json();
}

export async function downloadReportFile(reportId: string, filename: string): Promise<void> {
  const headers = getAuthHeaders(false);
  const res = await fetch(`${API_BASE}/reports/${reportId}/download`, { headers });
  if (!res.ok) {
    throw new Error(`Failed to download report: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function deleteReport(reportId: string): Promise<void> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/reports/${reportId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to delete report');
  }
}

// ============================================================
// ADMIN APIS
// ============================================================

export async function fetchAdminStats(): Promise<AdminStats> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/stats`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch admin stats');
  }
  return res.json();
}

export async function fetchAdminUsers(): Promise<AdminUserListResponse> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/users`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch admin users');
  }
  return res.json();
}

export async function updateUserStatus(userId: string, isActive: boolean) {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update user status');
  }
  return res.json();
}

export async function updateUserRole(userId: string, role: 'ADMIN' | 'RESEARCHER') {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to update user role');
  }
  return res.json();
}

export async function fetchAdminAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  action?: string;
}): Promise<AuditListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.pageSize) query.append('page_size', params.pageSize.toString());
  if (params?.action) query.append('action', params.action);

  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/audit-logs?${query.toString()}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch audit logs');
  }
  return res.json();
}

export async function fetchAdminHealth(): Promise<AdminHealthResponse> {
  const headers = getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/health`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to fetch admin health');
  }
  return res.json();
}
