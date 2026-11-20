import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Lock, Mail, RefreshCw, User, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, defaultMode = 'login' }: AuthModalProps) {
  const { login, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);

    if (!email.trim()) {
      setError('Please provide a valid institutional email address.');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        await resetPassword(email.trim());
        setInfoMsg('Password reset instructions have been dispatched to your email.');
      } catch (err: any) {
        setError(err.message || 'Failed to dispatch reset email. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setError('Display name / academic title is required.');
        return;
      }
      if (!password) {
        setError('Please create a secure password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!termsAgreed) {
        setError('You must acknowledge the research use terms.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password || undefined);
      } else {
        await register(displayName.trim(), email.trim(), password || undefined);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              {mode === 'forgot' ? <KeyRound className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <h2 className="text-base font-bold text-slate-100">
              {mode === 'login' && 'Sign In to ThoracicAI'}
              {mode === 'register' && 'Create Researcher Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          {infoMsg && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-lg text-xs text-emerald-300">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name & Title
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Maya Lin"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  placeholder="researcher@institution.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setInfoMsg(null);
                        setMode('forgot');
                      }}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2 pt-1 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0"
                />
                <span>I acknowledge this platform is restricted to academic research use only.</span>
              </label>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 mt-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition flex items-center justify-center gap-2"
            >
              {isSubmitting && <RefreshCw className="h-3 w-3 animate-spin" />}
              {mode === 'login' && 'Sign In'}
              {mode === 'register' && 'Create Account'}
              {mode === 'forgot' && 'Send Reset Instructions'}
            </button>
          </form>

          {/* Toggle Login / Register / Forgot */}
          <div className="text-center pt-2 space-y-1">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMsg(null);
                  setMode('register');
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Don't have an account? Register here
              </button>
            )}
            {mode === 'register' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMsg(null);
                  setMode('login');
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Already have an account? Sign In
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setInfoMsg(null);
                  setMode('login');
                }}
                className="text-xs text-cyan-400 hover:underline"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
