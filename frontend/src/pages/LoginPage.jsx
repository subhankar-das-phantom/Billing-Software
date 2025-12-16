import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogIn, 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

const floatingAnimation = {
  y: [0, -20, 0],
  opacity: [0.5, 0.8, 0.5],
  scale: [1, 1.1, 1],
  transition: {
    duration: 5,
    repeat: Infinity,
    ease: 'easeInOut'
  }
};

const shimmerAnimation = {
  x: ['-100%', '100%'],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: 'linear'
  }
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { error: showError } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      showError('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={floatingAnimation}
          className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 20, 0],
            opacity: [0.5, 0.8, 0.5],
            scale: [1, 1.2, 1],
            transition: {
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1
            }
          }}
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -15, 0],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1],
            transition: {
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2
            }
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Login Card */}
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md z-10"
      >
        <motion.div
          className="glass-card p-8 md:p-10 shadow-2xl border border-white/10 backdrop-blur-xl bg-slate-900/80 relative overflow-hidden"
          whileHover={{ boxShadow: '0 25px 50px -12px rgba(59, 130, 246, 0.3)' }}
          transition={{ duration: 0.3 }}
        >
          {/* Card Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={shimmerAnimation}
          />

          {/* Logo Section */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 mb-4 shadow-lg shadow-blue-500/50 relative overflow-hidden"
              whileHover={{ 
                scale: 1.1, 
                rotate: 360,
                boxShadow: '0 20px 40px -15px rgba(59, 130, 246, 0.6)'
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-500"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0, 0.5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
              <span className="text-white font-bold text-3xl relative z-10">B</span>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.5, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                Bharat Enterprise
              </h1>
              <p className="text-slate-400 font-medium flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Billing & Inventory System
              </p>
            </motion.div>
          </motion.div>

          {/* Welcome Message */}
          <motion.div
            variants={itemVariants}
            className="text-center mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 border border-blue-500/20"
          >
            <p className="text-slate-300 text-sm">
              👋 Welcome back! Please sign in to continue
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <motion.div variants={itemVariants}>
              <label className="label flex items-center gap-2 mb-2" htmlFor="email">
                <Mail size={16} className="text-slate-400" />
                Email Address
              </label>
              <motion.div
                className="relative"
                animate={focusedField === 'email' ? { scale: 1.02 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <motion.div
                    animate={focusedField === 'email' ? { 
                      scale: 1.2,
                      color: 'rgb(59, 130, 246)'
                    } : {
                      scale: 1,
                      color: 'rgb(148, 163, 184)'
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <Mail size={18} />
                  </motion.div>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="input pl-10 pr-10 transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                  placeholder="admin@bharat.com"
                  autoComplete="email"
                  disabled={loading}
                />
                <AnimatePresence>
                  {email && (
                    <motion.div
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                    >
                      <CheckCircle size={18} className="text-emerald-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants}>
              <label className="label flex items-center gap-2 mb-2" htmlFor="password">
                <Lock size={16} className="text-slate-400" />
                Password
              </label>
              <motion.div
                className="relative"
                animate={focusedField === 'password' ? { scale: 1.02 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <motion.div
                    animate={focusedField === 'password' ? { 
                      scale: 1.2,
                      color: 'rgb(59, 130, 246)'
                    } : {
                      scale: 1,
                      color: 'rgb(148, 163, 184)'
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <Lock size={18} />
                  </motion.div>
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
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence mode="wait">
                    {showPassword ? (
                      <motion.div
                        key="eye-off"
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <EyeOff size={18} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="eye"
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Eye size={18} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </motion.div>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3.5 font-semibold shadow-lg shadow-blue-500/30 relative overflow-hidden group"
            >
              {/* Button Shimmer Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{
                  x: loading ? ['-100%', '100%'] : '-100%'
                }}
                transition={{
                  duration: 1.5,
                  repeat: loading ? Infinity : 0,
                  ease: 'linear'
                }}
              />

              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.div>
                  </>
                )}
              </span>
            </motion.button>
          </form>

          {/* Demo Credentials */}
          <motion.div
            variants={itemVariants}
            className="mt-6 p-4 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50 relative overflow-hidden group"
            whileHover={{ scale: 1.02 }}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.6 }}
            />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-blue-400" />
                <p className="text-sm font-semibold text-slate-300">Demo Credentials</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <Mail size={14} className="text-slate-500" />
                  <span className="text-slate-400">Email:</span>
                  <motion.code
                    className="text-blue-400 font-mono bg-slate-900/50 px-2 py-0.5 rounded"
                    whileHover={{ scale: 1.05 }}
                  >
                    admin@bharat.com
                  </motion.code>
                </p>
                <p className="flex items-center gap-2">
                  <Lock size={14} className="text-slate-500" />
                  <span className="text-slate-400">Password:</span>
                  <motion.code
                    className="text-blue-400 font-mono bg-slate-900/50 px-2 py-0.5 rounded"
                    whileHover={{ scale: 1.05 }}
                  >
                    admin123
                  </motion.code>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Register Link */}
          <motion.div
            variants={itemVariants}
            className="mt-6 text-center"
          >
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                Create one here
              </Link>
            </p>
          </motion.div>

          {/* Security Badge */}
          <motion.div
            variants={itemVariants}
            className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500"
          >
            <Shield size={14} className="text-emerald-400" />
            <span>Secured with end-to-end encryption</span>
          </motion.div>
        </motion.div>

        {/* Floating Particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-blue-400/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0, 1, 0],
              scale: [0, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'easeInOut'
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
