import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth, AdminRoute } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { Feature } from './saas/features';
import { ShieldAlert, LogOut } from 'lucide-react';

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
const InvoicesPage = lazy(() => import('./pages/Invoices/InvoicesPage'));
const InvoiceCreatePage = lazy(() => import('./pages/Invoices/InvoiceCreatePage'));
const InvoiceViewPage = lazy(() => import('./pages/Invoices/InvoiceViewPage'));
const NotesPage = lazy(() => import('./pages/Notes/NotesPage'));
const CreditsPage = lazy(() => import('./pages/CreditNotes/CreditsPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CollectionsPage = lazy(() => import('./pages/Collections/CollectionsPage'));
const SubscriptionPage = lazy(() => import('./pages/Subscription/SubscriptionPage'));
const ReferralPage = lazy(() => import('./pages/Referral/ReferralPage'));

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
const ReportsPage = lazy(() => import('./pages/Reports/ReportsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/Legal/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/Legal/TermsPage'));

// Landing page (eagerly loaded — it's the entry point for new users)

// Page loading spinner removed as per request
function PageLoader() {
  return null;
}

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user, loading, isAdmin, logout } = useAuth();
  const { canAccess, loading: subLoading } = useSubscription();
  
  if (loading || subLoading) {
    return null;
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

// Permission Route Wrapper
function PermissionRoute({ resource, action = 'view', children }) {
  const { hasPermission, loading, showToast } = useAuth();
  
  useEffect(() => {
    if (!loading && !hasPermission(resource, action)) {
      showToast('Access denied by admin', 'error');
    }
  }, [loading, hasPermission, resource, action, showToast]);

  if (loading) {
    return null;
  }
  
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
        
        {/* Protected Routes */}
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
          <Route path="/invoices" element={<PermissionRoute resource="invoices"><InvoicesPage /></PermissionRoute>} />
          <Route path="/invoices/create" element={<PermissionRoute resource="invoices" action="create"><InvoiceCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id/edit" element={<PermissionRoute resource="invoices" action="edit"><InvoiceCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id/return" element={<PermissionRoute resource="creditNotes" action="create"><CreditNoteCreatePage /></PermissionRoute>} />
          <Route path="/invoices/:id" element={<PermissionRoute resource="invoices"><InvoiceViewPage /></PermissionRoute>} />
          <Route path="/credit-notes/:id" element={<PermissionRoute resource="creditNotes"><CreditNoteViewPage /></PermissionRoute>} />
          <Route path="/notes" element={<PermissionRoute resource="notes"><NotesPage /></PermissionRoute>} />
          <Route path="/credits" element={<PermissionRoute resource="creditNotes"><CreditsPage /></PermissionRoute>} />
          <Route path="/collections" element={<PermissionRoute resource="payments"><CollectionsPage /></PermissionRoute>} />
          <Route path="/reports" element={<PermissionRoute resource="reports"><ReportsPage /></PermissionRoute>} />
          <Route path="/reports/gst" element={<Navigate to="/reports" replace />} />
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
          
          {/* Admin-only routes */}
          <Route 
            path="/employees" 
            element={
              <AdminRoute>
                <EmployeesPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/employees/:id" 
            element={
              <AdminRoute>
                <EmployeeDetailPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/employee-analytics" 
            element={
              <AdminRoute>
                <EmployeeAnalyticsPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/activity-log" 
            element={
              <AdminRoute>
                <ActivityLogPage />
              </AdminRoute>
            } 
          />
          <Route 
            path="/manual-entries" 
            element={
              <AdminRoute>
                <ManualEntriesPage />
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
      <AuthProvider>
        <SubscriptionProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
