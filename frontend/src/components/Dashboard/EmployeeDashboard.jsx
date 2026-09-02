import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  IndianRupee, 
  Wallet, 
  AlertTriangle, 
  FilePlus, 
  Package, 
  History, 
  Users, 
  ShoppingCart, 
  ArrowUpRight, 
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Clean presentation labels for employee roles
const getRoleLabel = (roleId) => {
  const map = {
    billing_operator: 'Billing Operator',
    payment_collector: 'Payment Collector',
    inventory_manager: 'Inventory Manager',
    full_access: 'Full Access',
    viewer: 'Viewer',
    custom: 'Operations'
  };
  return map[roleId] || 'Staff';
};

const getDerivedPaymentStatus = (inv) => {
  if (inv.paymentStatus) return inv.paymentStatus;
  const netTotal = inv.totals?.netTotal || 0;
  const paid = inv.paidAmount || 0;
  if (paid >= netTotal && netTotal > 0) return 'Paid';
  if (paid > 0) return 'Partial';
  if (inv.paymentType && inv.paymentType !== 'Credit') return 'Paid';
  return 'Unpaid';
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'Paid':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-800/60">
          Paid
        </span>
      );
    case 'Partial':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/50 text-amber-400 border border-amber-800/60">
          Partial
        </span>
      );
    case 'Unpaid':
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
          Unpaid
        </span>
      );
  }
};

