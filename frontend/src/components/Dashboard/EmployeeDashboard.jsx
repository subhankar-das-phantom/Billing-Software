import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FileText, 
  TrendingUp, 
  Banknote, 
  AlertTriangle, 
  Plus, 
  Package, 
  History, 
  Users, 
  ShoppingCart, 
  ArrowUpRight, 
  ShieldCheck, 
  Clock, 
  Calendar,
  ExternalLink,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Map existing Employee schema roles to presentation labels and aesthetic badge themes
const getRolePresentation = (roleId) => {
  const roleMap = {
    billing_operator: {
      label: 'Billing Operator',
      desc: 'Invoice Creation & Sales Desk',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    payment_collector: {
      label: 'Payment Collector',
      desc: 'Collections & Customer Dues Desk',
      badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30'
    },
    inventory_manager: {
      label: 'Inventory Manager',
      desc: 'Stock Levels & Inward Processing',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    full_access: {
      label: 'Full Operational Access',
      desc: 'Cross-functional Operations',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    },
    viewer: {
      label: 'Operational Viewer',
      desc: 'Read-only Access',
      badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    },
    custom: {
      label: 'Custom Operations',
      desc: 'Custom Role Profile',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    }
  };
  return roleMap[roleId] || {
    label: 'Operations Team',
    desc: 'General Operations',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  };
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
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Paid
        </span>
      );
    case 'Partial':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Partial
        </span>
      );
    case 'Unpaid':
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
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

  const roleInfo = useMemo(() => {
    return getRolePresentation(user?.role || employeeStats.role);
  }, [user?.role, employeeStats.role]);

  // Current formatted IST date string
  const istDateString = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }, []);

  // Permission flags
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

  // Build role-aware quick actions list
  const quickActions = useMemo(() => {
    const actions = [];
    if (canCreateInvoices) {
      actions.push({
        id: 'new-invoice',
        label: 'New Invoice',
        subtitle: 'Bill customer & create invoice',
        path: '/invoices/create',
        icon: Plus,
        gradient: 'from-blue-600 to-indigo-600',
        hoverBorder: 'hover:border-blue-500/50'
      });
    }
    if (canCreatePayments) {
      actions.push({
        id: 'record-payment',
        label: 'Record Payment',
        subtitle: 'Log received cash, UPI or cheque',
        path: '/collections?action=record',
        icon: Banknote,
        gradient: 'from-emerald-600 to-teal-600',
        hoverBorder: 'hover:border-emerald-500/50'
      });
    }
    if (canViewProducts) {
      actions.push({
        id: 'products',
        label: 'Product Catalog',
        subtitle: 'Check pricing and current stock',
        path: '/products',
        icon: Package,
        gradient: 'from-purple-600 to-indigo-600',
        hoverBorder: 'hover:border-purple-500/50'
      });
    }
    if (canViewLedger) {
      actions.push({
        id: 'inventory-ledger',
        label: 'Inventory Ledger',
        subtitle: 'Audit stock movements & batches',
        path: '/inventory/ledger',
        icon: History,
        gradient: 'from-amber-600 to-orange-600',
        hoverBorder: 'hover:border-amber-500/50'
      });
    }
    if (canViewCustomers) {
      actions.push({
        id: 'customers',
        label: 'Customer Directory',
        subtitle: 'View client contact info & balances',
        path: '/customers',
        icon: Users,
        gradient: 'from-sky-600 to-blue-600',
        hoverBorder: 'hover:border-sky-500/50'
      });
    }
    if (canCreatePurchases) {
      actions.push({
        id: 'new-purchase',
        label: 'Inward Purchase',
        subtitle: 'Record supplier stock receipt',
        path: '/purchases/create',
        icon: ShoppingCart,
        gradient: 'from-teal-600 to-emerald-600',
        hoverBorder: 'hover:border-teal-500/50'
      });
    }
    if (canViewCollections && !canCreatePayments) {
      actions.push({
        id: 'collections-hub',
        label: 'Collections Hub',
        subtitle: 'View payment receipts & trends',
        path: '/collections',
        icon: Banknote,
        gradient: 'from-emerald-600 to-teal-600',
        hoverBorder: 'hover:border-emerald-500/50'
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
    <div className="space-y-6 pb-12">
      {/* ─────────────────────────────────────────────────────────────
          1. PERSONALIZED OPERATIONAL HERO BANNER
      ────────────────────────────────────────────────────────────── */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 p-6 sm:p-8 shadow-xl"
      >
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Operational Desk
              </span>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${roleInfo.badgeClass}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {roleInfo.label}
              </span>
              {isValidating && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  <Clock className="w-3 h-3 animate-spin text-blue-400" />
                  Syncing
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400">{user?.name || employeeStats.employeeName || 'Team Member'}</span>
            </h1>

            <p className="text-sm text-slate-400 max-w-xl">
              {roleInfo.desc}. Track your daily performance, record operations, and access assigned workflows.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto bg-slate-800/80 border border-slate-700/80 px-4 py-2.5 rounded-xl text-slate-300 text-xs sm:text-sm">
            <Calendar className="w-4 h-4 text-blue-400" />
            <span className="font-medium">{istDateString}</span>
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          2. PERSONAL OPERATIONAL KPI GRID
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Invoices Created by Me */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 hover:border-slate-600 transition-all shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Invoices Created By Me</span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {employeeStats.todayInvoicesCreated ?? 0}
              </span>
              <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                Today
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Career Total: <span className="text-slate-200 font-semibold">{employeeStats.myInvoicesCount ?? 0}</span> invoices
            </p>
          </div>
        </motion.div>

        {/* KPI 2: Sales Handled by Me */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 hover:border-slate-600 transition-all shadow-lg flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sales Handled By Me</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {formatCurrency(employeeStats.todaySalesHandled ?? 0)}
              </span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Today
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Career Volume: <span className="text-slate-200 font-semibold">{formatCurrency(employeeStats.myTotalSales ?? 0)}</span>
            </p>
          </div>
        </motion.div>

        {/* KPI 3: Payments Collected by Me (Conditional on Payments/Collections Permission) */}
        {canViewPayments ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 hover:border-slate-600 transition-all shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Collections Logged By Me</span>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {formatCurrency(employeeStats.todayPaymentsAmount ?? 0)}
                </span>
                <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded">
                  {employeeStats.todayPaymentsRecorded ?? 0} Today
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-400" />
                Career Collections: <span className="text-slate-200 font-semibold">{formatCurrency(employeeStats.myPaymentsAmount ?? 0)}</span>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="p-5 rounded-2xl bg-slate-800/30 backdrop-blur-md border border-slate-700/40 flex flex-col justify-between text-slate-500"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider">Collections Desk</span>
              <div className="w-10 h-10 rounded-xl bg-slate-700/20 text-slate-500 flex items-center justify-center">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-400">Restricted Module</p>
              <p className="text-xs text-slate-500 mt-1">Payments & collections permission not assigned</p>
            </div>
          </motion.div>
        )}

        {/* KPI 4: Inventory Alerts (Conditional on Inventory/Ledger Permission) */}
        {canViewInventory ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 hover:border-slate-600 transition-all shadow-lg flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Inventory Stock Alerts</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                (statsData?.lowStockCount ?? 0) > 0 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {statsData?.lowStockCount ?? 0}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  (statsData?.lowStockCount ?? 0) > 0 
                    ? 'text-amber-400 bg-amber-500/10' 
                    : 'text-emerald-400 bg-emerald-500/10'
                }`}>
                  {(statsData?.lowStockCount ?? 0) > 0 ? 'Low Stock' : 'Healthy'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {(statsData?.lowStockCount ?? 0) > 0 
                  ? 'Items require replenishment' 
                  : 'All tracked inventory in stock'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="p-5 rounded-2xl bg-slate-800/30 backdrop-blur-md border border-slate-700/40 flex flex-col justify-between text-slate-500"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider">Inventory Desk</span>
              <div className="w-10 h-10 rounded-xl bg-slate-700/20 text-slate-500 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-400">Restricted Module</p>
              <p className="text-xs text-slate-500 mt-1">Inventory view permission not assigned</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. ROLE-AWARE QUICK ACTIONS DOCK
      ────────────────────────────────────────────────────────────── */}
      {quickActions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Assigned Operational Workflows
            </h2>
            <span className="text-xs text-slate-500">Filtered by your permissions</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.id}
                  to={action.path}
                  className={`group p-4 rounded-xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 ${action.hoverBorder} hover:bg-slate-800 transition-all flex items-center gap-3.5 shadow-md`}
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.gradient} text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors truncate">
                      {action.label}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {action.subtitle}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. OPERATIONAL WORKSPACE & ACTIVITY HUB
      ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Recent Invoices */}
        <div className={canViewInventory ? 'lg:col-span-2 space-y-4' : 'lg:col-span-3 space-y-4'}>
          <div className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h3 className="text-base font-semibold text-white">My Recent Invoices</h3>
              </div>
              {canViewInvoices && (
                <Link
                  to="/invoices"
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                  All Invoices
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {recentInvoices.length > 0 ? (
              <div className="divide-y divide-slate-700/40">
                {recentInvoices.map((inv) => {
                  const derivedStatus = getDerivedPaymentStatus(inv);
                  return (
                    <div
                      key={inv._id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-700/20 px-2 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          INV
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">
                            {inv.customer?.customerName || 'Walk-in Customer'}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-300">{inv.invoiceNumber}</span>
                            <span>•</span>
                            <span>{formatDate(inv.invoiceDate || inv.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3.5 pl-12 sm:pl-0">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">
                            {formatCurrency(inv.totals?.netTotal ?? 0)}
                          </p>
                          <div className="mt-0.5">
                            {getStatusBadge(derivedStatus)}
                          </div>
                        </div>

                        {canViewInvoices && (
                          <Link
                            to={`/invoices/${inv._id}`}
                            className="p-1.5 rounded-lg bg-slate-700/40 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="View Invoice"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center space-y-3">
                <FileText className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No invoices logged by you yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Invoices you create will appear here with live payment status indicators.
                </p>
                {canCreateInvoices && (
                  <div className="pt-2">
                    <Link
                      to="/invoices/create"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create First Invoice
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operational Stock Alerts (Strictly no prices/margins!) */}
        {canViewInventory && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-slate-700/60 shadow-lg h-full flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">Operational Stock Alerts</h3>
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

              <div className="flex-1 mt-3">
                {lowStockProducts.length > 0 ? (
                  <div className="space-y-2.5">
                    {lowStockProducts.slice(0, 6).map((product) => {
                      const qty = product.effectiveStockQty ?? product.currentStockQty ?? 0;
                      return (
                        <div
                          key={product._id}
                          className="p-3 rounded-xl bg-slate-700/20 border border-slate-700/40 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {product.productName}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Unit: <span className="text-slate-300 font-medium">{product.unit || 'Units'}</span>
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="inline-block text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                              {qty} left
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-sm font-medium text-white">All Stock Levels Healthy</p>
                    <p className="text-xs text-slate-400">
                      No products are currently under the low stock threshold.
                    </p>
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
