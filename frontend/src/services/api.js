import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const isDevelopment = import.meta.env.DEV;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true, // Enable sending cookies
  timeout: 30000 // 30 seconds timeout
});

// Track pending requests for cancellation
const pendingRequests = new Map();

// Request ID generator
let requestId = 0;
const generateRequestId = () => `req_${++requestId}_${Date.now()}`;

// Create cancel token
const getCancelToken = (config) => {
  const source = axios.CancelToken.source();
  const key = `${config.method}_${config.url}`;
  
  // Cancel previous pending request with same key
  if (pendingRequests.has(key)) {
    pendingRequests.get(key).cancel('Request cancelled due to new request');
  }
  
  pendingRequests.set(key, source);
  return source.token;
};

// Remove completed request from pending
const removePendingRequest = (config) => {
  const key = `${config.method}_${config.url}`;
  pendingRequests.delete(key);
};

// Retry configuration
const retryConfig = {
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return (
      !error.response ||
      (error.response.status >= 500 && error.response.status < 600)
    );
  }
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add request ID for tracking
    config.metadata = { 
      requestId: generateRequestId(),
      startTime: Date.now() 
    };

    // Add cancel token (optional - uncomment if needed)
    // config.cancelToken = getCancelToken(config);

    // Initialize retry count
    config.retryCount = config.retryCount || 0;

    // Development logging
    if (isDevelopment) {
      console.log(
        `%c→ ${config.method.toUpperCase()} ${config.url}`,
        'color: #3b82f6; font-weight: bold',
        {
          id: config.metadata.requestId,
          data: config.data,
          params: config.params
        }
      );
    }

    return config;
  },
  (error) => {
    if (isDevelopment) {
      console.error('%c✖ Request Error', 'color: #ef4444; font-weight: bold', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    const { config } = response;
    
    // Remove from pending requests
    removePendingRequest(config);

    // Calculate request duration
    const duration = Date.now() - config.metadata.startTime;

    // Development logging
    if (isDevelopment) {
      console.log(
        `%c← ${config.method.toUpperCase()} ${config.url} (${duration}ms)`,
        'color: #10b981; font-weight: bold',
        {
          id: config.metadata.requestId,
          status: response.status,
          data: response.data
        }
      );
    }

    return response;
  },
  async (error) => {
    const { config } = error;

    // Remove from pending requests
    if (config) {
      removePendingRequest(config);
    }

    // Handle request cancellation
    if (axios.isCancel(error)) {
      if (isDevelopment) {
        console.log(
          `%c⊘ Request Cancelled: ${config?.method?.toUpperCase()} ${config?.url}`,
          'color: #f59e0b; font-weight: bold'
        );
      }
      return Promise.reject(error);
    }

    // Calculate request duration if available
    const duration = config?.metadata?.startTime 
      ? Date.now() - config.metadata.startTime 
      : 0;

    // Development error logging
    if (isDevelopment && config) {
      const errorDetails = {
        id: config.metadata?.requestId,
        url: config.url,
        method: config.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        duration: `${duration}ms`,
        message: error.message,
        data: error.response?.data
      };

      console.error(
        `%c✖ ${config.method.toUpperCase()} ${config.url} (${duration}ms)`,
        'color: #ef4444; font-weight: bold',
        errorDetails
      );
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      const isAuthCheck = config?.url?.includes('/auth/me');
      const isLoginPage = window.location.pathname === '/login';
      const isLoginRequest = config?.url?.includes('/auth/login');
      
      if (!isAuthCheck && !isLoginPage && !isLoginRequest) {
        localStorage.removeItem('admin');
        
        // Store intended destination for redirect after login
        const currentPath = window.location.pathname;
        if (currentPath !== '/') {
          sessionStorage.setItem('redirectAfterLogin', currentPath);
        }
        
        window.location.href = '/login';
      }
    }

    // Retry logic
    if (config && retryConfig.retryCondition(error) && config.retryCount < retryConfig.retries) {
      config.retryCount += 1;
      
      const delay = retryConfig.retryDelay * Math.pow(2, config.retryCount - 1); // Exponential backoff
      
      if (isDevelopment) {
        console.log(
          `%c⟳ Retrying ${config.method.toUpperCase()} ${config.url} (Attempt ${config.retryCount}/${retryConfig.retries})`,
          'color: #f59e0b; font-weight: bold'
        );
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      
      return api(config);
    }

    // Enhanced error object
    const enhancedError = {
      ...error,
      isNetworkError: !error.response,
      isServerError: error.response?.status >= 500,
      isClientError: error.response?.status >= 400 && error.response?.status < 500,
      message: error.response?.data?.message || error.message || 'An error occurred',
      statusCode: error.response?.status,
      requestId: config?.metadata?.requestId
    };

    return Promise.reject(enhancedError);
  }
);

// Utility functions

/**
 * Cancel all pending requests
 */
export const cancelAllRequests = (reason = 'All requests cancelled') => {
  pendingRequests.forEach((source) => {
    source.cancel(reason);
  });
  pendingRequests.clear();
  
  if (isDevelopment) {
    console.log('%c⊘ All pending requests cancelled', 'color: #f59e0b; font-weight: bold');
  }
};

/**
 * Create a request with custom abort controller
 */
export const createAbortableRequest = () => {
  const controller = new AbortController();
  
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
    request: (config) => api({ ...config, signal: controller.signal })
  };
};

/**
 * Batch multiple requests
 */
export const batchRequests = async (requests, options = {}) => {
  const { 
    concurrent = 5, 
    stopOnError = false,
    onProgress 
  } = options;

  const results = [];
  const errors = [];
  let completed = 0;

  for (let i = 0; i < requests.length; i += concurrent) {
    const batch = requests.slice(i, i + concurrent);
    
    const batchResults = await Promise.allSettled(
      batch.map(request => api(request))
    );

    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({ index: i + index, error: result.reason });
        if (stopOnError) {
          throw result.reason;
        }
      }
      
      completed++;
      if (onProgress) {
        onProgress(completed, requests.length);
      }
    });
  }

  return { results, errors };
};

/**
 * Create a request with cache
 */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const cachedRequest = async (config, ttl = CACHE_TTL) => {
  const cacheKey = `${config.method}_${config.url}_${JSON.stringify(config.params || {})}`;
  const now = Date.now();

  // Check cache
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < ttl) {
      if (isDevelopment) {
        console.log(
          `%c⚡ Cache Hit: ${config.method.toUpperCase()} ${config.url}`,
          'color: #8b5cf6; font-weight: bold'
        );
      }
      return { data, fromCache: true };
    }
    cache.delete(cacheKey);
  }

  // Make request
  const response = await api(config);
  cache.set(cacheKey, { data: response.data, timestamp: now });
  
  return { data: response.data, fromCache: false };
};

/**
 * Clear request cache
 */
export const clearCache = () => {
  cache.clear();
  if (isDevelopment) {
    console.log('%c🗑️ Cache cleared', 'color: #8b5cf6; font-weight: bold');
  }
};

/**
 * Health check
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/health', { timeout: 5000 });
    return { healthy: true, data: response.data };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

/**
 * Get API status
 */
export const getApiStatus = () => ({
  baseURL: API_URL,
  pendingRequests: pendingRequests.size,
  cacheSize: cache.size,
  isDevelopment
});

// Export configured instance
export default api;

// Export axios for direct use if needed
export { axios };
