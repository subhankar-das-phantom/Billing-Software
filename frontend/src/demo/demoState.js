/**
 * Bharat Enterprise — Demo Mode State Manager
 * Handles demo session lifecycle, tokens, and cache flushing.
 */
import { DEMO_ADMIN, DEMO_SUBSCRIPTION } from './demoData';
import { clearCache as clearApiCache } from '../services/api';

export const isDemoModeActive = () => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('isDemoMode') === 'true';
};

const clearSWRCache = () => {
  if (typeof window === 'undefined') return;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('swr_cache_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
};

export const enterDemoMode = (navigate) => {
  if (typeof window === 'undefined') return;

  // Clear any existing session first
  clearSWRCache();
  clearApiCache();

  // Seed demo session synchronously
  localStorage.setItem('isDemoMode', 'true');
  localStorage.setItem('token', 'demo_client_jwt_token_secure_isolated');
  localStorage.setItem('userRole', 'admin');
  localStorage.setItem('admin', JSON.stringify(DEMO_ADMIN));
  localStorage.setItem('cached_subscription', JSON.stringify(DEMO_SUBSCRIPTION));

  if (navigate) {
    navigate('/');
  } else {
    window.location.href = '/';
  }
};

export const exitDemoMode = (navigate) => {
  if (typeof window === 'undefined') return;

  clearSWRCache();
  clearApiCache();

  localStorage.removeItem('isDemoMode');
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  localStorage.removeItem('user');
  localStorage.removeItem('userRole');
  localStorage.removeItem('cached_subscription');

  if (navigate) {
    navigate('/login');
  } else {
    window.location.href = '/login';
  }
};
