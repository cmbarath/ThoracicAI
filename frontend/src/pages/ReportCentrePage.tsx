import { useEffect, useState } from 'react';
import type { ReportItem } from '../types';
import {
  deleteReport,
  downloadReportFile,
  fetchReports,
} from '../services/api';
import {
  AlertCircle,
  Clock,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderArchive,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

export function ReportCentrePage() {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [datasetFilter, setDatasetFilter] = useState<string>('');
  const [formatFilter, setFormatFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadReports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetchReports({
        page,
        pageSize,
        dataset: datasetFilter || undefined,
        format: formatFilter || undefined,
        search: searchQuery.trim() || undefined,
      });
      setReports(resp.reports);
      setTotal(resp.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load research reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [page, datasetFilter, formatFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadReports();
  };

  const handleDownload = async (report: ReportItem) => {
    setDownloadingId(report.id);
    try {
      const ext = report.report_format.toLowerCase();
      const filename = `${report.case_reference}_report.${ext}`;
      await downloadReportFile(report.id, filename);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (reportId: string, caseRef: string, format: string) => {
    if (!confirm(`Delete ${format} report for ${caseRef}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteReport(reportId);
      loadReports();
    } catch (err: any) {
      alert(`Failed to delete report: ${err.message}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  const renderFormatBadge = (fmt: string) => {
    switch (fmt) {
      case 'PDF':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <FileText className="h-3 w-3" />
            PDF Report
          </span>
        );
      case 'CSV':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <FileSpreadsheet className="h-3 w-3" />
            CSV Data
          </span>
        );
      case 'JSON':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <FileCheck2 className="h-3 w-3" />
            JSON Schema
          </span>
        );
      default:
        return <span>{fmt}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Report Centre
            </span>
            <span className="text-xs text-slate-500">• Private Encrypted Storage</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
            Research Document & Export Centre
          </h1>
          <p className="text-sm text-slate-400">
            Download ReportLab publication-grade PDFs, CSV tabular slice audits, and JSON artifacts.
          </p>
        </div>

        <button
          onClick={loadReports}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Documents
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by case reference (CASE-CAN-...)..."
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

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>Format:</span>
          </div>
          <select
            value={formatFilter}
            onChange={(e) => {
              setFormatFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Formats</option>
            <option value="PDF">PDF Reports</option>
            <option value="CSV">CSV Exports</option>
            <option value="JSON">JSON Payloads</option>
          </select>

          <select
            value={datasetFilter}
            onChange={(e) => {
              setDatasetFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Workflows</option>
            <option value="cancer">Cancer</option>
            <option value="covid">COVID</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-rose-400">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-80" />
            {error}
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
            Loading documents...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            <FolderArchive className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            <p className="font-medium text-slate-300">No generated reports found</p>
            <p className="text-xs text-slate-500 mt-1">
              Go to Case History or run inference to generate publication-grade PDF and CSV reports.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Document ID</th>
                  <th className="py-3 px-4">Case Reference</th>
                  <th className="py-3 px-4">Workflow</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">File Size</th>
                  <th className="py-3 px-4">Generated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {reports.map((r) => {
                  const isCancer = r.dataset === 'cancer';
                  const isDownloading = downloadingId === r.id;
                  return (
                    <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{r.id}</td>
                      <td className="py-3.5 px-4 font-mono font-medium text-cyan-400">
                        {r.case_reference}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            isCancer
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}
                        >
                          {isCancer ? 'Cancer' : 'COVID'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{renderFormatBadge(r.report_format)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {formatBytes(r.file_size_bytes)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {new Date(r.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleDownload(r)}
                          disabled={isDownloading}
                          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 transition"
                          title="Download document"
                        >
                          <Download
                            className={`h-3 w-3 ${isDownloading ? 'animate-bounce' : ''}`}
                          />
                          {isDownloading ? 'Downloading...' : 'Download'}
                        </button>
                        <button
                          onClick={() => handleDelete(r.id, r.case_reference, r.report_format)}
                          className="inline-flex items-center p-1 text-xs rounded text-rose-400 hover:bg-rose-500/10 transition"
                          title="Delete Report"
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
            Showing {reports.length} of {total} documents
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
    </div>
  );
}
