import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { DisclaimerBanner } from './components/DisclaimerBanner';
import { Dashboard } from './pages/Dashboard';
import { WorkflowPage } from './pages/WorkflowPage';
import { PerformancePage } from './pages/PerformancePage';
import { MethodologyPage } from './pages/MethodologyPage';
import { Activity } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Research Disclaimer Banner */}
      <DisclaimerBanner variant="top" />

      {/* Navigation Header */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === 'cancer' && <WorkflowPage dataset="cancer" />}
        {activeTab === 'covid' && <WorkflowPage dataset="covid" />}
        {activeTab === 'performance' && <PerformancePage />}
        {activeTab === 'methodology' && <MethodologyPage />}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-8 px-4 text-xs text-slate-400 mt-12">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
              <Activity className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-slate-200">ThoracicAI Platform</span>
            <span>•</span>
            <span>DenseNet121 Research Prototype</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setActiveTab('methodology')}
              className="hover:text-slate-200 transition-colors"
            >
              Model Card
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className="hover:text-slate-200 transition-colors"
            >
              Benchmarks
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className="hover:text-slate-200 transition-colors"
            >
              Overview
            </button>
          </div>

          <p className="text-[11px] text-slate-400 text-center sm:text-right">
            Not for clinical or diagnostic use. Academic research workbench.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
