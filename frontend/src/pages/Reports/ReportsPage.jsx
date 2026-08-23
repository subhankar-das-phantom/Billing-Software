import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileBarChart, TrendingUp, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GstReportPage from './GstReportPage';
import { SalesAnalyticsSection } from '../../features/salesAnalytics/components/SalesAnalyticsSection';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Feature } from '../../saas/features';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('sales-analytics');
  const { canAccess } = useSubscription();
  const navigate = useNavigate();

  if (canAccess && !canAccess(Feature.REPORTS)) {
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
          <h2 className="text-2xl font-bold text-white mb-3">Premium Feature</h2>
          <p className="text-slate-400 mb-8">
            Detailed business reports and sales analytics are only available on higher plans. Upgrade to unlock powerful insights.
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
      </AnimatePresence>
    </div>
  );
}
