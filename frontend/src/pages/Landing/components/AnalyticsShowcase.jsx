import React, { useState } from 'react';
import { TrendingUp, ShoppingCart } from 'lucide-react';
import ProductWindow from './ProductWindow';

export default function AnalyticsShowcase() {
  const [activeTab, setActiveTab] = useState('sales');

  return (
    <section id="analytics" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (No eyebrow kicker) */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
            Financial Telemetry and Operational Clarity
          </h2>

          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Gain immediate insight into business velocity, cash flow collection ratios, receivables aging, and procurement spend.
          </p>

          {/* Interactive Screen Switcher Pills */}
          <div className="mt-8 w-full max-w-md sm:max-w-none mx-auto sm:w-auto p-1.5 rounded-2xl sm:rounded-xl bg-slate-850 border border-slate-800 shadow-inner inline-block sm:inline-flex">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('sales')}
                className={`flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
                  activeTab === 'sales'
                    ? 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-600/25 z-10'
                    : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-slate-50 shadow-2xs'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Sales Velocity & Cash Flow</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('purchases')}
                className={`flex items-center justify-center space-x-2 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
                  activeTab === 'purchases'
                    ? 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-600/25 z-10'
                    : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-slate-50 shadow-2xs'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Procurement Telemetry</span>
              </button>
            </div>
          </div>
        </div>

        {/* Edge-to-Edge Product Window */}
        <div className="transition-all duration-300">
          {activeTab === 'sales' ? (
            <ProductWindow
              src="/landing/product/analytics.webp"
              mobileSrc="/landing/product/analytics-mobile.webp"
              mobileSmallSrc="/landing/product/analytics-sm.webp"
              alt="Bharat Enterprise sales analytics dashboard showing revenue charts, top selling products, and monthly sales trends"
              variant="edge-to-edge"
              title="Sales Velocity & Period Performance"
              status="Period Performance"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1280px"
            />
          ) : (
            <ProductWindow
              src="/landing/product/purchases.webp"
              mobileSrc="/landing/product/purchases-mobile.webp"
              mobileSmallSrc="/landing/product/purchases-sm.webp"
              alt="Bharat Enterprise purchase management view showing vendor orders, total procurement spend, and receiving status"
              variant="edge-to-edge"
              title="Procurement & Purchase Orders"
              status="Total Spend: ₹6,44,630.00"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 95vw, 1280px"
            />
          )}
        </div>

        {/* Supporting Metric Highlights below the screen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-2xs text-center transition-colors">
            <span className="text-xs text-slate-400 font-medium">Daily & Monthly Trend</span>
            <p className="text-sm font-semibold text-slate-100 mt-1">Dual Curve Comparison</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-2xs text-center transition-colors">
            <span className="text-xs text-slate-400 font-medium">Cash Flow Ratio</span>
            <p className="text-sm font-semibold text-emerald-400 mt-1">Collected vs Pending Dues</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-2xs text-center transition-colors">
            <span className="text-xs text-slate-400 font-medium">Average Invoice Value</span>
            <p className="text-sm font-semibold text-slate-100 mt-1">Track Basket Size Growth</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-2xs text-center transition-colors">
            <span className="text-xs text-slate-400 font-medium">Multi-Period Filters</span>
            <p className="text-sm font-semibold text-blue-400 mt-1">Today, 7D, 30D, Month, Year</p>
          </div>
        </div>
      </div>
    </section>
  );
}
