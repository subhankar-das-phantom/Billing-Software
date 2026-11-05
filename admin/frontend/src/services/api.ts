/**
 * Bharat Enterprise Billing System — Platform Control Plane API Service
 * Centralized Axios client configured for `/api/platform` with anti-thrashing interceptors.
 */

import axios, { AxiosError } from 'axios';

export const PLATFORM_FORBIDDEN_EVENT = 'platform:forbidden';
export const PLATFORM_UNAUTHORIZED_EVENT = 'platform:unauthorized';

export interface PlatformForbiddenDetail {
  message: string;
  code?: string;
  requiredPermission?: string;
}

export const api = axios.create({
  baseURL: '/api/platform',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

let isRedirecting = false;

// ─── Request Interceptor: Forward Diagnostic Support Session Code ───
api.interceptors.request.use((config) => {
  try {
    const cachedSessionStr = sessionStorage.getItem('cached_support_session');
    if (cachedSessionStr) {
      const session = JSON.parse(cachedSessionStr);
      if (session?.sessionCode) {
        config.headers['x-support-session-code'] = session.sessionCode;
      }
    }
  } catch {
    // Ignore JSON parsing errors
  }
  return config;
});

// ─── Response Interceptor ─────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string; code?: string }>) => {
    const status = error.response?.status;
    const currentPath = window.location.pathname;

    // 401: Unauthorized session (expired or invalid token)
    if (status === 401) {
      try {
        localStorage.removeItem('cached_platform_user');
        sessionStorage.removeItem('cached_support_session');
      } catch {
        // Storage access failure
      }

      if (!currentPath.startsWith('/login') && !isRedirecting) {
        isRedirecting = true;
        window.dispatchEvent(
          new CustomEvent(PLATFORM_UNAUTHORIZED_EVENT, { detail: error.response?.data })
        );

        // Redirect cleanly to login, preserving intended destination
        const redirectParam = encodeURIComponent(currentPath + window.location.search);
        setTimeout(() => {
          window.location.replace(`/login?redirect=${redirectParam}`);
        }, 100);
      }
    }

    // 403: Forbidden privilege (user authenticated, but lacks granular privilege)
    // NEVER redirect or log out on 403. Emit warning event for non-intrusive toast notification.
    if (status === 403) {
      const responseData = error.response?.data;
      const detail: PlatformForbiddenDetail = {
        message:
          responseData?.error ||
          responseData?.message ||
          'Action restricted: Insufficient platform permissions.',
        code: responseData?.code,
      };

      window.dispatchEvent(
        new CustomEvent<PlatformForbiddenDetail>(PLATFORM_FORBIDDEN_EVENT, { detail })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
