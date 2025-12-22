import api from './api';

/**
 * Note Service
 * Handles all note-related API calls
 */
export const noteService = {
  /**
   * Get list of notes with optional filters
   * @param {object} params - Query parameters (search, page, limit, pinned)
   * @returns {Promise<{notes: array, total: number, pages: number}>}
   */
  getNotes: async (params = {}) => {
    try {
      const response = await api.get('/notes', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get single note by ID
   * @param {string} id - Note ID
   * @returns {Promise<{note: object}>}
   */
  getNote: async (id) => {
    try {
      const response = await api.get(`/notes/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create new note
   * @param {object} data - Note data (title, content, color, isPinned)
   * @returns {Promise<{success: boolean, note: object}>}
   */
  createNote: async (data) => {
    try {
      const response = await api.post('/notes', data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update note
   * @param {string} id - Note ID
   * @param {object} data - Updated note data
   * @returns {Promise<{success: boolean, note: object}>}
   */
  updateNote: async (id, data) => {
    try {
      const response = await api.put(`/notes/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete note
   * @param {string} id - Note ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  deleteNote: async (id) => {
    try {
      const response = await api.delete(`/notes/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Toggle pin status
   * @param {string} id - Note ID
   * @returns {Promise<{success: boolean, note: object}>}
   */
  togglePin: async (id) => {
    try {
      const response = await api.patch(`/notes/${id}/pin`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
