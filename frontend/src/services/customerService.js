import api, { cachedRequest, clearCache } from './api';

/**
 * Customer Service
 * Handles all customer-related API calls
 */
export const customerService = {
  /**
   * Get list of customers with optional filters
   * @param {object} params - Query parameters (search, page, limit, sortBy, sortOrder)
   * @returns {Promise<{customers: array, total: number, pages: number}>}
   */
  getCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer by ID with caching
   * @param {string} id - Customer ID
   * @param {boolean} useCache - Use cached data if available
   * @returns {Promise<{customer: object, invoices: array}>}
   */
  getCustomer: async (id, useCache = true) => {
    try {
      if (useCache) {
        const { data } = await cachedRequest({
          method: 'GET',
          url: `/customers/${id}`
        }, 2 * 60 * 1000); // 2 minute cache
        return data;
      }
      
      const response = await api.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new customer
   * @param {object} data - Customer data
   * @returns {Promise<{success: boolean, customer: object, message: string}>}
   */
  createCustomer: async (data) => {
    try {
      // Validation and sanitization bypassed
      // const validationErrors = customerUtils.validateCustomerData(data);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }
      // const sanitizedData = customerUtils.sanitizeCustomerData(data);
      
      const response = await api.post('/customers', data);
      
      // Clear cache after creation
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update existing customer
   * @param {string} id - Customer ID
   * @param {object} data - Updated customer data
   * @returns {Promise<{success: boolean, customer: object, message: string}>}
   */
  updateCustomer: async (id, data) => {
    try {
      // Validation and sanitization bypassed
      // const validationErrors = customerUtils.validateCustomerData(data, false);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }
      // const sanitizedData = customerUtils.sanitizeCustomerData(data);
      
      const response = await api.put(`/customers/${id}`, data);
      
      // Clear cache after update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete customer
   * @param {string} id - Customer ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteCustomer: async (id) => {
    try {
      const response = await api.delete(`/customers/${id}`);
      
      // Clear cache after deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Search customers by query
   * @param {string} query - Search query
   * @param {object} options - Search options (field, exact)
   * @returns {Promise<{customers: array, total: number}>}
   */
  searchCustomers: async (query, options = {}) => {
    try {
      const params = { 
        q: query,
        ...options
      };
      
      const response = await api.get('/customers/search', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer statistics
   * @param {string} id - Customer ID
   * @returns {Promise<object>} - Customer statistics
   */
  getCustomerStats: async (id) => {
    try {
      const response = await api.get(`/customers/${id}/stats`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer invoices
   * @param {string} id - Customer ID
   * @param {object} params - Query parameters
   * @returns {Promise<{invoices: array, total: number}>}
   */
  getCustomerInvoices: async (id, params = {}) => {
    try {
      const response = await api.get(`/customers/${id}/invoices`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer purchase history
   * @param {string} id - Customer ID
   * @param {object} params - Query parameters (startDate, endDate)
   * @returns {Promise<{purchases: array, total: number}>}
   */
  getCustomerPurchaseHistory: async (id, params = {}) => {
    try {
      const response = await api.get(`/customers/${id}/purchases`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get top customers by purchase amount
   * @param {object} params - Query parameters (limit, startDate, endDate)
   * @returns {Promise<{customers: array}>}
   */
  getTopCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers/top', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk create customers
   * @param {array} customers - Array of customer data
   * @returns {Promise<{success: boolean, created: number, failed: number, errors: array}>}
   */
  bulkCreateCustomers: async (customers) => {
    try {
      // Validate all customers
      const validCustomers = [];
      const errors = [];

      customers.forEach((customer, index) => {
        const validationErrors = customerUtils.validateCustomerData(customer);
        if (validationErrors.length > 0) {
          errors.push({ index, errors: validationErrors });
        } else {
          validCustomers.push(customerUtils.sanitizeCustomerData(customer));
        }
      });

      const response = await api.post('/customers/bulk', { customers: validCustomers });
      
      // Clear cache after bulk creation
      clearCache();
      
      return {
        ...response.data,
        validationErrors: errors
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk update customers
   * @param {array} updates - Array of {id, data} objects
   * @returns {Promise<{success: boolean, updated: number, failed: number}>}
   */
  bulkUpdateCustomers: async (updates) => {
    try {
      const response = await api.put('/customers/bulk', { updates });
      
      // Clear cache after bulk update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk delete customers
   * @param {array} ids - Array of customer IDs
   * @returns {Promise<{success: boolean, deleted: number, failed: number}>}
   */
  bulkDeleteCustomers: async (ids) => {
    try {
      const response = await api.delete('/customers/bulk', { data: { ids } });
      
      // Clear cache after bulk deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Export customers to CSV
   * @param {object} params - Export parameters (filters, fields)
   * @returns {Promise<Blob>} - CSV file blob
   */
  exportCustomers: async (params = {}) => {
    try {
      const response = await api.get('/customers/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Import customers from CSV
   * @param {File} file - CSV file
   * @returns {Promise<{success: boolean, imported: number, failed: number, errors: array}>}
   */
  importCustomers: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/customers/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Clear cache after import
      clearCache();

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Merge duplicate customers
   * @param {string} primaryId - Primary customer ID (to keep)
   * @param {string} secondaryId - Secondary customer ID (to merge and delete)
   * @returns {Promise<{success: boolean, customer: object}>}
   */
  mergeCustomers: async (primaryId, secondaryId) => {
    try {
      const response = await api.post('/customers/merge', {
        primaryId,
        secondaryId
      });

      // Clear cache after merge
      clearCache();

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer insights and analytics
   * @param {string} id - Customer ID
   * @returns {Promise<object>} - Customer insights
   */
  getCustomerInsights: async (id) => {
    try {
      const response = await api.get(`/customers/${id}/insights`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check for duplicate customers
   * @param {object} data - Customer data to check
   * @returns {Promise<{duplicates: array, hasDuplicates: boolean}>}
   */
  checkDuplicates: async (data) => {
    try {
      const response = await api.post('/customers/check-duplicates', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Send notification to customer
   * @param {string} id - Customer ID
   * @param {object} notification - Notification data (type, message, channel)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  sendNotification: async (id, notification) => {
    try {
      const response = await api.post(`/customers/${id}/notify`, notification);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

/**
 * Customer Validation and Utility Functions
 */
export const customerUtils = {
  /**
   * Validate customer data
   * @param {object} data - Customer data
   * @param {boolean} isNew - Is this a new customer (requires all fields)
   * @returns {array} - Array of validation errors
   */
  validateCustomerData: (data, isNew = true) => {
    const errors = [];

    // Required fields validation
    if (isNew || data.customerName !== undefined) {
      if (!data.customerName || data.customerName.trim().length === 0) {
        errors.push('Customer name is required');
      } else if (data.customerName.length > 100) {
        errors.push('Customer name must be less than 100 characters');
      }
    }

    if (isNew || data.phone !== undefined) {
      if (!data.phone) {
        errors.push('Phone number is required');
      } else if (!customerUtils.isValidPhone(data.phone)) {
        errors.push('Invalid phone number format');
      }
    }

    // Optional fields validation
    if (data.email && !customerUtils.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    if (data.gstin && !customerUtils.isValidGSTIN(data.gstin)) {
      errors.push('Invalid GSTIN format');
    }

    if (data.dlNo && data.dlNo.length > 50) {
      errors.push('DL Number must be less than 50 characters');
    }

    if (data.address && data.address.length > 500) {
      errors.push('Address must be less than 500 characters');
    }

    if (data.customerCode && data.customerCode.length > 20) {
      errors.push('Customer code must be less than 20 characters');
    }

    return errors;
  },

  /**
   * Sanitize customer data
   * @param {object} data - Customer data
   * @returns {object} - Sanitized data
   */
  sanitizeCustomerData: (data) => {
    const sanitized = {};

    if (data.customerName) {
      sanitized.customerName = data.customerName.trim();
    }

    if (data.phone) {
      sanitized.phone = data.phone.replace(/\D/g, ''); // Remove non-digits
    }

    if (data.email) {
      sanitized.email = data.email.trim().toLowerCase();
    }

    if (data.gstin) {
      sanitized.gstin = data.gstin.trim().toUpperCase();
    }

    if (data.dlNo) {
      sanitized.dlNo = data.dlNo.trim();
    }

    if (data.address) {
      sanitized.address = data.address.trim();
    }

    if (data.customerCode) {
      sanitized.customerCode = data.customerCode.trim();
    }

    return sanitized;
  },

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
   * Validate Indian phone number
   * @param {string} phone
   * @returns {boolean}
   */
  isValidPhone: (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    // Indian phone: 10 digits, optionally with country code
    return /^(\+91|91)?[6-9]\d{9}$/.test(cleanPhone);
  },

  /**
   * Validate GSTIN format
   * @param {string} gstin
   * @returns {boolean}
   */
  isValidGSTIN: (gstin) => {
    // GSTIN format: 2 digit state code + 10 digit PAN + 1 digit entity number + Z + 1 digit checksum
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  },

  /**
   * Format phone number for display
   * @param {string} phone
   * @returns {string}
   */
  formatPhone: (phone) => {
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length === 10) {
      return cleanPhone.replace(/(\d{5})(\d{5})/, '$1-$2');
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      return `+91 ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7)}`;
    }
    
    return phone;
  },

  /**
   * Parse CSV file for import
   * @param {File} file
   * @returns {Promise<array>} - Array of customer objects
   */
  parseCSV: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          const customers = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(v => v.trim());
            const customer = {};
            
            headers.forEach((header, index) => {
              customer[header] = values[index] || '';
            });
            
            customers.push(customer);
          }
          
          resolve(customers);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  /**
   * Generate CSV from customers
   * @param {array} customers
   * @returns {string} - CSV content
   */
  generateCSV: (customers) => {
    if (customers.length === 0) return '';

    const headers = ['customerName', 'phone', 'email', 'gstin', 'dlNo', 'address', 'customerCode'];
    const csvHeaders = headers.join(',');
    
    const csvRows = customers.map(customer => {
      return headers.map(header => {
        const value = customer[header] || '';
        // Escape commas and quotes
        return `"${value.toString().replace(/"/g, '""')}"`;
      }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
  },

  /**
   * Download CSV file
   * @param {string} csvContent
   * @param {string} filename
   */
  downloadCSV: (csvContent, filename = 'customers.csv') => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  },

  /**
   * Group customers by criteria
   * @param {array} customers
   * @param {string} criteria - 'location', 'purchaseRange', 'status'
   * @returns {object} - Grouped customers
   */
  groupCustomers: (customers, criteria) => {
    const groups = {};
    
    customers.forEach(customer => {
      let key;
      
      switch (criteria) {
        case 'location':
          // Extract city from address (simplified)
          key = customer.address?.split(',').pop()?.trim() || 'Unknown';
          break;
          
        case 'purchaseRange':
          const amount = customer.totalPurchases || 0;
          if (amount === 0) key = 'No Purchases';
          else if (amount < 10000) key = '< ₹10,000';
          else if (amount < 50000) key = '₹10,000 - ₹50,000';
          else if (amount < 100000) key = '₹50,000 - ₹1,00,000';
          else key = '> ₹1,00,000';
          break;
          
        case 'status':
          const daysSinceLastPurchase = customer.daysSinceLastPurchase || 0;
          if (daysSinceLastPurchase === 0) key = 'New';
          else if (daysSinceLastPurchase < 30) key = 'Active';
          else if (daysSinceLastPurchase < 90) key = 'Inactive';
          else key = 'Dormant';
          break;
          
        default:
          key = 'Other';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(customer);
    });
    
    return groups;
  },

  /**
   * Sort customers by field
   * @param {array} customers
   * @param {string} field
   * @param {string} order - 'asc' or 'desc'
   * @returns {array} - Sorted customers
   */
  sortCustomers: (customers, field, order = 'asc') => {
    return [...customers].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal > bVal ? 1 : -1;
      return order === 'asc' ? comparison : -comparison;
    });
  },

  /**
   * Filter customers by criteria
   * @param {array} customers
   * @param {object} filters
   * @returns {array} - Filtered customers
   */
  filterCustomers: (customers, filters) => {
    return customers.filter(customer => {
      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          customer.customerName,
          customer.phone,
          customer.email,
          customer.gstin
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }
      
      // Purchase range filter
      if (filters.minPurchase !== undefined) {
        if ((customer.totalPurchases || 0) < filters.minPurchase) return false;
      }
      
      if (filters.maxPurchase !== undefined) {
        if ((customer.totalPurchases || 0) > filters.maxPurchase) return false;
      }
      
      // Invoice count filter
      if (filters.minInvoices !== undefined) {
        if ((customer.invoiceCount || 0) < filters.minInvoices) return false;
      }
      
      return true;
    });
  },

  /**
   * Calculate customer lifetime value
   * @param {object} customer
   * @returns {object} - LTV metrics
   */
  calculateLTV: (customer) => {
    const totalPurchases = customer.totalPurchases || 0;
    const invoiceCount = customer.invoiceCount || 0;
    const avgOrderValue = invoiceCount > 0 ? totalPurchases / invoiceCount : 0;
    
    // Estimate based on purchase frequency
    const daysSinceFirst = customer.daysSinceFirstPurchase || 0;
    const purchaseFrequency = daysSinceFirst > 0 ? (invoiceCount / daysSinceFirst) * 365 : 0;
    
    // Simple LTV estimation (can be made more sophisticated)
    const estimatedYears = 3; // Average customer lifespan
    const estimatedLTV = avgOrderValue * purchaseFrequency * estimatedYears;
    
    return {
      totalPurchases,
      invoiceCount,
      avgOrderValue,
      purchaseFrequency,
      estimatedLTV,
      ltv: estimatedLTV
    };
  }
};

/**
 * Customer Analytics
 */
export const customerAnalytics = {
  /**
   * Get customer segments
   * @param {array} customers
   * @returns {object} - Customer segments
   */
  getSegments: (customers) => {
    const segments = {
      champions: [], // High value, frequent
      loyalCustomers: [], // Frequent purchases
      potentialLoyalists: [], // Recent, moderate purchases
      newCustomers: [], // Recent first purchase
      atRisk: [], // Haven't purchased recently
      cantLose: [], // High value but inactive
      hibernating: [], // Long time since purchase
      lost: [] // Very long time since purchase
    };
    
    customers.forEach(customer => {
      const recency = customer.daysSinceLastPurchase || 999;
      const frequency = customer.invoiceCount || 0;
      const monetary = customer.totalPurchases || 0;
      
      if (recency <= 30 && frequency >= 10 && monetary >= 50000) {
        segments.champions.push(customer);
      } else if (recency <= 60 && frequency >= 5) {
        segments.loyalCustomers.push(customer);
      } else if (recency <= 30 && frequency >= 2) {
        segments.potentialLoyalists.push(customer);
      } else if (recency <= 30 && frequency === 1) {
        segments.newCustomers.push(customer);
      } else if (recency > 60 && recency <= 120 && frequency >= 3) {
        segments.atRisk.push(customer);
      } else if (recency > 60 && monetary >= 50000) {
        segments.cantLose.push(customer);
      } else if (recency > 120 && recency <= 180) {
        segments.hibernating.push(customer);
      } else if (recency > 180) {
        segments.lost.push(customer);
      }
    });
    
    return segments;
  },

  /**
   * Calculate customer churn rate
   * @param {array} customers
   * @param {number} days - Days to consider as churned
   * @returns {object} - Churn metrics
   */
  calculateChurnRate: (customers, days = 90) => {
    const total = customers.length;
    const churned = customers.filter(c => 
      (c.daysSinceLastPurchase || 0) > days
    ).length;
    
    return {
      total,
      churned,
      churnRate: total > 0 ? (churned / total) * 100 : 0,
      retained: total - churned,
      retentionRate: total > 0 ? ((total - churned) / total) * 100 : 0
    };
  }
};

export default customerService;
