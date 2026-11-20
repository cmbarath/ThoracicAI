import React from 'react';
import {
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  BarChart3,
  Cpu,
} from 'lucide-react';
import { DisclaimerBanner } from '../components/DisclaimerBanner';

interface Props {
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<Props> = ({ setActiveTab }) => {
  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-300">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Dual-Workflow PyTorch DenseNet121 Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            ThoracicAI — CT Research & Classification Workbench
          </h1>

          <p className="text-base text-slate-300 leading-relaxed">
            A unified clinical research interface providing two strictly independent CT classification workflows.
            Trained with leakage-group isolation, slice-level feature extraction, and arithmetic mean softmax score aggregation.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('cancer')}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:opacity-95 hover:shadow-cyan-500/40"
            >
              <Layers className="h-4 w-4 stroke-[2.2]" />
              <span>Launch Cancer Workflow</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('covid')}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:border-cyan-500/50 hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Launch COVID / Pulmonary</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className="flex items-center gap-2 rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-slate-400 transition-all hover:text-slate-200 hover:bg-slate-800/60"
            >
              <BarChart3 className="h-4 w-4" />
              <span>View Official Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Research Disclaimer */}
      <DisclaimerBanner variant="card" />

      {/* Key Architectural Highlights Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Independent Models</span>
            <Cpu className="h-5 w-5 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">2 Networks</p>
          <p className="text-xs text-slate-400">
            Dedicated DenseNet121 models for Cancer and COVID with distinct label spaces.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Group Isolation</span>
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">247 Groups</p>
          <p className="text-xs text-slate-400">
            69 cancer and 178 covid leakage-connected groups audited to prevent patient data contamination.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Slice Aggregation</span>
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">Mean Softmax</p>
          <p className="text-xs text-slate-400">
            Arithmetic mean of slice softmax vectors; avoids crude majority hard-label voting.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evaluation Method</span>
            <BarChart3 className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white">Nested Group CV</p>
          <p className="text-xs text-slate-400">
            3-fold outer cross-validation + untouched independent test set verification.
          </p>
        </div>
      </div>

      {/* The Two Workflows Showcase */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Classification Workflows
            </h2>
            <p className="text-xs text-slate-400">
              Select a specialized model pipeline to begin analysis
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-full">
            Zero Label Overlap
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cancer Card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 flex flex-col justify-between transition-all hover:border-cyan-500/40">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Workflow A: Thoracic Cancer
                    </h3>
                    <p className="text-xs text-slate-400">DenseNet121 • 9 Epochs</p>
                  </div>
                </div>
                <span className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-cyan-300 border border-slate-700">
                  Crop V2 Active
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Specialized for benign vs. malignant tumor discrimination against normal parenchyma.
                Applies Cancer Crop V2 (top 12%, bottom 10%, left/right 6%) to mitigate periphery artifacts.
              </p>

              {/* Classes */}
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Output Classes (Exact Order):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-sky-950/60 border border-sky-700/50 px-2.5 py-1 text-xs font-medium text-sky-300">
                    1. Benign
                  </span>
                  <span className="rounded-lg bg-rose-950/60 border border-rose-700/50 px-2.5 py-1 text-xs font-medium text-rose-300">
                    2. Malignant
                  </span>
                  <span className="rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    3. Normal
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-950/60 border border-slate-800/80 p-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400">Nested CV F1</p>
                  <p className="text-sm font-mono font-bold text-cyan-300">0.7212</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Test Macro F1</p>
                  <p className="text-sm font-mono font-bold text-cyan-300">0.7091</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Test Accuracy</p>
                  <p className="text-sm font-mono font-bold text-white">76.92%</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('cancer')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 py-2.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:text-cyan-200"
            >
              <span>Open Cancer Classification</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* COVID Card */}
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 space-y-6 flex flex-col justify-between transition-all hover:border-cyan-500/40">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Workflow B: COVID & Pulmonary
                    </h3>
                    <p className="text-xs text-slate-400">DenseNet121 • 16 Epochs</p>
                  </div>
                </div>
                <span className="rounded bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-blue-300 border border-slate-700">
                  Full Aspect Pad
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Trained on 3,553 images across 178 leakage groups. Designed to detect COVID-19 patterns
                and differentiate from other pulmonary diseases and normal parenchyma without cropping.
              </p>

              {/* Classes */}
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Output Classes (Exact Order):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-lg bg-rose-950/60 border border-rose-700/50 px-2.5 py-1 text-xs font-medium text-rose-300">
                    1. COVID-19
                  </span>
                  <span className="rounded-lg bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    2. Normal
                  </span>
                  <span className="rounded-lg bg-purple-950/60 border border-purple-700/50 px-2.5 py-1 text-xs font-medium text-purple-300">
                    3. Other pulmonary
                  </span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-950/60 border border-slate-800/80 p-3 text-center">
                <div>
                  <p className="text-[10px] text-slate-400">Nested CV F1</p>
                  <p className="text-sm font-mono font-bold text-cyan-300">0.8242</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Test Macro F1</p>
                  <p className="text-sm font-mono font-bold text-cyan-300">0.7775</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Test Accuracy</p>
                  <p className="text-sm font-mono font-bold text-white">78.13%</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('covid')}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/30 py-2.5 text-xs font-semibold text-blue-300 transition-all hover:bg-blue-500/20 hover:text-blue-200"
            >
              <span>Open COVID Classification</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Benchmark Summary Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">
              Official Experimental Benchmarks Summary
            </h3>
            <p className="text-xs text-slate-400">
              Verified performance comparison across development nested CV and untouched test evaluation
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300"
          >
            <span>Explore All Metrics</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Workflow Target</th>
                <th className="py-3 px-4">Architecture</th>
                <th className="py-3 px-4">Dev Images / Groups</th>
                <th className="py-3 px-4">Nested CV Macro F1</th>
                <th className="py-3 px-4">Test Set Groups</th>
                <th className="py-3 px-4">Test Accuracy</th>
                <th className="py-3 px-4">Test Macro F1</th>
                <th className="py-3 px-4">Test NLL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              <tr className="hover:bg-slate-800/40">
                <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                  Cancer (Benign / Malignant / Normal)
                </td>
                <td className="py-3 px-4 text-cyan-300">DenseNet121</td>
                <td className="py-3 px-4 text-slate-300">875 imgs / 69 grps</td>
                <td className="py-3 px-4 text-cyan-400 font-bold">0.7212</td>
                <td className="py-3 px-4 text-slate-300">13 grps (198 imgs)</td>
                <td className="py-3 px-4 text-white font-bold">76.92%</td>
                <td className="py-3 px-4 text-cyan-300 font-bold">0.7091</td>
                <td className="py-3 px-4 text-slate-300">0.3576</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="py-3 px-4 font-sans font-semibold text-slate-200">
                  COVID & Pulmonary (COVID / Normal / Other)
                </td>
                <td className="py-3 px-4 text-cyan-300">DenseNet121</td>
                <td className="py-3 px-4 text-slate-300">3,553 imgs / 178 grps</td>
                <td className="py-3 px-4 text-cyan-400 font-bold">0.8242</td>
                <td className="py-3 px-4 text-slate-300">32 grps (615 imgs)</td>
                <td className="py-3 px-4 text-white font-bold">78.13%</td>
                <td className="py-3 px-4 text-cyan-300 font-bold">0.7775</td>
                <td className="py-3 px-4 text-slate-300">0.4980</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
