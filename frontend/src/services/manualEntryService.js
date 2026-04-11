import api from './api';

// Entry type labels for display
export const ENTRY_TYPES = [
  { value: 'opening_balance', label: 'Opening Balance', description: 'Set initial balance from pre-digital records', icon: '📊' },
  { value: 'manual_bill', label: 'Manual Bill', description: 'Record an offline transaction', icon: '💰' },
  { value: 'payment_adjustment', label: 'Payment Adjustment', description: 'Record manual payment received', icon: '💳' },
  { value: 'credit_adjustment', label: 'Credit Adjustment', description: 'Apply discount or correction', icon: '✏️' }
];

// Payment types (like invoices)
export const PAYMENT_TYPES = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Credit', label: 'Credit' }
];

/**
 * Create a new manual entry
 */
export const createManualEntry = async (data) => {
  const response = await api.post('/manual-entries', data);
  return response.data;
};

/**
 * Get all manual entries with optional filters
 */
export const getManualEntries = async (params = {}) => {
  const response = await api.get('/manual-entries', { params });
  return response.data;
};

/**
 * Get a single manual entry by ID
 */
export const getManualEntry = async (id) => {
  const response = await api.get(`/manual-entries/${id}`);
  return response.data;
};

/**
 * Get manual entries for a specific customer
 */
export const getManualEntriesByCustomer = async (customerId) => {
  const response = await api.get(`/manual-entries/customer/${customerId}`);
  return response.data;
};

/**
 * Get unpaid opening balance entries for a customer (for payment modal)
 */
export const getUnpaidOpeningBalances = async (customerId) => {
  const response = await api.get(`/manual-entries/customer/${customerId}/unpaid`);
  return response.data;
};

/**
 * Record payment against an opening balance entry
 */
export const recordPaymentAgainstEntry = async (entryId, paymentData) => {
  const response = await api.post(`/manual-entries/${entryId}/payment`, paymentData);
  return response.data;
};

/**
 * Delete a manual entry (admin only)
 */
export const deleteManualEntry = async (id) => {
  const response = await api.delete(`/manual-entries/${id}`);
  return response.data;
};

/**
 * Update a manual entry (admin only)
 */
export const updateManualEntry = async (id, data) => {
  const response = await api.put(`/manual-entries/${id}`, data);
  return response.data;
};

/**
 * Get entry type display info
 */
export const getEntryTypeInfo = (entryType) => {
  return ENTRY_TYPES.find(t => t.value === entryType) || { label: entryType, icon: '📋' };
};

/**
 * Calculate financial impact preview for a manual entry
 */
export const calculateImpact = (entryType, paymentType, amount) => {
  const numAmount = parseFloat(amount) || 0;
  
  switch (entryType) {
    case 'opening_balance':
    case 'manual_bill':
      if (paymentType === 'Credit') {
        return {
          totalPurchases: `+₹${numAmount.toLocaleString()}`,
          outstanding: `+₹${numAmount.toLocaleString()}`,
          message: `Will increase both total purchases and outstanding by ₹${numAmount.toLocaleString()}`
        };
      } else {
        return {
          totalPurchases: `+₹${numAmount.toLocaleString()}`,
          outstanding: 'No change',
          message: `Will increase total purchases by ₹${numAmount.toLocaleString()}, outstanding unchanged`
        };
      }
    
    case 'payment_adjustment':
      return {
        totalPurchases: 'No change',
        outstanding: `-₹${numAmount.toLocaleString()}`,
        message: `Will decrease outstanding by ₹${numAmount.toLocaleString()}`
      };
    
    case 'credit_adjustment':
      return {
        totalPurchases: 'No change',
        outstanding: `-₹${numAmount.toLocaleString()}`,
        message: `Will decrease outstanding by ₹${numAmount.toLocaleString()}`
      };
    
    default:
      return { message: 'Select an entry type to see impact' };
  }
};

export const manualEntryService = {
  createManualEntry,
  getManualEntries,
  getManualEntry,
  getManualEntriesByCustomer,
  getUnpaidOpeningBalances,
  recordPaymentAgainstEntry,
  deleteManualEntry,
  updateManualEntry,
  getEntryTypeInfo,
  calculateImpact,
  ENTRY_TYPES,
  PAYMENT_TYPES
};