export const EmployeeDashboard = ({
  statsData,
  lowStockData,
  isValidating = false
}) => {
  const { user, hasPermission } = useAuth();
  const employeeStats = statsData?.employeeStats || {};
  const recentInvoices = statsData?.recentInvoices || [];
  const lowStockProducts = lowStockData?.products || [];

  const roleLabel = useMemo(() => {
    return getRoleLabel(user?.role || employeeStats.role);
  }, [user?.role, employeeStats.role]);

  // Formatted date and fiscal year matching Admin Hero
  const { formattedDate, fiscalQuarter } = useMemo(() => {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const formatted = now.toLocaleDateString('en-IN', options);

    const month = now.getMonth();
    const year = now.getFullYear();
    let q = 'Q4';
    let fy = `${year - 1}-${String(year).slice(-2)}`;

    if (month >= 3 && month <= 5) {
      q = 'Q1';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    } else if (month >= 6 && month <= 8) {
      q = 'Q2';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    } else if (month >= 9 && month <= 11) {
      q = 'Q3';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    }

    return {
      formattedDate: formatted,
      fiscalQuarter: `${q} FY${fy}`
    };
  }, []);

  // Permissions
  const canCreateInvoices = hasPermission('invoices', 'create');
  const canViewInvoices = hasPermission('invoices', 'view');
  const canCreatePayments = hasPermission('payments', 'create');
  const canViewPayments = hasPermission('payments', 'view') || hasPermission('collections', 'view');
  const canViewProducts = hasPermission('products', 'view');
  const canViewLedger = hasPermission('ledger', 'view');
  const canViewCustomers = hasPermission('customers', 'view');
  const canCreatePurchases = hasPermission('purchases', 'create');
  const canViewCollections = hasPermission('collections', 'view');
  const canViewInventory = hasPermission('inventory', 'view') || hasPermission('ledger', 'view');

  // Build active KPI list (never show dummy placeholder cards!)
  const kpiCards = useMemo(() => {
    const list = [
      {
        id: 'invoices-created',
        label: "Today's Invoices",
        value: employeeStats.todayInvoicesCreated ?? 0,
        badgeText: `${employeeStats.todayInvoicesCreated ?? 0} bills today`,
        badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        subtext: `Total logged: ${employeeStats.myInvoicesCount ?? 0}`,
        icon: FileText,
        iconColor: 'text-blue-400',
        linkTo: canViewInvoices ? '/invoices' : null
      },
      {
        id: 'sales-handled',
        label: "Today's Billed Value",
        value: formatCurrency(employeeStats.todaySalesHandled ?? 0),
        badgeText: 'Handled today',
        badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        subtext: `Total billed: ${formatCurrency(employeeStats.myTotalSales ?? 0)}`,
        icon: IndianRupee,
        iconColor: 'text-emerald-400',
        linkTo: canViewInvoices ? '/invoices' : null
      }
    ];

    if (canViewPayments) {
      list.push({
        id: 'payments-collected',
        label: "Today's Collections",
        value: formatCurrency(employeeStats.todayPaymentsAmount ?? 0),
        badgeText: `${employeeStats.todayPaymentsRecorded ?? 0} receipts`,
        badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        subtext: `Total collected: ${formatCurrency(employeeStats.myPaymentsAmount ?? 0)}`,
        icon: Wallet,
        iconColor: 'text-teal-400',
        linkTo: canViewCollections ? '/collections' : null
      });
    }

    if (canViewInventory) {
      const lowCount = statsData?.lowStockCount ?? 0;
      list.push({
        id: 'low-stock',
        label: 'Low Stock Alerts',
        value: lowCount,
        badgeText: lowCount > 0 ? `${lowCount} reorder needed` : 'Healthy',
        badgeColor: lowCount > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        subtext: lowCount > 0 ? 'Items below minimum threshold' : 'All stock levels optimal',
        icon: AlertTriangle,
        iconColor: lowCount > 0 ? 'text-amber-400' : 'text-emerald-400',
        linkTo: canViewProducts ? '/products' : null
      });
    }

    return list;
  }, [employeeStats, statsData?.lowStockCount, canViewInvoices, canViewPayments, canViewCollections, canViewInventory, canViewProducts]);

  // Clean Quick Actions
  const quickActions = useMemo(() => {
    const actions = [];
    if (canCreateInvoices) {
      actions.push({
        to: '/invoices/create',
        label: 'Create Invoice',
        sublabel: 'New customer bill',
        icon: FilePlus,
        shortcut: 'Alt+N',
        iconColor: 'text-blue-400'
      });
    }
    if (canCreatePayments) {
      actions.push({
        to: '/collections?action=record',
        label: 'Record Payment',
        sublabel: 'Log cash or UPI payment',
        icon: Wallet,
        shortcut: 'Collect',
        iconColor: 'text-emerald-400'
      });
    }
    if (canViewProducts) {
      actions.push({
        to: '/products',
        label: 'Product Catalog',
        sublabel: 'Stock levels & prices',
        icon: Package,
        shortcut: 'Items',
        iconColor: 'text-violet-400'
      });
    }
    if (canViewLedger) {
      actions.push({
        to: '/inventory/ledger',
        label: 'Inventory Ledger',
        sublabel: 'Track batch & stock movements',
        icon: History,
        shortcut: 'Ledger',
        iconColor: 'text-amber-400'
      });
    }
    if (canViewCustomers) {
      actions.push({
        to: '/customers',
        label: 'Customers',
        sublabel: 'Accounts & balances',
        icon: Users,
        shortcut: 'Clients',
        iconColor: 'text-sky-400'
      });
    }
    if (canCreatePurchases) {
      actions.push({
        to: '/purchases/create',
        label: 'Inward Purchase',
        sublabel: 'Receive supplier stock',
        icon: ShoppingCart,
        shortcut: 'Inward',
        iconColor: 'text-teal-400'
      });
    }
    if (canViewCollections && !canCreatePayments) {
      actions.push({
        to: '/collections',
        label: 'Collections',
        sublabel: 'Payment receipts hub',
        icon: Wallet,
        shortcut: 'View',
        iconColor: 'text-emerald-400'
      });
    }
    return actions;
  }, [
    canCreateInvoices,
    canCreatePayments,
    canViewProducts,
    canViewLedger,
    canViewCustomers,
    canCreatePurchases,
    canViewCollections
  ]);

  return (
    <div className="space-y-4 pb-10">
      {/* ─────────────────────────────────────────────────────────────
          1. PROFESSIONAL HEADER (Clean, Structured, Enterprise)
      ────────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60">
                <Calendar className="w-3 h-3 text-slate-400" />
                {formattedDate} • {fiscalQuarter}
              </span>

              {isValidating ? (
                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                  <Clock className="w-3 h-3 animate-spin text-blue-400" />
                  Syncing...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {user?.name || employeeStats.employeeName || 'Staff Workspace'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                {roleLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Operational terminal for billing, inventory tracking, and payment logging.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {canCreateInvoices && (
              <Link
                to="/invoices/create"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
              >
                <FilePlus className="w-3.5 h-3.5" />
                New Invoice
              </Link>
            )}
            {canCreatePayments && (
              <Link
                to="/collections?action=record"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                Record Payment
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. OPERATIONAL KPI METRICS (No placeholders, clean grid)
      ────────────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${kpiCards.length >= 4 ? 'lg:grid-cols-4' : kpiCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-3.5`}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const CardWrapper = kpi.linkTo ? Link : 'div';
          return (
            <CardWrapper
              key={kpi.id}
              to={kpi.linkTo}
              className={`bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col justify-between ${kpi.linkTo ? 'hover:border-slate-700 transition-colors group cursor-pointer' : ''}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-slate-800/80 text-slate-400 border border-slate-700/50 group-hover:border-slate-600 transition-colors">
                    <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${kpi.badgeColor}`}>
                    {kpi.badgeText}
                  </span>
                </div>

                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold text-white tracking-tight mt-1">
                  {kpi.value}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{kpi.subtext}</span>
                {kpi.linkTo && (
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                )}
              </div>
            </CardWrapper>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. QUICK ACTIONS DOCK (Enterprise Look & Feel)
      ────────────────────────────────────────────────────────────── */}
      {quickActions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-sm font-semibold text-white">Quick Actions</h2>
              <p className="text-xs text-slate-400">Operational shortcuts for assigned workflows</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex flex-col justify-between p-3.5 rounded-lg bg-slate-950/40 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/50 transition-colors group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-md bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                        <Icon className={`w-4 h-4 ${action.iconColor}`} />
                      </div>
                      {action.shortcut && (
                        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400">
                          {action.shortcut}
                        </span>
                      )}
                    </div>

                    <h3 className="font-medium text-xs text-white group-hover:text-blue-300 transition-colors">
                      {action.label}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {action.sublabel}
                    </p>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-end">
                    <ArrowUpRight className="w-3 h-3 text-slate-600 group-hover:text-slate-300 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. OPERATIONS FEED & RECENT ACTIVITY
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: My Recent Invoices */}
        <div className={canViewInventory ? 'lg:col-span-2' : 'lg:col-span-3'}>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-white">My Recent Invoices</h2>
                <p className="text-xs text-slate-400">Invoices created during your shifts</p>
              </div>
              {canViewInvoices && (
                <Link
                  to="/invoices"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  View All
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {recentInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="pb-2.5">Invoice #</th>
                      <th className="pb-2.5">Customer</th>
                      <th className="pb-2.5">Date</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5 text-right">Amount</th>
                      <th className="pb-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {recentInvoices.map((inv) => {
                      const derivedStatus = getDerivedPaymentStatus(inv);
                      return (
                        <tr key={inv._id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="py-3 font-mono font-medium text-blue-400">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 text-slate-200 font-medium">
                            {inv.customer?.customerName || 'Walk-in Customer'}
                          </td>
                          <td className="py-3 text-slate-400">
                            {formatDate(inv.invoiceDate || inv.createdAt)}
                          </td>
                          <td className="py-3">
                            {getStatusBadge(derivedStatus)}
                          </td>
                          <td className="py-3 text-right font-semibold text-white">
                            {formatCurrency(inv.totals?.netTotal ?? 0)}
                          </td>
                          <td className="py-3 text-right">
                            {canViewInvoices && (
                              <Link
                                to={`/invoices/${inv._id}`}
                                className="inline-flex p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="View Document"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center space-y-2.5">
                <FileText className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-medium text-slate-300">No invoices logged yet</p>
                <p className="text-[11px] text-slate-500">
                  New customer invoices you generate will appear here.
                </p>
                {canCreateInvoices && (
                  <div className="pt-1">
                    <Link
                      to="/invoices/create"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      <FilePlus className="w-3.5 h-3.5 text-blue-400" />
                      Create Invoice
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operational Stock Alerts (Non-financial) */}
        {canViewInventory && (
          <div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Stock Warnings</h2>
                  <p className="text-xs text-slate-400">Items below reorder point</p>
                </div>
                {canViewProducts && (
                  <Link
                    to="/products"
                    className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  >
                    Inventory
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="flex-1">
                {lowStockProducts.length > 0 ? (
                  <div className="space-y-2">
                    {lowStockProducts.slice(0, 6).map((product) => {
                      const qty = product.effectiveStockQty ?? product.currentStockQty ?? 0;
                      return (
                        <div
                          key={product._id}
                          className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">
                              {product.productName}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Unit: {product.unit || 'Units'}
                            </p>
                          </div>
                          <span className="flex-shrink-0 font-mono text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            {qty} left
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center space-y-2">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                    <p className="text-xs font-medium text-slate-300">All Stock Levels Optimal</p>
                    <p className="text-[11px] text-slate-500">No products are currently under the reorder threshold.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
