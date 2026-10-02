import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  Users, 
  Loader2, 
  DollarSign, 
  Clock, 
  XCircle,
  FileBarChart,
  RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useMotionConfig } from '../../hooks';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import {
  usePurchaseSummaryQuery,
  useSupplierWisePurchasesQuery,
  useProductWisePurchasesQuery
} from '../../features/purchaseReports/queries/usePurchaseReportQueries';

export default function PurchaseReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

  const motionConfig = useMotionConfig();

  const queryParams = useMemo(() => {
    const p = {};
    if (activeDateFrom) p.dateFrom = activeDateFrom;
    if (activeDateTo) p.dateTo = activeDateTo;
    return p;
  }, [activeDateFrom, activeDateTo]);

  const {
    data: summaryRes,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary
  } = usePurchaseSummaryQuery(queryParams);

  const {
    data: supplierRes,
    isLoading: supplierLoading,
    isFetching: supplierFetching,
    refetch: refetchSuppliers
  } = useSupplierWisePurchasesQuery(queryParams);

  const {
    data: productRes,
    isLoading: productLoading,
    isFetching: productFetching,
    refetch: refetchProducts
  } = useProductWisePurchasesQuery(queryParams);

  const summary = summaryRes?.data || null;
  const supplierData = supplierRes?.data || [];
  const productData = productRes?.data || [];

  const isUpdating = summaryFetching || supplierFetching || productFetching;
  const isInitialLoading = (summaryLoading && !summary) || (supplierLoading && supplierData.length === 0) || (productLoading && productData.length === 0);

  const handleRefresh = () => {
    refetchSummary();
    refetchSuppliers();
    refetchProducts();
  };

  const handleApplyFilter = () => {
    setActiveDateFrom(dateFrom);
    setActiveDateTo(dateTo);
  };

  const handleClearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setActiveDateFrom('');
    setActiveDateTo('');
  };

  return (
    <div className="space-y-6 relative">
      {/* Header & Date Filters */}
      <div className="glass-card p-3.5 sm:p-6">
        <div className="flex flex-row justify-between items-center mb-3 sm:mb-6 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-1">
            <div className="p-2 sm:p-2.5 bg-blue-500/20 text-blue-400 rounded-xl shrink-0">
              <FileBarChart className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold text-slate-100 truncate">Purchase Analytics & Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5 truncate hidden sm:block">Comprehensive vendor and item purchase breakdown</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RefreshIndicator isRefreshing={isUpdating} size="sm" showText={false} />
            <button
              onClick={handleRefresh}
              disabled={isUpdating}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700/80 transition-colors disabled:opacity-50"
              title="Refresh reports"
            >
              <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Mobile Date Filter Bar (< sm) */}
        <div className="sm:hidden pt-3 border-t border-slate-700/50 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">From Date</label>
              <input
                type="date"
                className="input w-full text-xs py-1.5 px-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">To Date</label>
              <input
                type="date"
                className="input w-full text-xs py-1.5 px-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyFilter}
              disabled={isUpdating}
              className="btn btn-primary text-xs py-2 flex-1 flex items-center justify-center gap-1.5"
            >
              Apply Filter
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={handleClearFilter}
                disabled={isUpdating}
                className="btn btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Date Filter Bar (>= sm) */}
        <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">From Date</label>
            <input
              type="date"
              className="input w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">To Date</label>
            <input
              type="date"
              className="input w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleApplyFilter}
              disabled={isUpdating}
              className="btn btn-primary text-xs h-10 w-full flex items-center justify-center gap-1.5"
            >
              Apply Filter
            </button>
          </div>
          {(dateFrom || dateTo) && (
            <div className="flex items-end">
              <button
                onClick={handleClearFilter}
                disabled={isUpdating}
                className="btn btn-secondary text-xs h-10 w-full flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {isInitialLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card p-3 sm:p-5">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <ShimmerBone className="h-3 sm:h-3.5 w-16 sm:w-24 rounded" />
                  <ShimmerBone className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl shrink-0" />
                </div>
                <ShimmerBone className="h-5 sm:h-7 w-20 sm:w-28 rounded mb-1 sm:mb-1.5" />
                <ShimmerBone className="h-2.5 sm:h-3 w-24 sm:w-36 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="glass-card p-5">
                <ShimmerBone className="h-5 w-44 rounded mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(j => (
                    <div key={j} className="flex justify-between items-center py-2 border-b border-slate-800/40">
                      <ShimmerBone className="h-4 w-32 rounded" />
                      <ShimmerBone className="h-4 w-20 rounded" />
                      <ShimmerBone className="h-4 w-24 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="glass-card p-3 sm:p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-1">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1 truncate">Total Purchases</p>
                  <h3 className="text-lg sm:text-2xl font-bold text-slate-100">
                    {typeof summary?.totalPurchases === 'object' ? summary.totalPurchases.count : (summary?.totalPurchases || 0)}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-blue-400 font-medium mt-0.5 sm:mt-1 truncate">
                    {formatCurrency(typeof summary?.totalPurchases === 'object' ? summary.totalPurchases.value : 0)}
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-500/20 text-blue-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform shrink-0">
                  <ShoppingCart className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>
            </div>
            
            <div className="glass-card p-3 sm:p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-1">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1 truncate">Completed Value</p>
                  <h3 className="text-lg sm:text-2xl font-bold text-emerald-400">{formatCurrency(summary?.completed?.value || 0)}</h3>
                  <p className="text-[10px] sm:text-xs text-emerald-500 font-medium mt-0.5 sm:mt-1 truncate">{summary?.completed?.count || 0} completed orders</p>
                </div>
                <div className="p-2 sm:p-3 bg-emerald-500/20 text-emerald-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform shrink-0">
                  <ArrowUpRight className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>
            </div>
            
            <div className="glass-card p-3 sm:p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-1">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1 truncate">Draft Value</p>
                  <h3 className="text-lg sm:text-2xl font-bold text-amber-400">{formatCurrency(summary?.draft?.value || 0)}</h3>
                  <p className="text-[10px] sm:text-xs text-amber-500 font-medium mt-0.5 sm:mt-1 truncate">{summary?.draft?.count || 0} pending drafts</p>
                </div>
                <div className="p-2 sm:p-3 bg-amber-500/20 text-amber-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform shrink-0">
                  <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>
            </div>

            <div className="glass-card p-3 sm:p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-1">
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5 sm:mb-1 truncate">Cancelled Value</p>
                  <h3 className="text-lg sm:text-2xl font-bold text-rose-400">{formatCurrency(summary?.cancelled?.value || 0)}</h3>
                  <p className="text-[10px] sm:text-xs text-rose-500 font-medium mt-0.5 sm:mt-1 truncate">{summary?.cancelled?.count || 0} cancelled</p>
                </div>
                <div className="p-2 sm:p-3 bg-rose-500/20 text-rose-400 rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform shrink-0">
                  <ArrowDownRight className="w-4 h-4 sm:w-6 sm:h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supplier Wise Analysis */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-100 font-semibold">
                  <Users size={18} className="text-blue-400" />
                  Supplier Wise Analysis
                </div>
                <span className="text-xs text-slate-400">{supplierData.length} Suppliers</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-800/70 sticky top-0 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                    <tr>
                      <th className="p-3">Supplier</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Orders</th>
                      <th className="p-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {supplierData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium text-slate-100">{row.supplierName || 'Unknown'}</div>
                          {row.lastPurchaseDate && (
                            <div className="text-xs text-slate-500">
                              Last: {new Date(row.lastPurchaseDate).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            row.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-300">{row.count}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(row.totalValue)}</td>
                      </tr>
                    ))}
                    {supplierData.length === 0 && (
                      <tr><td colSpan="4" className="p-8 text-center text-slate-500">No supplier data found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Wise Analysis */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-100 font-semibold">
                  <Package size={18} className="text-teal-400" />
                  Product Wise Analysis
                </div>
                <span className="text-xs text-slate-400">{productData.length} Products</span>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-800/70 sticky top-0 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Paid Qty</th>
                      <th className="p-3 text-right">Free</th>
                      <th className="p-3 text-right">Recv Qty</th>
                      <th className="p-3 text-right">Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {productData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium text-slate-100">{row.productName || 'Unknown'}</div>
                          {row.sku && <div className="text-xs text-slate-500">{row.sku}</div>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            row.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-slate-200">{row.paidQuantity ?? row.quantity ?? 0}</td>
                        <td className="p-3 text-right text-emerald-400/80">{row.freeQuantity || 0}</td>
                        <td className="p-3 text-right font-semibold text-blue-300">
                          {row.receivedQuantity ?? ((row.quantity || 0) + (row.freeQuantity || 0))}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(row.totalValue)}</td>
                      </tr>
                    ))}
                    {productData.length === 0 && (
                      <tr><td colSpan="6" className="p-8 text-center text-slate-500">No product purchase data found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
