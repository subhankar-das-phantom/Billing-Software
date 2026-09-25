import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LogIn, 
  Mail, 
  Lock, 
  ArrowLeft,
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Shield,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { enterDemoMode } from '../../demo/demoState';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  const { login, startDemoMode } = useAuth();
  const { error: showError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    try {
      const result = await login(email, password);
      if (result?.success) {
        navigate('/');
      }
    } catch (err) {
      // Hold loading state for at least 400ms so rapid local network 401 rejections (~20ms) don't trigger a 1-frame button flick
      const elapsed = Date.now() - startTime;
      const MIN_LOADING_MS = 400;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_MS - elapsed));
      }
      showError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 sm:py-12 relative overflow-y-auto bg-slate-950">
      {/* Crisp Subtle Grid Background */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_75%_50%_at_50%_50%,black,transparent)]" />

      {/* In-Flow Navigation Header (Positioned above the card, zero displacement) */}
      <div className="w-full max-w-md mb-3 flex items-center justify-start z-10 pointer-events-auto">
        <Link
          to="/landing"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Login Card (Instant Frame-0 Mount - Zero CLS) */}
      <div className="relative w-full max-w-md z-10">
        <div className="glass-card p-8 md:p-10 shadow-xl border border-slate-700/60 relative overflow-hidden">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-sm text-white font-bold text-2xl">
              B
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-2 tracking-tight">
                Bharat Enterprise
              </h1>
              <p className="text-slate-400 font-medium flex items-center justify-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-blue-500" />
                Billing & Business Operations
              </p>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center mb-6 p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <p className="text-slate-300 text-sm">
              Welcome back. Sign in to your workstation.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="label flex items-center gap-2 mb-2" htmlFor="email">
                <Mail size={16} className="text-slate-400" />
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className={focusedField === 'email' ? 'text-blue-500' : 'text-slate-400'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="input pl-10 pr-10 transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  placeholder="email@example.com"
                  autoComplete="email"
                  disabled={loading}
                />
                {email && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <CheckCircle size={18} className="text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="label flex items-center gap-2 mb-2" htmlFor="password">
                <Lock size={16} className="text-slate-400" />
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className={focusedField === 'password' ? 'text-blue-500' : 'text-slate-400'} style={{ transition: 'color 0.2s' }} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="input pl-10 pr-10 transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 font-semibold shadow-xs relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-3 text-slate-400 font-semibold tracking-wider">
                Or explore instantly
              </span>
            </div>
          </div>

          {/* 1-Click Interactive Live Demo Button */}
          <button
            type="button"
            onClick={startDemoMode}
            className="w-full p-3.5 rounded-xl bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/70 hover:border-amber-500/50 text-slate-200 hover:text-white transition-all shadow-xs flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-3 text-left min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                  <span>Explore Live Demo Mode</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    No Login Required
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  Full workspace preview with realistic Indian distribution data
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Register Link */}
          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="relative z-20 inline-flex items-center text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create one here
              </Link>
            </p>
          </div>

          {/* Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield size={14} className="text-emerald-400" />
            <span>Secured with end-to-end encryption</span>
          </div>
        </div>
      </div>
    </div>
  );
}
