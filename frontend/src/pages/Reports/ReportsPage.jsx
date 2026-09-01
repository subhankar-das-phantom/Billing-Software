import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileBarChart, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  ShieldAlert, 
  Truck, 
  CheckCircle2, 
  ArrowRight,
  BarChart3,
  ShoppingCart
} from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import GstReportPage from './GstReportPage';
import PurchaseReportsPage from './PurchaseReportsPage';
import { SalesAnalyticsSection } from '../../features/salesAnalytics/components/SalesAnalyticsSection';
import { InventoryIntelligenceSection } from '../../features/inventoryAnalytics/components/InventoryIntelligenceSection';

export default function ReportsPage({ defaultTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab from prop, URL search param (?tab=purchases), or location path
  const getInitialTab = () => {
    if (defaultTab) return defaultTab;
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    if (location.pathname.includes('/purchases')) return 'purchases';
    if (location.pathname.includes('/gst')) return 'gst-report';
    if (location.pathname.includes('/inventory')) return 'inventory-intelligence';
    return 'sales-analytics';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="glass-card p-5 border border-slate-800/80 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Reports & Intelligence Hub</h1>
            <p className="text-xs text-slate-400 mt-0.5">Comprehensive sales velocity, procurement telemetry, batch horizons, and tax compliance</p>
          </div>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
        <button
          onClick={() => handleTabChange('sales-analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'sales-analytics'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Sales Analytics
        </button>

        <button
          onClick={() => handleTabChange('purchases')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'purchases'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Purchase Reports
        </button>

        <button
          onClick={() => handleTabChange('inventory-intelligence')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'inventory-intelligence'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Inventory Intelligence
        </button>

        <button
          onClick={() => handleTabChange('gst-report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'gst-report'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileBarChart className="w-3.5 h-3.5" />
          GST Report
        </button>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <AnimatePresence mode="wait">
        {activeTab === 'sales-analytics' && (
          <motion.div
            key="sales-analytics"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <SalesAnalyticsSection />
          </motion.div>
        )}

        {activeTab === 'purchases' && (
          <motion.div
            key="purchases"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <PurchaseReportsPage />
          </motion.div>
        )}

        {activeTab === 'inventory-intelligence' && (
          <motion.div
            key="inventory-intelligence"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <InventoryIntelligenceSection />
          </motion.div>
        )}

        {activeTab === 'gst-report' && (
          <motion.div
            key="gst-report"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <GstReportPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
