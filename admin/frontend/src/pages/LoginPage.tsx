/**
 * Bharat Enterprise Billing System — Platform Control Plane Login
 * Two-stage authentication with password validation and TOTP/Backup MFA verification.
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Mail, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const { login, verifyMfa } = usePlatformAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stage 1: Email + Password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.mfaRequired && result.mfaPendingToken) {
        setMfaPendingToken(result.mfaPendingToken);
      } else {
        navigate(redirectPath, { replace: true });
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Authentication failed. Please verify credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Stage 2: MFA TOTP / Backup Code submission
  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaPendingToken) return;
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await verifyMfa(mfaPendingToken, mfaCode, isBackupCode);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Invalid verification code. Please check your authenticator application.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-blue-400 mb-3 shadow-lg shadow-black/40">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">
            Bharat Enterprise Control Plane
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Restricted Operator & System Administrator Access Only
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl shadow-black/60">
          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!mfaPendingToken ? (
            /* Stage 1: Login Form */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Platform Operator Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder="operator@platform.internal"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors shadow-md shadow-blue-950/40 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Verifying Credentials...' : 'Authenticate to Platform'}
              </button>
            </form>
          ) : (
            /* Stage 2: MFA Verification */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  Multi-Factor Authentication required. Enter the 6-digit code from your authenticator app.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  {isBackupCode ? '8-Character Backup Code' : '6-Digit TOTP Code'}
                </label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.trim())}
                  required
                  autoFocus
                  placeholder={isBackupCode ? 'XXXX-XXXX' : '123456'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono tracking-widest text-center text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setIsBackupCode(!isBackupCode)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  {isBackupCode ? 'Use Authenticator Code instead' : 'Use a single-use backup code'}
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMfaPendingToken(null)}
                  className="w-1/3 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !mfaCode}
                  className="w-2/3 py-2 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors shadow-md shadow-blue-950/40 disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? 'Verifying...' : 'Confirm MFA'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-[11px] text-slate-500 font-mono">
          All platform actions, sessions, and mutations are cryptographically hash-chained and audited.
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
