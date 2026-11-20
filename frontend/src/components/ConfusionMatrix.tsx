import React from 'react';
import type { ConfusionMatrixData } from '../types';

interface Props {
  data: ConfusionMatrixData;
  title: string;
  subtitle?: string;
}

export const ConfusionMatrix: React.FC<Props> = ({ data, title, subtitle }) => {
  const { labels, matrix } = data;

  if (!matrix || matrix.length === 0 || !labels || labels.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
        No confusion matrix data available.
      </div>
    );
  }

  // Calculate row sums (actual total per class)
  const rowTotals = matrix.map((row) => row.reduce((sum, val) => sum + val, 0));
  const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);

  // Maximum value for color scaling
  const maxVal = Math.max(...matrix.flatMap((row) => row), 1);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
      <div>
        <h4 className="text-sm font-bold text-slate-100">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex flex-col items-center">
            {/* Top Label */}
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Predicted Class →
            </div>

            <div className="flex items-center">
              {/* Left Label */}
              <div className="mr-3 -rotate-90 text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                ← Actual Class
              </div>

              {/* Matrix Grid */}
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2"></th>
                    {labels.map((colLabel) => (
                      <th
                        key={colLabel}
                        className="p-2 text-center font-medium text-slate-300 max-w-[120px] truncate"
                        title={colLabel}
                      >
                        {colLabel}
                      </th>
                    ))}
                    <th className="p-2 text-center font-semibold text-slate-400 border-l border-slate-800">
                      Total
                    </th>
                    <th className="p-2 text-center font-semibold text-cyan-400">
                      Recall
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, rIdx) => {
                    const actualLabel = labels[rIdx];
                    const rowTotal = rowTotals[rIdx] || 1;
                    const correctVal = row[rIdx] || 0;
                    const recallPct = ((correctVal / rowTotal) * 100).toFixed(1);

                    return (
                      <tr key={actualLabel} className="border-t border-slate-800/60">
                        <td className="p-2 font-medium text-slate-300 text-right pr-3 whitespace-nowrap">
                          {actualLabel}
                        </td>
                        {row.map((val, cIdx) => {
                          const isDiagonal = rIdx === cIdx;
                          const intensity = val / maxVal;
                          const cellPct = ((val / rowTotal) * 100).toFixed(0);

                          return (
                            <td
                              key={`${rIdx}-${cIdx}`}
                              className="p-1.5 text-center min-w-[75px]"
                            >
                              <div
                                className={`rounded-lg p-2.5 transition-all ${
                                  isDiagonal
                                    ? 'border border-cyan-500/40 bg-cyan-500 text-slate-950 font-bold'
                                    : val > 0
                                    ? 'bg-slate-800 text-slate-200 border border-slate-700/60'
                                    : 'bg-slate-950/40 text-slate-400'
                                }`}
                                style={
                                  isDiagonal
                                    ? {
                                        backgroundColor: `rgba(6, 182, 212, ${Math.max(
                                          0.3,
                                          intensity
                                        )})`,
                                        color: intensity > 0.4 ? '#ffffff' : '#e2e8f0',
                                      }
                                    : val > 0
                                    ? {
                                        backgroundColor: `rgba(244, 63, 94, ${Math.max(
                                          0.15,
                                          intensity * 0.7
                                        )})`,
                                      }
                                    : undefined
                                }
                              >
                                <div className="text-sm font-mono font-bold">{val}</div>
                                <div className="text-[10px] opacity-80">{cellPct}%</div>
                              </div>
                            </td>
                          );
                        })}
                        {/* Row Total */}
                        <td className="p-2 text-center font-mono font-semibold text-slate-300 border-l border-slate-800">
                          {rowTotals[rIdx]}
                        </td>
                        {/* Recall */}
                        <td className="p-2 text-center font-mono font-bold text-cyan-300">
                          {recallPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
        <span>Evaluated cases / groups: <strong>{grandTotal}</strong></span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-cyan-500/60 inline-block" />
            Diagonal (True Positives)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded bg-rose-500/40 inline-block" />
            Off-diagonal (Confusion)
          </span>
        </span>
      </div>
    </div>
  );
};
