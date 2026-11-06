/**
 * Bharat Enterprise Billing System — Platform Auth Context
 * Authoritative authentication state, permission evaluation, and heartbeat daemon.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import api from '../services/api';
import {
  PlatformRole,
  PlatformPermission,
  ROLE_PERMISSIONS,
  type PlatformUser,
  type PlatformSession,
  type ActiveSupportSession,
} from '../types';

interface LoginResult {
  mfaRequired: boolean;
  mfaPendingToken?: string;
  user?: PlatformUser;
}

interface PlatformAuthContextType {
  user: PlatformUser | null;
  role: PlatformRole | null;
  session: PlatformSession | null;
  activeSupportSession: ActiveSupportSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: PlatformPermission) => boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyMfa: (mfaPendingToken: string, code: string, isBackupCode?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setActiveSupportSession: (session: ActiveSupportSession | null) => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextType | undefined>(undefined);

const SUPPORT_SESSION_STORAGE_KEY = 'cached_support_session';
const USER_CACHE_STORAGE_KEY = 'cached_platform_user';

export const PlatformAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Synchronous Frame-0 pre-seeding to eliminate CLS and flash-of-unauthenticated-state
  const [user, setUser] = useState<PlatformUser | null>(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_STORAGE_KEY);
      if (cached === null) return null;
      if (!cached.trim()) {
        localStorage.removeItem(USER_CACHE_STORAGE_KEY);
        return null;
      }
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed === 'object' && parsed._id && parsed.role) {
        return parsed as PlatformUser;
      }
      localStorage.removeItem(USER_CACHE_STORAGE_KEY);
      return null;
    } catch {
      try {
        localStorage.removeItem(USER_CACHE_STORAGE_KEY);
      } catch {}
      return null;
    }
  });

  const [session, setSession] = useState<PlatformSession | null>(null);

  const [activeSupportSession, setActiveSupportSessionState] =
    useState<ActiveSupportSession | null>(() => {
      try {
        const cached = sessionStorage.getItem(SUPPORT_SESSION_STORAGE_KEY);
        if (cached === null) return null;
        if (!cached.trim()) {
          sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
          return null;
        }
        const parsed = JSON.parse(cached);
        if (!parsed || typeof parsed !== 'object' || !parsed.expiresAt || !parsed.sessionCode) {
          sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
          return null;
        }
        const expiryMs = new Date(parsed.expiresAt).getTime();
        // Verify not already expired or invalid timestamp
        if (isNaN(expiryMs) || expiryMs < Date.now()) {
          sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
          return null;
        }
        return parsed as ActiveSupportSession;
      } catch {
        try {
          sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
        } catch {}
        return null;
      }
    });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronize active support session with sessionStorage
  const setActiveSupportSession = useCallback((newSession: ActiveSupportSession | null) => {
    setActiveSupportSessionState(newSession);
    if (newSession) {
      sessionStorage.setItem(SUPPORT_SESSION_STORAGE_KEY, JSON.stringify(newSession));
    } else {
      sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
    }
  }, []);

  // Update cached user in localStorage whenever user state changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_CACHE_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_STORAGE_KEY);
    }
  }, [user]);

  // ─── Permission Evaluation Engine ────────────────────────────────
  const hasPermission = useCallback(
    (permission: PlatformPermission): boolean => {
      if (!user) return false;

      // Platform Owner has unconditional privilege
      if (user.role === PlatformRole.PLATFORM_OWNER) {
        return true;
      }

      // Base role permissions
      const rolePerms = ROLE_PERMISSIONS[user.role] ?? [];
      if (rolePerms.includes(permission)) {
        return true;
      }

      // Custom assigned permissions
      if (user.customPermissions && Array.isArray(user.customPermissions)) {
        if (user.customPermissions.includes(permission)) {
          return true;
        }
      }

      return false;
    },
    [user]
  );

  // ─── Fetch Current User & Session ────────────────────────────────
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get<{
        success: boolean;
        user: PlatformUser;
        session: PlatformSession;
      }>('/auth/me');

      if (data.success && data.user) {
        setUser(data.user);
        setSession(data.session ?? null);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch {
      // Do not hard-clear cached user immediately on transient network drop,
      // let interceptor handle 401s cleanly
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial session hydration
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // ─── Auto-Refresh & Heartbeat Daemon ─────────────────────────────
  // Runs every 4 minutes (240,000ms) to ensure token freshness and OCC sync
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    heartbeatTimerRef.current = setInterval(() => {
      api.post('/auth/refresh').catch(() => {
        // Interceptor handles 401 if session has expired or been revoked
      });
    }, 240000);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [user]);

  // ─── Login Flow ──────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<LoginResult> => {
    const { data } = await api.post<{
      success: boolean;
      mfaRequired?: boolean;
      mfaPendingToken?: string;
      user?: PlatformUser;
      session?: PlatformSession;
    }>('/auth/login', { email, password });

    if (data.mfaRequired) {
      return {
        mfaRequired: true,
        mfaPendingToken: data.mfaPendingToken,
      };
    }

    if (data.user) {
      setUser(data.user);
      setSession(data.session ?? null);
    }

    return {
      mfaRequired: false,
      user: data.user,
    };
  };

  // ─── Verify MFA Flow ─────────────────────────────────────────────
  const verifyMfa = async (
    mfaPendingToken: string,
    code: string,
    isBackupCode: boolean = false
  ): Promise<void> => {
    const { data } = await api.post<{
      success: boolean;
      user: PlatformUser;
      session: PlatformSession;
    }>('/auth/mfa/verify', {
      mfaPendingToken,
      code,
      isBackupCode,
    });

    if (data.success && data.user) {
      setUser(data.user);
      setSession(data.session ?? null);
    }
  };

  // ─── Logout Flow ─────────────────────────────────────────────────
  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with client side cleanup regardless
    } finally {
      setUser(null);
      setSession(null);
      setActiveSupportSession(null);
      localStorage.removeItem(USER_CACHE_STORAGE_KEY);
      sessionStorage.removeItem(SUPPORT_SESSION_STORAGE_KEY);
      window.location.replace('/login');
    }
  };

  const role = user?.role ?? null;
  const isAuthenticated = Boolean(user && user.isActive);

  return (
    <PlatformAuthContext.Provider
      value={{
        user,
        role,
        session,
        activeSupportSession,
        isLoading,
        isAuthenticated,
        hasPermission,
        login,
        verifyMfa,
        logout,
        refreshSession,
        setActiveSupportSession,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
};

export function usePlatformAuth(): PlatformAuthContextType {
  const context = useContext(PlatformAuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within a PlatformAuthProvider');
  }
  return context;
}
