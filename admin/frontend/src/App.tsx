/**
 * Bharat Enterprise Billing System — Platform Control Plane App Root
 * Configures QueryClient, Auth Provider, and React Router routing hierarchy.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlatformAuthProvider } from './contexts/PlatformAuthContext';
import PlatformLayout from './components/layout/PlatformLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TenantsPage from './pages/TenantsPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import CampaignsPage from './pages/CampaignsPage';
import FeaturesPage from './pages/FeaturesPage';
import SupportPage from './pages/SupportPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import { PlatformPermission } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <PlatformAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Platform Control Plane Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <PlatformLayout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.DASHBOARD_VIEW}>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="tenants"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.TENANTS_VIEW}>
                    <TenantsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="subscriptions"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.SUBSCRIPTIONS_VIEW}>
                    <SubscriptionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="campaigns"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.SUBSCRIPTIONS_VIEW}>
                    <CampaignsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="features"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.FEATURE_OVERRIDES_VIEW}>
                    <FeaturesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="support"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.SUPPORT_START}>
                    <SupportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.AUDIT_VIEW}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute requiredPermission={PlatformPermission.USERS_VIEW}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PlatformAuthProvider>
    </QueryClientProvider>
  );
};

export default App;
