import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  Calendar,
  Sparkles
} from 'lucide-react';
import { inventoryAnalyticsService } from '../../../services/inventoryAnalyticsService';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../../contexts/ToastContext';

export function InventoryIntelligenceSection() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expiryData, setExpiryData] = useState(null);
  const [velocityData, setVelocityData] = useState(null);
  const [stockRiskData, setStockRiskData] = useState(null);
  const [procurementData, setProcurementData] = useState(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeDateFrom, setActiveDateFrom] = useState('');
  const [activeDateTo, setActiveDateTo] = useState('');

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

  const [riskFilter, setRiskFilter] = useState('ALL');
  const [riskSearch, setRiskSearch] = useState('');

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
      item.sku?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query)
    );
  });

  if (initialLoading) {
    return (
      <div className="glass-card p-12 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-400 mb-3" />
        <p className="font-medium">Aggregating inventory intelligence...</p>
      </div>
    );
  }

  const getBucketColor = (key) => {
    switch (key) {
      case 'EXPIRED':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      case 'DAYS_0_30':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'DAYS_31_60':
        return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
      case 'DAYS_61_90':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      case 'DAYS_90_PLUS':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'NO_EXPIRY':
      default:
        return 'border-slate-600/30 bg-slate-800/40 text-slate-400';
    }
  };

  return (
    <div className="space-y-8 relative">
      {isUpdating && (
        <div className="absolute top-2 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Refreshing metrics...
        </div>
      )}
      {/* ─── SECTION 1: BATCH EXPIRY INTELLIGENCE ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Batch Expiry Intelligence</h3>
              <p className="text-xs text-slate-400">Active stock segmented by expiration horizon (including non-expiring batches)</p>
            </div>
          </div>
          <span className="text-xs px-3 py-1 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
            {expiryData?.totalActiveBatches || 0} Active Batches
          </span>
        </div>

        {/* 6-Bucket Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {expiryData?.summary?.map((b) => (
            <div key={b.key} className={`glass-card p-4 rounded-xl border ${getBucketColor(b.key)}`}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1">{b.label}</p>
              <h4 className="text-xl font-bold text-white">{b.batchCount} <span className="text-xs font-normal text-slate-400">batches</span></h4>
              <div className="mt-2 text-xs flex flex-col gap-0.5 text-slate-400">
                <span>{b.totalRemainingQty.toLocaleString()} units</span>
                <span>{b.uniqueProductCount} products</span>
              </div>
            </div>
          ))}
        </div>

        {/* Critical Expiry Alerts */}
        {expiryData?.criticalBatches?.length > 0 && (
          <div className="glass-card p-4 border border-rose-500/20 bg-rose-950/10 rounded-xl">
            <div className="flex items-center gap-2 mb-3 text-rose-400 text-sm font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Critical Expiry Action Required ({expiryData.criticalBatches.length} batches)
            </div>
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-rose-500/20">
                  <tr>
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Batch No</th>
                    <th className="pb-2">Expiry Date</th>
                    <th className="pb-2 text-right">Remaining Qty</th>
                    <th className="pb-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {expiryData.criticalBatches.map((cb, idx) => (
                    <tr key={idx} className="hover:bg-rose-500/5">
                      <td className="py-2 text-white font-medium">{cb.productName}</td>
                      <td className="py-2 text-slate-300 font-mono">{cb.batchNo}</td>
                      <td className="py-2 text-slate-400">{new Date(cb.expiryDate).toLocaleDateString()}</td>
                      <td className="py-2 text-right font-bold text-white">{cb.remainingQty}</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          cb.status === 'EXPIRED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {cb.status === 'EXPIRED' ? 'EXPIRED' : '< 30 DAYS'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 2: PRODUCT SALES VELOCITY ─── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-white">Product Sales Velocity</h3>
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/10 text-emerald-300 rounded-full border border-emerald-500/30 font-semibold">
                  {(velocityData?.summary?.totalUnitsSold || 0).toLocaleString()} Units Sold
                </span>
              </div>
              <p className="text-xs text-slate-400">Deterministic movement rate based on invoice sales in selected period</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="input text-xs py-1 px-2.5 h-8 w-36"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
            />
            <input
              type="date"
              className="input text-xs py-1 px-2.5 h-8 w-36"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
            />
            <button
              onClick={handleApplyFilter}
              disabled={isUpdating}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 h-8"
            >
              Apply Filter
            </button>
            {(dateFrom || dateTo) && (
              <button
                onClick={handleClearFilter}
                disabled={isUpdating}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all h-8"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Velocity Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 border-l-4 border-emerald-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Fast Moving</p>
                <h4 className="text-2xl font-bold text-emerald-400">{velocityData?.summary?.fastMovingCount || 0}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Top 25% by sales volume</p>
              </div>
              <TrendingUp className="w-6 h-6 text-emerald-500/40" />
            </div>
          </div>

          <div className="glass-card p-4 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Normal Velocity</p>
                <h4 className="text-2xl font-bold text-blue-400">{velocityData?.summary?.normalCount || 0}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Moderate regular sales</p>
              </div>
              <Layers className="w-6 h-6 text-blue-500/40" />
            </div>
          </div>

          <div className="glass-card p-4 border-l-4 border-amber-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">Slow Moving</p>
                <h4 className="text-2xl font-bold text-amber-400">{velocityData?.summary?.slowMovingCount || 0}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Low non-zero volume</p>
              </div>
              <TrendingDown className="w-6 h-6 text-amber-500/40" />
            </div>
          </div>

          <div className="glass-card p-4 border-l-4 border-slate-600">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">No Sales</p>
                <h4 className="text-2xl font-bold text-slate-400">{velocityData?.summary?.noSalesCount || 0}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">0 units sold in period</p>
              </div>
              <XCircle className="w-6 h-6 text-slate-500/40" />
            </div>
          </div>
        </div>

        {/* Fast Moving vs Slow Moving Comparison Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card overflow-hidden">
            <div className="p-3 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Top Fast-Moving Products
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-right">Units Sold</th>
                    <th className="p-2.5 text-right">Current Stock</th>
                    <th className="p-2.5 text-right">Movement %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {velocityData?.fastMovingTop?.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-2.5 text-white font-medium">{p.productName}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-400">{p.unitsSold}</td>
                      <td className="p-2.5 text-right text-slate-300">{p.currentStockQty}</td>
                      <td className="p-2.5 text-right font-semibold text-blue-300">{p.velocityRate}%</td>
                    </tr>
                  ))}
                  {(!velocityData?.fastMovingTop || velocityData.fastMovingTop.length === 0) && (
                    <tr><td colSpan="4" className="p-6 text-center text-slate-500">No fast-moving items in selected period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Slow-Moving & Zero-Sales Items
            </div>
            <div className="overflow-x-auto max-h-60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-700/50">
                  <tr>
                    <th className="p-2.5">Product</th>
                    <th className="p-2.5 text-right">Units Sold</th>
                    <th className="p-2.5 text-right">Stock on Hand</th>
                    <th className="p-2.5 text-center">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[...(velocityData?.slowMovingTop || []), ...(velocityData?.noSalesTop || [])].slice(0, 10).map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-2.5 text-white font-medium">{p.productName}</td>
                      <td className="p-2.5 text-right text-slate-400">{p.unitsSold}</td>
                      <td className="p-2.5 text-right font-bold text-amber-400">{p.currentStockQty}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.unitsSold === 0 ? 'bg-slate-700/50 text-slate-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {p.unitsSold === 0 ? 'NO SALES' : 'SLOW MOVING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: STOCK RISK INDICATORS ─── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Stock Risk Analysis</h3>
              <p className="text-xs text-slate-400">Objective stock levels: Out of Stock (0 units), Low Stock (≤10 units), and Healthy (&gt;10 units)</p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800">
            <button
              onClick={() => setRiskFilter('ALL')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                riskFilter === 'ALL'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({stockRiskData?.summary?.totalProducts || 0})
            </button>
            <button
              onClick={() => setRiskFilter('OUT_OF_STOCK')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                riskFilter === 'OUT_OF_STOCK'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-rose-400/80 hover:text-rose-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Out of Stock ({stockRiskData?.summary?.outOfStockCount || 0})
            </button>
            <button
              onClick={() => setRiskFilter('LOW_STOCK')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                riskFilter === 'LOW_STOCK'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Low Stock ({stockRiskData?.summary?.lowStockCount || 0})
            </button>
            <button
              onClick={() => setRiskFilter('HEALTHY')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                riskFilter === 'HEALTHY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-emerald-400/80 hover:text-emerald-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Healthy ({stockRiskData?.summary?.healthyCount || 0})
            </button>
          </div>
        </div>

        {/* 3 Summary Cards (Clickable) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => setRiskFilter('OUT_OF_STOCK')}
            className={`glass-card p-5 border cursor-pointer transition-all ${
              riskFilter === 'OUT_OF_STOCK'
                ? 'border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/30'
                : 'border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-rose-400 uppercase font-semibold">Out of Stock</p>
                <h4 className="text-3xl font-extrabold text-white mt-1">{stockRiskData?.summary?.outOfStockCount || 0}</h4>
                <p className="text-xs text-rose-400/80 mt-1">Requires immediate reorder</p>
              </div>
              <XCircle className="w-8 h-8 text-rose-400" />
            </div>
          </div>

          <div
            onClick={() => setRiskFilter('LOW_STOCK')}
            className={`glass-card p-5 border cursor-pointer transition-all ${
              riskFilter === 'LOW_STOCK'
                ? 'border-amber-500 bg-amber-950/30 ring-2 ring-amber-500/30'
                : 'border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-400 uppercase font-semibold">Low Stock (≤10 units)</p>
                <h4 className="text-3xl font-extrabold text-white mt-1">{stockRiskData?.summary?.lowStockCount || 0}</h4>
                <p className="text-xs text-amber-400/80 mt-1">Approaching stockout threshold</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div
            onClick={() => setRiskFilter('HEALTHY')}
            className={`glass-card p-5 border cursor-pointer transition-all ${
              riskFilter === 'HEALTHY'
                ? 'border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500/30'
                : 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 uppercase font-semibold">Healthy Stock (&gt;10 units)</p>
                <h4 className="text-3xl font-extrabold text-white mt-1">{stockRiskData?.summary?.healthyCount || 0}</h4>
                <p className="text-xs text-emerald-400/80 mt-1">Adequate inventory buffer</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Detailed Product Risk Table */}
        <div className="glass-card overflow-hidden">
          <div className="p-3.5 bg-slate-800/60 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                {riskFilter === 'ALL' && 'All Catalog Inventory'}
                {riskFilter === 'OUT_OF_STOCK' && 'Out of Stock Products (Immediate Reorder Required)'}
                {riskFilter === 'LOW_STOCK' && 'Low Stock Products (Low Inventory Warning)'}
                {riskFilter === 'HEALTHY' && 'Healthy Inventory Stock Buffer'}
              </h4>
            </div>
            <input
              type="text"
              placeholder="Search products in this list..."
              value={riskSearch}
              onChange={(e) => setRiskSearch(e.target.value)}
              className="input text-xs py-1 px-3 h-8 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider border-b border-slate-700/50 sticky top-0">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU / Code</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Unit Rate</th>
                  <th className="p-3 text-right">Stock on Hand</th>
                  <th className="p-3 text-center">Status / Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {displayedRiskItems.map((item, idx) => (
                  <tr key={item.productId || idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">{item.productName}</td>
                    <td className="p-3 text-slate-400 font-mono">{item.sku || '—'}</td>
                    <td className="p-3 text-slate-400">{item.category || 'General'}</td>
                    <td className="p-3 text-right text-slate-300 font-medium">{formatCurrency(item.rate || 0)}</td>
                    <td className="p-3 text-right font-bold text-sm">
                      <span className={
                        item.currentStockQty <= 0
                          ? 'text-rose-400'
                          : item.currentStockQty <= 10
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }>
                        {item.currentStockQty.toLocaleString()} units
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {item.currentStockQty <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <XCircle className="w-3 h-3" />
                          Out of Stock — Reorder
                        </span>
                      ) : item.currentStockQty <= 10 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock — Approaching Limit
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          Healthy Stock Buffer
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
      </div>

      {/* ─── SECTION 4: SUPPLIER PROCUREMENT ACTIVITY ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Supplier Procurement Activity</h3>
            <p className="text-xs text-slate-400">Vendor purchase frequency, physical quantity volume, and spend distribution</p>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-800/70 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
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
              <tbody className="divide-y divide-slate-700/40">
                {procurementData?.suppliers?.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div className="font-semibold text-white">{s.supplierName}</div>
                      {s.supplierGstin && <div className="text-[11px] text-slate-500 font-mono">GST: {s.supplierGstin}</div>}
                    </td>
                    <td className="p-3 text-right text-slate-300 font-medium">{s.orderCount}</td>
                    <td className="p-3 text-right text-slate-300">{s.baseQuantity.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-400/80 font-medium">{s.freeQuantity.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-blue-300">{s.receivedQuantity.toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(s.totalAmount)}</td>
                    <td className="p-3 text-right text-xs text-slate-400">
                      {s.lastPurchaseDate ? new Date(s.lastPurchaseDate).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
                {(!procurementData?.suppliers || procurementData.suppliers.length === 0) && (
                  <tr><td colSpan="7" className="p-8 text-center text-slate-500">No completed supplier purchase records in period</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
