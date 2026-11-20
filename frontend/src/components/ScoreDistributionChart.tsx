import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';

interface Props {
  classScores: Record<string, number>;
  dataset?: 'cancer' | 'covid';
}

const COLOR_MAP: Record<string, string> = {
  // Cancer classes
  Benign: '#38bdf8', // Cyan/Sky
  Malignant: '#f43f5e', // Rose/Red
  Normal: '#10b981', // Emerald

  // COVID classes
  'COVID-19': '#ef4444', // Red
  'Other pulmonary disease': '#a855f7', // Violet
};

export const ScoreDistributionChart: React.FC<Props> = ({ classScores }) => {
  const data = Object.entries(classScores).map(([name, score]) => ({
    name,
    scorePct: Number((score * 100).toFixed(2)),
    rawScore: score,
  }));

  // Sort descending by score for ranking view
  const sortedData = [...data].sort((a, b) => b.scorePct - a.scorePct);

  return (
    <div className="space-y-4">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              unit="%"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#334155"
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 500 }}
              stroke="#334155"
              width={140}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-900/95 p-2.5 shadow-xl text-xs backdrop-blur-sm">
                      <p className="font-semibold text-slate-100">{item.name}</p>
                      <p className="mt-1 font-mono text-cyan-300">
                        Mean Softmax: {item.scorePct}%
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Normalized score: {item.rawScore.toFixed(4)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="scorePct" radius={[0, 6, 6, 0]} barSize={22}>
              {sortedData.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={COLOR_MAP[entry.name] || '#06b6d4'}
                  opacity={0.88}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Numerical score tiles */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
        {data.map((item) => (
          <div
            key={item.name}
            className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-center"
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: COLOR_MAP[item.name] || '#06b6d4' }}
              />
              <span className="text-xs font-medium text-slate-300 truncate" title={item.name}>
                {item.name}
              </span>
            </div>
            <p className="text-lg font-bold font-mono text-slate-100">
              {item.scorePct}%
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              {item.rawScore.toFixed(4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
