/**
 * Navigation Data Configuration for Bharat Enterprise Landing Page.
 * Grounded in actual application routing and section anchors.
 */

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Billing & Tax', href: '#billing' },
  { label: 'Inventory', href: '#inventory' },
  { label: 'Ledger & Khata', href: '#ledger' },
  { label: 'Workflows', href: '#workflows' },
  { label: 'Analytics', href: '#analytics' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const AUTH_ACTIONS = {
  login: {
    label: 'Sign In',
    href: '/login',
  },
  register: {
    label: 'Get Started',
    href: '/register',
  },
};

export const FOOTER_SECTIONS = [
  {
    title: 'Product Capabilities',
    links: [
      { label: 'GST Invoicing & Billing', href: '#billing' },
      { label: 'Multi-Batch Inventory', href: '#inventory' },
      { label: 'Customer Ledger & Khata', href: '#ledger' },
      { label: 'Business Intelligence', href: '#analytics' },
      { label: 'Procurement & Suppliers', href: '#features' },
      { label: 'Staff Role-Based Access', href: '#features' },
    ],
  },
  {
    title: 'Compliance & Standards',
    links: [
      { label: 'Indian GST Compliance', href: '#gst' },
      { label: 'HSN Code & Tax Rates', href: '#gst' },
      { label: 'Drug License Tracking', href: '#gst' },
      { label: 'Dual-Copy Invoicing', href: '#billing' },
      { label: 'Payment Receipt Vouchers', href: '#ledger' },
    ],
  },
  {
    title: 'Account & Plans',
    links: [
      { label: 'SaaS Subscription Plans', href: '#pricing' },
      { label: 'Sign In to Portal', href: '/login' },
      { label: 'Create New Account', href: '/register' },
      { label: 'Frequently Asked Questions', href: '#faq' },
    ],
  },
  {
    title: 'Legal & Policies',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
    ],
  },
];
