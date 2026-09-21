/**
 * Structured feature definitions for the Bharat Enterprise landing page.
 * Strictly aligned with backend/saas/shared/features.ts and real application functionality.
 */

export const CORE_CAPABILITIES = [
  {
    id: 'gst-billing',
    title: 'GST-Compliant Invoicing',
    badge: 'Billing & Sales',
    description:
      'Generate clear, compliant invoices with automated HSN lookups, CGST/SGST/IGST tax breakdowns, dual-copy printing, and credit/cash bill types.',
    highlights: [
      'Automatic HSN code and GST rate mapping',
      'Intra-state and inter-state tax split computation',
      'Dual-copy printing (Customer and Business/Transport copies)',
      'Direct credit note generation and return processing',
    ],
  },
  {
    id: 'batch-inventory',
    title: 'Multi-Batch Stock Management',
    badge: 'Inventory & Warehousing',
    description:
      'Track stock at the individual batch level with expiry horizons, MRP, purchase cost, and selling rates. Receive proactive warnings for low stock.',
    highlights: [
      'Batch-level stock tracking with manufacturing & expiry dates',
      'Proactive low-stock and near-expiry status indicators',
      'Unit of measure customization (bottles, boxes, rolls, strips)',
      'Complete inventory movement ledger for auditing stock deltas',
    ],
  },
  {
    id: 'customer-ledger',
    title: 'B2B Customer Khata & Ledgers',
    badge: 'Receivables & Accounting',
    description:
      'Maintain running customer balances across invoices, payments, manual journal entries, and credit notes with full statement histories.',
    highlights: [
      'Running outstanding balance tracking per account',
      'Record full or partial payments with mode and reference notes',
      'Manual debit/credit entries for adjustments and discounts',
      'Exportable account statements and ledger summaries',
    ],
  },
  {
    id: 'procurement-suppliers',
    title: 'Supplier & Purchase Tracking',
    badge: 'Procurement',
    description:
      'Record purchase orders from registered suppliers, update batch inventories upon receipt, and monitor cumulative procurement expenditures.',
    highlights: [
      'Supplier directory with GSTIN, contact details, and terms',
      'Purchase entry with batch creation and stock incrementation',
      'Procurement spend telemetry and monthly purchase analysis',
      'Status tracking across draft, ordered, and completed purchases',
    ],
  },
  {
    id: 'business-intelligence',
    title: 'Executive Intelligence & Analytics',
    badge: 'Telemetry & Reports',
    description:
      'Monitor business velocity with daily sales curves, cash collection ratios, receivables aging, and product velocity reports.',
    highlights: [
      'Daily and monthly sales vs collection comparative trends',
      'Cash flow breakdown donut (collected cash vs active dues)',
      'Average invoice value and volume metrics across date filters',
      'Exportable GST sales registers and purchase reports',
    ],
  },
  {
    id: 'rbac-security',
    title: 'Role-Based Access & Audit Logs',
    badge: 'Team & Governance',
    description:
      'Delegate day-to-day operations to staff with granular permission controls while tracking key administrative events.',
    highlights: [
      'Admin and Employee role segregation',
      'SaaS plan entitlement gating on sensitive features',
      'Detailed activity logs with user, timestamp, and action context',
      'Secure session management and authentication guards',
    ],
  },
];

export const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Stock Inward & Batches',
    description: 'Procure goods from suppliers, record purchase invoices, and automatically assign batch numbers with expiry dates.',
  },
  {
    step: '02',
    title: 'Tax Invoice Generation',
    description: 'Select customer, pick items from available batches, and apply automatic GST tax calculations.',
  },
  {
    step: '03',
    title: 'Stock Deduction',
    description: 'Inventory levels and batch allocations are decremented atomically with stock movement logs.',
  },
  {
    step: '04',
    title: 'Ledger Posting',
    description: 'The invoice amount is posted to the customer account ledger, updating running receivables.',
  },
  {
    step: '05',
    title: 'Payment Reconciliation',
    description: 'Collect cash, UPI, or bank transfer payments and record receipts to settle outstanding balances.',
  },
  {
    step: '06',
    title: 'Reports & GST Filing',
    description: 'Review monthly sales registers, tax breakdowns, and cash flow telemetry for tax compliance.',
  },
];

export const CANONICAL_PLANS = [
  {
    id: 'starter',
    code: 'STARTER',
    name: 'Starter',
    baseMonthlyPrice: 299,
    description: 'Essential billing and customer management for single-location operations.',
    features: [
      'Dashboard & Overview',
      'Customer Directory',
      'Product Catalog',
      'Create & Print Invoices',
      'Invoice History & Downloads',
      'Basic Business Reports',
    ],
    popular: false,
    ctaText: 'Start with Starter',
  },
  {
    id: 'business',
    code: 'BUSINESS',
    name: 'Business',
    baseMonthlyPrice: 499,
    description: 'Comprehensive workflow suite including ledger khata, collections, and purchasing.',
    features: [
      'All Starter capabilities',
      'Supplier Management',
      'Purchase Entries & Tracking',
      'Inventory Movement Ledger',
      'Collections & Payment Receipts',
      'Credit Notes & Returns',
      'Customer Khata & Ledgers',
      'Manual Journal Entries',
      'Outstanding Balance Tracking',
    ],
    popular: true,
    ctaText: 'Choose Business',
  },
  {
    id: 'professional',
    code: 'PROFESSIONAL',
    name: 'Professional',
    baseMonthlyPrice: 699,
    description: 'Full enterprise suite with team access, GST compliance, and intelligence.',
    features: [
      'All Business capabilities',
      'Employee Management & RBAC',
      'Employee Activity Analytics',
      'Administrative Activity Logs',
      'GST Reports & Tax Filing Data',
      'Advanced Business Reporting',
      'Inventory Intelligence Engine',
    ],
    popular: false,
    ctaText: 'Choose Professional',
  },
];

export const DURATION_DISCOUNTS = [
  { durationMonths: 1, label: 'Monthly', discountPercent: 0 },
  { durationMonths: 3, label: 'Quarterly (3 Mo)', discountPercent: 5 },
  { durationMonths: 6, label: 'Half-Yearly (6 Mo)', discountPercent: 10 },
  { durationMonths: 12, label: 'Annual (12 Mo)', discountPercent: 20 },
];
