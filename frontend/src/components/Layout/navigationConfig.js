import {
  LayoutDashboard,
  Package,
  Users,
  FilePlus,
  FileText,
  Wallet,
  Banknote,
  Truck,
  ShoppingCart,
  History,
  UsersRound,
  BarChart3,
  Shield,
  StickyNote,
  FileBarChart,
  Clock,
  Settings,
  PlusCircle
} from 'lucide-react';

/**
 * Central navigation configuration for Bharat Enterprise ERP.
 * Single source of truth for:
 * - Sidebar Navigation
 * - Header Breadcrumbs & Page Titles
 * - Command Palette (Ctrl+K)
 */
export const NAVIGATION_SECTIONS = [
  {
    id: 'main',
    title: 'MAIN',
    items: [
      {
        id: 'dashboard',
        path: '/',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
        permission: null, // Public within auth
      },
    ],
  },
  {
    id: 'sales',
    title: 'SALES',
    items: [
      {
        id: 'customers',
        path: '/customers',
        label: 'Customers',
        icon: Users,
        permission: { module: 'customers', action: 'view' },
      },
      {
        id: 'invoices',
        path: '/invoices',
        label: 'Invoices',
        icon: FileText,
        permission: { module: 'invoices', action: 'view' },
        getBadge: (dynamicData) => {
          if (dynamicData?.invoiceCount && dynamicData.invoiceCount > 0) {
            return {
              text: String(dynamicData.invoiceCount),
              color: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
            };
          }
          return null;
        },
      },
      {
        id: 'create-invoice',
        path: '/invoices/create',
        label: 'Create Invoice',
        icon: FilePlus,
        permission: { module: 'invoices', action: 'create' },
        badge: {
          text: 'New',
          color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
        },
      },
      {
        id: 'credits',
        path: '/credits',
        label: 'Credits',
        icon: Wallet,
        permission: { module: 'creditNotes', action: 'view' },
      },
      {
        id: 'collections',
        path: '/collections',
        label: 'Collections',
        icon: Banknote,
        permission: { module: 'payments', action: 'view' },
      },
    ],
  },
  {
    id: 'inventory',
    title: 'INVENTORY',
    items: [
      {
        id: 'products',
        path: '/products',
        label: 'Products',
        icon: Package,
        permission: { module: 'products', action: 'view' },
      },
      {
        id: 'suppliers',
        path: '/suppliers',
        label: 'Suppliers',
        icon: Truck,
        permission: { module: 'suppliers', action: 'view' },
      },
      {
        id: 'purchases',
        path: '/purchases',
        label: 'Purchases',
        icon: ShoppingCart,
        permission: { module: 'purchases', action: 'view' },
      },
      {
        id: 'inventory-ledger',
        path: '/inventory/ledger',
        label: 'Inventory Ledger',
        icon: History,
        permission: { module: 'inventory', action: 'view' },
      },
    ],
  },
  {
    id: 'employees',
    title: 'EMPLOYEES',
    items: [
      {
        id: 'employees',
        path: '/employees',
        label: 'Employees',
        icon: UsersRound,
        adminOnly: true,
        permission: { module: 'employees', action: 'view' },
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
      {
        id: 'employee-analytics',
        path: '/employee-analytics',
        label: 'Employee Analytics',
        icon: BarChart3,
        adminOnly: true,
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
      {
        id: 'activity-log',
        path: '/activity-log',
        label: 'Activity Log',
        icon: Clock,
        adminOnly: true,
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
    ],
  },
  {
    id: 'operations',
    title: 'OPERATIONS',
    items: [
      {
        id: 'manual-entries',
        path: '/manual-entries',
        label: 'Manual Entries',
        icon: Shield,
        adminOnly: true,
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
      {
        id: 'notes',
        path: '/notes',
        label: 'Notes',
        icon: StickyNote,
        permission: { module: 'notes', action: 'view' },
      },
    ],
  },
  {
    id: 'analytics',
    title: 'ANALYTICS',
    items: [
      {
        id: 'reports',
        path: '/reports',
        label: 'Reports',
        icon: FileBarChart,
        adminOnly: true,
        permission: { module: 'reports', action: 'view' },
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
    ],
  },
  {
    id: 'system',
    title: 'SYSTEM',
    items: [
      {
        id: 'settings',
        path: '/settings',
        label: 'Settings',
        icon: Settings,
        adminOnly: true,
        badge: {
          text: 'Admin',
          color: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
        },
      },
    ],
  },
];

/**
 * Quick action shortcuts for the Command Palette
 */
export const QUICK_ACTIONS = [
  {
    id: 'action-create-invoice',
    label: 'Create New Invoice',
    category: 'Quick Actions',
    path: '/invoices/create',
    icon: FilePlus,
    permission: { module: 'invoices', action: 'create' },
    keywords: ['new invoice', 'bill', 'sale', 'billing', 'create'],
  },
  {
    id: 'action-add-product',
    label: 'Add New Product',
    category: 'Quick Actions',
    path: '/products',
    icon: PlusCircle,
    permission: { module: 'products', action: 'create' },
    keywords: ['new product', 'item', 'inventory', 'stock'],
  },
  {
    id: 'action-add-customer',
    label: 'Add New Customer',
    category: 'Quick Actions',
    path: '/customers',
    icon: Users,
    permission: { module: 'customers', action: 'create' },
    keywords: ['new customer', 'client', 'buyer'],
  },
  {
    id: 'action-record-purchase',
    label: 'Record Purchase Order',
    category: 'Quick Actions',
    path: '/purchases/new',
    icon: ShoppingCart,
    permission: { module: 'purchases', action: 'create' },
    keywords: ['purchase', 'vendor', 'supplier invoice', 'buy', 'stock in'],
  },
  {
    id: 'action-manual-entry',
    label: 'Create Manual Entry',
    category: 'Quick Actions',
    path: '/manual-entries',
    icon: Shield,
    adminOnly: true,
    keywords: ['manual adjustment', 'stock correction', 'audit'],
  },
];

/**
 * Filter navigation sections based on user role and permissions.
 * Any section with 0 accessible items will be omitted completely.
 */
export function getFilteredNavigation({ isAdmin, hasPermission, dynamicData = {} }) {
  const checkAccess = (item) => {
    // If adminOnly, require isAdmin
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    // If permission defined, verify either isAdmin or hasPermission
    if (item.permission) {
      const { module, action } = item.permission;
      if (!isAdmin && (!hasPermission || !hasPermission(module, action))) {
        return false;
      }
    }
    return true;
  };

  return NAVIGATION_SECTIONS.map((section) => {
    const accessibleItems = section.items
      .filter(checkAccess)
      .map((item) => {
        const dynamicBadge = item.getBadge ? item.getBadge(dynamicData) : null;
        return {
          ...item,
          badge: dynamicBadge || item.badge || null,
        };
      });

    return {
      ...section,
      items: accessibleItems,
    };
  }).filter((section) => section.items.length > 0);
}

/**
 * Route matching helper for active navigation state
 */
export function isRouteActive(itemPath, currentPath) {
  const isEditPage = currentPath.includes('/edit');

  if (itemPath === '/invoices/create') {
    return currentPath === '/invoices/create' || isEditPage;
  }

  if (itemPath === '/invoices') {
    return (
      currentPath === '/invoices' ||
      (currentPath.startsWith('/invoices/') &&
        !isEditPage &&
        !currentPath.includes('/create'))
    );
  }

  if (itemPath === '/purchases') {
    return (
      currentPath === '/purchases' ||
      (currentPath.startsWith('/purchases/') &&
        !currentPath.includes('/new') &&
        !isEditPage)
    );
  }

  if (itemPath === '/') {
    return currentPath === '/';
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

/**
 * Dynamic Breadcrumb & Page Title resolver
 */
export function resolveBreadcrumbs(pathname) {
  // Exact route title overrides
  const routeMap = {
    '/': { title: 'Dashboard', crumbs: [{ label: 'Dashboard', path: '/' }] },
    '/customers': {
      title: 'Customers',
      crumbs: [{ label: 'Sales' }, { label: 'Customers', path: '/customers' }],
    },
    '/invoices': {
      title: 'Invoices',
      crumbs: [{ label: 'Sales' }, { label: 'Invoices', path: '/invoices' }],
    },
    '/invoices/create': {
      title: 'Create Invoice',
      crumbs: [
        { label: 'Sales' },
        { label: 'Invoices', path: '/invoices' },
        { label: 'Create Invoice', path: '/invoices/create' },
      ],
    },
    '/credits': {
      title: 'Credit Notes',
      crumbs: [{ label: 'Sales' }, { label: 'Credits', path: '/credits' }],
    },
    '/collections': {
      title: 'Collections & Payments',
      crumbs: [{ label: 'Sales' }, { label: 'Collections', path: '/collections' }],
    },
    '/products': {
      title: 'Products',
      crumbs: [{ label: 'Inventory' }, { label: 'Products', path: '/products' }],
    },
    '/suppliers': {
      title: 'Suppliers',
      crumbs: [{ label: 'Inventory' }, { label: 'Suppliers', path: '/suppliers' }],
    },
    '/purchases': {
      title: 'Purchases',
      crumbs: [{ label: 'Inventory' }, { label: 'Purchases', path: '/purchases' }],
    },
    '/purchases/new': {
      title: 'New Purchase Order',
      crumbs: [
        { label: 'Inventory' },
        { label: 'Purchases', path: '/purchases' },
        { label: 'New Purchase', path: '/purchases/new' },
      ],
    },
    '/inventory/ledger': {
      title: 'Inventory Ledger',
      crumbs: [{ label: 'Inventory' }, { label: 'Ledger', path: '/inventory/ledger' }],
    },
    '/employees': {
      title: 'Employees',
      crumbs: [{ label: 'Employees' }, { label: 'Directory', path: '/employees' }],
    },
    '/employee-analytics': {
      title: 'Employee Analytics',
      crumbs: [{ label: 'Employees' }, { label: 'Analytics', path: '/employee-analytics' }],
    },
    '/manual-entries': {
      title: 'Manual Stock Entries',
      crumbs: [{ label: 'Operations' }, { label: 'Manual Entries', path: '/manual-entries' }],
    },
    '/notes': {
      title: 'Notes & Reminders',
      crumbs: [{ label: 'Operations' }, { label: 'Notes', path: '/notes' }],
    },
    '/reports': {
      title: 'Business Reports',
      crumbs: [{ label: 'Analytics' }, { label: 'Reports', path: '/reports' }],
    },
    '/activity-log': {
      title: 'Employee Activity Log',
      crumbs: [{ label: 'Employees' }, { label: 'Activity Log', path: '/activity-log' }],
    },
    '/settings': {
      title: 'Settings',
      crumbs: [{ label: 'System' }, { label: 'Settings', path: '/settings' }],
    },
  };

  if (routeMap[pathname]) {
    return routeMap[pathname];
  }

  // Dynamic parameterized sub-routes
  if (pathname.startsWith('/invoices/') && pathname.endsWith('/edit')) {
    return {
      title: 'Edit Invoice',
      crumbs: [
        { label: 'Sales' },
        { label: 'Invoices', path: '/invoices' },
        { label: 'Edit Invoice' },
      ],
    };
  }

  if (pathname.startsWith('/invoices/') && pathname.endsWith('/return')) {
    return {
      title: 'Credit Note Return',
      crumbs: [
        { label: 'Sales' },
        { label: 'Invoices', path: '/invoices' },
        { label: 'Return' },
      ],
    };
  }

  if (pathname.startsWith('/invoices/')) {
    return {
      title: 'Invoice Details',
      crumbs: [
        { label: 'Sales' },
        { label: 'Invoices', path: '/invoices' },
        { label: 'Invoice Details' },
      ],
    };
  }

  if (pathname.startsWith('/credit-notes/')) {
    return {
      title: 'Credit Note Details',
      crumbs: [
        { label: 'Sales' },
        { label: 'Credits', path: '/credits' },
        { label: 'Credit Note Details' },
      ],
    };
  }

  if (pathname.startsWith('/products/')) {
    return {
      title: 'Product Details',
      crumbs: [
        { label: 'Inventory' },
        { label: 'Products', path: '/products' },
        { label: 'Product Details' },
      ],
    };
  }

  if (pathname.startsWith('/customers/')) {
    return {
      title: 'Customer Profile',
      crumbs: [
        { label: 'Sales' },
        { label: 'Customers', path: '/customers' },
        { label: 'Customer Profile' },
      ],
    };
  }

  if (pathname.startsWith('/suppliers/')) {
    return {
      title: 'Supplier Profile',
      crumbs: [
        { label: 'Inventory' },
        { label: 'Suppliers', path: '/suppliers' },
        { label: 'Supplier Profile' },
      ],
    };
  }

  if (pathname.startsWith('/purchases/') && pathname.endsWith('/edit')) {
    return {
      title: 'Edit Purchase Order',
      crumbs: [
        { label: 'Inventory' },
        { label: 'Purchases', path: '/purchases' },
        { label: 'Edit Purchase' },
      ],
    };
  }

  if (pathname.startsWith('/purchases/')) {
    return {
      title: 'Purchase Order Details',
      crumbs: [
        { label: 'Inventory' },
        { label: 'Purchases', path: '/purchases' },
        { label: 'Purchase Details' },
      ],
    };
  }

  if (pathname.startsWith('/employees/')) {
    return {
      title: 'Employee Profile',
      crumbs: [
        { label: 'Employees' },
        { label: 'Employees', path: '/employees' },
        { label: 'Employee Profile' },
      ],
    };
  }

  // Fallback title derived from pathname
  const segments = pathname.split('/').filter(Boolean);
  const formattedSegments = segments.map((seg) =>
    seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
  );

  return {
    title: formattedSegments[formattedSegments.length - 1] || 'Bharat Enterprise',
    crumbs: formattedSegments.map((label, index) => ({
      label,
      path: index === formattedSegments.length - 1 ? null : `/${segments.slice(0, index + 1).join('/')}`,
    })),
  };
}
