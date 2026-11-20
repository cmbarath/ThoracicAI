import React from 'react';
import { X, Printer, Download, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { PredictionResponse } from '../types';

interface Props {
  prediction: PredictionResponse;
  onClose: () => void;
}

export const CaseReportModal: React.FC<Props> = ({ prediction, onClose }) => {
  const downloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(prediction, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${prediction.case_id}_research_report.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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
                {prediction.case_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Printer className="h-3.5 w-3.5 text-cyan-400" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={downloadJSON}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>JSON</span>
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
              <p className="text-slate-400">Case ID</p>
              <p className="font-mono font-bold text-cyan-300 mt-0.5">{prediction.case_id}</p>
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
              <span className="text-xs text-slate-400 font-mono">
                Aggregation: {prediction.aggregation}
              </span>
            </div>
          </div>

          {/* Class Score Breakdown */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Arithmetic Mean Softmax Distribution
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(prediction.class_scores).map(([cName, score]) => (
                <div
                  key={cName}
                  className={`rounded-xl border p-3 ${
                    cName === prediction.predicted_class
                      ? 'border-cyan-500/50 bg-cyan-950/30'
                      : 'border-slate-800 bg-slate-950/40'
                  }`}
                >
                  <p className="text-xs text-slate-400">{cName}</p>
                  <p className="text-xl font-bold font-mono text-slate-100 mt-1">
                    {(score * 100).toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Score: {score.toFixed(4)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-slice summary list */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Individual Slice Inferences ({prediction.slice_predictions.length})
            </h4>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800 text-xs">
              {prediction.slice_predictions.map((s) => (
                <div key={s.slice_index} className="flex items-center justify-between p-2.5 bg-slate-950/30">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 text-[11px]">#{s.slice_index}</span>
                    <span className="truncate max-w-xs text-slate-300">{s.filename}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-200">
                      {s.predicted_class}
                    </span>
                    <span className="font-mono text-slate-300 font-bold">
                      {(s.predicted_class_score * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mandatory Research Disclaimer */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-300">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-200">Research Prototype Disclaimer</p>
                <p className="text-amber-300/80 leading-relaxed text-[11px]">
                  {prediction.disclaimer} This document is an academic artifact summarizing model inferences
                  from an experimental ImageNet-pretrained DenseNet121 network. It is not an official medical record
                  or diagnostic determination.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-950/70 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
