import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileBarChart, 
  TrendingUp, 
  Sparkles, 
  Lock, 
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
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Feature } from '../../saas/features';

export default function ReportsPage({ defaultTab }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { canAccess } = useSubscription();

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

  // If reports feature is completely blocked for Starter
  if (canAccess && !canAccess(Feature.REPORTS) && !canAccess(Feature.ADVANCED_REPORTING) && !canAccess(Feature.PURCHASE_REPORTS)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center h-full">
        <div className="glass-card p-8 max-w-md w-full border-slate-800 bg-slate-900/80 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Business Reports Hub</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            Sales analytics, purchase reporting, and inventory intelligence are available on Business and Professional plans.
          </p>
          <button
            onClick={() => navigate('/subscription')}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Contact us to upgrade this plan.
          </button>
        </div>
      </div>
    );
  }

  const hasPurchaseReports = canAccess ? canAccess(Feature.PURCHASE_REPORTS) : true;
  const hasInventoryIntelligence = canAccess ? canAccess(Feature.INVENTORY_INTELLIGENCE) : true;
  const hasGstReports = canAccess ? canAccess(Feature.GST_REPORTS) : true;

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
          {!hasPurchaseReports && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              <Lock className="w-2.5 h-2.5" /> BIZ
            </span>
          )}
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
          {!hasInventoryIntelligence && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              <Lock className="w-2.5 h-2.5" /> PRO
            </span>
          )}
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
          {!hasGstReports && (
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
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
            {!hasPurchaseReports ? (
              <div className="glass-card p-6 lg:p-8 border border-slate-800 bg-slate-900/70 max-w-3xl mx-auto rounded-2xl">
                <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">Purchase Reports & Analytics</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Business Plan
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Supplier procurement performance, order volume breakdowns, and spending analytics</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6">
                  <span className="text-xs text-slate-400">
                    Purchase analytics and supplier reports are available on Business and Professional plans.
                  </span>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    Contact us to upgrade this plan.
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <PurchaseReportsPage />
            )}
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
            {!hasInventoryIntelligence ? (
              <div className="glass-card p-6 lg:p-8 border border-slate-800 bg-slate-900/70 max-w-3xl mx-auto rounded-2xl">
                <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">Inventory Intelligence Engine</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Professional Plan
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Advanced operational telemetry and predictive stock intelligence</p>
                    </div>
                  </div>
                </div>

                {/* 3 Clean Feature Capabilities */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 my-6">
                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-semibold">Expiry Horizon</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      6-tier expiration horizon analysis and critical 30-day stockout alerts.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-xs font-semibold">Sales Velocity</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Quartile ranking of fast-moving vs stagnant items with turnover metrics.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                      <Truck className="w-4 h-4" />
                      <span className="text-xs font-semibold">Procurement Activity</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Supplier fulfillment frequency, base vs free unit audits, and spend history.
                    </p>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-400">
                    Deep analytics across your entire catalog.
                  </span>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    Contact us to upgrade this plan.
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <InventoryIntelligenceSection />
            )}
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
            {!hasGstReports ? (
              <div className="glass-card p-6 lg:p-8 border border-slate-800 bg-slate-900/70 max-w-3xl mx-auto rounded-2xl">
                <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <FileBarChart className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">GST Compliance Reporting</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Professional Plan
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Itemized tax breakdowns, GSTR slab distributions, and tax compliance summaries</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6">
                  <span className="text-xs text-slate-400">
                    Tax compliance reports are available on the Professional tier.
                  </span>
                  <button
                    onClick={() => navigate('/subscription')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    Contact us to upgrade this plan.
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
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
