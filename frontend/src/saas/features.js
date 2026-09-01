/**
 * Feature Constants — Frontend copy of backend feature system.
 *
 * This mirrors backend/saas/shared/features.ts for use in
 * React components (nav filtering, feature gating, route guards, etc.)
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
  REPORTS:             'REPORTS',
  SUPPLIERS:           'SUPPLIERS',
  PURCHASES:           'PURCHASES',
  PURCHASE_REPORTS:    'PURCHASE_REPORTS',
  INVENTORY_LEDGER:    'INVENTORY_LEDGER',
  INVENTORY_INTELLIGENCE: 'INVENTORY_INTELLIGENCE',
};

// ─── Feature Labels ──────────────────────────────────────────────
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
  [Feature.SUPPLIERS]: 'Supplier Management',
  [Feature.PURCHASES]: 'Purchase Entry & Management',
  [Feature.PURCHASE_REPORTS]: 'Purchase Reports & Analytics',
  [Feature.INVENTORY_LEDGER]: 'Inventory Movement Ledger',
  [Feature.EMPLOYEES]: 'Employee Management',
  [Feature.EMPLOYEE_ANALYTICS]: 'Employee Analytics',
  [Feature.ACTIVITY_LOGS]: 'Activity Logs',
  [Feature.GST_REPORTS]: 'GST Reports & Filing',
  [Feature.ADVANCED_REPORTING]: 'Advanced Reporting',
  [Feature.INVENTORY_INTELLIGENCE]: 'Inventory Intelligence Engine',
  [Feature.REPORTS]: 'Business Reports',
};

// ─── Required Plan Tier for Features ─────────────────────────────
export const FEATURE_TIER_NAMES = {
  [Feature.SUPPLIERS]: 'Business',
  [Feature.PURCHASES]: 'Business',
  [Feature.PURCHASE_REPORTS]: 'Business',
  [Feature.INVENTORY_LEDGER]: 'Business',
  [Feature.COLLECTIONS]: 'Business',
  [Feature.CREDIT_NOTES]: 'Business',
  [Feature.NOTES]: 'Business',
  [Feature.MANUAL_ENTRIES]: 'Business',
  [Feature.LEDGER]: 'Business',
  [Feature.OUTSTANDING_TRACKING]: 'Business',
  [Feature.EMPLOYEES]: 'Professional',
  [Feature.EMPLOYEE_ANALYTICS]: 'Professional',
  [Feature.ACTIVITY_LOGS]: 'Professional',
  [Feature.GST_REPORTS]: 'Professional',
  [Feature.ADVANCED_REPORTING]: 'Professional',
  [Feature.INVENTORY_INTELLIGENCE]: 'Professional',
};

// ─── Route → Feature helper (supports subpaths and query params) ─
export function getFeatureForRoute(routePath) {
  if (!routePath) return null;
  const path = routePath.split('?')[0].replace(/\/$/, '') || '/';

  if (path === '/') return Feature.DASHBOARD;
  if (path.startsWith('/suppliers')) return Feature.SUPPLIERS;
  if (path.startsWith('/purchases')) return Feature.PURCHASES;
  if (path.startsWith('/inventory/ledger')) return Feature.INVENTORY_LEDGER;
  if (path.startsWith('/collections')) return Feature.COLLECTIONS;
  if (path.startsWith('/credits') || path.startsWith('/credit-notes')) return Feature.CREDIT_NOTES;
  if (path.startsWith('/notes')) return Feature.NOTES;
  if (path.startsWith('/manual-entries')) return Feature.MANUAL_ENTRIES;
  if (path.startsWith('/employees')) return Feature.EMPLOYEES;
  if (path.startsWith('/employee-analytics')) return Feature.EMPLOYEE_ANALYTICS;
  if (path.startsWith('/activity-log')) return Feature.ACTIVITY_LOGS;
  if (path.startsWith('/reports/gst')) return Feature.GST_REPORTS;
  if (path.startsWith('/reports/purchases')) return Feature.PURCHASE_REPORTS;
  if (path.startsWith('/reports/inventory')) return Feature.INVENTORY_INTELLIGENCE;
  if (path.startsWith('/reports')) return Feature.REPORTS;
  if (path.startsWith('/products')) return Feature.PRODUCTS;
  if (path.startsWith('/customers')) return Feature.CUSTOMERS;
  if (path.startsWith('/invoices/create') || path.includes('/edit') || path.endsWith('/return')) return Feature.INVOICE_CREATE;
  if (path.startsWith('/invoices')) return Feature.INVOICE_HISTORY;

  return null;
}

// ─── Static Map for Top-Level Nav Items ──────────────────────────
export const ROUTE_FEATURE_MAP = {
  '/':                            Feature.DASHBOARD,
  '/products':                    Feature.PRODUCTS,
  '/customers':                   Feature.CUSTOMERS,
  '/invoices/create':             Feature.INVOICE_CREATE,
  '/invoices':                    Feature.INVOICE_HISTORY,
  '/credits':                     Feature.CREDIT_NOTES,
  '/collections':                 Feature.COLLECTIONS,
  '/suppliers':                   Feature.SUPPLIERS,
  '/purchases':                   Feature.PURCHASES,
  '/purchases/new':               Feature.PURCHASES,
  '/inventory/ledger':            Feature.INVENTORY_LEDGER,
  '/notes':                       Feature.NOTES,
  '/manual-entries':              Feature.MANUAL_ENTRIES,
  '/employees':                   Feature.EMPLOYEES,
  '/employee-analytics':          Feature.EMPLOYEE_ANALYTICS,
  '/activity-log':                Feature.ACTIVITY_LOGS,
  '/reports/gst':                 Feature.GST_REPORTS,
  '/reports/purchases':           Feature.PURCHASE_REPORTS,
  '/reports/inventory':           Feature.INVENTORY_INTELLIGENCE,
  '/reports':                     Feature.REPORTS,
};

// ─── Subscription Statuses ───────────────────────────────────────
export const SubscriptionStatus = {
  TRIAL:     'trial',
  ACTIVE:    'active',
  GRACE:     'grace',
  EXPIRED:   'expired',
  SUSPENDED: 'suspended',
};
