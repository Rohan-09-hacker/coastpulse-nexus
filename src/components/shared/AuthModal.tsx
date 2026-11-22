import React, { useState, useEffect } from 'react';
import { api } from '../../core/api-client.ts';
import { Lock, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  setupRequired: boolean;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ setupRequired, onSuccess }) => {
  const [isSetup, setIsSetup] = useState(setupRequired);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsSetup(setupRequired);
  }, [setupRequired]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSetup) {
        if (!displayName.trim()) {
          throw new Error('Display name is required for admin setup.');
        }
        await api.setupAdmin({ email, password, displayName });
      } else {
        await api.login({ email, password });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
      // If admin setup was already completed, automatically switch to login view
      if (
        err.message &&
        (err.message.includes('already been initialized') ||
          err.message.includes('Conflict') ||
          err.message.includes('already established'))
      ) {
        setIsSetup(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#17243A]/25 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/88 backdrop-blur-2xl border border-white/95 rounded-2xl p-6 shadow-[0_24px_60px_-12px_rgba(23,36,58,0.22)] space-y-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#3978F6] to-[#9275E8] text-white flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(57,120,246,0.45)] shrink-0">
            {isSetup ? <KeyRound className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-[#17243A] tracking-tight">
              {isSetup ? 'Initial Administrator Setup' : 'COASTPULSE CORE Sign In'}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {isSetup
                ? 'Create the primary admin account with secure password hashing.'
                : 'Enter your credentials to establish a secure HTTP-only session.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSetup && (
            <div>
              <label className="block text-[#17243A] font-semibold mb-1.5">Full Name / Callsign</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Chief Administrator"
                className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl px-3 py-2.5 text-[#17243A] placeholder:text-slate-400 focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 font-mono transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-[#17243A] font-semibold mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@coastpulse.internal"
              className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl px-3 py-2.5 text-[#17243A] placeholder:text-slate-400 focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 font-mono transition-all"
            />
          </div>

          <div>
            <label className="block text-[#17243A] font-semibold mb-1.5">Password (min 8 characters)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-[#EEF4FC]/70 border border-slate-200 rounded-xl px-3 py-2.5 text-[#17243A] placeholder:text-slate-400 focus:outline-none focus:border-[#3978F6] focus:ring-2 focus:ring-[#3978F6]/20 font-mono transition-all"
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl font-semibold bg-[#3978F6] hover:bg-[#2A66E0] text-white shadow-[0_8px_20px_-6px_rgba(57,120,246,0.5)] flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3978F6]/40"
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  <span>{isSetup ? 'Create Administrator Account' : 'Authenticate Session'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {!setupRequired && (
          <div className="text-center pt-2 border-t border-slate-200/70">
            <button
              type="button"
              onClick={() => {
                setIsSetup(!isSetup);
                setError(null);
              }}
              className="text-[11px] font-medium text-[#3978F6] hover:underline cursor-pointer"
            >
              {isSetup ? 'Already have credentials? Sign in' : 'First time? Setup admin'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
