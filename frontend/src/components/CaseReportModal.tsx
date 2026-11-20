import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { PredictionResponse } from '../types';
import { downloadReportFile, generateCaseReport } from '../services/api';

interface Props {
  prediction: PredictionResponse;
  onClose: () => void;
}

export const CaseReportModal: React.FC<Props> = ({ prediction, onClose }) => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  const downloadJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(prediction, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${prediction.case_id}_research_report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleDownloadOfficialReport = async (format: 'PDF' | 'CSV' | 'JSON') => {
    if (!prediction.case_database_id) {
      if (format === 'JSON') downloadJSON();
      else window.print();
      return;
    }

    setIsGenerating(format);
    try {
      const report = await generateCaseReport(prediction.case_database_id, format);
      const ext = format.toLowerCase();
      const filename = `${prediction.case_reference || prediction.case_id}_report.${ext}`;
      await downloadReportFile(report.id, filename);
    } catch (err: any) {
      alert(`Report download failed: ${err.message}`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                ThoracicAI Case Examination Summary
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {prediction.case_reference || prediction.case_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadOfficialReport('PDF')}
              disabled={isGenerating === 'PDF'}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40 transition"
              title="Download publication-grade ReportLab PDF"
            >
              {isGenerating === 'PDF' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span>Official PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadOfficialReport('CSV')}
              disabled={isGenerating === 'CSV'}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              title="Download slice audit CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={downloadJSON}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>JSON</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Print view"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-200">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs">
            <div>
              <p className="text-slate-400">Case Reference</p>
              <p className="font-mono font-bold text-cyan-300 mt-0.5">
                {prediction.case_reference || prediction.case_id}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Workflow Target</p>
              <p className="font-bold text-slate-100 mt-0.5 capitalize">{prediction.dataset}</p>
            </div>
            <div>
              <p className="text-slate-400">Model Architecture</p>
              <p className="font-mono font-bold text-slate-100 mt-0.5">{prediction.architecture}</p>
            </div>
            <div>
              <p className="text-slate-400">Slices Processed</p>
              <p className="font-mono font-bold text-slate-100 mt-0.5">{prediction.number_of_slices}</p>
            </div>
          </div>

          {/* Primary Result Banner */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 to-slate-900 p-5">
            <p className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
              Aggregated Case Classification
            </p>
            <div className="flex flex-wrap items-baseline gap-4 mt-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {prediction.predicted_class}
              </span>
              <span className="text-sm font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                Mean Score: {(prediction.class_scores[prediction.predicted_class] * 100).toFixed(2)}%
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Aggregation: {prediction.aggregation}
            </p>
          </div>

          {/* Scores Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Aggregated Softmax Score Distribution
            </h4>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                  <tr>
                    <th className="py-2.5 px-4">Research Class</th>
                    <th className="py-2.5 px-4">Softmax Output</th>
                    <th className="py-2.5 px-4">Relative Visual Representation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.entries(prediction.class_scores).map(([className, score]) => {
                    const isTop = className === prediction.predicted_class;
                    return (
                      <tr key={className} className={isTop ? 'bg-cyan-500/5' : ''}>
                        <td className={`py-2.5 px-4 font-medium ${isTop ? 'text-cyan-300 font-bold' : 'text-slate-300'}`}>
                          {className} {isTop && '★'}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {(score * 100).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-4 w-1/2">
                          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isTop ? 'bg-cyan-400' : 'bg-slate-600'}`}
                              style={{ width: `${Math.max(score * 100, 2)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slices Summary */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Per-Slice Model Evaluations ({prediction.slice_predictions.length} slices)
            </h4>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[10px] uppercase sticky top-0">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Slice Filename</th>
                    <th className="py-2 px-3">Predicted Class</th>
                    <th className="py-2 px-3">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {prediction.slice_predictions.map((s) => (
                    <tr key={s.slice_index}>
                      <td className="py-1.5 px-3 text-cyan-400">#{s.slice_index}</td>
                      <td className="py-1.5 px-3 text-slate-300">{s.filename}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-200">{s.predicted_class}</td>
                      <td className="py-1.5 px-3">{(s.predicted_class_score * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Governance & Disclaimer */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>Academic Research Disclaimer</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-300/80">
              {prediction.disclaimer}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-6 py-3 text-xs text-slate-500">
          <span>Generated: {new Date(prediction.timestamp).toLocaleString()}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-medium text-slate-200 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
