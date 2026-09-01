import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBarChart, TrendingUp, Sparkles, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GstReportPage from './GstReportPage';
import { SalesAnalyticsSection } from '../../features/salesAnalytics/components/SalesAnalyticsSection';
import { InventoryIntelligenceSection } from '../../features/inventoryAnalytics/components/InventoryIntelligenceSection';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Feature } from '../../saas/features';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales-analytics');
  const { canAccess } = useSubscription();
  const navigate = useNavigate();

  // If reports feature is completely blocked for Starter
  if (canAccess && !canAccess(Feature.REPORTS) && !canAccess(Feature.ADVANCED_REPORTING) && !canAccess(Feature.PURCHASE_REPORTS)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center h-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-10 max-w-md w-full border-accent-500/30 shadow-2xl shadow-accent-500/10"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6 border border-accent-500/30">
            <Lock className="w-8 h-8 text-accent-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Reports & Analytics</h2>
          <p className="text-slate-400 mb-8">
            Advanced sales analytics, inventory intelligence, and tax reports are available on Business and Professional plans.
          </p>
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-accent-600 hover:from-blue-500 hover:to-accent-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95"
          >
            Upgrade Plan
          </button>
        </motion.div>
      </div>
    );
  }

  const hasInventoryIntelligence = canAccess ? canAccess(Feature.INVENTORY_INTELLIGENCE) : true;
  const hasGstReports = canAccess ? canAccess(Feature.GST_REPORTS) : true;

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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">Reports & Intelligence Hub</h1>
          <p className="text-xs sm:text-sm text-slate-400">Comprehensive business performance, inventory intelligence, and tax compliance</p>
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
          onClick={() => setActiveTab('inventory-intelligence')}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'inventory-intelligence'
              ? 'bg-gradient-to-r from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          Inventory Intelligence
          {!hasInventoryIntelligence && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold ml-1">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
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
          {!hasGstReports && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold ml-1">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
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
        {activeTab === 'inventory-intelligence' && (
          <motion.div
            key="inventory-intelligence"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {!hasInventoryIntelligence ? (
              <div className="glass-card p-12 text-center max-w-lg mx-auto border-amber-500/20">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                  <Sparkles className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Inventory Intelligence Engine</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Batch expiry horizons, deterministic sales velocity, and supplier procurement analytics are available exclusively on the <strong>Professional Plan</strong>.
                </p>
                <button
                  onClick={() => navigate('/subscription')}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all"
                >
                  Upgrade to Professional
                </button>
              </div>
            ) : (
              <InventoryIntelligenceSection />
            )}
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
            {!hasGstReports ? (
              <div className="glass-card p-12 text-center max-w-lg mx-auto border-amber-500/20">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                  <FileBarChart className="w-7 h-7 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">GST Compliance Reports</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Itemized tax breakdowns, GSTR slab distributions, and tax compliance summaries are available on the <strong>Professional Plan</strong>.
                </p>
                <button
                  onClick={() => navigate('/subscription')}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg transition-all"
                >
                  Upgrade to Professional
                </button>
              </div>
            ) : (
              <GstReportPage />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
