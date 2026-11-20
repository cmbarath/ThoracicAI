import React, { useState } from 'react';
import { Download, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import type { SlicePrediction, UploadedSlicePreview } from '../types';

interface Props {
  slices: SlicePrediction[];
  uploadedPreviews?: UploadedSlicePreview[];
  caseId: string;
  dataset: 'cancer' | 'covid';
}

export const SliceTable: React.FC<Props> = ({
  slices,
  uploadedPreviews = [],
  caseId,
  dataset,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const getPreviewUrl = (filename: string) => {
    const match = uploadedPreviews.find((p) => p.file.name === filename);
    return match ? match.previewUrl : null;
  };

  const downloadCSV = () => {
    // Generate slice predictions CSV
    const headers = ['Slice Index', 'Filename', 'Predicted Class', 'Predicted Score (%)'];
    const classNames = Object.keys(slices[0]?.class_scores || {});
    classNames.forEach((c) => headers.push(`${c} Score (%)`));

    const rows = slices.map((s) => {
      const row = [
        s.slice_index,
        `"${s.filename.replace(/"/g, '""')}"`,
        `"${s.predicted_class}"`,
        (s.predicted_class_score * 100).toFixed(2),
      ];
      classNames.forEach((c) => {
        const val = s.class_scores[c] !== undefined ? (s.class_scores[c] * 100).toFixed(2) : '0.00';
        row.push(val);
      });
      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${caseId}_${dataset}_slice_predictions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">
            Per-Slice Model Inferences ({slices.length})
          </h4>
          <p className="text-[11px] text-slate-400">
            Individual slice-level softmax predictions prior to case aggregation
          </p>
        </div>

        <button
          type="button"
          onClick={downloadCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-500/40 hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5 text-cyan-400" />
          <span>Export Slice CSV</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-md text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-16">Slice</th>
                <th className="py-2.5 px-3">Filename</th>
                <th className="py-2.5 px-3">Predicted Class</th>
                <th className="py-2.5 px-3 text-right">Top Score</th>
                <th className="py-2.5 px-3 text-center w-20">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {slices.map((slice) => {
                const isExpanded = expandedIndex === slice.slice_index;
                const previewUrl = getPreviewUrl(slice.filename);

                return (
                  <React.Fragment key={slice.slice_index}>
                    <tr className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-cyan-400 font-semibold">
                        #{slice.slice_index}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">
                        <div className="flex items-center gap-2">
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt=""
                              className="h-7 w-7 rounded object-cover border border-slate-700 bg-black shrink-0"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                          )}
                          <span className="truncate max-w-xs" title={slice.filename}>
                            {slice.filename}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-slate-800 border border-slate-700 text-slate-200">
                          {slice.predicted_class}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-100">
                        {(slice.predicted_class_score * 100).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedIndex(isExpanded ? null : slice.slice_index)}
                          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70">
                        <td colSpan={5} className="py-3 px-4">
                          <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 space-y-2">
                            <p className="text-[11px] font-sans font-medium text-slate-300">
                              Full Softmax Score Vector for Slice #{slice.slice_index}:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {Object.entries(slice.class_scores).map(([cName, score]) => (
                                <div
                                  key={cName}
                                  className={`rounded p-2 border ${
                                    cName === slice.predicted_class
                                      ? 'border-cyan-500/40 bg-cyan-950/30'
                                      : 'border-slate-800 bg-slate-900'
                                  }`}
                                >
                                  <div className="flex justify-between items-center text-[10px] font-sans">
                                    <span className="text-slate-400">{cName}</span>
                                    <span className="font-mono font-bold text-slate-200">
                                      {(score * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        cName === slice.predicted_class ? 'bg-cyan-400' : 'bg-slate-600'
                                      }`}
                                      style={{ width: `${Math.min(100, score * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
