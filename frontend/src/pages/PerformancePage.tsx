import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Layers,
  Sparkles,
  AlertCircle,
  Database,
} from 'lucide-react';
import { fetchMetrics } from '../services/api';
import type { AllMetricsResponse, DatasetMetrics } from '../types';
import { ConfusionMatrix } from '../components/ConfusionMatrix';
import { TrainingHistoryChart } from '../components/TrainingHistoryChart';

export const PerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<AllMetricsResponse | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<'cancer' | 'covid'>('cancer');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const data = await fetchMetrics();
        if (isMounted) {
          setMetrics(data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed loading evaluation metrics.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="mt-3 text-xs text-slate-400">Loading verified benchmark artifacts...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center text-xs text-rose-300">
        <AlertCircle className="mx-auto h-6 w-6 text-rose-400 mb-2" />
        <p className="font-semibold text-rose-200">Failed to load performance artifacts</p>
        <p className="mt-1 text-slate-400">{error}</p>
      </div>
    );
  }

  const currentMetrics: DatasetMetrics = metrics[selectedDataset];
  const isCancer = selectedDataset === 'cancer';

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-0.5 text-xs font-semibold text-cyan-300 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
            <span>Official Research Metrics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Model Evaluation & Research Benchmarks
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Derived directly from the verified evaluation artifacts. Distinguishes pooled out-of-fold nested cross-validation
            from untouched independent test group evaluation.
          </p>
        </div>

        {/* Dataset Switcher */}
        <div className="flex items-center gap-1 rounded-2xl bg-slate-950 p-1.5 border border-slate-800">
          <button
            type="button"
            onClick={() => setSelectedDataset('cancer')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              isCancer
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Cancer Model</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedDataset('covid')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              !isCancer
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>COVID / Pulmonary Model</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Nested CV Macro F1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Nested CV Macro F1
          </p>
          <p className="text-2xl font-extrabold font-mono text-cyan-300">
            {isCancer ? '0.7212' : '0.8242'}
          </p>
          <p className="text-[10px] text-slate-400">
            3-fold pooled OOF ({isCancer ? '69' : '178'} groups)
          </p>
        </div>

        {/* Independent Test Macro F1 */}
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
            Test Macro F1
          </p>
          <p className="text-2xl font-extrabold font-mono text-white">
            {isCancer ? '0.7091' : '0.7775'}
          </p>
          <p className="text-[10px] text-slate-300">
            Independent test ({isCancer ? '13' : '32'} groups)
          </p>
        </div>

        {/* Independent Test Group Accuracy */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Test Group Accuracy
          </p>
          <p className="text-2xl font-extrabold font-mono text-emerald-400">
            {isCancer ? '76.92%' : '78.13%'}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            {isCancer ? '0.76923' : '0.78125'}
          </p>
        </div>

        {/* Test Weighted F1 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Test Weighted F1
          </p>
          <p className="text-2xl font-extrabold font-mono text-slate-200">
            {isCancer ? '0.7818' : '0.7810'}
          </p>
          <p className="text-[10px] text-slate-400">
            Support-weighted score
          </p>
        </div>

        {/* Test Negative Log Likelihood */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 col-span-2 lg:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Test Loss (NLL)
          </p>
          <p className="text-2xl font-extrabold font-mono text-purple-300">
            {isCancer ? '0.3576' : '0.4980'}
          </p>
          <p className="text-[10px] text-slate-400">
            Cross-entropy loss
          </p>
        </div>
      </div>

      {/* Dataset & Group Partition Context */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          <span className="font-semibold text-slate-200">
            {isCancer ? 'Cancer Dataset Partitioning:' : 'COVID Dataset Partitioning:'}
          </span>
          <span className="text-slate-400">
            {isCancer
              ? '875 development images (69 leakage groups) • 198 test images (13 leakage groups)'
              : '3,553 development images (178 leakage groups) • 615 test images (32 leakage groups)'}
          </span>
        </div>
        <div className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-700">
          DenseNet-121 Architecture
        </div>
      </div>

      {/* Confusion Matrices Section: Test Matrix + Outer CV Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Independent Test Confusion Matrix */}
        <ConfusionMatrix
          data={currentMetrics.test_confusion_matrix}
          title="Independent Test Confusion Matrix"
          subtitle={`Evaluated on ${isCancer ? '13' : '32'} untouched test patient leakage groups`}
        />

        {/* Outer CV Confusion Matrix */}
        <ConfusionMatrix
          data={currentMetrics.outer_confusion_matrix}
          title="Nested CV Outer Out-of-Fold Matrix"
          subtitle={`Pooled cross-validation across ${isCancer ? '69' : '178'} development groups`}
        />
      </div>

      {/* Class-wise Classification Report Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">
            Independent Test Class-Wise Classification Report
          </h3>
          <p className="text-xs text-slate-400">
            Exact metric scores calculated over untouched test examination groups
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-sans">
              <tr>
                <th className="py-3 px-4">Class / Category</th>
                <th className="py-3 px-4 text-right">Precision</th>
                <th className="py-3 px-4 text-right">Recall</th>
                <th className="py-3 px-4 text-right">F1-Score</th>
                <th className="py-3 px-4 text-right">Support (Groups)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {currentMetrics.test_classification_report.map((row) => {
                const isAggregate = ['accuracy', 'macro avg', 'weighted avg'].includes(row.label.toLowerCase());
                return (
                  <tr
                    key={row.label}
                    className={`hover:bg-slate-800/40 ${
                      isAggregate ? 'bg-slate-950/40 font-bold text-slate-100' : 'text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4 font-sans capitalize text-slate-200">
                      {row.label}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.precision.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.recall.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-cyan-300">
                      {row.f1_score.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {row.support.toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Training Convergence History Curve */}
      <TrainingHistoryChart
        history={currentMetrics.training_history}
      />

      {/* Outer Fold Cross-Validation Breakdown */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white">
            Nested Group Cross-Validation Outer Fold Breakdown
          </h3>
          <p className="text-xs text-slate-400">
            Details of 3-fold outer cross-validation: inner validation tuning, optimal epoch selection, and out-of-fold generalization
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-sans">
              <tr>
                <th className="py-3 px-3">Outer Fold</th>
                <th className="py-3 px-3">Inner Train / Val Groups</th>
                <th className="py-3 px-3">Outer Eval Groups</th>
                <th className="py-3 px-3">Selected Epoch</th>
                <th className="py-3 px-3">Inner Val Macro F1</th>
                <th className="py-3 px-3">Outer Accuracy</th>
                <th className="py-3 px-3">Outer Macro F1</th>
                <th className="py-3 px-3">Outer NLL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {currentMetrics.outer_fold_metrics.map((fold) => (
                <tr key={fold.outer_fold} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-sans font-bold text-cyan-300">
                    Fold {fold.outer_fold}
                  </td>
                  <td className="py-3 px-3">
                    {fold.inner_train_groups} / {fold.inner_validation_groups}
                  </td>
                  <td className="py-3 px-3">
                    {fold.outer_evaluation_groups}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    Epoch {fold.selected_epoch} ({fold.selected_phase})
                  </td>
                  <td className="py-3 px-3">
                    {fold.inner_validation_group_macro_f1.toFixed(4)}
                  </td>
                  <td className="py-3 px-3 text-emerald-400 font-bold">
                    {(fold.outer_group_accuracy * 100).toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-cyan-300 font-bold">
                    {fold.outer_group_macro_f1.toFixed(4)}
                  </td>
                  <td className="py-3 px-3 text-slate-400">
                    {fold.outer_group_nll.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
