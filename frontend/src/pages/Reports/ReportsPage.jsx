import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBarChart, TrendingUp } from 'lucide-react';
import GstReportPage from './GstReportPage';
import PurchaseReportsPage from './PurchaseReportsPage';
import InventoryMovementReportPage from './InventoryMovementReportPage';
import { SalesAnalyticsSection } from '../../features/salesAnalytics/components/SalesAnalyticsSection';
import { ShoppingCart, ArrowRightLeft } from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales-analytics');

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ─── HEADER ─── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 sm:p-8 bg-gradient-to-br from-blue-600/10 via-accent-500/10 to-transparent border-blue-500/20 relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-accent-500/5 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">Reports Hub</h1>
          <p className="text-xs sm:text-sm text-slate-400">Comprehensive business insights and reporting</p>
        </div>
      </motion.div>

      {/* ─── TABS ─── */}
      <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
        <button
          onClick={() => setActiveTab('sales-analytics')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'sales-analytics'
              ? 'bg-gradient-to-r from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Sales Analytics
        </button>
        <button
          onClick={() => setActiveTab('gst-report')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'gst-report'
              ? 'bg-gradient-to-r from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <FileBarChart className="w-4 h-4" />
          GST Report
        </button>
        <button
          onClick={() => setActiveTab('purchases')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'purchases'
              ? 'bg-gradient-to-r from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Purchase Reports
        </button>
        <button
          onClick={() => setActiveTab('inventory-flow')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'inventory-flow'
              ? 'bg-gradient-to-r from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Inventory Flow
        </button>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'sales-analytics' && (
          <motion.div
            key="sales-analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <SalesAnalyticsSection />
          </motion.div>
        )}
        {activeTab === 'gst-report' && (
          <motion.div
            key="gst-report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <GstReportPage />
          </motion.div>
        )}
        {activeTab === 'purchases' && (
          <motion.div
            key="purchases"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <PurchaseReportsPage />
          </motion.div>
        )}
        {activeTab === 'inventory-flow' && (
          <motion.div
            key="inventory-flow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <InventoryMovementReportPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
