import { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Shield,
  LogIn,
  LogOut as LogOutIcon
} from 'lucide-react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

// Toast notification component
const Toast = ({ message, type = 'success', onClose }) => {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-emerald-500/90',
      iconColor: 'text-emerald-100'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-500/90',
      iconColor: 'text-red-100'
    },
    info: {
      icon: Shield,
      bgColor: 'bg-blue-500/90',
      iconColor: 'text-blue-100'
    }
  };

  const { icon: Icon, bgColor, iconColor } = config[type] || config.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`${bgColor} backdrop-blur-xl text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] max-w-md border border-white/20`}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </motion.div>
      
      <p className="flex-1 text-sm font-medium">{message}</p>
      
      <motion.button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
      >
        <X className="w-4 h-4" />
      </motion.button>
    </motion.div>
  );
};

// Loading screen component
const AuthLoadingScreen = () => {
  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-50 flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center">
        {/* Logo with pulse animation */}
        <motion.div
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <Shield className="w-10 h-10 text-white" strokeWidth={2.5} />
        </motion.div>

        {/* Spinner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="inline-block mb-4"
        >
          <Loader2 className="w-8 h-8 text-blue-500" />
        </motion.div>

        {/* Loading text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-white mb-2">
            Authenticating
          </h2>
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map((index) => (
              <motion.div
                key={index}
                className="w-2 h-2 bg-blue-500 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: index * 0.2
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Animated background gradient */}
        <motion.div
          className="fixed inset-0 pointer-events-none opacity-30"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
              'radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%)'
            ]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      </div>
    </motion.div>
  );
};

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [authTransition, setAuthTransition] = useState(null); // 'login' | 'logout'

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const data = await authService.getMe();
        if (data.success) {
          setAdmin(data.admin);
          localStorage.setItem('admin', JSON.stringify(data.admin));
        }
      } catch (error) {
        localStorage.removeItem('admin');
        setAdmin(null);
      } finally {
        // Add slight delay for smoother transition
        setTimeout(() => setLoading(false), 800);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setAuthTransition('login');
      const data = await authService.login(email, password);
      
      if (data.success) {
        localStorage.setItem('admin', JSON.stringify(data.admin));
        setAdmin(data.admin);
        
        // Show success toast with animation delay
        setTimeout(() => {
          showToast(`Welcome back, ${data.admin.firmName || 'Admin'}!`, 'success');
          setAuthTransition(null);
        }, 500);
      } else {
        setAuthTransition(null);
        showToast(data.message || 'Login failed', 'error');
      }
      
      return data;
    } catch (error) {
      setAuthTransition(null);
      showToast(error.message || 'An error occurred during login', 'error');
      throw error;
    }
  };

  const logout = async () => {
    try {
      setAuthTransition('logout');
      await authService.logout();
      
      localStorage.removeItem('admin');
      setAdmin(null);
      
      setTimeout(() => {
        showToast('Successfully logged out', 'info');
        setAuthTransition(null);
      }, 500);
    } catch (error) {
      setAuthTransition(null);
      showToast('Logout failed. Please try again.', 'error');
    }
  };

  const updateAdmin = (adminData) => {
    localStorage.setItem('admin', JSON.stringify(adminData));
    setAdmin(adminData);
    showToast('Profile updated successfully', 'success');
  };

  return (
    <AuthContext.Provider 
      value={{ 
        admin, 
        login, 
        logout, 
        updateAdmin, 
        loading,
        showToast,
        authTransition
      }}
    >
      {/* Loading screen with exit animation */}
      <AnimatePresence mode="wait">
        {loading && <AuthLoadingScreen key="loading" />}
      </AnimatePresence>

      {/* Toast notifications container */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <AnimatePresence mode="wait">
          {toast && (
            <div className="pointer-events-auto">
              <Toast
                key={`${toast.message}-${Date.now()}`}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(null)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Login transition overlay */}
      <AnimatePresence>
        {authTransition === 'login' && (
          <motion.div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <motion.div
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <LogIn className="w-12 h-12 text-blue-500" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Signing you in...
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Please wait a moment
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {authTransition === 'logout' && (
          <motion.div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <motion.div
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <LogOutIcon className="w-12 h-12 text-red-500" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Signing you out...
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Come back soon!
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content with fade-in animation */}
      <AnimatePresence mode="wait">
        {!loading && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Bonus: Protected route wrapper with animation
export const ProtectedRoute = ({ children }) => {
  const { admin, loading } = useAuth();

  if (loading) {
    return null; // Loading screen is shown by AuthProvider
  }

  if (!admin) {
    return (
      <motion.div
        className="fixed inset-0 bg-slate-950 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <motion.div
            className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/20 flex items-center justify-center"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5, repeat: 2 }}
          >
            <AlertCircle className="w-8 h-8 text-red-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Access Denied
          </h2>
          <p className="text-slate-400 mb-6">
            Please log in to continue
          </p>
          <motion.button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
};
