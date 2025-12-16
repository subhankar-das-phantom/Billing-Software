import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  Building2,
  MapPin,
  Phone,
  FileText,
  ArrowRight, 
  Loader2, 
  Eye, 
  EyeOff,
  CheckCircle,
  Sparkles,
  Shield
} from 'lucide-react';
import { authService } from '../services/authService';
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

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firmName: '',
    firmAddress: '',
    firmPhone: '',
    firmGSTIN: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const { updateAdmin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password) {
      showError('Please enter email and password');
      return;
    }

    if (formData.password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { confirmPassword, ...registerData } = formData;
      const result = await authService.register(registerData);
      
      if (result.success) {
        // Auto-login: Set user state and redirect to dashboard
        updateAdmin(result.admin);
        showSuccess('Account created successfully! Welcome to Bharat Enterprise.');
        navigate('/');
      }
    } catch (err) {
      // Show the specific error message from the server
      const errorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const renderInput = ({ name, label, icon: Icon, type = 'text', placeholder, showToggle = false }) => {
    const isPassword = name === 'password';
    const isConfirmPassword = name === 'confirmPassword';
    const showPasswordState = isPassword ? showPassword : showConfirmPassword;
    const togglePassword = () => {
      if (isPassword) setShowPassword(!showPassword);
      else setShowConfirmPassword(!showConfirmPassword);
    };

    return (
      <motion.div variants={itemVariants}>
        <label className="label flex items-center gap-2 mb-2" htmlFor={name}>
          <Icon size={16} className="text-slate-400" />
          {label}
        </label>
        <motion.div
          className="relative"
          animate={focusedField === name ? { scale: 1.02 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <motion.div
              animate={focusedField === name ? { 
                scale: 1.2,
                color: 'rgb(59, 130, 246)'
              } : {
                scale: 1,
                color: 'rgb(148, 163, 184)'
              }}
              transition={{ duration: 0.2 }}
            >
              <Icon size={18} />
            </motion.div>
          </div>
          <input
            id={name}
            name={name}
            type={showToggle ? (showPasswordState ? 'text' : 'password') : type}
            value={formData[name]}
            onChange={handleChange}
            onFocus={() => setFocusedField(name)}
            onBlur={() => setFocusedField(null)}
            className={`input pl-10 transition-all focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${showToggle || formData[name] ? 'pr-10' : 'pr-4'}`}
            placeholder={placeholder}
            disabled={loading}
          />
          {showToggle ? (
            <motion.button
              type="button"
              onClick={togglePassword}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-400 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <AnimatePresence mode="wait">
                {showPasswordState ? (
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
          ) : (
            <AnimatePresence>
              {formData[name] && (
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
          )}
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={floatingAnimation}
          className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"
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
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
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
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Animated Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Register Card */}
      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-lg z-10"
      >
        <motion.div
          className="glass-card p-8 md:p-10 shadow-2xl border border-white/10 backdrop-blur-xl bg-slate-900/80 relative overflow-hidden"
          whileHover={{ boxShadow: '0 25px 50px -12px rgba(16, 185, 129, 0.3)' }}
          transition={{ duration: 0.3 }}
        >
          {/* Card Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={shimmerAnimation}
          />

          {/* Logo Section */}
          <motion.div variants={itemVariants} className="text-center mb-6">
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 mb-4 shadow-lg shadow-emerald-500/50 relative overflow-hidden"
              whileHover={{ 
                scale: 1.1, 
                rotate: 360,
                boxShadow: '0 20px 40px -15px rgba(16, 185, 129, 0.6)'
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-teal-600 to-emerald-500"
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
              <UserPlus className="w-10 h-10 text-white relative z-10" />
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
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
                Create Account
              </h1>
              <p className="text-slate-400 font-medium flex items-center justify-center gap-2">
                <Shield className="w-4 h-4" />
                Join Bharat Enterprise
              </p>
            </motion.div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email & Password Section */}
            <div className="grid grid-cols-1 gap-4">
              {renderInput({ 
                name: 'email', 
                label: 'Email Address', 
                icon: Mail, 
                type: 'email', 
                placeholder: 'your@email.com' 
              })}
              
              {renderInput({ 
                name: 'password', 
                label: 'Password', 
                icon: Lock, 
                placeholder: '••••••••',
                showToggle: true
              })}
              
              {renderInput({ 
                name: 'confirmPassword', 
                label: 'Confirm Password', 
                icon: Lock, 
                placeholder: '••••••••',
                showToggle: true
              })}
            </div>

            {/* Firm Details Section */}
            <motion.div variants={itemVariants} className="pt-4 border-t border-slate-700/50">
              <p className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                <Building2 size={14} />
                Business Details (Optional)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderInput({ 
                  name: 'firmName', 
                  label: 'Firm Name', 
                  icon: Building2, 
                  placeholder: 'Your Enterprise' 
                })}
                
                {renderInput({ 
                  name: 'firmPhone', 
                  label: 'Phone', 
                  icon: Phone, 
                  placeholder: '+91 9876543210' 
                })}
                
                {renderInput({ 
                  name: 'firmGSTIN', 
                  label: 'GSTIN', 
                  icon: FileText, 
                  placeholder: '22AAAAA0000A1Z5' 
                })}
                
                {renderInput({ 
                  name: 'firmAddress', 
                  label: 'Address', 
                  icon: MapPin, 
                  placeholder: 'Business address' 
                })}
              </div>
            </motion.div>

            {/* Submit Button */}
            <motion.button
              variants={itemVariants}
              whileHover={{ scale: loading ? 1 : 1.02, y: loading ? 0 : -2 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              type="submit"
              disabled={loading}
              className="btn w-full py-3.5 font-semibold shadow-lg shadow-emerald-500/30 relative overflow-hidden group bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg mt-6"
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Account</span>
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

          {/* Login Link */}
          <motion.div
            variants={itemVariants}
            className="mt-6 text-center"
          >
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
          </motion.div>

          {/* Security Badge */}
          <motion.div
            variants={itemVariants}
            className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"
          >
            <Shield size={14} className="text-emerald-400" />
            <span>Your data is encrypted and secure</span>
          </motion.div>
        </motion.div>

        {/* Floating Particles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400/30 rounded-full"
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
