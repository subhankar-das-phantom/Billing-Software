import React from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Package, 
  ShoppingCart, 
  CheckCircle2, 
  ArrowRight, 
  TrendingUp
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Progress } from '../ui/progress';

export const DashboardAlertsAndTopProducts = ({ 
  lowStock = [], 
  topProducts = [] 
}) => {
  return (
    <div className="space-y-4">
      {/* 1. Low Stock Alerts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white">Low Stock Alerts</h2>
            </div>
          </div>

          <Link
            to="/products"
            className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group"
          >
            <span>Products</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="p-4">
          {lowStock.length === 0 ? (
            <div className="py-6 text-center text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <p className="font-medium text-slate-300">Stock levels healthy</p>
              <p className="text-slate-500 mt-0.5">No products below safety threshold.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {lowStock.slice(0, 3).map((product) => {
                const stockQty = product.effectiveStockQty ?? product.currentStockQty ?? 0;
                const isCritical = stockQty <= 3;

                return (
                  <div
                    key={product._id}
                    className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <p className="font-medium text-xs text-white truncate">
                        {product.productName}
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                          isCritical ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        }`}>
                          {stockQty} {product.unit || 'units'}
                        </span>

                        <Link
                          to="/purchases/new"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-medium transition-colors"
                        >
                          Reorder
                        </Link>
                      </div>
                    </div>

                    <Progress
                      value={stockQty}
                      max={15}
                      className="h-1 bg-slate-800"
                      indicatorClassName={isCritical ? 'bg-rose-500' : 'bg-amber-500'}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Selling Products */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-semibold text-white">Top Moving Products</h2>
            </div>
          </div>

          <Link
            to="/reports"
            className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors group"
          >
            <span>Reports</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="p-4">
          {topProducts.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              <Package className="w-6 h-6 mx-auto text-slate-600 mb-1" />
              <p>Top sales insights will populate here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topProducts.slice(0, 3).map((product, idx) => (
                <div
                  key={product.productId || product._id || idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded bg-slate-800 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-xs text-white truncate">
                        {product.productName || product.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {product.totalQuantity || product.quantity || 0} units
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-semibold text-xs text-emerald-400 font-mono">
                      {formatCurrency(product.totalRevenue || product.revenue || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardAlertsAndTopProducts;
