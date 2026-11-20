import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Cpu,
  FileText,
  FolderArchive,
  Layers,
  LogOut,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { fetchHealth } from '../services/api';
import type { HealthResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

interface Props {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<Props> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin, logout } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isError, setIsError] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        if (isMounted) {
          setHealth(data);
          setIsError(false);
        }
      } catch {
        if (isMounted) setIsError(true);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'cancer', label: 'Cancer Workflow', icon: Layers, badge: 'DenseNet121' },
    { id: 'covid', label: 'COVID / Pulmonary', icon: Sparkles, badge: 'DenseNet121' },
    { id: 'cases', label: 'Case Registry', icon: FolderArchive },
    { id: 'reports', label: 'Report Centre', icon: FileText },
    { id: 'performance', label: 'Benchmarks', icon: BarChart3 },
    { id: 'methodology', label: 'Methodology', icon: BookOpen },
    ...(isAdmin
      ? [{ id: 'admin', label: 'Administration', icon: Shield, badge: 'Superuser' }]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20 text-slate-950">
              <Activity className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-white">ThoracicAI</span>
                <span className="rounded bg-cyan-950/70 border border-cyan-700/50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 uppercase tracking-wider">
                  Platform
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Secure CT Research & Classification</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        item.badge === 'Superuser'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : isActive
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Hub: User / Auth & Health Indicator */}
          <div className="flex items-center gap-3">
            {/* Backend Status indicator */}
            <div className="hidden sm:flex items-center gap-2">
              {health ? (
                <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-300">
                    PyTorch {health.device.toUpperCase()}
                  </span>
                </div>
              ) : isError ? (
                <div className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/30 px-3 py-1 text-xs text-rose-300">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-[11px]">Backend Offline</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400">
                  <Cpu className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
                  <span className="text-[11px]">Connecting...</span>
                </div>
              )}
            </div>

            {/* User Profile / Auth State */}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('settings')}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs transition"
                  title="View Account Settings & Identity"
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center font-bold text-[11px] text-slate-950">
                    {user.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="font-medium text-slate-200 text-[11px] truncate max-w-[120px]">
                      {user.display_name}
                    </div>
                    <div className="text-[9px] font-mono text-cyan-400 uppercase tracking-wider">
                      {user.role}
                    </div>
                  </div>
                </button>

                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition"
              >
                <User className="h-3.5 w-3.5" />
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile / Compact Navigation Bar */}
        <div className="flex lg:hidden overflow-x-auto border-t border-slate-800/80 px-2 py-1.5 gap-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Authentication Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
