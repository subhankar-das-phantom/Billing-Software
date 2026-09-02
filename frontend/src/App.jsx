import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth, AdminRoute } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { Feature, getFeatureForRoute } from './saas/features';
import { ShieldAlert, LogOut } from 'lucide-react';
import PlanAccessRestricted from './components/Common/Guards/PlanAccessRestricted';

// Eager load - needed immediately
import DashboardLayout from './components/Layout/DashboardLayout';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import LandingPage from './pages/Landing/LandingPage';

// Lazy load - loaded on-demand for better initial performance
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('./pages/Products/ProductsPage'));
const CustomersPage = lazy(() => import('./pages/Customers/CustomersPage'));
const CustomerDetailsPage = lazy(() => import('./pages/Customers/CustomerDetailsPage'));
const SuppliersPage = lazy(() => import('./pages/Suppliers/SuppliersPage'));
const SupplierDetailsPage = lazy(() => import('./pages/Suppliers/SupplierDetailsPage'));
const PurchasesPage = lazy(() => import('./pages/Purchases/PurchasesPage'));
const PurchaseCreatePage = lazy(() => import('./pages/Purchases/PurchaseCreatePage'));
const PurchaseDetailsPage = lazy(() => import('./pages/Purchases/PurchaseDetailsPage'));
const InventoryLedgerPage = lazy(() => import('./pages/Inventory/InventoryLedgerPage'));
const InvoicesPage = lazy(() => import('./pages/Invoices/InvoicesPage'));
const InvoiceCreatePage = lazy(() => import('./pages/Invoices/InvoiceCreatePage'));
const InvoiceViewPage = lazy(() => import('./pages/Invoices/InvoiceViewPage'));
const NotesPage = lazy(() => import('./pages/Notes/NotesPage'));
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CollectionsPage = lazy(() => import('./pages/Collections/CollectionsPage'));
const SubscriptionPage = lazy(() => import('./pages/Subscription/SubscriptionPage'));
const ReferralPage = lazy(() => import('./pages/Referral/ReferralPage'));
const CreditsPage = lazy(() => import('./pages/CreditNotes/CreditsPage'));

// Admin-only pages
const EmployeesPage = lazy(() => import('./pages/Employees/EmployeesPage'));
const EmployeeDetailPage = lazy(() => import('./pages/Employees/EmployeeDetailPage'));
const EmployeeAnalyticsPage = lazy(() => import('./pages/Employees/EmployeeAnalyticsPage'));
const ActivityLogPage = lazy(() => import('./pages/Admin/ActivityLogPage'));
const ManualEntriesPage = lazy(() => import('./pages/Admin/ManualEntriesPage'));

// Batch & Credit Note pages
const ProductDetailsPage = lazy(() => import('./pages/Products/ProductDetailsPage'));
const CreditNoteCreatePage = lazy(() => import('./pages/CreditNotes/CreditNoteCreatePage'));
const CreditNoteViewPage = lazy(() => import('./pages/CreditNotes/CreditNoteViewPage'));

// Report pages
const PrivacyPolicyPage = lazy(() => import('./pages/Legal/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/Legal/TermsPage'));

import AppShellSkeleton from './components/Layout/AppShellSkeleton';

// Page loading fallback
function PageLoader() {
  return <AppShellSkeleton />;
}

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { canAccess, loading: subLoading } = useSubscription();
  
  if (loading || subLoading) {
    return <AppShellSkeleton />;
  }
  
  if (!user) {
    return <Navigate to="/landing" replace />;
  }

  // Check if employee has access based on tenant's subscription
  if (!isAdmin && canAccess && !canAccess(Feature.EMPLOYEES)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="glass-card p-10 max-w-md w-full text-center border-accent-500/30 shadow-2xl shadow-accent-500/10">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6 border border-red-500/30">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Access Restricted</h2>
          <p className="text-slate-400 mb-8">
            {user.firmName ? `${user.firmName}'s` : "Your firm's"} subscription does not include employee access. Please ask your administrator to upgrade to the Professional plan to use this account.
          </p>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium border border-slate-700 hover:border-slate-600"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    );
  }
  
  return children;
}

// Plan Feature Guard (renders PlanAccessRestricted if feature is not supported by current plan)
function PlanGuard({ feature: explicitFeature, children }) {
  const { canAccess, loading: subLoading, planName } = useSubscription();
  const location = useLocation();

  const requiredFeature = explicitFeature || getFeatureForRoute(location.pathname);
  const isFeatureAllowed = requiredFeature ? (canAccess ? canAccess(requiredFeature) : true) : true;

  if (subLoading) {
    return <AppShellSkeleton />;
  }

  if (!isFeatureAllowed) {
    return <PlanAccessRestricted feature={requiredFeature} currentPlan={planName} />;
  }

  return children;
}

