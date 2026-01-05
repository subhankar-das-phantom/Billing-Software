import { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Shield,
  LogIn,
  LogOut as LogOutIcon,
  UserCircle
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

// Loading screen component - Simplified for iOS Safari performance
const AuthLoadingScreen = () => {
  return (
    <motion.div
      className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 z-50 flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        {/* Logo - static on mobile, subtle animation on desktop */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
          <Shield className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>

        {/* Simple CSS-based spinner - much better iOS performance */}
        <div className="inline-block mb-4">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>

        {/* Loading text - simple fade in, no infinite animations */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-white mb-2">
            Authenticating
          </h2>
          <p className="text-sm text-slate-400">Please wait...</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export const AuthProvider = ({ children }) => {
  // Support for both admin and employee users
  const [user, setUser] = useState(null); // Current user (admin or employee)
  const [userRole, setUserRole] = useState(null); // 'admin' or 'employee'
  const [admin, setAdmin] = useState(null); // For backward compatibility
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
          const role = data.role || 'admin';
          setUserRole(role);
          
          if (role === 'admin') {
            setAdmin(data.admin);
            setUser(data.admin);
            localStorage.setItem('admin', JSON.stringify(data.admin));
            localStorage.setItem('userRole', 'admin');
          } else {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', 'employee');
          }
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('admin');
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        setAdmin(null);
        setUser(null);
        setUserRole(null);
      } finally {
        // Minimal delay for smooth transition (reduced from 800ms)
        setTimeout(() => setLoading(false), 200);
      }
    };

    checkAuth();
  }, []);

  // Heartbeat to keep session alive (every 2 minutes)
  // When all tabs are closed or internet disconnects, heartbeats stop
  // and the session becomes "offline" after 5 minutes
  useEffect(() => {
    // Only send heartbeats when user is logged in
    if (!user && !admin) return;

    // Send initial heartbeat
    authService.heartbeat();

    // Set up interval - every 2 minutes
    const heartbeatInterval = setInterval(() => {
      authService.heartbeat();
    }, 2 * 60 * 1000); // 2 minutes

    // Cleanup on unmount or logout
    return () => clearInterval(heartbeatInterval);
  }, [user, admin]);

  // Unified login - auto-detects Admin or Employee
  const login = async (email, password) => {
    try {
      setAuthTransition('login');
      const data = await authService.login(email, password);
      
      if (data.success) {
        if (data.role === 'admin') {
          // Admin login
          localStorage.setItem('admin', JSON.stringify(data.admin));
          localStorage.setItem('userRole', 'admin');
          setAdmin(data.admin);
          setUser(data.admin);
          setUserRole('admin');
          
          setAuthTransition(null);
          requestAnimationFrame(() => {
            showToast(`Welcome back, ${data.admin.firmName || 'Admin'}!`, 'success');
          });
        } else if (data.role === 'employee') {
          // Employee login
          localStorage.setItem('user', JSON.stringify(data.employee));
          localStorage.setItem('userRole', 'employee');
          setUser(data.employee);
          setUserRole('employee');
          setAdmin(null);
          
          setAuthTransition(null);
          requestAnimationFrame(() => {
            showToast(`Welcome back, ${data.employee.name || 'Employee'}!`, 'success');
          });
        }
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
      
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      setAdmin(null);
      setUser(null);
      setUserRole(null);
      
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
    setUser(adminData);
    showToast('Profile updated successfully', 'success');
  };

  // Check if current user is admin
  const isAdmin = () => userRole === 'admin';

  return (
    <AuthContext.Provider 
      value={{ 
        // Current user (either admin or employee)
        user,
        userRole,
        isAdmin: isAdmin(),
        
        // For backward compatibility
        admin, 
        
        // Auth actions
        login, 
        logout, 
        updateAdmin, 
        loading,
        showToast,
        authTransition
      }}
    >
      {/* Loading screen - render directly without exit animation to prevent issues */}
      {loading && <AuthLoadingScreen />}

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

      {/* Login transition overlay - simplified for mobile */}
      <AnimatePresence>
        {authTransition === 'login' && (
          <motion.div
            className="fixed inset-0 bg-slate-950/70 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-3 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Signing you in...
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Please wait a moment
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {authTransition === 'logout' && (
          <motion.div
            className="fixed inset-0 bg-slate-950/70 z-40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-3 border-red-500 border-t-transparent animate-spin"></div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Signing you out...
                  </h3>
                  <p className="text-slate-400 text-sm">
                    Come back soon!
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - render immediately without animation to prevent blank screen */}
      {!loading && children}
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
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Loading screen is shown by AuthProvider
  }

  if (!user) {
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
            onClick={() => window.location.href = '/#/login'}
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

// Admin-only route wrapper
export const AdminRoute = ({ children }) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user || userRole !== 'admin') {
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
            className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-orange-500/20 flex items-center justify-center"
          >
            <Shield className="w-8 h-8 text-orange-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Admin Access Required
          </h2>
          <p className="text-slate-400 mb-6">
            This page is only accessible to administrators
          </p>
          <motion.button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/#/'}
          >
            Go to Dashboard
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return children;
};
