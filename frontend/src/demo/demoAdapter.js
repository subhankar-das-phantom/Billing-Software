/**
 * Bharat Enterprise — Demo Mock Axios Adapter
 * Intercepts 100% of network requests client-side in Demo Mode.
 * Guarantees zero HTTP calls to the backend server.
 */
import {
  DEMO_ADMIN,
  DEMO_PLANS,
  DEMO_SUBSCRIPTION,
  DEMO_CREDIT_STATS,
  DEMO_PRODUCTS,
  DEMO_CUSTOMERS,
  DEMO_INVOICES,
  DEMO_SUPPLIERS,
  DEMO_PURCHASES,
  DEMO_EMPLOYEES,
  DEMO_COLLECTIONS,
  DEMO_DASHBOARD_STATS,
  DEMO_SALES_ANALYTICS,
  DEMO_MANUAL_ENTRIES,
  DEMO_PURCHASE_REPORTS,
  DEMO_INVENTORY_INTELLIGENCE,
  DEMO_EMPLOYEE_ANALYTICS,
} from './demoData';

// Simulated realistic micro-delay for smooth UI transitions (30-50ms)
const simulateLatency = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

export const demoMockAdapter = async (config) => {
  await simulateLatency(40);

  const method = (config.method || 'get').toLowerCase();
  const rawUrl = config.url || '';
  // Normalize URL: remove query string and leading host/api prefixes
  const path = rawUrl
    .replace(/^(?:https?:\/\/[^/]+)?(?:\/api)?/, '')
    .split('?')[0]
    .replace(/\/$/, '') || '/';

  // Read-only conversion guard for all mutating HTTP methods
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    // Exception: Allow logout and heartbeat to succeed seamlessly
    if (path === '/auth/logout' || path === '/auth/heartbeat') {
      return {
        data: { success: true, message: 'OK' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config,
      };
    }

    const message =
      'Demo Mode is read-only. Sign up for a free 14-day trial to perform live operations!';
    const err = new Error(message);
    err.response = {
      data: {
        success: false,
        message,
        isDemoReadOnly: true,
      },
      status: 403,
      statusText: 'Forbidden (Demo Read-Only)',
      headers: { 'content-type': 'application/json' },
      config,
    };
    err.isAxiosError = true;
    return Promise.reject(err);
  }

  // ─────────────────────────────────────────────────────────────
  // GET Endpoint Dispatcher
  // ─────────────────────────────────────────────────────────────
  let responseData = null;

  // 1. Authentication & Session
  if (path === '/auth/me') {
    responseData = {
      success: true,
      role: 'admin',
      admin: DEMO_ADMIN,
      user: DEMO_ADMIN,
    };
  }

  // 2. Subscription & SaaS Plans
  else if (path === '/saas/subscription' || path === '/subscription/current' || path === '/subscription') {
    responseData = {
      success: true,
      subscription: {
        ...DEMO_SUBSCRIPTION,
        planId: DEMO_PLANS[2]._id,
      },
      info: DEMO_SUBSCRIPTION,
    };
  } else if (path === '/saas/plans' || path === '/subscription/plans') {
    responseData = {
      success: true,
      plans: DEMO_PLANS,
      trialDays: 14,
      minStartingPrice: 299,
    };
  }

  // 3. Executive Dashboard
  else if (path === '/dashboard/stats') {
    responseData = {
      success: true,
      ...DEMO_DASHBOARD_STATS,
      stats: DEMO_DASHBOARD_STATS,
    };
  } else if (path === '/dashboard/invoice-count') {
    responseData = {
      success: true,
      count: DEMO_INVOICES.length,
    };
  } else if (path === '/dashboard/low-stock') {
    const lowStock = DEMO_PRODUCTS.filter((p) => p.totalStock <= p.reorderLevel);
    responseData = {
      success: true,
      products: lowStock,
      total: lowStock.length,
    };
  } else if (path === '/dashboard/recent-activity') {
    responseData = {
      success: true,
      activities: DEMO_DASHBOARD_STATS.recentActivity,
    };
  }

  // 4. Products & Batches
  else if (path === '/products/low-stock') {
    const lowStock = DEMO_PRODUCTS.filter((p) => p.totalStock <= p.reorderLevel);
    responseData = {
      success: true,
      products: lowStock,
      count: lowStock.length,
    };
  } else if (path === '/products/stats' || path === '/products-stats-global') {
    responseData = {
      success: true,
      stats: {
        totalProducts: DEMO_PRODUCTS.length,
        totalCategories: 5,
        lowStockCount: 2,
        outOfStockCount: 0,
        totalStockUnits: 2000,
      },
    };
  } else if (path.startsWith('/products/')) {
    const id = path.replace('/products/', '');
    const found = DEMO_PRODUCTS.find((p) => p._id === id) || DEMO_PRODUCTS[0];
    responseData = {
      success: true,
      product: found,
      data: found,
    };
  } else if (path === '/products') {
    const search = config.params?.search?.toLowerCase();
    let list = DEMO_PRODUCTS;
    if (search) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search) ||
          p.genericName?.toLowerCase().includes(search)
      );
    }
    responseData = {
      success: true,
      products: list,
      data: list,
      total: list.length,
      page: 1,
      totalPages: 1,
    };
  }

  // 5. Customers & Khata Ledgers
  else if (path.match(/^\/customers\/[^/]+\/ledger/)) {
    responseData = {
      success: true,
      data: {
        entries: [
          {
            _id: 'led_1',
            type: 'invoice',
            referenceNumber: 'INV-2026-001',
            date: '2026-03-24T10:30:00.000Z',
            debit: 38400.0,
            credit: 0,
            balance: 38400.0,
            note: 'GST Tax Invoice issued',
          },
          {
            _id: 'led_2',
            type: 'payment',
            referenceNumber: 'REC-2026-075',
            date: '2026-03-10T14:00:00.000Z',
            debit: 0,
            credit: 25000.0,
            balance: 0.0,
            note: 'UPI Payment received (Verified)',
          },
        ],
        totals: {
          totalDebit: 38400.0,
          totalCredit: 25000.0,
          netOutstanding: 38400.0,
        },
      },
    };
  } else if (path.startsWith('/customers/')) {
    const id = path.replace('/customers/', '');
    const found = DEMO_CUSTOMERS.find((c) => c._id === id) || DEMO_CUSTOMERS[0];
    responseData = {
      success: true,
      customer: found,
      data: found,
    };
  } else if (path === '/customers') {
    const search = config.params?.search?.toLowerCase();
    let list = DEMO_CUSTOMERS;
    if (search) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.phone.includes(search) ||
          c.city.toLowerCase().includes(search)
      );
    }
    responseData = {
      success: true,
      customers: list,
      data: list,
      total: list.length,
      page: 1,
      totalPages: 1,
    };
  }

  // 6. Invoices
  else if (path === '/invoices/stats') {
    responseData = {
      success: true,
      stats: {
        total: DEMO_INVOICES.length,
        today: 1,
        thisMonth: DEMO_INVOICES.length,
        totalAmount: 188620.00,
      },
    };
  } else if (path.startsWith('/invoices/')) {
    const id = path.replace('/invoices/', '');
    const found = DEMO_INVOICES.find((inv) => inv._id === id) || DEMO_INVOICES[0];
    responseData = {
      success: true,
      invoice: found,
      data: found,
    };
  } else if (path === '/invoices') {
    responseData = {
      success: true,
      invoices: DEMO_INVOICES,
      data: DEMO_INVOICES,
      total: DEMO_INVOICES.length,
      page: 1,
      totalPages: 1,
    };
  }

  // 7. Suppliers & Purchases
  else if (path === '/purchases/stats') {
    responseData = {
      success: true,
      stats: {
        totalPurchases: DEMO_PURCHASES.length,
        todayPurchases: 0,
        thisMonthPurchases: DEMO_PURCHASES.length,
        totalSpend: 152880.00,
      },
    };
  } else if (path.startsWith('/suppliers/')) {
    const id = path.replace('/suppliers/', '');
    const found = DEMO_SUPPLIERS.find((s) => s._id === id) || DEMO_SUPPLIERS[0];
    responseData = {
      success: true,
      supplier: found,
      data: found,
    };
  } else if (path === '/suppliers') {
    responseData = {
      success: true,
      suppliers: DEMO_SUPPLIERS,
      data: DEMO_SUPPLIERS,
      total: DEMO_SUPPLIERS.length,
    };
  } else if (path.startsWith('/purchases/')) {
    const id = path.replace('/purchases/', '');
    const found = DEMO_PURCHASES.find((p) => p._id === id) || DEMO_PURCHASES[0];
    responseData = {
      success: true,
      purchase: found,
      data: found,
    };
  } else if (path === '/purchases') {
    responseData = {
      success: true,
      purchases: DEMO_PURCHASES,
      data: DEMO_PURCHASES,
      total: DEMO_PURCHASES.length,
      page: 1,
      totalPages: 1,
    };
  }

  // 8. Collections & Payments
  else if (
    path === '/payments/collections' ||
    path === '/collections' ||
    path === '/payments'
  ) {
    responseData = {
      success: true,
      summary: {
        totalCollected: 60400.00,
        paymentCount: DEMO_COLLECTIONS.length,
        cashCollected: 0.00,
        cashCount: 0,
        nonCashCollected: 60400.00,
        nonCashCount: DEMO_COLLECTIONS.length,
        byMethod: {
          UPI: { count: 2, total: 39400.00 },
          NEFT: { count: 1, total: 21000.00 },
          Cash: { count: 0, total: 0 },
          Cheque: { count: 0, total: 0 },
          Card: { count: 0, total: 0 },
        },
      },
      count: DEMO_COLLECTIONS.length,
      total: DEMO_COLLECTIONS.length,
      page: 1,
      pages: 1,
      payments: DEMO_COLLECTIONS,
      collections: DEMO_COLLECTIONS,
      data: DEMO_COLLECTIONS,
    };
  }

  // 9. Staff & Employees
  else if (path === '/analytics/employees/comparison') {
    responseData = {
      success: true,
      ...DEMO_EMPLOYEE_ANALYTICS.comparison,
    };
  } else if (path === '/analytics/sessions/summary') {
    responseData = {
      success: true,
      ...DEMO_EMPLOYEE_ANALYTICS.sessionSummary,
    };
  } else if (path === '/analytics/activity-log') {
    responseData = {
      success: true,
      ...DEMO_EMPLOYEE_ANALYTICS.activityLog,
    };
  } else if (path === '/analytics/employees' || path.startsWith('/analytics/employees/')) {
    responseData = {
      success: true,
      employees: DEMO_EMPLOYEES,
      employee: DEMO_EMPLOYEES[0],
      sessionStats: DEMO_EMPLOYEE_ANALYTICS.sessionSummary.stats,
      recentActivity: DEMO_EMPLOYEE_ANALYTICS.activityLog.log[0]?.activities || [],
    };
  } else if (path.startsWith('/employees/')) {
    const id = path.replace('/employees/', '');
    const found = DEMO_EMPLOYEES.find((e) => e._id === id || e.id === id) || DEMO_EMPLOYEES[0];
    responseData = {
      success: true,
      employee: found,
      data: found,
    };
  } else if (path === '/employees') {
    responseData = {
      success: true,
      employees: DEMO_EMPLOYEES,
      users: DEMO_EMPLOYEES,
      total: DEMO_EMPLOYEES.length,
    };
  }

  // 10. Sales Analytics Suite
  else if (path === '/sales-analytics/overview') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.overview,
    };
  } else if (path === '/sales-analytics/monthly') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.monthly,
    };
  } else if (path === '/sales-analytics/daily') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.daily,
    };
  } else if (path === '/sales-analytics/yearly') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.monthly,
    };
  } else if (path === '/sales-analytics/top-products') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.topProducts,
    };
  } else if (path === '/sales-analytics/top-customers') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.topCustomers,
    };
  } else if (path === '/sales-analytics/payment-trends') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.paymentTrends,
    };
  }

  // 11. Settings & Profile
  else if (path === '/settings' || path === '/admin/profile') {
    responseData = {
      success: true,
      settings: DEMO_ADMIN,
      admin: DEMO_ADMIN,
      firmName: DEMO_ADMIN.firmName,
    };
  }

  // 12. Manual Entries & Operations
  else if (path === '/manual-entries' || path === '/entries' || path.startsWith('/manual-entries/customer/')) {
    responseData = {
      success: true,
      manualEntries: DEMO_MANUAL_ENTRIES,
      entries: DEMO_MANUAL_ENTRIES,
      data: DEMO_MANUAL_ENTRIES,
      total: DEMO_MANUAL_ENTRIES.length,
      page: 1,
      pages: 1,
    };
  }

  // 13. Reports & Intelligence
  else if (path === '/reports/purchases/summary') {
    responseData = {
      success: true,
      data: DEMO_PURCHASE_REPORTS.summary,
    };
  } else if (path === '/reports/purchases/supplier-wise') {
    responseData = {
      success: true,
      data: DEMO_PURCHASE_REPORTS.supplierWise,
    };
  } else if (path === '/reports/purchases/product-wise') {
    responseData = {
      success: true,
      data: DEMO_PURCHASE_REPORTS.productWise,
    };
  } else if (path === '/reports/purchases/status') {
    responseData = {
      success: true,
      data: DEMO_PURCHASE_REPORTS.statusSummary,
    };
  } else if (path === '/reports/purchases/inventory-flow') {
    responseData = {
      success: true,
      data: DEMO_PURCHASE_REPORTS.inventoryFlow,
    };
  } else if (path === '/analytics/inventory/expiry-horizon') {
    responseData = {
      success: true,
      data: DEMO_INVENTORY_INTELLIGENCE.expiryHorizon,
    };
  } else if (path === '/analytics/inventory/velocity') {
    responseData = {
      success: true,
      data: DEMO_INVENTORY_INTELLIGENCE.velocity,
    };
  } else if (path === '/analytics/inventory/stock-risk') {
    responseData = {
      success: true,
      data: DEMO_INVENTORY_INTELLIGENCE.stockRisk,
    };
  } else if (path === '/analytics/inventory/procurement') {
    responseData = {
      success: true,
      data: DEMO_INVENTORY_INTELLIGENCE.procurement,
    };
  } else if (path === '/inventory/ledger') {
    responseData = {
      success: true,
      movements: DEMO_PURCHASE_REPORTS.inventoryFlow.summary,
      total: 3,
    };
  }

  // 14. Outstanding & Ageing Khata Reports
  else if (path === '/reports/credit-stats') {
    responseData = {
      success: true,
      stats: DEMO_CREDIT_STATS,
    };
  } else if (path === '/reports/recent-payments') {
    responseData = {
      success: true,
      payments: DEMO_COLLECTIONS.map((c) => ({
        _id: c._id,
        paymentNumber: c.paymentNumber,
        amount: c.amount,
        paymentDate: c.paymentDate,
        paymentMethod: c.paymentMethod,
        customer: { _id: c.customerId, name: c.customerName },
        invoice: { invoiceNumber: c.invoiceNumber },
      })),
    };
  } else if (path === '/reports/outstanding') {
    const outstandingList = DEMO_CUSTOMERS.filter((c) => c.outstandingBalance > 0);
    responseData = {
      success: true,
      summary: {
        totalOutstanding: 148220.00,
        overdueAmount: 38400.00,
        customersWithDues: outstandingList.length,
        totalOverdueCount: 1,
      },
      customers: outstandingList,
      data: outstandingList,
      pagination: {
        page: 1,
        limit: 20,
        total: outstandingList.length,
        pages: 1,
      },
      hasMore: false,
    };
  } else if (path === '/reports/ageing') {
    const overdueInvoices = DEMO_INVOICES.filter((inv) => inv.remainingAmount > 0).map((inv) => ({
      ...inv,
      overdueDays: Math.max(
        0,
        Math.floor((new Date('2026-03-25').getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      ),
      bucket: inv.remainingAmount > 35000 ? 'overdue30' : 'current',
    }));

    responseData = {
      success: true,
      summary: {
        totalAmount: 148220.00,
        totalCount: overdueInvoices.length,
        currentAmount: 85200.00,
        overdueAmount: 63020.00,
      },
      buckets: {
        current: { amount: 85200.0, count: 2 },
        overdue30: { amount: 38400.0, count: 1 },
        overdue60: { amount: 24620.0, count: 1 },
        overdue90: { amount: 0, count: 0 },
        days30: { amount: 38400.0, count: 1 },
        days60: { amount: 24620.0, count: 1 },
        days90: { amount: 0, count: 0 },
      },
      invoices: overdueInvoices,
      data: {
        current: 85200.0,
        days30: 38400.0,
        days60: 24620.0,
        days90Plus: 0.0,
        total: 148220.0,
      },
      pagination: {
        page: 1,
        limit: 20,
        total: overdueInvoices.length,
        pages: 1,
      },
      hasMore: false,
    };
  }

  // 15. Miscellaneous
  else if (path === '/notes') {
    responseData = {
      success: true,
      notes: [
        {
          _id: 'note_1',
          title: 'Monthly Stock & Batch Audit',
          content: 'Physical verification of all antibiotic batches scheduled for 31st March.',
          category: 'operations',
          createdAt: '2026-03-20T10:00:00.000Z',
        },
      ],
    };
  } else if (path === '/credits' || path === '/credit-notes') {
    responseData = {
      success: true,
      creditNotes: [],
      data: [],
    };
  } else if (path === '/activity-logs' || path === '/admin/activity-logs') {
    responseData = {
      success: true,
      logs: DEMO_DASHBOARD_STATS.recentActivity,
    };
  } else if (path === '/referrals' || path === '/referral') {
    responseData = {
      success: true,
      stats: { totalReferrals: 3, rewardedCredits: 1500 },
    };
  }

  // Fallback for any other unhandled GET routes: return safe empty structure
  else {
    responseData = {
      success: true,
      data: [],
    };
  }

  return {
    data: responseData,
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    config,
    request: {},
  };
};
