/**
 * Bharat Enterprise Billing System — ProtectedRoute Component
 * Guards routes requiring authentication and granular platform permissions.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { PlatformPermission } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PlatformPermission;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, hasPermission } = usePlatformAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-slate-700 border-t-blue-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Authenticating Platform Session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="p-8 max-w-lg mx-auto my-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Access Restricted</h2>
          <p className="text-xs text-slate-400 mt-1">
            Your platform role lacks the required privilege ({requiredPermission}) to view this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
