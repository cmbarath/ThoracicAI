import { useEffect, useState } from 'react';
import type { CaseDetail, CaseItem } from '../types';
import {
  deleteCase,
  downloadReportFile,
  fetchCaseById,
  fetchCases,
  generateCaseReport,
} from '../services/api';
import {
  AlertCircle,
  Clock,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface CaseHistoryPageProps {
  onSelectCaseForWorkflow?: (caseRef: string, dataset: 'cancer' | 'covid') => void;
}

export function CaseHistoryPage({ onSelectCaseForWorkflow: _ }: CaseHistoryPageProps) {
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [datasetFilter, setDatasetFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected case for detailed inspection modal
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  const [generatingReportFormat, setGeneratingReportFormat] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetchCases({
        page,
        pageSize,
        dataset: datasetFilter || undefined,
        search: searchQuery.trim() || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      setCases(resp.cases);
      setTotal(resp.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load research cases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
  }, [page, datasetFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCases();
  };

  const handleOpenDetail = async (caseId: string) => {
    try {
      const detail = await fetchCaseById(caseId);
      setSelectedCase(detail);
    } catch (err: any) {
      alert(`Could not load case details: ${err.message}`);
    }
  };

  const handleDeleteCase = async (caseId: string, caseRef: string) => {
    if (!confirm(`Are you sure you want to delete case ${caseRef}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCase(caseId);
      if (selectedCase?.id === caseId) {
        setSelectedCase(null);
      }
      setActionSuccessMsg(`Case ${caseRef} deleted successfully.`);
      loadCases();
    } catch (err: any) {
      alert(`Failed to delete case: ${err.message}`);
    }
  };

  const handleGenerateReport = async (caseId: string, format: 'PDF' | 'CSV' | 'JSON') => {
    setGeneratingReportFormat(format);
    try {
      const report = await generateCaseReport(caseId, format);
      const ext = format.toLowerCase();
      const filename = `${report.case_reference}_report.${ext}`;
      await downloadReportFile(report.id, filename);
      setActionSuccessMsg(`${format} report generated and downloaded successfully.`);
      // Refresh details if modal open
      if (selectedCase && selectedCase.id === caseId) {
        const updated = await fetchCaseById(caseId);
        setSelectedCase(updated);
      }
    } catch (err: any) {
      alert(`Report generation failed: ${err.message}`);
    } finally {
      setGeneratingReportFormat(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Persistent Registry
            </span>
            <span className="text-xs text-slate-500">• Anonymous Case Sessions</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
            Research Case History
          </h1>
          <p className="text-sm text-slate-400">
            Secure audit log and multi-slice inference records across Cancer and COVID workflows.
          </p>
        </div>

        <button
          onClick={loadCases}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="hover:text-emerald-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by case reference (e.g. CASE-CAN-...) or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Workflow:</span>
          </div>
          <select
            value={datasetFilter}
            onChange={(e) => {
              setDatasetFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Workflows</option>
            <option value="cancer">Cancer DenseNet121</option>
            <option value="covid">COVID / Pulmonary</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-rose-400">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-80" />
            {error}
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
            Loading research records...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            <Layers className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            <p className="font-medium text-slate-300">No research cases found</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload CT scans in the Cancer or COVID workflow to create your first case.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Case Reference</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Slices</th>
                  <th className="py-3 px-4">Predicted Research Class</th>
                  <th className="py-3 px-4">Mean Model Output</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {cases.map((c) => {
                  const topScore = c.mean_scores[c.predicted_class] ?? 0;
                  const isCancer = c.dataset === 'cancer';
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                        {c.case_reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            isCancer
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}
                        >
                          {isCancer ? 'Cancer DenseNet' : 'COVID DenseNet'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {c.number_of_slices} {c.is_single_slice ? 'slice' : 'slices'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {c.predicted_class}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {(topScore * 100).toFixed(2)}%
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {c.inference_duration_ms} ms
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(c.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenDetail(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                          title="View Case Inspection"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect
                        </button>
                        <button
                          onClick={() => handleGenerateReport(c.id, 'PDF')}
                          disabled={generatingReportFormat === 'PDF'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition"
                          title="Generate PDF Report"
                        >
                          <FileText className="h-3 w-3" />
                          PDF
                        </button>
                        <button
                          onClick={() => handleDeleteCase(c.id, c.case_reference)}
                          className="inline-flex items-center p-1 text-xs rounded text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete Case Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {cases.length} of {total} registered cases
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1 || isLoading}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700"
            >
              Previous
            </button>
            <span className="font-mono text-slate-300">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages || isLoading}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 border border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-100 font-mono">
                      {selectedCase.case_reference}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      {selectedCase.dataset.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    DenseNet121 Inference Inspection • {selectedCase.number_of_slices} Slice(s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Aggregated Finding Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Aggregated Research Prediction
                  </span>
                  <div className="text-xl font-bold text-slate-100 mt-0.5">
                    {selectedCase.predicted_class}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Aggregation: Arithmetic mean of per-slice softmax probability vectors.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleGenerateReport(selectedCase.id, 'PDF')}
                    disabled={generatingReportFormat === 'PDF'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow transition"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {generatingReportFormat === 'PDF' ? 'Generating...' : 'Export PDF'}
                  </button>
                  <button
                    onClick={() => handleGenerateReport(selectedCase.id, 'CSV')}
                    disabled={generatingReportFormat === 'CSV'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                    CSV
                  </button>
                  <button
                    onClick={() => handleGenerateReport(selectedCase.id, 'JSON')}
                    disabled={generatingReportFormat === 'JSON'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-amber-400" />
                    JSON
                  </button>
                </div>
              </div>

              {/* Mean Softmax Probabilities */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Mean Class Score Distribution
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {Object.entries(selectedCase.mean_scores).map(([className, score]) => (
                    <div
                      key={className}
                      className={`p-3 rounded-lg border ${
                        className === selectedCase.predicted_class
                          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="text-xs text-slate-400">{className}</div>
                      <div className="text-lg font-bold font-mono mt-0.5">
                        {(score * 100).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slices Breakdown Table */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Slice-Level Softmax Breakdown ({selectedCase.slice_predictions.length} slices)
                </h3>
                <div className="border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Slice #</th>
                        <th className="py-2.5 px-3">Filename</th>
                        <th className="py-2.5 px-3">Slice Prediction</th>
                        <th className="py-2.5 px-3">Top Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {selectedCase.slice_predictions.map((s) => (
                        <tr key={s.slice_index} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3 text-cyan-400">#{s.slice_index}</td>
                          <td className="py-2 px-3 text-slate-300">{s.filename}</td>
                          <td className="py-2 px-3 font-medium text-slate-200">
                            {s.predicted_class}
                          </td>
                          <td className="py-2 px-3">
                            {(s.predicted_class_score * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Governance & Disclaimers */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg text-xs text-amber-300/80 leading-relaxed">
                <span className="font-semibold text-amber-200">Research Use Only:</span> Softmax
                activations are mathematical model outputs and do not represent calibrated clinical
                probabilities. This tool is not a medical device.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                ID: {selectedCase.id}
              </span>
              <button
                onClick={() => setSelectedCase(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
