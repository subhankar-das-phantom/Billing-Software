import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShieldAlert, 
  Truck, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Search,
  Calendar,
  Sparkles,
  BarChart3,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { inventoryAnalyticsService } from '../../../services/inventoryAnalyticsService';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../../contexts/ToastContext';
import { InventoryIntelligenceSkeleton } from './InventoryIntelligenceSkeleton';

export function InventoryIntelligenceSection() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('stock-risk');

  const [expiryData, setExpiryData] = useState(null);
  const [velocityData, setVelocityData] = useState(null);
  const [stockRiskData, setStockRiskData] = useState(null);
  const [procurementData, setProcurementData] = useState(null);

  // Date filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

  // Sub-section filters
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [riskSearch, setRiskSearch] = useState('');
  const [velocitySearch, setVelocitySearch] = useState('');
  const [procurementSearch, setProcurementSearch] = useState('');

  const { showToast } = useToast();

  const fetchIntelligence = useCallback(async (from = activeDateFrom, to = activeDateTo) => {
    try {
      setIsUpdating(true);
      const params = {};
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;

      const [expiryRes, velocityRes, riskRes, procurementRes] = await Promise.all([
        inventoryAnalyticsService.getBatchExpiryIntelligence(),
        inventoryAnalyticsService.getProductVelocity(params),
        inventoryAnalyticsService.getStockRiskIndicators(),
        inventoryAnalyticsService.getSupplierProcurementActivity(params)
      ]);

      setExpiryData(expiryRes.data);
      setVelocityData(velocityRes.data);
      setStockRiskData(riskRes.data);
      setProcurementData(procurementRes.data);
    } catch (err) {
      showToast('Failed to load inventory intelligence', 'error');
    } finally {
      setInitialLoading(false);
      setIsUpdating(false);
    }
  }, [activeDateFrom, activeDateTo, showToast]);

  useEffect(() => {
    fetchIntelligence('', '');
  }, []);

  const handleApplyFilter = () => {
    setActiveDateFrom(dateFrom);
    setActiveDateTo(dateTo);
    fetchIntelligence(dateFrom, dateTo);
  };

  const handleClearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setActiveDateFrom('');
    setActiveDateTo('');
    fetchIntelligence('', '');
  };

  // Stock Risk filtering
  const allRiskItems = [
    ...(stockRiskData?.outOfStockItems || []),
    ...(stockRiskData?.lowStockItems || []),
    ...(stockRiskData?.healthyItems || [])
  ];

  const filteredByStatus = riskFilter === 'ALL'
    ? allRiskItems
    : riskFilter === 'OUT_OF_STOCK'
    ? (stockRiskData?.outOfStockItems || [])
    : riskFilter === 'LOW_STOCK'
    ? (stockRiskData?.lowStockItems || [])
    : (stockRiskData?.healthyItems || []);

  const displayedRiskItems = filteredByStatus.filter(item => {
    if (!riskSearch.trim()) return true;
    const query = riskSearch.toLowerCase();
    return (
      item.productName?.toLowerCase().includes(query) ||
      item.hsnCode?.toLowerCase().includes(query) ||
      item.manufacturer?.toLowerCase().includes(query)
    );
  });

  // Velocity filtering
  const displayedVelocityFast = (velocityData?.fastMovingTop || []).filter(item => {
    if (!velocitySearch.trim()) return true;
    const query = velocitySearch.toLowerCase();
    return (
      item.productName?.toLowerCase().includes(query) ||
      item.hsnCode?.toLowerCase().includes(query) ||
      item.manufacturer?.toLowerCase().includes(query)
    );
  });

  const displayedVelocitySlow = [
    ...(velocityData?.slowMovingTop || []),
    ...(velocityData?.noSalesTop || [])
  ].filter(item => {
    if (!velocitySearch.trim()) return true;
    const query = velocitySearch.toLowerCase();
    return (
      item.productName?.toLowerCase().includes(query) ||
      item.hsnCode?.toLowerCase().includes(query) ||
      item.manufacturer?.toLowerCase().includes(query)
    );
  });

  // Procurement filtering
  const displayedSuppliers = (procurementData?.suppliers || []).filter(item => {
    if (!procurementSearch.trim()) return true;
    const query = procurementSearch.toLowerCase();
    return (
      item.supplierName?.toLowerCase().includes(query) ||
      item.supplierGstin?.toLowerCase().includes(query) ||
      item.supplierPhone?.toLowerCase().includes(query)
    );
  });

  if (initialLoading) {
    return <InventoryIntelligenceSkeleton />;
  }

  const getBucketColor = (key) => {
    switch (key) {
      case 'EXPIRED':
        return { border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300' };
      case 'DAYS_0_30':
        return { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300' };
      case 'DAYS_31_60':
        return { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300' };
      case 'DAYS_61_90':
        return { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' };
      case 'DAYS_90_PLUS':
        return { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' };
      case 'NO_EXPIRY':
      default:
        return { border: 'border-slate-700/50', bg: 'bg-slate-800/40', text: 'text-slate-400', badge: 'bg-slate-700/50 text-slate-300' };
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── TOP EXECUTIVE CONTROLS & DATE FILTER ─── */}
      <div className="glass-card p-5 border border-slate-800/80 bg-slate-900/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">Inventory Intelligence</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm">
                    Professional
                  </span>
                </div>
                <p className="text-xs text-slate-400">Deterministic stock velocity, batch expiration horizon, and procurement analytics</p>
              </div>
            </div>
          </div>

          {/* Date Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-lg border border-slate-800">
              <input
                type="date"
                className="input text-xs py-1 px-2 h-8 w-34 bg-transparent border-0 focus:ring-0 text-slate-200"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From"
              />
              <span className="text-slate-600 text-xs">to</span>
              <input
                type="date"
                className="input text-xs py-1 px-2 h-8 w-34 bg-transparent border-0 focus:ring-0 text-slate-200"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To"
              />
            </div>

            <button
              onClick={handleApplyFilter}
              disabled={isUpdating}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-sm transition-all flex items-center gap-1.5 h-9"
            >
              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
              Apply Filter
            </button>

            {(dateFrom || dateTo) && (
              <button
                onClick={handleClearFilter}
                disabled={isUpdating}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all h-9"
              >
                Reset
              </button>
            )}

            {isUpdating && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-medium border border-blue-500/20">
                <Loader2 className="w-3 h-3 animate-spin" />
                Refreshing...
              </div>
            )}
          </div>
        </div>

        {/* ─── 4 TOP SUMMARY KPI TILES ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Batches</span>
              <Clock className="w-4 h-4 text-amber-400/80" />
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {expiryData?.totalActiveBatches || 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {expiryData?.summary?.find(s => s.key === 'NO_EXPIRY')?.batchCount || 0} non-expiring batches
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Units Sold (Period)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400/80" />
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {(velocityData?.summary?.totalUnitsSold || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {velocityData?.summary?.fastMovingCount || 0} fast-moving lines
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Stock Health</span>
              <ShieldAlert className="w-4 h-4 text-rose-400/80" />
            </div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-2">
              <span className="text-rose-400">{stockRiskData?.summary?.outOfStockCount || 0} Out</span>
              <span className="text-xs text-slate-500">/ {stockRiskData?.summary?.healthyCount || 0} Healthy</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stockRiskData?.summary?.lowStockCount || 0} items near stockout
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Procurement Spend</span>
              <Truck className="w-4 h-4 text-blue-400/80" />
            </div>
            <div className="text-xl font-bold text-white font-mono">
              {formatCurrency(procurementData?.summary?.totalPurchasedValue || 0)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {(procurementData?.summary?.totalPhysicalQuantity || 0).toLocaleString()} units from {procurementData?.summary?.activeSuppliersCount || 0} vendors
            </div>
          </div>
        </div>
      </div>

      {/* ─── SEGMENTED SUB-NAVIGATION TABS ─── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('stock-risk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'stock-risk'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Stock Risk & Buffer
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeSubTab === 'stock-risk' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {(stockRiskData?.summary?.outOfStockCount || 0) + (stockRiskData?.summary?.lowStockCount || 0)} At Risk
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('expiry-horizon')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'expiry-horizon'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Expiry Horizon
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeSubTab === 'expiry-horizon' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {expiryData?.criticalBatches?.length || 0} Critical
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('sales-velocity')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'sales-velocity'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Sales Velocity
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeSubTab === 'sales-velocity' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {velocityData?.summary?.fastMovingCount || 0} Fast Movers
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('vendor-procurement')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'vendor-procurement'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Vendor Procurement
          <span className={`px-1.5 py-0.2 rounded text-[10px] ${
            activeSubTab === 'vendor-procurement' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {procurementData?.summary?.activeSuppliersCount || 0} Vendors
          </span>
        </button>
      </div>

      {/* ─── TAB CONTENT PANELS ─── */}
      <AnimatePresence mode="wait">
        {/* ─── SUB-TAB 1: STOCK RISK ANALYSIS ─── */}
        {activeSubTab === 'stock-risk' && (
          <motion.div
            key="stock-risk"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* 3 Clickable Filter Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                onClick={() => setRiskFilter('OUT_OF_STOCK')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  riskFilter === 'OUT_OF_STOCK'
                    ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Out of Stock</span>
                    <div className="text-2xl font-bold text-white font-mono mt-1">
                      {stockRiskData?.summary?.outOfStockCount || 0}
                    </div>
                    <span className="text-[11px] text-slate-400">Zero inventory remaining</span>
                  </div>
                  <XCircle className="w-7 h-7 text-rose-400/80" />
                </div>
              </div>

              <div
                onClick={() => setRiskFilter('LOW_STOCK')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  riskFilter === 'LOW_STOCK'
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Low Stock (≤10 Units)</span>
                    <div className="text-2xl font-bold text-white font-mono mt-1">
                      {stockRiskData?.summary?.lowStockCount || 0}
                    </div>
                    <span className="text-[11px] text-slate-400">Near stockout threshold</span>
                  </div>
                  <AlertTriangle className="w-7 h-7 text-amber-400/80" />
                </div>
              </div>

              <div
                onClick={() => setRiskFilter('HEALTHY')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  riskFilter === 'HEALTHY'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/40'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Healthy Stock (&gt;10 Units)</span>
                    <div className="text-2xl font-bold text-white font-mono mt-1">
                      {stockRiskData?.summary?.healthyCount || 0}
                    </div>
                    <span className="text-[11px] text-slate-400">Adequate operational buffer</span>
                  </div>
                  <CheckCircle2 className="w-7 h-7 text-emerald-400/80" />
                </div>
              </div>
            </div>

            {/* Product Risk Table Card */}
            <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
              <div className="p-3.5 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    {riskFilter === 'ALL' && `All Catalog Products (${stockRiskData?.summary?.totalProducts || 0})`}
                    {riskFilter === 'OUT_OF_STOCK' && `Out of Stock Line Items (${stockRiskData?.summary?.outOfStockCount || 0})`}
                    {riskFilter === 'LOW_STOCK' && `Low Stock Line Items (${stockRiskData?.summary?.lowStockCount || 0})`}
                    {riskFilter === 'HEALTHY' && `Healthy Stock Items (${stockRiskData?.summary?.healthyCount || 0})`}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search product, HSN, manufacturer..."
                      value={riskSearch}
                      onChange={(e) => setRiskSearch(e.target.value)}
                      className="input text-xs py-1 pl-8 pr-3 h-8 w-full bg-slate-900/80 border-slate-700/60"
                    />
                  </div>
                  <button
                    onClick={() => setRiskFilter('ALL')}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                      riskFilter === 'ALL' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    View All
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800 sticky top-0 font-medium">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">HSN Code</th>
                      <th className="p-3">Manufacturer</th>
                      <th className="p-3 text-right">Unit Rate</th>
                      <th className="p-3 text-right">Stock on Hand</th>
                      <th className="p-3 text-center">Status / Alert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {displayedRiskItems.map((item, idx) => (
                      <tr key={item.productId || idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-medium text-white">
                          <div>{item.productName}</div>
                        </td>
                        <td className="p-3 text-slate-400 font-mono">{item.hsnCode || '—'}</td>
                        <td className="p-3 text-slate-400">{item.manufacturer || 'General'}</td>
                        <td className="p-3 text-right text-slate-300 font-mono">
                          <div>{formatCurrency(item.rate || 0)}</div>
                          {item.newMRP > 0 && <div className="text-[10px] text-slate-500 font-sans">MRP: {formatCurrency(item.newMRP)}</div>}
                        </td>
                        <td className="p-3 text-right font-bold font-mono text-sm">
                          <span className={
                            item.currentStockQty <= 0
                              ? 'text-rose-400'
                              : item.currentStockQty <= 10
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }>
                            {item.currentStockQty.toLocaleString()} {item.unit || 'units'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {item.currentStockQty <= 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25">
                              <XCircle className="w-3 h-3" />
                              Out of Stock
                            </span>
                          ) : item.currentStockQty <= 10 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              <AlertTriangle className="w-3 h-3" />
                              Low Stock Buffer
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                              <CheckCircle2 className="w-3 h-3" />
                              Healthy Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayedRiskItems.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500">
                          No products match the selected stock risk filter
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── SUB-TAB 2: BATCH EXPIRY HORIZON ─── */}
        {activeSubTab === 'expiry-horizon' && (
          <motion.div
            key="expiry-horizon"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* 6 Clean Expiry Horizon Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {expiryData?.summary?.map((b) => {
                const color = getBucketColor(b.key);
                return (
                  <div key={b.key} className={`p-3.5 rounded-xl border ${color.border} ${color.bg} bg-opacity-40`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${color.text} mb-1`}>{b.label}</p>
                    <div className="text-xl font-bold text-white font-mono">{b.batchCount} <span className="text-xs font-normal text-slate-400 font-sans">batches</span></div>
                    <div className="mt-2 text-[11px] flex flex-col text-slate-400 gap-0.5">
                      <span className="font-mono">{b.totalRemainingQty.toLocaleString()} units</span>
                      <span>{b.uniqueProductCount} products</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Critical Expiration Alert Table */}
            <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
              <div className="p-3.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4" />
                  Critical Batches Requiring Action ({expiryData?.criticalBatches?.length || 0})
                </div>
                <span className="text-xs text-slate-500">Batches expired or expiring within 30 days</span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Batch Number</th>
                      <th className="p-3">Manufacturer</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3 text-right">Remaining Stock</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {expiryData?.criticalBatches?.map((cb, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 font-medium text-white">{cb.productName}</td>
                        <td className="p-3 text-slate-300 font-mono">{cb.batchNo}</td>
                        <td className="p-3 text-slate-400">{cb.manufacturer || 'General'}</td>
                        <td className="p-3 text-slate-400">{cb.expiryDate ? new Date(cb.expiryDate).toLocaleDateString() : '—'}</td>
                        <td className="p-3 text-right font-bold text-white font-mono">{cb.remainingQty}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            cb.status === 'EXPIRED' 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' 
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                          }`}>
                            {cb.status === 'EXPIRED' ? 'EXPIRED' : '< 30 DAYS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!expiryData?.criticalBatches || expiryData.criticalBatches.length === 0) && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500">
                          No expired or critically near-expiry batches detected.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── SUB-TAB 3: SALES VELOCITY ─── */}
        {activeSubTab === 'sales-velocity' && (
          <motion.div
            key="sales-velocity"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* 4 Quartile Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Fast Moving</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{velocityData?.summary?.fastMovingCount || 0}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Top 25% by sales volume</div>
              </div>

              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Normal Velocity</span>
                  <Layers className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{velocityData?.summary?.normalCount || 0}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Middle 50% regular sales</div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Slow Moving</span>
                  <TrendingDown className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{velocityData?.summary?.slowMovingCount || 0}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Bottom 25% non-zero sales</div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-700/50 bg-slate-800/30">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Zero Sales</span>
                  <XCircle className="w-4 h-4 text-slate-500" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">{velocityData?.summary?.noSalesCount || 0}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">0 units billed in period</div>
              </div>
            </div>

            {/* Split Tables: Fast Movers vs Slow/Zero Movers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Fast Movers */}
              <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
                <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    Top Fast-Moving Products
                  </div>
                  <span className="text-xs text-slate-500">Highest sales velocity</span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-right">Units Sold</th>
                        <th className="p-2.5 text-right">Current Stock</th>
                        <th className="p-2.5 text-right">Movement %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {displayedVelocityFast.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-2.5 font-medium text-white">
                            <div>{p.productName}</div>
                            {p.manufacturer && <div className="text-[10px] text-slate-500">{p.manufacturer}</div>}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-400 font-mono">{p.unitsSold}</td>
                          <td className="p-2.5 text-right text-slate-300 font-mono">{p.currentStockQty}</td>
                          <td className="p-2.5 text-right font-semibold text-blue-300 font-mono">{p.velocityRate}%</td>
                        </tr>
                      ))}
                      {displayedVelocityFast.length === 0 && (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-500">No fast-moving products in period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Slow / Zero Movers */}
              <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
                <div className="p-3 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    <TrendingDown className="w-4 h-4" />
                    Slow-Moving & Zero-Sales
                  </div>
                  <span className="text-xs text-slate-500">Potential stagnant capital</span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
                      <tr>
                        <th className="p-2.5">Product</th>
                        <th className="p-2.5 text-right">Units Sold</th>
                        <th className="p-2.5 text-right">Stock on Hand</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {displayedVelocitySlow.slice(0, 15).map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-2.5 font-medium text-white">
                            <div>{p.productName}</div>
                            {p.manufacturer && <div className="text-[10px] text-slate-500">{p.manufacturer}</div>}
                          </td>
                          <td className="p-2.5 text-right text-slate-400 font-mono">{p.unitsSold}</td>
                          <td className="p-2.5 text-right font-bold text-amber-400 font-mono">{p.currentStockQty}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              p.unitsSold === 0 ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
                            }`}>
                              {p.unitsSold === 0 ? 'ZERO SALES' : 'SLOW MOVING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {displayedVelocitySlow.length === 0 && (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-500">No slow-moving products</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── SUB-TAB 4: VENDOR PROCUREMENT ─── */}
        {activeSubTab === 'vendor-procurement' && (
          <motion.div
            key="vendor-procurement"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            <div className="glass-card overflow-hidden border border-slate-800/80 bg-slate-900/60">
              <div className="p-3.5 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Vendor Procurement Performance ({procurementData?.summary?.activeSuppliersCount || 0} Suppliers)
                  </span>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search supplier or GSTIN..."
                    value={procurementSearch}
                    onChange={(e) => setProcurementSearch(e.target.value)}
                    className="input text-xs py-1 pl-8 pr-3 h-8 w-full bg-slate-900/80 border-slate-700/60"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
                    <tr>
                      <th className="p-3">Vendor / Supplier</th>
                      <th className="p-3 text-right">Orders</th>
                      <th className="p-3 text-right">Base Qty</th>
                      <th className="p-3 text-right">Free Qty</th>
                      <th className="p-3 text-right">Total Recv Units</th>
                      <th className="p-3 text-right">Total Spend (₹)</th>
                      <th className="p-3 text-right">Last Purchase</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedSuppliers.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <div className="font-semibold text-white">{s.supplierName}</div>
                          {s.supplierGstin && <div className="text-[10px] text-slate-500 font-mono">GST: {s.supplierGstin}</div>}
                        </td>
                        <td className="p-3 text-right text-slate-300 font-mono">{s.orderCount}</td>
                        <td className="p-3 text-right text-slate-300 font-mono">{s.baseQuantity.toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-400 font-mono">+{s.freeQuantity.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-blue-300 font-mono">{s.receivedQuantity.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-emerald-400 font-mono">{formatCurrency(s.totalAmount)}</td>
                        <td className="p-3 text-right text-slate-400 font-mono">
                          {s.lastPurchaseDate ? new Date(s.lastPurchaseDate).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {displayedSuppliers.length === 0 && (
                      <tr><td colSpan="7" className="p-8 text-center text-slate-500">No completed vendor purchases in period</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
