/**
 * Feature Constants — Frontend copy of backend feature system.
 *
 * This mirrors backend/saas/shared/features.ts for use in
 * React components (nav filtering, feature gating, etc.)
 */

// ─── Feature Enum ────────────────────────────────────────────────
export const Feature = {
  DASHBOARD:           'DASHBOARD',
  CUSTOMERS:           'CUSTOMERS',
  PRODUCTS:            'PRODUCTS',
  INVOICE_CREATE:      'INVOICE_CREATE',
  INVOICE_HISTORY:     'INVOICE_HISTORY',
  INVOICE_PRINT:       'INVOICE_PRINT',
  PAYMENTS:            'PAYMENTS',
  COLLECTIONS:         'COLLECTIONS',
  CREDIT_NOTES:        'CREDIT_NOTES',
  NOTES:               'NOTES',
  MANUAL_ENTRIES:      'MANUAL_ENTRIES',
  LEDGER:              'LEDGER',
  OUTSTANDING_TRACKING:'OUTSTANDING_TRACKING',
  EMPLOYEES:           'EMPLOYEES',
  EMPLOYEE_ANALYTICS:  'EMPLOYEE_ANALYTICS',
  ACTIVITY_LOGS:       'ACTIVITY_LOGS',
  GST_REPORTS:         'GST_REPORTS',
  ADVANCED_REPORTING:  'ADVANCED_REPORTING',
};

// ─── Route → Feature mapping ────────────────────────────────────
// Maps frontend routes to the feature they require.
// Used by Sidebar/Navbar to show/hide/lock items.
export const ROUTE_FEATURE_MAP = {
  '/':                   Feature.DASHBOARD,
  '/products':           Feature.PRODUCTS,
  '/customers':          Feature.CUSTOMERS,
  '/invoices/create':    Feature.INVOICE_CREATE,
  '/invoices':           Feature.INVOICE_HISTORY,
  '/credits':            Feature.CREDIT_NOTES,
  '/collections':        Feature.COLLECTIONS,
  '/notes':              Feature.NOTES,
  '/manual-entries':     Feature.MANUAL_ENTRIES,
  '/employees':          Feature.EMPLOYEES,
  '/employee-analytics': Feature.EMPLOYEE_ANALYTICS,
  '/activity-log':       Feature.ACTIVITY_LOGS,
  '/reports/gst':        Feature.GST_REPORTS,
};

// ─── Subscription Statuses ───────────────────────────────────────
export const SubscriptionStatus = {
  TRIAL:     'trial',
  ACTIVE:    'active',
  GRACE:     'grace',
  EXPIRED:   'expired',
  SUSPENDED: 'suspended',
};
