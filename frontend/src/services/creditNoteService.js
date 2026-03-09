import api, { clearCache } from './api';

/**
 * Credit Note Service
 * Handles all credit note (sales return) API calls
 */
export const creditNoteService = {
  /**
   * Create a credit note (sales return)
   * @param {object} data - { invoiceId, items: [{ productId, batchId, batchNo, quantityReturned }], reason }
   */
  createCreditNote: async (data) => {
    const response = await api.post('/credit-notes', data);
    clearCache();
    return response.data;
  },

  /**
   * Get all credit notes
   * @param {object} params - { page, limit }
   */
  getCreditNotes: async (params = {}) => {
    const response = await api.get('/credit-notes', { params });
    return response.data;
  },

  /**
   * Get credit notes for a specific invoice
   * @param {string} invoiceId
   */
  getCreditNotesByInvoice: async (invoiceId) => {
    const response = await api.get(`/credit-notes/invoice/${invoiceId}`);
    return response.data;
  },

  /**
   * Get a single credit note by ID
   * @param {string} id
   */
  getCreditNote: async (id) => {
    const response = await api.get(`/credit-notes/${id}`);
    return response.data;
  }
};

export default creditNoteService;
