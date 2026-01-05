import api from './api';

/**
 * Employee Service
 * Handles all employee management and analytics API calls
 * All endpoints are admin-only
 */
export const employeeService = {
  // ==========================================
  // Employee CRUD Operations
  // ==========================================

  /**
   * Get all employees with pagination and search
   * @param {object} params - Query parameters
   * @returns {Promise<{success: boolean, employees: array, total: number}>}
   */
  getEmployees: async (params = {}) => {
    try {
      const response = await api.get('/employees', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get single employee by ID with recent sessions
   * @param {string} id - Employee ID
   * @returns {Promise<{success: boolean, employee: object, recentSessions: array}>}
   */
  getEmployee: async (id) => {
    try {
      const response = await api.get(`/employees/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new employee
   * @param {object} data - Employee data (email, userId, password, name, phone)
   * @returns {Promise<{success: boolean, employee: object}>}
   */
  createEmployee: async (data) => {
    try {
      const response = await api.post('/employees', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update employee profile
   * @param {string} id - Employee ID
   * @param {object} data - Updated employee data
   * @returns {Promise<{success: boolean, employee: object}>}
   */
  updateEmployee: async (id, data) => {
    try {
      const response = await api.put(`/employees/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Reset employee password
   * @param {string} id - Employee ID
   * @param {string} newPassword - New password
   * @returns {Promise<{success: boolean, message: string}>}
   */
  resetPassword: async (id, newPassword) => {
    try {
      const response = await api.put(`/employees/${id}/password`, { newPassword });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Toggle employee active status
   * @param {string} id - Employee ID
   * @param {boolean} isActive - New status
   * @returns {Promise<{success: boolean, employee: object}>}
   */
  toggleStatus: async (id, isActive) => {
    try {
      const response = await api.put(`/employees/${id}/status`, { isActive });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete (deactivate) employee
   * @param {string} id - Employee ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteEmployee: async (id) => {
    try {
      const response = await api.delete(`/employees/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // ==========================================
  // Analytics Endpoints
  // ==========================================

  /**
   * Get all employees with analytics summary
   * @returns {Promise<{success: boolean, employees: array}>}
   */
  getEmployeeAnalytics: async () => {
    try {
      const response = await api.get('/analytics/employees');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get detailed analytics for single employee
   * @param {string} id - Employee ID
   * @returns {Promise<{success: boolean, employee: object, sessionStats: object, recentActivity: object}>}
   */
  getEmployeeDetails: async (id) => {
    try {
      const response = await api.get(`/analytics/employees/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get employee session history
   * @param {string} id - Employee ID
   * @param {object} params - Query params (page, limit, startDate, endDate)
   * @returns {Promise<{success: boolean, sessions: array, total: number}>}
   */
  getEmployeeSessions: async (id, params = {}) => {
    try {
      const response = await api.get(`/analytics/employees/${id}/sessions`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get employee performance comparison
   * @param {number} days - Number of days for comparison period (default: 30)
   * @returns {Promise<{success: boolean, period: object, employees: array}>}
   */
  getEmployeeComparison: async (days = 30) => {
    try {
      const response = await api.get('/analytics/employees/comparison', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get overall session summary
   * @returns {Promise<{success: boolean, activeSessions: array, stats: object}>}
   */
  getSessionSummary: async () => {
    try {
      const response = await api.get('/analytics/sessions/summary');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get detailed activity log with session and work attribution
   * @param {number} hours - Time range in hours (default: 24, max: 72)
   * @param {string} employeeId - Optional employee filter
   * @returns {Promise<{success: boolean, timeRange: object, log: array}>}
   */
  getActivityLog: async (hours = 24, employeeId = null) => {
    try {
      const params = { hours };
      if (employeeId) params.employeeId = employeeId;
      const response = await api.get('/analytics/activity-log', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default employeeService;
