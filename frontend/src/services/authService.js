import api from './api';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
export const authService = {
  /**
   * Login user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, admin: object, message: string}>}
   */
  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Store JWT token and user info in localStorage
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.admin) {
        localStorage.setItem('admin', JSON.stringify(response.data.admin));
        localStorage.setItem('lastLoginTime', Date.now().toString());
      }
      
      return response.data;
    } catch (error) {
      // Clear any stale auth data on failed login
      localStorage.removeItem('admin');
      localStorage.removeItem('lastLoginTime');
      throw error;
    }
  },

  /**
   * Register new user account
   * @param {object} userData - User registration data
   * @returns {Promise<{success: boolean, admin: object, message: string}>}
   */
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      
      // Store JWT token and user info in localStorage
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.admin) {
        localStorage.setItem('admin', JSON.stringify(response.data.admin));
        localStorage.setItem('lastLoginTime', Date.now().toString());
        localStorage.setItem('userRole', 'admin');
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Login employee with email and password
   * @param {string} email - Email
   * @param {string} password - User password
   * @returns {Promise<{success: boolean, role: string, employee: object}>}
   */
  employeeLogin: async (email, password) => {
    try {
      const response = await api.post('/auth/employee/login', { email, password });
      
      // Store JWT token and employee info in localStorage
      if (response.data?.token) {
        localStorage.setItem('token', response.data.token);
      }
      if (response.data?.employee) {
        localStorage.setItem('user', JSON.stringify(response.data.employee));
        localStorage.setItem('lastLoginTime', Date.now().toString());
        localStorage.setItem('userRole', 'employee');
      }
      
      return response.data;
    } catch (error) {
      localStorage.removeItem('user');
      localStorage.removeItem('lastLoginTime');
      localStorage.removeItem('userRole');
      throw error;
    }
  },

  /**
   * Get current authenticated user information
   * @returns {Promise<{success: boolean, admin: object}>}
   */
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');
      
      // Update stored user info
      if (response.data?.admin) {
        localStorage.setItem('admin', JSON.stringify(response.data.admin));
      }
      
      return response.data;
    } catch (error) {
      // Clear auth data if user is not authenticated
      if (error.response?.status === 401) {
        localStorage.removeItem('admin');
        localStorage.removeItem('lastLoginTime');
      }
      throw error;
    }
  },

  /**
   * Update user profile information
   * @param {object} data - Profile data to update
   * @returns {Promise<{success: boolean, admin: object, message: string}>}
   */
  updateProfile: async (data) => {
    try {
      const response = await api.put('/auth/profile', data);
      
      // Update stored user info with new profile data
      if (response.data?.admin) {
        localStorage.setItem('admin', JSON.stringify(response.data.admin));
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Change user password
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<{success: boolean, message: string}>}
   */
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Logout user and clear session
   * @returns {Promise<{success: boolean, message: string}>}
   */
  logout: async () => {
    try {
      // Call backend to clear HTTP-only cookie
      const response = await api.post('/auth/logout');
      
      // Clear all auth-related data from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      localStorage.removeItem('lastLoginTime');
      sessionStorage.removeItem('redirectAfterLogin');
      
      return response.data;
    } catch (error) {
      // Even if backend call fails, clear local data
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      localStorage.removeItem('user');
      localStorage.removeItem('userRole');
      localStorage.removeItem('lastLoginTime');
      sessionStorage.removeItem('redirectAfterLogin');
      
      throw error;
    }
  },

  /**
   * Send heartbeat to keep session alive and update lastActivityAt
   * @returns {Promise<{success: boolean}>}
   */
  heartbeat: async () => {
    try {
      const response = await api.post('/auth/heartbeat');
      return response.data;
    } catch (error) {
      // Silently fail - heartbeat errors shouldn't interrupt user
      console.warn('Heartbeat failed:', error.message);
      return { success: false };
    }
  },

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<{success: boolean, message: string}>}
   */
  requestPasswordReset: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Reset password with token
   * @param {string} token - Reset token from email
   * @param {string} newPassword - New password
   * @returns {Promise<{success: boolean, message: string}>}
   */
  resetPassword: async (token, newPassword) => {
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Verify user session validity
   * @returns {Promise<boolean>}
   */
  verifySession: async () => {
    try {
      const response = await api.get('/auth/verify');
      return response.data?.valid || false;
    } catch (error) {
      return false;
    }
  },

  /**
   * Refresh authentication token (if using JWT)
   * @returns {Promise<{success: boolean, token: string}>}
   */
  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get stored user from localStorage
   * @returns {object|null} - User object or null
   */
  getStoredUser: () => {
    try {
      const adminData = localStorage.getItem('admin');
      return adminData ? JSON.parse(adminData) : null;
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      localStorage.removeItem('admin');
      return null;
    }
  },

  /**
   * Check if user is authenticated (client-side check)
   * Note: This is not secure, always verify with backend
   * @returns {boolean}
   */
  isAuthenticated: () => {
    const admin = authService.getStoredUser();
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    
    if (!admin || !lastLoginTime) {
      return false;
    }

    // Check if session is older than 24 hours (client-side only)
    const sessionAge = Date.now() - parseInt(lastLoginTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionAge > maxAge) {
      // Clear stale session
      localStorage.removeItem('admin');
      localStorage.removeItem('lastLoginTime');
      return false;
    }

    return true;
  },

  /**
   * Clear all authentication data
   */
  clearAuthData: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('lastLoginTime');
    sessionStorage.removeItem('redirectAfterLogin');
  },

  /**
   * Get session info
   * @returns {object} - Session information
   */
  getSessionInfo: () => {
    const admin = authService.getStoredUser();
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    
    if (!admin || !lastLoginTime) {
      return null;
    }

    const loginTimestamp = parseInt(lastLoginTime);
    const sessionAge = Date.now() - loginTimestamp;
    const sessionAgeMinutes = Math.floor(sessionAge / 60000);
    
    return {
      user: admin,
      loginTime: new Date(loginTimestamp),
      sessionAge: sessionAgeMinutes,
      isActive: authService.isAuthenticated()
    };
  },

  /**
   * Update user activity timestamp
   */
  updateActivity: () => {
    if (authService.isAuthenticated()) {
      localStorage.setItem('lastActivityTime', Date.now().toString());
    }
  },

  /**
   * Check if session is about to expire (within 30 minutes)
   * @returns {boolean}
   */
  isSessionExpiring: () => {
    const lastLoginTime = localStorage.getItem('lastLoginTime');
    
    if (!lastLoginTime) {
      return false;
    }

    const sessionAge = Date.now() - parseInt(lastLoginTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const warningThreshold = 30 * 60 * 1000; // 30 minutes before expiry
    
    return sessionAge > (maxAge - warningThreshold);
  }
};

/**
 * Auth Utilities
 */
export const authUtils = {
  /**
   * Validate email format
   * @param {string} email 
   * @returns {boolean}
   */
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * @param {string} password 
   * @returns {{valid: boolean, errors: string[]}}
   */
  validatePassword: (password) => {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Get password strength level
   * @param {string} password 
   * @returns {{level: string, score: number, color: string}}
   */
  getPasswordStrength: (password) => {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    
    const levels = {
      0: { level: 'Very Weak', color: 'red' },
      1: { level: 'Weak', color: 'red' },
      2: { level: 'Fair', color: 'orange' },
      3: { level: 'Good', color: 'yellow' },
      4: { level: 'Strong', color: 'green' },
      5: { level: 'Very Strong', color: 'green' },
      6: { level: 'Excellent', color: 'emerald' }
    };
    
    return { ...levels[score], score };
  },

  /**
   * Sanitize user input
   * @param {string} input 
   * @returns {string}
   */
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  },

  /**
   * Generate secure random string
   * @param {number} length 
   * @returns {string}
   */
  generateRandomString: (length = 32) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    
    return result;
  }
};

/**
 * Auth event emitter for cross-tab synchronization
 */
export const authEvents = {
  /**
   * Listen for logout events from other tabs
   */
  listenForLogout: (callback) => {
    const handleStorageChange = (e) => {
      if (e.key === 'admin' && e.newValue === null) {
        callback();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  },

  /**
   * Listen for login events from other tabs
   */
  listenForLogin: (callback) => {
    const handleStorageChange = (e) => {
      if (e.key === 'admin' && e.newValue !== null) {
        try {
          const admin = JSON.parse(e.newValue);
          callback(admin);
        } catch (error) {
          console.error('Error parsing admin data:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }
};

export default authService;
