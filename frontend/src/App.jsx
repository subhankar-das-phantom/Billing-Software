import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth, AdminRoute } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

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
const PurchaseReportsPage = lazy(() => import('./pages/Reports/PurchaseReportsPage'));
const InventoryMovementReportPage = lazy(() => import('./pages/Reports/InventoryMovementReportPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CollectionsPage = lazy(() => import('./pages/Collections/CollectionsPage'));
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

// Landing page (eagerly loaded — it's the entry point for new users)

// Page loading spinner removed as per request
function PageLoader() {
  return null;
}

// Protected Route Wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return null;
  }
  
  if (!user) {
    return <Navigate to="/landing" replace />;
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
          <Route path="/suppliers" element={<PermissionRoute resource="suppliers"><SuppliersPage /></PermissionRoute>} />
          <Route path="/suppliers/:id" element={<PermissionRoute resource="suppliers"><SupplierDetailsPage /></PermissionRoute>} />
          <Route path="/purchases" element={<PermissionRoute resource="purchases"><PurchasesPage /></PermissionRoute>} />
          <Route path="/purchases/new" element={<PermissionRoute resource="purchases" action="create"><PurchaseCreatePage /></PermissionRoute>} />
          <Route path="/purchases/:id/edit" element={<PermissionRoute resource="purchases" action="edit"><PurchaseCreatePage /></PermissionRoute>} />
          <Route path="/purchases/:id" element={<PermissionRoute resource="purchases"><PurchaseDetailsPage /></PermissionRoute>} />
          <Route path="/inventory/ledger" element={<PermissionRoute resource="inventory" action="view"><InventoryLedgerPage /></PermissionRoute>} />
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
          <Route path="/reports/purchases" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="purchases" /></PermissionRoute>} />
          <Route path="/reports/gst" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="gst-report" /></PermissionRoute>} />
          <Route path="/reports/inventory" element={<PermissionRoute resource="reports"><ReportsPage defaultTab="inventory-intelligence" /></PermissionRoute>} />
          <Route path="/reports/inventory-movements" element={<Navigate to="/inventory/ledger" replace />} />
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
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
