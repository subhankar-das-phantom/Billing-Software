import api, { cachedRequest, clearCache } from './api';

/**
 * Dashboard Service
 * Handles all dashboard and analytics-related API calls
 */
export const dashboardService = {
  /**
   * Get overall dashboard statistics
   * @param {object} params - Query parameters (startDate, endDate, refresh)
   * @returns {Promise<object>} - Dashboard statistics
   */
  getStats: async (params = {}) => {
    try {
      const { refresh = false, ...queryParams } = params;
      
      if (refresh) {
        const response = await api.get('/dashboard/stats', { params: queryParams });
        return response.data;
      }
      
      // Use cached data for 1 minute
      const { data } = await cachedRequest({
        method: 'GET',
        url: '/dashboard/stats',
        params: queryParams
      }, 60 * 1000);
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice count for a specific date range
   * @param {string} startDate - Start date ISO string
   * @param {string} endDate - End date ISO string
   * @returns {Promise<{count: number}>} - Invoice count
   */
  getInvoiceCount: async (startDate, endDate) => {
    try {
      const response = await api.get('/dashboard/invoice-count', {
        params: { startDate, endDate }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get low stock products
   * @param {number} threshold - Stock threshold (default: 10)
   * @param {object} params - Additional parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getLowStock: async (threshold = 10, params = {}) => {
    try {
      const response = await api.get('/dashboard/low-stock', {
        params: { threshold, ...params }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get expired products
   * @param {object} params - Query parameters
   * @returns {Promise<{products: array, total: number}>}
   */
  getExpiredProducts: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/expired-products', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get products expiring soon
   * @param {number} days - Days until expiry (default: 30)
   * @returns {Promise<{products: array, total: number}>}
   */
  getExpiringSoon: async (days = 30) => {
    try {
      const response = await api.get('/dashboard/expiring-soon', {
        params: { days }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get sales analytics
   * @param {object} params - Date range and filters (startDate, endDate, groupBy)
   * @returns {Promise<object>} - Sales analytics data
   */
  getSalesAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/sales-analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get revenue analytics
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Revenue analytics data
   */
  getRevenueAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/revenue-analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer analytics
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Customer analytics data
   */
  getCustomerAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/customer-analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get product analytics
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Product analytics data
   */
  getProductAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/product-analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get top selling products
   * @param {object} params - Query parameters (limit, startDate, endDate)
   * @returns {Promise<{products: array}>}
   */
  getTopSellingProducts: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/top-products', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get top customers
   * @param {object} params - Query parameters (limit, startDate, endDate)
   * @returns {Promise<{customers: array}>}
   */
  getTopCustomers: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/top-customers', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get recent activities
   * @param {object} params - Query parameters (limit, type)
   * @returns {Promise<{activities: array}>}
   */
  getRecentActivities: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/recent-activities', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get sales trends
   * @param {object} params - Date range and granularity (daily, weekly, monthly)
   * @returns {Promise<{trends: array}>}
   */
  getSalesTrends: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/sales-trends', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get inventory summary
   * @returns {Promise<object>} - Inventory summary
   */
  getInventorySummary: async () => {
    try {
      const { data } = await cachedRequest({
        method: 'GET',
        url: '/dashboard/inventory-summary'
      }, 2 * 60 * 1000); // 2 minute cache
      
      return data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice summary
   * @param {object} params - Date range
   * @returns {Promise<object>} - Invoice summary
   */
  getInvoiceSummary: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/invoice-summary', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get payment summary
   * @param {object} params - Date range
   * @returns {Promise<object>} - Payment summary
   */
  getPaymentSummary: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/payment-summary', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get GST summary
   * @param {object} params - Date range
   * @returns {Promise<object>} - GST summary
   */
  getGSTSummary: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/gst-summary', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Compare periods
   * @param {object} params - Date ranges to compare
   * @returns {Promise<object>} - Comparison data
   */
  comparePeriods: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/compare', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get performance metrics
   * @param {object} params - Date range
   * @returns {Promise<object>} - Performance metrics
   */
  getPerformanceMetrics: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/performance', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get alerts and notifications
   * @param {object} params - Filter parameters
   * @returns {Promise<{alerts: array, total: number}>}
   */
  getAlerts: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/alerts', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Export dashboard report
   * @param {object} params - Report parameters (format, dateRange, sections)
   * @returns {Promise<Blob>} - Report file blob
   */
  exportReport: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get real-time updates
   * @returns {Promise<object>} - Real-time data
   */
  getRealTimeUpdates: async () => {
    try {
      const response = await api.get('/dashboard/realtime');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get forecasts
   * @param {object} params - Forecast parameters (type, period)
   * @returns {Promise<object>} - Forecast data
   */
  getForecast: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/forecast', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get business insights
   * @param {object} params - Date range
   * @returns {Promise<object>} - Business insights
   */
  getInsights: async (params = {}) => {
    try {
      const response = await api.get('/dashboard/insights', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Refresh all dashboard data
   */
  refreshDashboard: () => {
    clearCache();
  }
};

/**
 * Dashboard Utilities
 */
export const dashboardUtils = {
  /**
   * Calculate growth rate
   * @param {number} current - Current value
   * @param {number} previous - Previous value
   * @returns {object} - Growth metrics
   */
  calculateGrowth: (current, previous) => {
    if (previous === 0) {
      return {
        absolute: current,
        percentage: current > 0 ? 100 : 0,
        trend: current > 0 ? 'up' : 'flat'
      };
    }

    const absolute = current - previous;
    const percentage = ((absolute / previous) * 100).toFixed(2);
    const trend = absolute > 0 ? 'up' : absolute < 0 ? 'down' : 'flat';

    return {
      absolute,
      percentage: parseFloat(percentage),
      trend
    };
  },

  /**
   * Format chart data for visualization
   * @param {array} data - Raw data
   * @param {string} xKey - X-axis key
   * @param {string} yKey - Y-axis key
   * @returns {array} - Formatted chart data
   */
  formatChartData: (data, xKey, yKey) => {
    return data.map(item => ({
      x: item[xKey],
      y: item[yKey],
      label: item.label || item[xKey]
    }));
  },

  /**
   * Group data by time period
   * @param {array} data - Raw data
   * @param {string} period - Grouping period (day, week, month, year)
   * @param {string} dateKey - Date field key
   * @returns {array} - Grouped data
   */
  groupByPeriod: (data, period, dateKey = 'date') => {
    const groups = {};

    data.forEach(item => {
      const date = new Date(item[dateKey]);
      let key;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const week = dashboardUtils.getWeekNumber(date);
          key = `${date.getFullYear()}-W${week}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = date.toISOString();
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
    });

    return Object.entries(groups).map(([key, items]) => ({
      period: key,
      items,
      count: items.length
    }));
  },

  /**
   * Get week number
   * @param {Date} date
   * @returns {number} - Week number
   */
  getWeekNumber: (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  /**
   * Calculate moving average
   * @param {array} data - Array of numbers
   * @param {number} period - Period for moving average
   * @returns {array} - Moving averages
   */
  calculateMovingAverage: (data, period = 7) => {
    const result = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(null);
        continue;
      }

      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }

    return result;
  },

  /**
   * Get date range presets
   * @returns {object} - Date range presets
   */
  getDateRangePresets: () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const thisYearStart = new Date(today.getFullYear(), 0, 1);
    const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);

    return {
      today: { start: today, end: today, label: 'Today' },
      yesterday: { start: yesterday, end: yesterday, label: 'Yesterday' },
      last7Days: { start: last7Days, end: today, label: 'Last 7 Days' },
      last30Days: { start: last30Days, end: today, label: 'Last 30 Days' },
      thisMonth: { start: thisMonthStart, end: today, label: 'This Month' },
      lastMonth: { start: lastMonthStart, end: lastMonthEnd, label: 'Last Month' },
      thisYear: { start: thisYearStart, end: today, label: 'This Year' },
      lastYear: { start: lastYearStart, end: lastYearEnd, label: 'Last Year' }
    };
  },

  /**
   * Format date for API
   * @param {Date} date
   * @returns {string} - Formatted date (YYYY-MM-DD)
   */
  formatDateForAPI: (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Calculate KPIs
   * @param {object} data - Dashboard data
   * @returns {object} - KPI metrics
   */
  calculateKPIs: (data) => {
    const {
      totalSales = 0,
      totalOrders = 0,
      totalCustomers = 0,
      newCustomers = 0,
      totalProducts = 0,
      lowStockProducts = 0,
      previousTotalSales = 0,
      previousTotalOrders = 0
    } = data;

    return {
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      customerAcquisitionRate: totalCustomers > 0 ? (newCustomers / totalCustomers) * 100 : 0,
      inventoryTurnover: totalProducts > 0 ? totalOrders / totalProducts : 0,
      stockHealthScore: totalProducts > 0 ? ((totalProducts - lowStockProducts) / totalProducts) * 100 : 0,
      salesGrowth: dashboardUtils.calculateGrowth(totalSales, previousTotalSales),
      orderGrowth: dashboardUtils.calculateGrowth(totalOrders, previousTotalOrders)
    };
  },

  /**
   * Generate color palette for charts
   * @param {number} count - Number of colors needed
   * @returns {array} - Array of color codes
   */
  generateColorPalette: (count) => {
    const baseColors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // violet
      '#ec4899', // pink
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f97316', // orange
      '#6366f1'  // indigo
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    // Generate additional colors if needed
    const colors = [...baseColors];
    while (colors.length < count) {
      const hue = (colors.length * 137.508) % 360; // Golden angle
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }

    return colors;
  },

  /**
   * Calculate percentiles
   * @param {array} data - Array of numbers
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} - Percentile value
   */
  calculatePercentile: (data, percentile) => {
    if (data.length === 0) return 0;

    const sorted = [...data].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  },

  /**
   * Detect anomalies in data
   * @param {array} data - Array of numbers
   * @param {number} threshold - Standard deviation threshold
   * @returns {array} - Indices of anomalies
   */
  detectAnomalies: (data, threshold = 2) => {
    if (data.length < 3) return [];

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);

    const anomalies = [];
    data.forEach((value, index) => {
      const zScore = Math.abs((value - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({ index, value, zScore });
      }
    });

    return anomalies;
  },

  /**
   * Format number with suffix (K, M, B)
   * @param {number} num
   * @returns {string}
   */
  formatNumberShort: (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
  },

  /**
   * Get trend indicator
   * @param {number} value
   * @param {number} threshold
   * @returns {object} - Trend info
   */
  getTrendIndicator: (value, threshold = 0) => {
    if (value > threshold) {
      return { direction: 'up', icon: '↑', color: 'green', label: 'Increase' };
    } else if (value < threshold) {
      return { direction: 'down', icon: '↓', color: 'red', label: 'Decrease' };
    }
    return { direction: 'flat', icon: '→', color: 'gray', label: 'No Change' };
  }
};

/**
 * Dashboard Charts Configuration
 */
export const dashboardCharts = {
  /**
   * Line chart configuration
   * @param {object} data
   * @returns {object} - Chart config
   */
  lineChart: (data) => ({
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: { enabled: true }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  }),

  /**
   * Bar chart configuration
   * @param {object} data
   * @returns {object} - Chart config
   */
  barChart: (data) => ({
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  }),

  /**
   * Pie chart configuration
   * @param {object} data
   * @returns {object} - Chart config
   */
  pieChart: (data) => ({
    type: 'pie',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right' },
        tooltip: { enabled: true }
      }
    }
  }),

  /**
   * Doughnut chart configuration
   * @param {object} data
   * @returns {object} - Chart config
   */
  doughnutChart: (data) => ({
    type: 'doughnut',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right' },
        tooltip: { enabled: true }
      },
      cutout: '70%'
    }
  })
};

export default dashboardService;
