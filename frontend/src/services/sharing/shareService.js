import api from '../api';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Share Service
 * Handles authenticated share link creation and public document lookups.
 */
export const shareService = {
  /**
   * Create or retrieve active share link for a resource (Invoice, Receipt, etc.)
   * @param {Object} params
   * @param {'invoice'|'receipt'|'quotation'|'credit_note'|'payment_receipt'} params.resourceType
   * @param {string} params.resourceId
   * @returns {Promise<{success: boolean, rawToken: string, shareUrl: string, isNew: boolean, expiresAt: string|null}>}
   */
  getOrCreateShareLink: async ({ resourceType = 'invoice', resourceId }) => {
    try {
      const response = await api.post('/shares', { resourceType, resourceId });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Fetch sanitized public customer-facing document
   * @param {string} token
   * @returns {Promise<{success: boolean, resourceType: string, data: object}>}
   */
  getPublicShare: async (token) => {
    try {
      const response = await api.get(`/public/shares/${token}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get direct URL to stream/download public PDF
   * @param {string} token
   * @returns {string}
   */
  getPublicSharePDFUrl: (token) => {
    return `${API_URL}/public/shares/${token}/pdf`;
  },

  /**
   * Fetch public invoice PDF as a Blob for seamless in-page download
   * @param {string} token
   * @returns {Promise<Blob>}
   */
  getPublicSharePDFBlob: async (token) => {
    const response = await api.get(`/public/shares/${token}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default shareService;
