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
  DEMO_STOCK_MOVEMENTS,
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
    // Exception: Allow login, logout and heartbeat to succeed seamlessly in demo mode
    if (path === '/auth/login') {
      return {
        data: {
          success: true,
          role: 'admin',
          token: 'demo_client_jwt_token_secure_isolated',
          admin: DEMO_ADMIN,
          message: 'Authenticated in Demo Mode',
        },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config,
      };
    }
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
  } else if (path.match(/^\/products\/[^/]+\/stock-history/)) {
    const prodId = path.split('/')[2];
    const filtered = DEMO_STOCK_MOVEMENTS.filter((m) => m.productId === prodId);
    const productMovements = (filtered.length > 0 ? filtered : DEMO_STOCK_MOVEMENTS).map((m) => ({
      _id: m._id,
      timestamp: m.createdAt,
      type: m.historyType || 'invoice',
      changeQty: m.changeQty,
      previousQty: m.previousQty,
      newQty: m.newQty,
      reference: m.referenceNumber,
      invoiceId: m.invoiceId,
      adjustedBy: m.adjustedBy || { userModel: 'Admin' },
    }));
    responseData = {
      success: true,
      history: productMovements,
      items: productMovements,
      data: productMovements,
      total: productMovements.length,
      pagination: { hasMore: false, page: 1, limit: 20 },
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
    const custId = path.split('/')[2];
    const custInvoices = DEMO_INVOICES.filter(
      (inv) => inv.customerId === custId || inv.customer?._id === custId
    );
    const custPayments = DEMO_COLLECTIONS.filter((p) => p.customerId === custId);

    // Build running-balance ledger chronologically
    const ledgerEntries = [];
    let runningBalance = 0;
    const allEvents = [
      ...custInvoices.map((inv) => ({
        _id: `led_inv_${inv._id}`,
        date: inv.invoiceDate,
        type: 'invoice',
        referenceNumber: inv.invoiceNumber,
        invoiceId: inv._id,
        description: `Tax Invoice ${inv.invoiceNumber}`,
        debit: inv.grandTotal ?? inv.totals?.grandTotal ?? 0,
        credit: 0,
        sortKey: new Date(inv.invoiceDate).getTime(),
      })),
      ...custPayments.map((p) => ({
        _id: `led_pay_${p._id}`,
        date: p.paymentDate,
        type: 'payment',
        referenceNumber: p.paymentNumber,
        description: `${p.paymentMethod} Payment received (${p.status === 'verified' ? 'Verified' : 'Pending'})`,
        debit: 0,
        credit: p.amount,
        sortKey: new Date(p.paymentDate).getTime(),
      })),
    ].sort((a, b) => a.sortKey - b.sortKey);

    for (const ev of allEvents) {
      runningBalance = runningBalance + ev.debit - ev.credit;
      ledgerEntries.push({ ...ev, balance: parseFloat(runningBalance.toFixed(2)) });
    }

    const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = ledgerEntries.reduce((s, e) => s + e.credit, 0);
    responseData = {
      success: true,
      ledger: ledgerEntries,
      items: ledgerEntries,
      data: ledgerEntries,
      totalCount: ledgerEntries.length,
      hasMore: false,
      summary: {
        totalDebit: parseFloat(totalDebit.toFixed(2)),
        totalCredit: parseFloat(totalCredit.toFixed(2)),
        closingBalance: parseFloat((totalDebit - totalCredit).toFixed(2)),
        openingBalance: 0,
      },
    };
  } else if (path.startsWith('/customers/')) {
    const id = path.replace('/customers/', '');
    const found = DEMO_CUSTOMERS.find((c) => c._id === id) || DEMO_CUSTOMERS[0];
    // Derive counts from actual demo datasets for the resolved customer
    const custInvoices = DEMO_INVOICES.filter(
      (inv) => inv.customerId === found._id || inv.customer?._id === found._id
    );
    const custPayments = DEMO_COLLECTIONS.filter((p) => p.customerId === found._id);
    const liveOutstanding = parseFloat(
      custInvoices.reduce((sum, inv) => sum + (inv.remainingAmount ?? inv.grandTotal ?? 0), 0).toFixed(2)
    );
    const liveTotalPurchases = parseFloat(
      custInvoices.reduce((sum, inv) => sum + (inv.grandTotal ?? inv.totals?.grandTotal ?? 0), 0).toFixed(2)
    );
    const customerSummary = {
      outstanding: liveOutstanding,
      calculatedOutstanding: liveOutstanding,
      balance: liveOutstanding,
      totalPurchases: liveTotalPurchases,
      invoiceCount: custInvoices.length,
      paymentCount: custPayments.length,
      creditNoteCount: 0,
      manualEntryCount: 0,
      unpaidInvoicesCount: liveOutstanding > 0 ? custInvoices.filter((inv) => (inv.remainingAmount ?? 0) > 0).length : 0,
    };
    const enrichedCustomer = {
      ...found,
      totalPurchases: liveTotalPurchases,
      totalPurchasesAmount: liveTotalPurchases,
      invoiceCount: custInvoices.length,
      totalInvoicesCount: custInvoices.length,
      outstandingBalance: liveOutstanding,
      totalOutstanding: liveOutstanding,
    };
    responseData = {
      success: true,
      customer: enrichedCustomer,
      data: enrichedCustomer,
      summary: customerSummary,
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
  } else if (path.startsWith('/invoices/customer/')) {
    const custId = path.replace('/invoices/customer/', '').split('?')[0];
    const customerInvoices = DEMO_INVOICES.filter(
      (inv) => inv.customerId === custId || inv.customer?._id === custId
    );
    const resultList = customerInvoices.length > 0 ? customerInvoices : DEMO_INVOICES.slice(0, 3);
    responseData = {
      success: true,
      invoices: resultList,
      items: resultList,
      data: resultList,
      total: resultList.length,
      totalCount: resultList.length,
      pages: 1,
      pagination: { page: 1, limit: 20, total: resultList.length, hasMore: false },
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
  else if (path.startsWith('/payments/customer/')) {
    const custId = path.replace('/payments/customer/', '').split('?')[0];
    const custPayments = DEMO_COLLECTIONS.filter((p) => p.customerId === custId);
    responseData = {
      success: true,
      payments: custPayments,
      items: custPayments,
      data: custPayments,
      total: custPayments.length,
      totalCount: custPayments.length,
      page: 1,
      pages: 1,
      pagination: { page: 1, limit: 20, total: custPayments.length, hasMore: false },
    };
  } else if (
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
  } else if (path.startsWith('/analytics/employees/')) {
    const id = path.replace('/analytics/employees/', '');
    const found = DEMO_EMPLOYEES.find((e) => e._id === id || e.id === id) || DEMO_EMPLOYEES[0];
    const logEntry = DEMO_EMPLOYEE_ANALYTICS.activityLog.log.find((l) => l.employee?.id === found._id || l.employee?.id === found.id) || DEMO_EMPLOYEE_ANALYTICS.activityLog.log[0];
    responseData = {
      success: true,
      employee: found,
      sessionStats: {
        today: { duration: 465, sessionsCount: 1 },
        thisWeek: { duration: 2340, sessionsCount: 5 },
        thisMonth: { duration: 9800, sessionsCount: 22 }
      },
      recentActivity: {
        invoices: (logEntry?.activities?.invoicesCreated || []).map(inv => ({
          invoiceNumber: inv.invoiceNumber,
          customer: { customerName: inv.customer },
          totals: { netTotal: inv.amount },
          createdAt: inv.time,
          invoiceDate: inv.time
        })),
        payments: (logEntry?.activities?.paymentsRecorded || []).map(p => ({
          amount: p.amount,
          paymentMethod: p.method,
          invoiceSnapshot: { invoiceNumber: p.invoiceNumber },
          createdAt: p.time,
          paymentDate: p.time
        }))
      }
    };
  } else if (path === '/analytics/employees') {
    responseData = {
      success: true,
      employees: DEMO_EMPLOYEES,
      count: DEMO_EMPLOYEES.length,
      sessionStats: DEMO_EMPLOYEE_ANALYTICS.sessionSummary.stats,
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
  } else if (path === '/sales-analytics/top-products' || path === '/reports/top-products') {
    responseData = {
      success: true,
      data: DEMO_SALES_ANALYTICS.topProducts,
    };
  } else if (path === '/sales-analytics/top-customers' || path === '/reports/top-customers') {
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
  else if (
    path === '/manual-entries' ||
    path === '/entries' ||
    path.startsWith('/manual-entries/customer/') ||
    path.startsWith('/manual-entries/unpaid/')
  ) {
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
  } else if (path === '/inventory/ledger' || path === '/stock-movements' || path.startsWith('/stock-movements')) {
    if (path === '/stock-movements/export') {
      return {
        data: new Blob(['Date,Type,Product,Batch,Quantity,Valuation,Operator\n2026-03-24,SALE,Dolo 650mg,DL-2026-A1,-50,1425.00,Rajesh Sharma\n'], { type: 'text/csv' }),
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/csv' },
        config,
      };
    }
    const params = config.params || {};
    let list = DEMO_STOCK_MOVEMENTS;
    if (params.type) {
      list = list.filter((m) => m.type === params.type);
    }
    if (params.productId) {
      list = list.filter((m) => m.productId === params.productId);
    }
    if (params.batchId) {
      list = list.filter((m) => m.batchNumber?.toLowerCase().includes(params.batchId.toLowerCase()));
    }
    responseData = {
      success: true,
      movements: list,
      data: list,
      total: list.length,
      pagination: {
        total: list.length,
        page: 1,
        limit: 20,
        pages: 1,
        hasMore: false,
      },
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
