import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrainingHistoryItem } from '../types';

interface Props {
  history: TrainingHistoryItem[];
  dataset?: 'cancer' | 'covid';
}

export const TrainingHistoryChart: React.FC<Props> = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
        No training history available.
      </div>
    );
  }

  const chartData = history.map((item) => ({
    epoch: `Epoch ${item.epoch}`,
    epochNum: item.epoch,
    phase: item.phase,
    loss: Number(item.train_loss.toFixed(4)),
    accuracyPct: Number((item.train_accuracy * 100).toFixed(2)),
  }));

  const finetuneStartEpoch = history.find((h) => h.phase === 'finetune')?.epoch;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-100">
            Training Convergence History
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Phase 1: Classifier head warm-up | Phase 2: Full network fine-tuning
            {finetuneStartEpoch && ` (began epoch ${finetuneStartEpoch})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-cyan-300 border border-slate-700">
            {history.length} Total Epochs
          </span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="epoch"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#334155"
            />
            {/* Left Y Axis for Accuracy % */}
            <YAxis
              yAxisId="acc"
              domain={[50, 100]}
              unit="%"
              tick={{ fill: '#10b981', fontSize: 11 }}
              stroke="#10b981"
            />
            {/* Right Y Axis for Loss */}
            <YAxis
              yAxisId="loss"
              orientation="right"
              domain={[0, 1.0]}
              tick={{ fill: '#f43f5e', fontSize: 11 }}
              stroke="#f43f5e"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs shadow-xl backdrop-blur-sm">
                      <p className="font-bold text-slate-100">{data.epoch} ({data.phase} phase)</p>
                      <div className="mt-1.5 space-y-1 font-mono">
                        <p className="text-emerald-400">Accuracy: {data.accuracyPct}%</p>
                        <p className="text-rose-400">Cross-Entropy Loss: {data.loss}</p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
              formatter={(val) => <span className="text-slate-300 font-medium">{val}</span>}
            />
            <Line
              yAxisId="acc"
              type="monotone"
              dataKey="accuracyPct"
              name="Training Accuracy (%)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981' }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="loss"
              type="monotone"
              dataKey="loss"
              name="Training Loss (NLL)"
              stroke="#f43f5e"
              strokeWidth={2.5}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#f43f5e' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-2">
        <span>Optimizer: Adam / Cosine Annealing</span>
        <span>Loss Metric: Cross-Entropy (Negative Log Likelihood)</span>
      </div>
    </div>
  );
};
