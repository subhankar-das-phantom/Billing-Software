import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  Wallet, 
  Clock, 
  ArrowRight, 
  CheckCircle2
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const DashboardActivityHub = ({ 
  recentInvoices = [], 
  recentPayments = [] 
}) => {
  const [activeTab, setActiveTab] = useState('invoices');

  const pendingInvoices = recentInvoices.filter(
    inv => inv.status !== 'Cancelled' && (inv.paymentStatus === 'Unpaid' || inv.paymentStatus === 'Partial' || !inv.paymentStatus)
  );

  const tabs = [
    { id: 'invoices', label: 'Recent Invoices', count: recentInvoices.length, icon: FileText },
    { id: 'payments', label: 'Collections', count: recentPayments.length, icon: Wallet },
    { id: 'pending', label: 'Pending Dues', count: pendingInvoices.length, icon: Clock }
  ];

  const getViewAllLink = () => {
    switch (activeTab) {
      case 'payments': return '/collections';
      case 'pending': return '/credits';
      default: return '/invoices';
    }
  };

  const getStatusBadge = (status, paymentStatus) => {
    if (status === 'Cancelled') {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">Cancelled</span>;
    }
    if (paymentStatus === 'Paid') {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Paid</span>;
    }
    if (paymentStatus === 'Partial') {
      return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">Partial</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">Unpaid</span>;
  };

  const getPaymentModeBadge = (mode) => {
    const formatted = (mode || 'Cash').toUpperCase();
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">{formatted}</span>;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="inline-flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive 
                    ? 'bg-slate-800 text-white font-semibold shadow-xs' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-slate-700 text-white' : 'text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* View All */}
        <Link
          to={getViewAllLink()}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group"
        >
          <span>View all</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Tab Feed */}
      <div className="p-4 flex-1">
        {activeTab === 'invoices' && (
          <div className="space-y-2">
            {recentInvoices.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <FileText className="w-8 h-8 mx-auto text-slate-600 mb-1.5" />
                <p>No invoices created yet.</p>
              </div>
            ) : (
              recentInvoices.map((inv) => (
                <Link
                  key={inv._id}
                  to={`/invoices/${inv._id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800/60 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-white truncate">
                          {inv.invoiceNumber}
                        </span>
                        {getStatusBadge(inv.status, inv.paymentStatus)}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {inv.customer?.customerName || 'Walk-in Customer'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-xs sm:text-sm text-white font-mono">
                      {formatCurrency(inv.totals?.netTotal || 0)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(inv.invoiceDate || inv.createdAt)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-2">
            {recentPayments.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <Wallet className="w-8 h-8 mx-auto text-slate-600 mb-1.5" />
                <p>No payment records found.</p>
              </div>
            ) : (
              recentPayments.map((pmt) => (
                <div
                  key={pmt._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-white truncate">
                          {pmt.customer?.customerName || 'Customer Payment'}
                        </span>
                        {getPaymentModeBadge(pmt.paymentMode)}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        Receipt: {pmt.receiptNumber || 'Direct Payment'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-xs sm:text-sm text-emerald-400 font-mono">
                      +{formatCurrency(pmt.amount || 0)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatDate(pmt.paymentDate || pmt.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="space-y-2">
            {pendingInvoices.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-1.5" />
                <p className="font-medium text-slate-300">All recent bills are settled.</p>
              </div>
            ) : (
              pendingInvoices.map((inv) => (
                <div
                  key={inv._id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/invoices/${inv._id}`} className="font-semibold text-xs sm:text-sm text-white hover:text-amber-300 truncate">
                          {inv.invoiceNumber}
                        </Link>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">Due</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {inv.customer?.customerName || 'Customer'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-xs sm:text-sm text-amber-400 font-mono">
                      {formatCurrency(inv.totals?.netTotal || 0)}
                    </p>
                    <Link to="/credits" className="text-[11px] text-blue-400 hover:underline">
                      Credit Ledger
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardActivityHub;