// Permission Route Wrapper (Enforces SaaS Plan Entitlement + Employee RBAC)
function PermissionRoute({ resource, action = 'view', feature: explicitFeature, children }) {
  const { hasPermission, loading, showToast } = useAuth();
  const { canAccess, loading: subLoading, planName } = useSubscription();
  const location = useLocation();

  const requiredFeature = explicitFeature || getFeatureForRoute(location.pathname);
  const isFeatureAllowed = requiredFeature ? (canAccess ? canAccess(requiredFeature) : true) : true;

  useEffect(() => {
    if (!loading && !subLoading && isFeatureAllowed && !hasPermission(resource, action)) {
      showToast('Access denied by admin', 'error');
    }
  }, [loading, subLoading, isFeatureAllowed, hasPermission, resource, action, showToast]);

  if (loading || subLoading) {
    return <AppShellSkeleton />;
  }

  // 1. Enforce SaaS Plan Entitlement first
  if (!isFeatureAllowed) {
    return <PlanAccessRestricted feature={requiredFeature} currentPlan={planName} />;
  }

  // 2. Enforce Employee RBAC permission
  if (!hasPermission(resource, action)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Public Route Wrapper (redirect if logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return null;
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Landing Page - Public */}
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        
        {/* Protected Operational Routes */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<PermissionRoute resource="products"><ProductsPage /></PermissionRoute>} />
          <Route path="/products/:id" element={<PermissionRoute resource="products"><ProductDetailsPage /></PermissionRoute>} />
          <Route path="/customers" element={<PermissionRoute resource="customers"><CustomersPage /></PermissionRoute>} />
          <Route path="/customers/:id" element={<PermissionRoute resource="customers"><CustomerDetailsPage /></PermissionRoute>} />
          
          {/* Business & Pro Tier: Suppliers */}
          <Route path="/suppliers" element={<PermissionRoute resource="suppliers" feature={Feature.SUPPLIERS}><SuppliersPage /></PermissionRoute>} />
          <Route path="/suppliers/:id" element={<PermissionRoute resource="suppliers" feature={Feature.SUPPLIERS}><SupplierDetailsPage /></PermissionRoute>} />
          
          {/* Business & Pro Tier: Purchases */}
          <Route path="/purchases" element={<PermissionRoute resource="purchases" feature={Feature.PURCHASES}><PurchasesPage /></PermissionRoute>} />
          <Route path="/purchases/new" element={<PermissionRoute resource="purchases" action="create" feature={Feature.PURCHASES}><PurchaseCreatePage /></PermissionRoute>} />
          <Route path="/purchases/:id/edit" element={<PermissionRoute resource="purchases" action="edit" feature={Feature.PURCHASES}><PurchaseCreatePage /></PermissionRoute>} />
          <Route path="/purchases/:id" element={<PermissionRoute resource="purchases" feature={Feature.PURCHASES}><PurchaseDetailsPage /></PermissionRoute>} />
          
          {/* Business & Pro Tier: Inventory Ledger */}
          <Route path="/inventory/ledger" element={<PermissionRoute resource="inventory" action="view" feature={Feature.INVENTORY_LEDGER}><InventoryLedgerPage /></PermissionRoute>} />
          
          {/* Invoices */}
          <Route path="/invoices" element={<PermissionRoute resource="invoices"><InvoicesPage /></PermissionRoute>} />
          <Route path="/invoices/create" element={<PermissionRoute resource="invoices" action="create"><InvoiceCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id/edit" element={<PermissionRoute resource="invoices" action="edit"><InvoiceCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id/return" element={<PermissionRoute resource="creditNotes" action="create" feature={Feature.CREDIT_NOTES}><CreditNoteCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id" element={<PermissionRoute resource="invoices"><InvoiceViewPage /></PermissionRoute>} />
          
          {/* Business & Pro Tier: Credit Notes & Notes & Collections */}
          <Route path="/credit-notes/:id" element={<PermissionRoute resource="creditNotes" feature={Feature.CREDIT_NOTES}><CreditNoteViewPage /></PermissionRoute>} />
          <Route path="/credits" element={<PermissionRoute resource="creditNotes" feature={Feature.CREDIT_NOTES}><CreditsPage /></PermissionRoute>} />
          <Route path="/notes" element={<PermissionRoute resource="notes" feature={Feature.NOTES}><NotesPage /></PermissionRoute>} />
          <Route path="/collections" element={<PermissionRoute resource="payments" feature={Feature.COLLECTIONS}><CollectionsPage /></PermissionRoute>} />
          
          {/* Reports Hub */}
          <Route path="/reports" element={<PermissionRoute resource="reports"><ReportsPage /></PermissionRoute>} />
          <Route path="/reports/purchases" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="purchases" /></PermissionRoute>} />
          <Route path="/reports/gst" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="gst-report" /></PermissionRoute>} />
          <Route path="/reports/inventory" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="inventory-intelligence" /></PermissionRoute>} />
          <Route path="/reports/inventory-movements" element={<Navigate to="/inventory/ledger" replace />} />
          
          {/* Admin Routes */}
          <Route 
            path="/subscription" 
            element={
              <AdminRoute>
                <SubscriptionPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/referral" 
            element={
              <AdminRoute>
                <ReferralPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <AdminRoute>
                <SettingsPage />
              </AdminRoute>
            } 
          />
          
          {/* Pro Tier Only: Employee Management */}
          <Route 
            path="/employees" 
            element={
              <AdminRoute>
                <PlanGuard feature={Feature.EMPLOYEES}>
                  <EmployeesPage />
                </PlanGuard>
              </AdminRoute>
            } 
          />
          <Route 
            path="/employees/:id" 
            element={
              <AdminRoute>
                <PlanGuard feature={Feature.EMPLOYEES}>
                  <EmployeeDetailPage />
                </PlanGuard>
              </AdminRoute>
            } 
          />
          <Route 
            path="/employee-analytics" 
            element={
              <AdminRoute>
                <PlanGuard feature={Feature.EMPLOYEE_ANALYTICS}>
                  <EmployeeAnalyticsPage />
                </PlanGuard>
              </AdminRoute>
            } 
          />
          <Route 
            path="/activity-log" 
            element={
              <AdminRoute>
                <PlanGuard feature={Feature.ACTIVITY_LOGS}>
                  <ActivityLogPage />
                </PlanGuard>
              </AdminRoute>
            } 
          />
          <Route 
            path="/manual-entries" 
            element={
              <AdminRoute>
                <PlanGuard feature={Feature.MANUAL_ENTRIES}>
                  <ManualEntriesPage />
                </PlanGuard>
              </AdminRoute>
            } 
          />
        </Route>
        
        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <AppRoutes />
          </SubscriptionProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
