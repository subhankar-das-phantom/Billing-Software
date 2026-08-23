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

// ─── Feature Labels ──────────────────────────────────────────────
// Friendly names for displaying in UI (e.g. pricing tables)
export const FEATURE_LABELS = {
  [Feature.DASHBOARD]: 'Dashboard Access',
  [Feature.CUSTOMERS]: 'Customer Management',
  [Feature.PRODUCTS]: 'Product Catalog',
  [Feature.INVOICE_CREATE]: 'Create Invoices',
  [Feature.INVOICE_HISTORY]: 'Invoice History',
  [Feature.INVOICE_PRINT]: 'Print & Export Invoices',
  [Feature.PAYMENTS]: 'Payment Tracking',
  [Feature.COLLECTIONS]: 'Collections Management',
  [Feature.CREDIT_NOTES]: 'Credit Notes & Returns',
  [Feature.NOTES]: 'Notes & Reminders',
  [Feature.MANUAL_ENTRIES]: 'Manual Journal Entries',
  [Feature.LEDGER]: 'Ledger Tracking',
  [Feature.OUTSTANDING_TRACKING]: 'Outstanding Balance Tracking',
  [Feature.EMPLOYEES]: 'Employee Management',
  [Feature.EMPLOYEE_ANALYTICS]: 'Employee Analytics',
  [Feature.ACTIVITY_LOGS]: 'Activity Logs',
  [Feature.GST_REPORTS]: 'GST Reports & Filing',
  [Feature.ADVANCED_REPORTING]: 'Advanced Reporting',
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
