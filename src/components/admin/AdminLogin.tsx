import React, { useState } from 'react';
import {
  ShieldAlert,
  KeyRound,
  Mail,
  AlertCircle,
  ArrowRight,
  Lock,
  CheckCircle2,
  School
} from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (adminEmail: string) => void;
  onNavigateHome: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const AUTHORIZED_ADMIN_EMAIL = 'fathertemitope@gmail.com';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError('Please provide the designated Administrator Email.');
      return;
    }

    if (cleanEmail !== AUTHORIZED_ADMIN_EMAIL.toLowerCase()) {
      setError(
        `Unauthorized Access: "${cleanEmail}" is not recognized as the designated Institutional Administrator. Only the designated administrator (${AUTHORIZED_ADMIN_EMAIL}) is authorized to enter this portal.`
      );
      return;
    }

    if (!passcode.trim()) {
      setError('Please enter the administrative security key / password.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(AUTHORIZED_ADMIN_EMAIL);
    }, 400);
  };

  const handleQuickFill = () => {
    setEmail(AUTHORIZED_ADMIN_EMAIL);
    setPasscode('admin2025');
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-900 py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        {/* Security Crest */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 shadow-xl mb-2">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            PRIME EDUTECH
          </h1>
          <p className="text-xs uppercase font-bold tracking-widest text-amber-400">
            Institutional Administration Gate
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Restricted console for staff provisioning, curriculum governance, and general school administration.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-sm">
          {error && (
            <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong>Security Rejection:</strong> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>Authorized Administrator Email</span>
              </label>
              <input
                type="email"
                required
                autoFocus
                placeholder="fathertemitope@gmail.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-3 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Access is strictly restricted to <code className="text-amber-300 font-mono">fathertemitope@gmail.com</code>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Security Key / Passcode</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-3 text-sm bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-6 active:scale-[0.99]"
            >
              <span>{loading ? 'Authenticating Administrative Access...' : 'Unlock Administration Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick One-Click Fill for Owner */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
            <button
              type="button"
              onClick={handleQuickFill}
              className="text-[11px] text-amber-400 hover:text-amber-300 underline font-semibold flex items-center gap-1"
            >
              <span>Fill Admin Credentials</span>
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-[11px] text-slate-400 hover:text-white"
            >
              ← Return Home
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-500 font-mono">
          PRIME EDUTECH Evaluation Architecture · Confidential URL Route
        </div>
      </div>
    </div>
  );
};
