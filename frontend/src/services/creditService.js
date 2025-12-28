import api from './api';

// ============= Payment APIs =============

/**
 * Record a new payment
 * @param {Object} paymentData - Payment details
 * @param {string} paymentData.invoiceId - Invoice ID
 * @param {number} paymentData.amount - Payment amount
 * @param {Date} paymentData.paymentDate - Payment date
 * @param {string} paymentData.paymentMethod - Payment method
 * @param {string} paymentData.referenceNumber - Reference/transaction number
 * @param {string} paymentData.notes - Notes
 */
export const recordPayment = async (paymentData) => {
  const response = await api.post('/payments', paymentData);
  return response.data;
};

/**
 * Get all payments with optional filters
 * @param {Object} filters - Filter options
 */
export const getPayments = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.customerId) params.append('customerId', filters.customerId);
  if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  
  const response = await api.get(`/payments?${params.toString()}`);
  return response.data;
};

/**
 * Get single payment by ID
 * @param {string} paymentId - Payment ID
 */
export const getPayment = async (paymentId) => {
  const response = await api.get(`/payments/${paymentId}`);
  return response.data;
};

/**
 * Get payments by customer
 * @param {string} customerId - Customer ID
 */
export const getPaymentsByCustomer = async (customerId) => {
  const response = await api.get(`/payments/customer/${customerId}`);
  return response.data;
};

/**
 * Get payments by invoice
 * @param {string} invoiceId - Invoice ID
 */
export const getPaymentsByInvoice = async (invoiceId) => {
  const response = await api.get(`/payments/invoice/${invoiceId}`);
  return response.data;
};

/**
 * Delete/reverse a payment
 * @param {string} paymentId - Payment ID
 */
export const deletePayment = async (paymentId) => {
  const response = await api.delete(`/payments/${paymentId}`);
  return response.data;
};

// ============= Credit Report APIs =============

/**
 * Get outstanding report - customers with pending amounts
 */
export const getOutstandingReport = async () => {
  const response = await api.get('/reports/outstanding');
  return response.data;
};

/**
 * Get ageing report - breakdown by days overdue
 */
export const getAgeingReport = async () => {
  const response = await api.get('/reports/ageing');
  return response.data;
};

/**
 * Get credit stats for dashboard
 */
export const getCreditStats = async () => {
  const response = await api.get('/reports/credit-stats');
  return response.data;
};

/**
 * Get recent payments
 * @param {number} limit - Number of payments to fetch
 */
export const getRecentPayments = async (limit = 20) => {
  const response = await api.get(`/reports/recent-payments?limit=${limit}`);
  return response.data;
};

// ============= Helper Functions =============

/**
 * Payment method options
 */
export const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Cheque', label: 'Cheque' },
  { value: 'NEFT/RTGS', label: 'NEFT/RTGS' }
];

/**
 * Get payment status badge color
 * @param {string} status - Payment status
 */
export const getPaymentStatusColor = (status) => {
  switch (status) {
    case 'Paid':
      return 'success';
    case 'Partial':
      return 'warning';
    case 'Unpaid':
      return 'danger';
    default:
      return 'default';
  }
};

export default {
  recordPayment,
  getPayments,
  getPayment,
  getPaymentsByCustomer,
  getPaymentsByInvoice,
  deletePayment,
  getOutstandingReport,
  getAgeingReport,
  getCreditStats,
  getRecentPayments,
  PAYMENT_METHODS,
  getPaymentStatusColor
};
