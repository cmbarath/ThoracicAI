import { useEffect, useState } from 'react';
import type {
  AdminHealthResponse,
  AdminStats,
  AdminUser,
  AuditLogItem,
} from '../types';
import {
  fetchAdminAuditLogs,
  fetchAdminHealth,
  fetchAdminStats,
  fetchAdminUsers,
  updateUserRole,
  updateUserStatus,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  AlertCircle,
  Cpu,
  Database,
  FileText,
  Layers,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';

export function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize] = useState<number>(15);
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'system'>('users');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, usersData, healthData, auditData] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminHealth(),
        fetchAdminAuditLogs({ page: auditPage, pageSize: auditPageSize }),
      ]);
      setStats(statsData);
      setUsers(usersData.users);
      setHealth(healthData);
      setAuditLogs(auditData.events);
      setAuditTotal(auditData.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [auditPage]);

  const handleToggleUserStatus = async (user: AdminUser) => {
    const newStatus = !user.is_active;
    if (user.id === currentUser?.id && !newStatus) {
      alert('Administrators cannot deactivate their own account.');
      return;
    }
    try {
      await updateUserStatus(user.id, newStatus);
      setActionSuccess(`User ${user.email} ${newStatus ? 'activated' : 'deactivated'}.`);
      loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleChangeRole = async (user: AdminUser, newRole: 'ADMIN' | 'RESEARCHER') => {
    if (user.role === newRole) return;
    try {
      await updateUserRole(user.id, newRole);
      setActionSuccess(`Updated ${user.email} role to ${newRole}.`);
      loadData();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Shield className="h-3 w-3" />
              Superuser Administration
            </span>
            <span className="text-xs text-slate-500">• Platform Operations & Governance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
            Administration & Governance Center
          </h1>
          <p className="text-sm text-slate-400">
            Real-time system telemetry, multi-user access control, and complete immutable audit logging.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="hover:text-emerald-100">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Telemetry KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Platform Users</span>
              <Users className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
              {stats.total_users}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1">
              {stats.active_users} active accounts
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Research Cases</span>
              <Layers className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
              {stats.total_cases}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {stats.cancer_cases} Cancer • {stats.covid_cases} COVID
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Generated Reports</span>
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100 font-mono mt-1">
              {stats.total_reports}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">PDF, CSV & JSON docs</div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>System Health</span>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">100%</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Device: {health?.device || 'CPU'}
            </div>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="border-b border-slate-800 flex gap-4">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'users'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          User Governance ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Audit Event Logs ({auditTotal})
        </button>
        <button
          onClick={() => setActiveTab('system')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'system'
              ? 'border-cyan-500 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Diagnostics & Infrastructure
        </button>
      </div>

      {/* Tab 1: User Governance */}
      {activeTab === 'users' && (
        <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Cases</th>
                  <th className="py-3 px-4">Reports</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {users.map((u) => {
                  const isAdminRole = u.role === 'ADMIN';
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-slate-100 flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-400">
                          {u.display_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{u.display_name}</div>
                          {isCurrent && (
                            <span className="text-[10px] text-cyan-400 font-mono">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isAdminRole
                              ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{u.cases_count}</td>
                      <td className="py-3.5 px-4 font-mono">{u.reports_count}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(u.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() =>
                            handleChangeRole(u, isAdminRole ? 'RESEARCHER' : 'ADMIN')
                          }
                          disabled={isCurrent}
                          className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40"
                          title="Toggle Admin / Researcher Role"
                        >
                          {isAdminRole ? 'Demote' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          disabled={isCurrent}
                          className={`px-2 py-1 text-xs rounded border transition ${
                            u.is_active
                              ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                          } disabled:opacity-40`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Audit Event Logs */}
      {activeTab === 'audit' && (
        <div className="bg-slate-900/40 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-500">{log.id.slice(0, 8)}...</td>
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">{log.resource_type}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {log.actor_email || log.actor_id || 'System'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-sans text-[11px] max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Showing {auditLogs.length} of {auditTotal} audit events
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuditPage((p) => Math.max(p - 1, 1))}
                disabled={auditPage <= 1}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700"
              >
                Previous
              </button>
              <span className="font-mono text-slate-300">
                Page {auditPage} of {Math.ceil(auditTotal / auditPageSize) || 1}
              </span>
              <button
                onClick={() =>
                  setAuditPage((p) =>
                    Math.min(p + 1, Math.ceil(auditTotal / auditPageSize) || 1)
                  )
                }
                disabled={auditPage >= Math.ceil(auditTotal / auditPageSize)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: System Diagnostics */}
      {activeTab === 'system' && health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              Machine Learning Compute Runtime
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">PyTorch Version</span>
                <span className="font-mono text-slate-200">{health.pytorch_version}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Execution Hardware</span>
                <span className="font-mono text-slate-200">{health.device.toUpperCase()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">CUDA Acceleration</span>
                <span className="font-mono text-slate-200">
                  {health.cuda_available ? 'Available' : 'CPU Native (No CUDA device)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Cancer Model Status</span>
                <span className="font-mono text-emerald-400">
                  {health.models.cancer.loaded ? 'Loaded (DenseNet121)' : 'Offline'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">COVID Model Status</span>
                <span className="font-mono text-emerald-400">
                  {health.models.covid.loaded ? 'Loaded (DenseNet121)' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Storage & Document Infrastructure
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Storage Backend</span>
                <span className="font-mono text-slate-200">{health.storage.mode}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">Encrypted Local Path</span>
                <span className="font-mono text-slate-200 truncate max-w-xs">
                  {health.storage.local_dir}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800">
                <span className="text-slate-400">PHI Protection</span>
                <span className="font-mono text-emerald-400">Zero Raw CT Stored</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Row Level Security</span>
                <span className="font-mono text-emerald-400">Enforced</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
