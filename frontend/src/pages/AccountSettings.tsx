import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Key,
  Lock,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';

export function AccountSettings() {
  const { user, token, updateDisplayName } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setStatusMsg({ type: 'error', text: 'Display name cannot be empty.' });
      return;
    }
    setIsUpdating(true);
    setStatusMsg(null);
    try {
      await updateDisplayName(displayName.trim());
      setStatusMsg({ type: 'success', text: 'Profile display name updated successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setIsUpdating(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            Account Management
          </span>
          <span className="text-xs text-slate-500">• Profile & Security</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-1">
          Researcher Account & Preferences
        </h1>
        <p className="text-sm text-slate-400">
          Manage your research profile, credentials, role authorization, and audit identity.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="hover:opacity-75">
            ×
          </button>
        </div>
      )}

      {/* Profile Information Form */}
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <User className="h-4 w-4 text-cyan-400" />
          Researcher Profile
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Registered Email Address
            </label>
            <input
              type="text"
              disabled
              value={user?.email || ''}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400 font-mono cursor-not-allowed"
            />
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Identity verified via Supabase Auth.
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Display Name / Academic Title
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dr. Alex Mercer"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow transition"
          >
            {isUpdating && <RefreshCw className="h-3 w-3 animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>

      {/* Role & Privileges */}
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          Role-Based Access Control (RBAC)
        </h2>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-950 border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Assigned Institutional Role:</span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                  user?.role === 'ADMIN'
                    ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {user?.role === 'ADMIN'
                ? 'Full administrative privileges: user governance, system metrics, and audit logs.'
                : 'Standard research privileges: multi-slice CT inference, case management, and report generation.'}
            </p>
          </div>

          <div className="text-[11px] text-slate-500 font-mono px-3 py-1.5 rounded bg-slate-900 border border-slate-800">
            RBAC Enforced
          </div>
        </div>
      </div>

      {/* Security & PHI Protection Guarantee */}
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-3">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" />
          Privacy & Research Data Governance
        </h2>
        <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
          <p>
            • <strong className="text-slate-300">Zero Raw CT Slice Persistence:</strong> Slices uploaded for
            inference are processed purely in-memory via PyTorch tensors and destroyed upon request
            completion.
          </p>
          <p>
            • <strong className="text-slate-300">Protected Health Information (PHI):</strong> No patient names,
            medical record numbers (MRNs), or identifying metadata are ever captured or stored.
          </p>
          <p>
            • <strong className="text-slate-300">Anonymous Reference Codes:</strong> Cases are referenced by
            random cryptographic identifiers (<code className="text-cyan-400">CASE-CAN-XXXXXX</code> /{' '}
            <code className="text-cyan-400">CASE-COV-XXXXXX</code>) to guarantee complete anonymization.
          </p>
        </div>
      </div>

      {/* Active Session JWT Telemetry */}
      {token && (
        <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-3">
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Key className="h-4 w-4 text-amber-400" />
            Active Session Security Details
          </h2>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-400 break-all space-y-1">
            <div>
              <span className="text-slate-500">Subject (User ID): </span>
              <span className="text-slate-300">{user?.id}</span>
            </div>
            <div>
              <span className="text-slate-500">Token Signature: </span>
              <span className="text-slate-400">{token.slice(0, 36)}...[REDACTED]</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
