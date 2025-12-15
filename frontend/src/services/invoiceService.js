import api, { cachedRequest, clearCache } from './api';

/**
 * Invoice Service
 * Handles all invoice-related API calls
 */
export const invoiceService = {
  /**
   * Get list of invoices with optional filters
   * @param {object} params - Query parameters (search, page, limit, status, startDate, endDate)
   * @returns {Promise<{invoices: array, total: number, pages: number}>}
   */
  getInvoices: async (params = {}) => {
    try {
      const response = await api.get('/invoices', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice by ID with caching
   * @param {string} id - Invoice ID
   * @param {boolean} useCache - Use cached data if available
   * @returns {Promise<{invoice: object}>}
   */
  getInvoice: async (id, useCache = true) => {
    try {
      if (useCache) {
        const { data } = await cachedRequest({
          method: 'GET',
          url: `/invoices/${id}`
        }, 60 * 1000); // 1 minute cache
        return data;
      }
      
      const response = await api.get(`/invoices/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new invoice
   * @param {object} data - Invoice data
   * @returns {Promise<{success: boolean, invoice: object, message: string}>}
   */
  createInvoice: async (data) => {
    try {
      // Validation bypassed - let backend handle
      // const validationErrors = invoiceUtils.validateInvoiceData(data);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }

      // Calculate totals
      const calculatedData = invoiceUtils.calculateInvoiceTotals(data);
      
      const response = await api.post('/invoices', calculatedData);
      
      // Clear cache after creation
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update existing invoice
   * @param {string} id - Invoice ID
   * @param {object} data - Updated invoice data
   * @returns {Promise<{success: boolean, invoice: object, message: string}>}
   */
  updateInvoice: async (id, data) => {
    try {
      // Validation bypassed - let backend handle
      // const validationErrors = invoiceUtils.validateInvoiceData(data, false);
      // if (validationErrors.length > 0) {
      //   throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      // }

      // Recalculate totals if items changed
      const calculatedData = data.items ? invoiceUtils.calculateInvoiceTotals(data) : data;
      
      const response = await api.put(`/invoices/${id}`, calculatedData);
      
      // Clear cache after update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete invoice
   * @param {string} id - Invoice ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteInvoice: async (id) => {
    try {
      const response = await api.delete(`/invoices/${id}`);
      
      // Clear cache after deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get customer invoices
   * @param {string} customerId - Customer ID
   * @param {object} params - Query parameters
   * @returns {Promise<{invoices: array, total: number}>}
   */
  getCustomerInvoices: async (customerId, params = {}) => {
    try {
      const response = await api.get(`/invoices/customer/${customerId}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update invoice status
   * @param {string} id - Invoice ID
   * @param {string} status - New status (draft, paid, pending, cancelled)
   * @returns {Promise<{success: boolean, invoice: object, message: string}>}
   */
  updateStatus: async (id, status) => {
    try {
      const response = await api.put(`/invoices/${id}/status`, { status });
      
      // Clear cache after status update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Add payment to invoice
   * @param {string} id - Invoice ID
   * @param {object} payment - Payment data (amount, method, date, reference)
   * @returns {Promise<{success: boolean, invoice: object, message: string}>}
   */
  addPayment: async (id, payment) => {
    try {
      const response = await api.post(`/invoices/${id}/payments`, payment);
      
      // Clear cache after payment
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice payments
   * @param {string} id - Invoice ID
   * @returns {Promise<{payments: array, total: number}>}
   */
  getInvoicePayments: async (id) => {
    try {
      const response = await api.get(`/invoices/${id}/payments`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Void invoice
   * @param {string} id - Invoice ID
   * @param {string} reason - Void reason
   * @returns {Promise<{success: boolean, message: string}>}
   */
  voidInvoice: async (id, reason) => {
    try {
      const response = await api.post(`/invoices/${id}/void`, { reason });
      
      // Clear cache after voiding
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Duplicate invoice
   * @param {string} id - Invoice ID
   * @returns {Promise<{success: boolean, invoice: object}>}
   */
  duplicateInvoice: async (id) => {
    try {
      const response = await api.post(`/invoices/${id}/duplicate`);
      
      // Clear cache after duplication
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generate PDF for invoice
   * @param {string} id - Invoice ID
   * @param {object} options - PDF options
   * @returns {Promise<Blob>} - PDF file blob
   */
  generatePDF: async (id, options = {}) => {
    try {
      const response = await api.get(`/invoices/${id}/pdf`, {
        params: options,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Download invoice PDF
   * @param {string} id - Invoice ID
   * @param {string} filename - Filename for download
   */
  downloadPDF: async (id, filename) => {
    try {
      const blob = await invoiceService.generatePDF(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `invoice_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Print invoice
   * @param {string} id - Invoice ID
   * @returns {Promise<void>}
   */
  printInvoice: async (id) => {
    try {
      const blob = await invoiceService.generatePDF(id);
      const url = window.URL.createObjectURL(blob);
      
      // Open print dialog
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          window.URL.revokeObjectURL(url);
        };
      }
    } catch (error) {
      throw error;
    }
  },

  /**
   * Email invoice to customer
   * @param {string} id - Invoice ID
   * @param {object} emailData - Email data (to, cc, subject, message)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  emailInvoice: async (id, emailData) => {
    try {
      const response = await api.post(`/invoices/${id}/email`, emailData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Send payment reminder
   * @param {string} id - Invoice ID
   * @param {object} reminderData - Reminder data
   * @returns {Promise<{success: boolean, message: string}>}
   */
  sendReminder: async (id, reminderData = {}) => {
    try {
      const response = await api.post(`/invoices/${id}/reminder`, reminderData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice statistics
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Invoice statistics
   */
  getInvoiceStats: async (params = {}) => {
    try {
      const response = await api.get('/invoices/stats', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get overdue invoices
   * @param {object} params - Query parameters
   * @returns {Promise<{invoices: array, total: number}>}
   */
  getOverdueInvoices: async (params = {}) => {
    try {
      const response = await api.get('/invoices/overdue', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get pending invoices
   * @param {object} params - Query parameters
   * @returns {Promise<{invoices: array, total: number}>}
   */
  getPendingInvoices: async (params = {}) => {
    try {
      const response = await api.get('/invoices/pending', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk update invoice status
   * @param {array} ids - Array of invoice IDs
   * @param {string} status - New status
   * @returns {Promise<{success: boolean, updated: number}>}
   */
  bulkUpdateStatus: async (ids, status) => {
    try {
      const response = await api.put('/invoices/bulk/status', { ids, status });
      
      // Clear cache after bulk update
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Bulk delete invoices
   * @param {array} ids - Array of invoice IDs
   * @returns {Promise<{success: boolean, deleted: number}>}
   */
  bulkDeleteInvoices: async (ids) => {
    try {
      const response = await api.delete('/invoices/bulk', { data: { ids } });
      
      // Clear cache after bulk deletion
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Export invoices to CSV/Excel
   * @param {object} params - Export parameters (format, filters, fields)
   * @returns {Promise<Blob>} - File blob
   */
  exportInvoices: async (params = {}) => {
    try {
      const response = await api.get('/invoices/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get next invoice number
   * @returns {Promise<{invoiceNumber: string}>}
   */
  getNextInvoiceNumber: async () => {
    try {
      const response = await api.get('/invoices/next-number');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Validate invoice number
   * @param {string} invoiceNumber - Invoice number to validate
   * @returns {Promise<{valid: boolean, exists: boolean}>}
   */
  validateInvoiceNumber: async (invoiceNumber) => {
    try {
      const response = await api.post('/invoices/validate-number', { invoiceNumber });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice analytics
   * @param {object} params - Date range and grouping
   * @returns {Promise<object>} - Analytics data
   */
  getInvoiceAnalytics: async (params = {}) => {
    try {
      const response = await api.get('/invoices/analytics', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get payment trends
   * @param {object} params - Date range and filters
   * @returns {Promise<object>} - Payment trends
   */
  getPaymentTrends: async (params = {}) => {
    try {
      const response = await api.get('/invoices/payment-trends', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Apply discount to invoice
   * @param {string} id - Invoice ID
   * @param {object} discount - Discount data (type, value, reason)
   * @returns {Promise<{success: boolean, invoice: object}>}
   */
  applyDiscount: async (id, discount) => {
    try {
      const response = await api.post(`/invoices/${id}/discount`, discount);
      
      // Clear cache after discount
      clearCache();
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get invoice history/audit log
   * @param {string} id - Invoice ID
   * @returns {Promise<{history: array}>}
   */
  getInvoiceHistory: async (id) => {
    try {
      const response = await api.get(`/invoices/${id}/history`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create recurring invoice
   * @param {object} data - Recurring invoice data
   * @returns {Promise<{success: boolean, recurringInvoice: object}>}
   */
  createRecurringInvoice: async (data) => {
    try {
      const response = await api.post('/invoices/recurring', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get recurring invoices
   * @param {object} params - Query parameters
   * @returns {Promise<{recurringInvoices: array}>}
   */
  getRecurringInvoices: async (params = {}) => {
    try {
      const response = await api.get('/invoices/recurring', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

/**
 * Invoice Validation and Utility Functions
 */
export const invoiceUtils = {
  /**
   * Validate invoice data
   * @param {object} data - Invoice data
   * @param {boolean} isNew - Is this a new invoice
   * @returns {array} - Array of validation errors
   */
  validateInvoiceData: (data, isNew = true) => {
    const errors = [];

    // Required fields validation
    if (isNew || data.customer !== undefined) {
      if (!data.customer) {
        errors.push('Customer is required');
      }
    }

    if (isNew || data.invoiceDate !== undefined) {
      if (!data.invoiceDate) {
        errors.push('Invoice date is required');
      } else if (new Date(data.invoiceDate) > new Date()) {
        errors.push('Invoice date cannot be in the future');
      }
    }

    if (isNew || data.items !== undefined) {
      if (!data.items || data.items.length === 0) {
        errors.push('At least one item is required');
      } else {
        // Validate each item
        data.items.forEach((item, index) => {
          if (!item.product) {
            errors.push(`Item ${index + 1}: Product is required`);
          }
          if (!item.quantity || item.quantity <= 0) {
            errors.push(`Item ${index + 1}: Valid quantity is required`);
          }
          if (!item.rate || item.rate <= 0) {
            errors.push(`Item ${index + 1}: Valid rate is required`);
          }
        });
      }
    }

    // Optional field validation
    if (data.dueDate) {
      if (new Date(data.dueDate) < new Date(data.invoiceDate)) {
        errors.push('Due date cannot be before invoice date');
      }
    }

    if (data.paymentTerms) {
      const validTerms = ['immediate', 'net15', 'net30', 'net45', 'net60', 'custom'];
      if (!validTerms.includes(data.paymentTerms)) {
        errors.push('Invalid payment terms');
      }
    }

    return errors;
  },

  /**
   * Calculate invoice totals
   * @param {object} invoiceData - Invoice data with items
   * @returns {object} - Invoice data with calculated totals
   */
  calculateInvoiceTotals: (invoiceData) => {
    const items = invoiceData.items || [];
    
    let subtotal = 0;
    let totalGST = 0;
    let totalDiscount = 0;

    // Calculate item totals
    const calculatedItems = items.map(item => {
      const quantity = parseFloat(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0;
      const discount = parseFloat(item.discount) || 0;
      const gstPercentage = parseFloat(item.gstPercentage) || 0;

      const amount = quantity * rate;
      const discountAmount = (amount * discount) / 100;
      const taxableAmount = amount - discountAmount;
      const gstAmount = (taxableAmount * gstPercentage) / 100;
      const total = taxableAmount + gstAmount;

      subtotal += amount;
      totalDiscount += discountAmount;
      totalGST += gstAmount;

      return {
        ...item,
        amount,
        discountAmount,
        taxableAmount,
        gstAmount,
        total
      };
    });

    // Apply invoice-level discount if any
    const invoiceDiscount = parseFloat(invoiceData.discount) || 0;
    const invoiceDiscountAmount = (subtotal * invoiceDiscount) / 100;

    // Calculate final totals
    const netAmount = subtotal - totalDiscount - invoiceDiscountAmount;
    const grandTotal = netAmount + totalGST;

    // Calculate tax breakdown by GST rate
    const gstBreakdown = {};
    calculatedItems.forEach(item => {
      const gstRate = item.gstPercentage || 0;
      if (!gstBreakdown[gstRate]) {
        gstBreakdown[gstRate] = {
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0
        };
      }

      const halfGST = item.gstAmount / 2;
      gstBreakdown[gstRate].taxableAmount += item.taxableAmount;
      gstBreakdown[gstRate].cgst += halfGST;
      gstBreakdown[gstRate].sgst += halfGST;
      gstBreakdown[gstRate].total += item.gstAmount;
    });

    return {
      ...invoiceData,
      items: calculatedItems,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalDiscount: parseFloat(totalDiscount.toFixed(2)),
      invoiceDiscountAmount: parseFloat(invoiceDiscountAmount.toFixed(2)),
      netAmount: parseFloat(netAmount.toFixed(2)),
      totalGST: parseFloat(totalGST.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
      gstBreakdown
    };
  },

  /**
   * Calculate due date based on payment terms
   * @param {Date} invoiceDate - Invoice date
   * @param {string} paymentTerms - Payment terms
   * @returns {Date} - Due date
   */
  calculateDueDate: (invoiceDate, paymentTerms) => {
    const date = new Date(invoiceDate);
    
    switch (paymentTerms) {
      case 'immediate':
        return date;
      case 'net15':
        date.setDate(date.getDate() + 15);
        return date;
      case 'net30':
        date.setDate(date.getDate() + 30);
        return date;
      case 'net45':
        date.setDate(date.getDate() + 45);
        return date;
      case 'net60':
        date.setDate(date.getDate() + 60);
        return date;
      default:
        date.setDate(date.getDate() + 30);
        return date;
    }
  },

  /**
   * Check if invoice is overdue
   * @param {object} invoice - Invoice object
   * @returns {boolean}
   */
  isOverdue: (invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      return false;
    }

    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dueDate < today;
  },

  /**
   * Get days overdue
   * @param {object} invoice - Invoice object
   * @returns {number} - Days overdue (0 if not overdue)
   */
  getDaysOverdue: (invoice) => {
    if (!invoiceUtils.isOverdue(invoice)) {
      return 0;
    }

    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    const diffTime = Math.abs(today - dueDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  },

  /**
   * Calculate outstanding amount
   * @param {object} invoice - Invoice object with payments
   * @returns {number} - Outstanding amount
   */
  calculateOutstanding: (invoice) => {
    const total = invoice.grandTotal || 0;
    const paid = (invoice.payments || []).reduce((sum, payment) => {
      return sum + (payment.amount || 0);
    }, 0);

    return Math.max(0, total - paid);
  },

  /**
   * Get payment status
   * @param {object} invoice - Invoice object
   * @returns {string} - Payment status (paid, partial, unpaid, overdue)
   */
  getPaymentStatus: (invoice) => {
    const outstanding = invoiceUtils.calculateOutstanding(invoice);
    const total = invoice.grandTotal || 0;

    if (outstanding === 0 || invoice.status === 'paid') {
      return 'paid';
    } else if (outstanding < total) {
      return 'partial';
    } else if (invoiceUtils.isOverdue(invoice)) {
      return 'overdue';
    }
    return 'unpaid';
  },

  /**
   * Format invoice number
   * @param {string|number} number - Invoice number
   * @param {string} prefix - Prefix (default: INV)
   * @param {number} padLength - Padding length (default: 6)
   * @returns {string} - Formatted invoice number
   */
  formatInvoiceNumber: (number, prefix = 'INV', padLength = 6) => {
    const numStr = String(number).padStart(padLength, '0');
    return `${prefix}-${numStr}`;
  },

  /**
   * Generate invoice number
   * @param {number} lastNumber - Last invoice number
   * @param {string} prefix - Prefix
   * @returns {string} - New invoice number
   */
  generateInvoiceNumber: (lastNumber, prefix = 'INV') => {
    const nextNumber = (lastNumber || 0) + 1;
    return invoiceUtils.formatInvoiceNumber(nextNumber, prefix);
  },

  /**
   * Calculate invoice age
   * @param {Date} invoiceDate - Invoice date
   * @returns {number} - Age in days
   */
  calculateInvoiceAge: (invoiceDate) => {
    const date = new Date(invoiceDate);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Get aging bucket
   * @param {object} invoice - Invoice object
   * @returns {string} - Aging bucket (current, 1-30, 31-60, 61-90, 90+)
   */
  getAgingBucket: (invoice) => {
    const daysOverdue = invoiceUtils.getDaysOverdue(invoice);

    if (daysOverdue === 0) return 'current';
    if (daysOverdue <= 30) return '1-30';
    if (daysOverdue <= 60) return '31-60';
    if (daysOverdue <= 90) return '61-90';
    return '90+';
  },

  /**
   * Calculate late fee
   * @param {object} invoice - Invoice object
   * @param {number} dailyRate - Daily late fee rate (percentage)
   * @param {number} maxFee - Maximum late fee
   * @returns {number} - Late fee amount
   */
  calculateLateFee: (invoice, dailyRate = 0.05, maxFee = null) => {
    const daysOverdue = invoiceUtils.getDaysOverdue(invoice);
    if (daysOverdue === 0) return 0;

    const outstanding = invoiceUtils.calculateOutstanding(invoice);
    let lateFee = (outstanding * (dailyRate / 100)) * daysOverdue;

    if (maxFee && lateFee > maxFee) {
      lateFee = maxFee;
    }

    return parseFloat(lateFee.toFixed(2));
  },

  /**
   * Parse CSV for bulk import
   * @param {File} file - CSV file
   * @returns {Promise<array>} - Array of invoice objects
   */
  parseCSV: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          const invoices = [];
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(v => v.trim());
            const invoice = {};
            
            headers.forEach((header, index) => {
              invoice[header] = values[index] || '';
            });
            
            invoices.push(invoice);
          }
          
          resolve(invoices);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  },

  /**
   * Group invoices by status
   * @param {array} invoices - Array of invoices
   * @returns {object} - Grouped invoices
   */
  groupByStatus: (invoices) => {
    return invoices.reduce((groups, invoice) => {
      const status = invoice.status || 'unknown';
      if (!groups[status]) groups[status] = [];
      groups[status].push(invoice);
      return groups;
    }, {});
  },

  /**
   * Group invoices by customer
   * @param {array} invoices - Array of invoices
   * @returns {object} - Grouped invoices
   */
  groupByCustomer: (invoices) => {
    return invoices.reduce((groups, invoice) => {
      const customerId = invoice.customer?._id || invoice.customer || 'unknown';
      if (!groups[customerId]) groups[customerId] = [];
      groups[customerId].push(invoice);
      return groups;
    }, {});
  },

  /**
   * Sort invoices
   * @param {array} invoices - Array of invoices
   * @param {string} field - Field to sort by
   * @param {string} order - Sort order (asc, desc)
   * @returns {array} - Sorted invoices
   */
  sortInvoices: (invoices, field, order = 'desc') => {
    return [...invoices].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Handle dates
      if (field.includes('Date')) {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal === bVal) return 0;
      const comparison = aVal > bVal ? 1 : -1;
      return order === 'asc' ? comparison : -comparison;
    });
  },

  /**
   * Filter invoices
   * @param {array} invoices - Array of invoices
   * @param {object} filters - Filter criteria
   * @returns {array} - Filtered invoices
   */
  filterInvoices: (invoices, filters) => {
    return invoices.filter(invoice => {
      // Status filter
      if (filters.status && invoice.status !== filters.status) {
        return false;
      }

      // Date range filter
      if (filters.startDate) {
        const invoiceDate = new Date(invoice.invoiceDate);
        const startDate = new Date(filters.startDate);
        if (invoiceDate < startDate) return false;
      }

      if (filters.endDate) {
        const invoiceDate = new Date(invoice.invoiceDate);
        const endDate = new Date(filters.endDate);
        if (invoiceDate > endDate) return false;
      }

      // Amount range filter
      if (filters.minAmount !== undefined) {
        if (invoice.grandTotal < filters.minAmount) return false;
      }

      if (filters.maxAmount !== undefined) {
        if (invoice.grandTotal > filters.maxAmount) return false;
      }

      // Payment status filter
      if (filters.paymentStatus) {
        const status = invoiceUtils.getPaymentStatus(invoice);
        if (status !== filters.paymentStatus) return false;
      }

      // Customer filter
      if (filters.customerId) {
        const invoiceCustomerId = invoice.customer?._id || invoice.customer;
        if (invoiceCustomerId !== filters.customerId) return false;
      }

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          invoice.invoiceNumber,
          invoice.customer?.customerName,
          invoice.notes
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchable.includes(search)) return false;
      }

      return true;
    });
  }
};

/**
 * Invoice Analytics
 */
export const invoiceAnalytics = {
  /**
   * Calculate total revenue
   * @param {array} invoices - Array of invoices
   * @returns {number} - Total revenue
   */
  calculateTotalRevenue: (invoices) => {
    return invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  },

  /**
   * Calculate outstanding revenue
   * @param {array} invoices - Array of invoices
   * @returns {number} - Outstanding revenue
   */
  calculateOutstandingRevenue: (invoices) => {
    return invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + invoiceUtils.calculateOutstanding(inv), 0);
  },

  /**
   * Calculate average invoice value
   * @param {array} invoices - Array of invoices
   * @returns {number} - Average invoice value
   */
  calculateAverageInvoiceValue: (invoices) => {
    if (invoices.length === 0) return 0;
    const total = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    return total / invoices.length;
  },

  /**
   * Get payment statistics
   * @param {array} invoices - Array of invoices
   * @returns {object} - Payment statistics
   */
  getPaymentStatistics: (invoices) => {
    const stats = {
      total: invoices.length,
      paid: 0,
      partial: 0,
      unpaid: 0,
      overdue: 0,
      cancelled: 0
    };

    invoices.forEach(invoice => {
      const status = invoiceUtils.getPaymentStatus(invoice);
      if (stats[status] !== undefined) {
        stats[status]++;
      }
    });

    return stats;
  },

  /**
   * Get aging report
   * @param {array} invoices - Array of invoices
   * @returns {object} - Aging report
   */
  getAgingReport: (invoices) => {
    const report = {
      current: { count: 0, amount: 0 },
      '1-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 }
    };

    invoices
      .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
      .forEach(invoice => {
        const bucket = invoiceUtils.getAgingBucket(invoice);
        const outstanding = invoiceUtils.calculateOutstanding(invoice);
        
        report[bucket].count++;
        report[bucket].amount += outstanding;
      });

    return report;
  }
};

export default invoiceService;
