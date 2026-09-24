import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
import AppShellSkeleton from '../components/Layout/AppShellSkeleton';
import { authService } from '../services/auth/authService';
import { clearCache as clearApiCache } from '../services/api';
import { useTheme } from './ThemeContext';

const AuthContext = createContext(null);

// High-performance GPU-accelerated toast notification
const Toast = ({ message, type = 'success', onClose }) => {
  const config = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-emerald-600',
      iconColor: 'text-white',
      borderColor: 'border-emerald-500/30'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-rose-600',
      iconColor: 'text-white',
      borderColor: 'border-rose-500/30'
    },
    info: {
      icon: Shield,
      bgColor: 'bg-blue-600',
      iconColor: 'text-white',
      borderColor: 'border-blue-500/30'
    }
  };

  const { icon: Icon, bgColor, iconColor, borderColor } = config[type] || config.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-auto ${bgColor} ${borderColor} text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[280px] max-w-md border will-change-[transform,opacity]`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${iconColor}`} />
      <p className="flex-1 text-sm font-medium leading-snug text-white">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0 text-white/80 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};



export const AuthProvider = ({ children }) => {
  const { setThemeMode } = useTheme();
  const location = useLocation();

  const isPublicMarketingRoute = 
    location.pathname === '/' ||
    location.pathname === '/landing' ||
    location.pathname === '/privacy-policy' ||
    location.pathname === '/terms';

  // Auth routes also don't need to block — PublicRoute handles redirect after auth resolves
  const isAuthRoute =
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register');

  const isNonBlockingRoute = isPublicMarketingRoute || isAuthRoute;

  // Check if there's a token to verify — if not, skip auth entirely
  const hasToken = !!localStorage.getItem('token');

  // Support for both admin and employee users
  const [user, setUser] = useState(null); // Current user (admin or employee)
  const [userRole, setUserRole] = useState(null); // 'admin' or 'employee'
  const [admin, setAdmin] = useState(null); // For backward compatibility
  const [loading, setLoading] = useState(() => {
    const isPublic = typeof window !== 'undefined' && (
      window.location.pathname === '/' ||
      window.location.pathname === '/landing' ||
      window.location.pathname === '/privacy-policy' ||
      window.location.pathname === '/terms' ||
      window.location.pathname === '/login' ||
      window.location.pathname === '/register' ||
      window.location.pathname.startsWith('/login') ||
      window.location.pathname.startsWith('/register')
    );
    return isPublic ? false : hasToken;
  });
  const [toast, setToast] = useState(null);
  const [authTransition, setAuthTransition] = useState(null); // 'login' | 'logout'

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const clearSWRCache = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('swr_cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  };

  const clearClientCaches = () => {
    clearSWRCache();
    clearApiCache();
  };

  useEffect(() => {
    // On non-blocking routes (marketing + auth pages), never run eager auth checks
    if (isNonBlockingRoute) {
      setLoading(false);
      return;
    }

    // No token = no session to verify, skip auth check entirely
    if (!hasToken) {
      setLoading(false);
      return;
    }

    // If user is already loaded, no need to re-verify
    if (user || admin) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const data = await authService.getMe();
        if (data?.success) {
          const role = data.role || 'admin';
          setUserRole(role);
          
          if (role === 'admin') {
            setAdmin(data.admin);
            setUser(data.admin);
            localStorage.setItem('admin', JSON.stringify(data.admin));
            localStorage.setItem('userRole', 'admin');
            if (data.admin?.preferences?.themeMode) {
              setThemeMode(data.admin.preferences.themeMode);
            }
            if (data.admin?.preferences?.mobileCardDensity) {
              localStorage.setItem('bharat_mobile_card_density', data.admin.preferences.mobileCardDensity);
            }
          } else {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('userRole', 'employee');
            if (data.user?.preferences?.themeMode) {
              setThemeMode(data.user.preferences.themeMode);
            }
            if (data.user?.preferences?.mobileCardDensity) {
              localStorage.setItem('bharat_mobile_card_density', data.user.preferences.mobileCardDensity);
            }
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
        setLoading(false);
      }
    };

    checkAuth();
  }, [isNonBlockingRoute, hasToken, user, admin]);

  // Heartbeat to keep session alive (every 2 minutes)
  // When all tabs are closed or internet disconnects, heartbeats stop
  // and the session becomes "offline" after 5 minutes
  useEffect(() => {
    // Only send heartbeats when user is logged in and not on public/auth pages
    if ((!user && !admin) || isNonBlockingRoute) return;

    // Send initial heartbeat
    authService.heartbeat();

    // Set up interval - every 2 minutes
    const heartbeatInterval = setInterval(() => {
      authService.heartbeat();
    }, 2 * 60 * 1000); // 2 minutes

    // Cleanup on unmount or logout
    return () => clearInterval(heartbeatInterval);
  }, [user, admin, isPublicMarketingRoute]);

  // Unified login - auto-detects Admin or Employee
  const login = async (email, password) => {
    try {
      clearClientCaches();
      const data = await authService.login(email, password);
      
      if (data?.success) {
        if (data.role === 'admin') {
          // Admin login
          localStorage.setItem('admin', JSON.stringify(data.admin));
          localStorage.setItem('userRole', 'admin');
          setAdmin(data.admin);
          setUser(data.admin);
          setUserRole('admin');
          if (data.admin?.preferences?.themeMode) {
            setThemeMode(data.admin.preferences.themeMode);
          }
          if (data.admin?.preferences?.mobileCardDensity) {
            localStorage.setItem('bharat_mobile_card_density', data.admin.preferences.mobileCardDensity);
          }
          
          setTimeout(() => {
            showToast(`Welcome back, ${data.admin?.firmName || 'Admin'}!`, 'success');
          }, 200);
        } else if (data.role === 'employee') {
          // Employee login
          localStorage.setItem('user', JSON.stringify(data.employee));
          localStorage.setItem('userRole', 'employee');
          setUser(data.employee);
          setUserRole('employee');
          setAdmin(null);
          if (data.employee?.preferences?.themeMode) {
            setThemeMode(data.employee.preferences.themeMode);
          }
          if (data.employee?.preferences?.mobileCardDensity) {
            localStorage.setItem('bharat_mobile_card_density', data.employee.preferences.mobileCardDensity);
          }
          
          setTimeout(() => {
            showToast(`Welcome back, ${data.employee?.name || 'Employee'}!`, 'success');
          }, 200);
        }
      } else {
        showToast(data?.message || 'Login failed', 'error');
      }
      
      return data;
    } catch (error) {
      // Removed showToast here to prevent duplicate error toast in LoginPage
      throw error;
    }
  };

  const logout = async () => {
    try {
      setAuthTransition('logout');
      clearClientCaches();
      await authService.logout();
      
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      localStorage.removeItem('bharat_mobile_card_density');
      setAdmin(null);
      setUser(null);
      setUserRole(null);
      
      setTimeout(() => {
        showToast('Successfully logged out', 'info');
        setAuthTransition(null);
      }, 500);
    } catch (error) {
      clearClientCaches();
      setAuthTransition(null);
      showToast('Logout failed. Please try again.', 'error');
    }
  };

  const updateAdmin = (adminData) => {
    localStorage.setItem('admin', JSON.stringify(adminData));
    localStorage.setItem('userRole', 'admin');
    setAdmin(adminData);
    setUser(adminData);
    setUserRole('admin');
    // Removed showToast here to prevent duplicate success toast in ProfilePage and RegisterPage
  };

  const updateUserPreferences = (newPreferences) => {
    setUser(prev => ({
      ...prev,
      preferences: { ...prev?.preferences, ...newPreferences }
    }));

    if (newPreferences?.themeMode) {
      setThemeMode(newPreferences.themeMode);
    }
    
    if (newPreferences?.mobileCardDensity) {
      localStorage.setItem('bharat_mobile_card_density', newPreferences.mobileCardDensity);
    }
    
    if (userRole === 'admin') {
      const updatedAdmin = { ...admin, preferences: { ...admin?.preferences, ...newPreferences } };
      localStorage.setItem('admin', JSON.stringify(updatedAdmin));
      setAdmin(updatedAdmin);
    } else if (userRole === 'employee') {
      const updatedEmployee = { ...user, preferences: { ...user?.preferences, ...newPreferences } };
      localStorage.setItem('user', JSON.stringify(updatedEmployee));
    }
  };

  // Check if current user is admin
  const isAdmin = () => userRole === 'admin';

  // Check if user has permission
  const hasPermission = useCallback((moduleName, action) => {
    if (userRole === 'admin') return true;
    if (!user || !user.permissions) return false;
    const modulePerms = user.permissions[moduleName];
    if (modulePerms !== undefined) {
      return !!modulePerms[action];
    }
    // Backward-compatibility fallback for legacy unconfigured sessions
    if (moduleName === 'collections') {
      return !!user.permissions.payments?.[action];
    }
    if (moduleName === 'ledger') {
      return !!user.permissions.inventory?.[action];
    }
    return false;
  }, [userRole, user]);

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
        updateUserPreferences,
        hasPermission,
        loading,
        showToast,
        authTransition
      }}
    >


      {/* Toast notifications container */}
      <div className="fixed top-4 right-4 z-[9999] pointer-events-none no-print">
        <AnimatePresence>
          {toast && (
            <Toast
              key={toast.message}
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Logout transition overlay - simplified for mobile */}
      <AnimatePresence>
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
                  <h3 className="text-xl font-semibold text-slate-100 mb-2">
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

      {/* Main content - always render so routes like /landing paint immediately for FCP */}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      admin: null,
      isAdmin: false,
      loading: false,
      userRole: null,
      hasPermission: () => false,
      showToast: () => {},
      logout: () => {},
      login: () => {},
    };
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
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
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

// Admin-only route wrapper
export const AdminRoute = ({ children }) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return <AppShellSkeleton />;
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
          <h2 className="text-2xl font-bold text-slate-100 mb-2">
            Admin Access Required
          </h2>
          <p className="text-slate-400 mb-6">
            This page is only accessible to administrators
          </p>
          <motion.button
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/'}
          >
            Go to Dashboard
          </motion.button>
        </motion.div>
      </motion.div>
    );
  }

  return children;
};

// Component for conditional rendering based on permissions
export const Can = ({ resource, action, children, fallback = null }) => {
  const { hasPermission, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (hasPermission(resource, action)) {
    return children;
  }

  return fallback;
};
