import type {
  AllMetricsResponse,
  HealthResponse,
  ModelsResponse,
  PredictionResponse,
} from '../types';

const API_BASE = '/api';

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

export async function runPredictCancer(files: File[]): Promise<PredictionResponse> {
  if (files.length === 0) {
    throw new Error('Please select at least one CT slice image.');
  }

  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  const res = await fetch(`${API_BASE}/predict/cancer`, {
    method: 'POST',
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

  const res = await fetch(`${API_BASE}/predict/covid`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `COVID prediction failed: ${res.statusText}`);
  }

  return res.json();
}

export async function runPredictSample(dataset: 'cancer' | 'covid'): Promise<PredictionResponse> {
  const res = await fetch(`${API_BASE}/predict/sample/${dataset}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorData.detail || `Sample prediction failed: ${res.statusText}`);
  }

  return res.json();
}
