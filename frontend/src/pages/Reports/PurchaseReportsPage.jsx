import { useState, useEffect, useCallback } from 'react';
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
  FileBarChart
} from 'lucide-react';
import { purchaseReportService } from '../../services/reports/purchaseReportService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../contexts/ToastContext';
import { useMotionConfig } from '../../hooks';
import { ShimmerBone } from '../../features/salesAnalytics/components/SkeletonCards';

export default function PurchaseReportsPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [summary, setSummary] = useState(null);
  const [supplierData, setSupplierData] = useState([]);
  const [productData, setProductData] = useState([]);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

  const { showToast } = useToast();
  const motionConfig = useMotionConfig();

  const fetchReports = useCallback(async (from = activeDateFrom, to = activeDateTo) => {
    try {
      setIsUpdating(true);
      const params = {};
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;
      
      const [sumData, supData, prodData] = await Promise.all([
        purchaseReportService.getPurchaseSummary(params),
        purchaseReportService.getSupplierWisePurchases(params),
        purchaseReportService.getProductWisePurchases(params)
      ]);
      
      setSummary(sumData.data);
      setSupplierData(supData.data || []);
      setProductData(prodData.data || []);
    } catch (error) {
      showToast('Failed to load purchase reports', 'error');
    } finally {
      setInitialLoading(false);
      setIsUpdating(false);
    }
  }, [activeDateFrom, activeDateTo, showToast]);

  useEffect(() => {
    fetchReports('', '');
  }, []);

  const handleApplyFilter = () => {
    setActiveDateFrom(dateFrom);
    setActiveDateTo(dateTo);
    fetchReports(dateFrom, dateTo);
  };

  const handleClearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setActiveDateFrom('');
    setActiveDateTo('');
    fetchReports('', '');
  };

  return (
    <div className="space-y-6 relative">
      {/* Header & Date Filters */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
              <FileBarChart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Purchase Analytics & Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">Comprehensive vendor and item purchase breakdown</p>
            </div>
          </div>
          {isUpdating && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Updating reports...
            </div>
          )}
        </div>

        {/* Date Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
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

      {initialLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <ShimmerBone className="h-3.5 w-24 rounded" />
                  <ShimmerBone className="w-8 h-8 rounded-xl" />
                </div>
                <ShimmerBone className="h-7 w-28 rounded mb-1.5" />
                <ShimmerBone className="h-3 w-36 rounded" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Total Purchases</p>
                  <h3 className="text-2xl font-bold text-white">
                    {typeof summary?.totalPurchases === 'object' ? summary.totalPurchases.count : (summary?.totalPurchases || 0)}
                  </h3>
                  <p className="text-xs text-blue-400 font-medium mt-1">
                    {formatCurrency(typeof summary?.totalPurchases === 'object' ? summary.totalPurchases.value : 0)}
                  </p>
                </div>
                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </div>
            </div>
            
            <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Completed Value</p>
                  <h3 className="text-2xl font-bold text-emerald-400">{formatCurrency(summary?.completed?.value || 0)}</h3>
                  <p className="text-xs text-emerald-500 font-medium mt-1">{summary?.completed?.count || 0} completed orders</p>
                </div>
                <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
              </div>
            </div>
            
            <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Draft Value</p>
                  <h3 className="text-2xl font-bold text-amber-400">{formatCurrency(summary?.draft?.value || 0)}</h3>
                  <p className="text-xs text-amber-500 font-medium mt-1">{summary?.draft?.count || 0} pending drafts</p>
                </div>
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                  <Clock className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Cancelled Value</p>
                  <h3 className="text-2xl font-bold text-rose-400">{formatCurrency(summary?.cancelled?.value || 0)}</h3>
                  <p className="text-xs text-rose-500 font-medium mt-1">{summary?.cancelled?.count || 0} cancelled</p>
                </div>
                <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl group-hover:scale-110 transition-transform">
                  <ArrowDownRight className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* Analysis Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Supplier Wise Analysis */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-slate-700/50 bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-semibold">
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
                          <div className="font-medium text-white">{row.supplierName || 'Unknown'}</div>
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
                <div className="flex items-center gap-2 text-white font-semibold">
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
                          <div className="font-medium text-white">{row.productName || 'Unknown'}</div>
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
