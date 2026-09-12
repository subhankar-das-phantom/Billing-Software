import React from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, FileText, Activity, TrendingUp, TrendingDown, RefreshCw, Layers } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { AnimatedCounter } from '../../../components/Dashboard/AnimatedCounter';
import { KPICardSkeleton } from './SkeletonCards';
import { useOverviewQuery } from '../queries/useOverviewQuery';

const GrowthBadge = ({ value, label }) => {
  if (value === null || value === undefined) return null;
  
  const isPositive = value >= 0;
  return (
    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${
      isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
    }`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(value)}% {label}
    </div>
  );
};

const KPICard = ({ title, value, prefix = '', suffix = '', icon: Icon, color, growth, growthLabel }) => {
  const colors = {
    blue: 'bg-blue-500/10 dark:bg-blue-500/15 border-blue-500/20 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/20 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-500/10 dark:bg-purple-500/15 border-purple-500/20 dark:border-purple-500/30 text-purple-600 dark:text-purple-400',
    rose: 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/20 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
    indigo: 'bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
  };

  const badgeStyle = colors[color] || colors.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5 relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <div className={`p-2 rounded-lg border ${badgeStyle}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-lg font-medium text-slate-400">{prefix}</span>}
          <div className="text-2xl font-bold text-slate-100 tracking-tight">
            <AnimatedCounter value={value} />
          </div>
          {suffix && <span className="text-sm font-medium text-slate-400">{suffix}</span>}
        </div>

        {growth !== undefined && (
          <div className="mt-3">
            <GrowthBadge value={growth} label={growthLabel} />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const KPICards = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = useOverviewQuery(filterParams);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => <KPICardSkeleton key={i} />)}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card p-6 border-red-500/20 flex flex-col items-center justify-center text-center col-span-full py-12">
        <Activity className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-red-300 font-medium mb-3">Failed to load overview metrics</p>
        <button onClick={() => refetch()} className="btn btn-secondary flex items-center gap-2 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const stats = data?.data || {
    totalRevenue: 0, totalInvoices: 0, avgInvoiceValue: 0,
    totalCollections: 0, totalOutstanding: 0, totalCreditNotes: 0,
    growth: {}
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <KPICard
        title="Total Revenue"
        value={stats.totalRevenue}
        prefix="₹"
        icon={IndianRupee}
        color="emerald"
        growth={stats.growth?.revenue}
        growthLabel="vs prev. period"
      />
      <KPICard
        title="Total Collections"
        value={stats.totalCollections}
        prefix="₹"
        icon={Layers}
        color="blue"
        growth={stats.growth?.collections}
        growthLabel="vs prev. period"
      />
      <KPICard
        title="Avg Invoice Value"
        value={stats.avgInvoiceValue}
        prefix="₹"
        icon={Activity}
        color="indigo"
      />
      <KPICard
        title="Total Invoices"
        value={stats.totalInvoices}
        icon={FileText}
        color="purple"
        growth={stats.growth?.invoices}
        growthLabel="vs prev. period"
      />
      <KPICard
        title="Total Outstanding"
        value={stats.totalOutstanding}
        prefix="₹"
        icon={TrendingDown}
        color="amber"
      />
      <KPICard
        title="Credit Notes"
        value={stats.totalCreditNotes}
        prefix="₹"
        icon={RefreshCw}
        color="rose"
      />
    </div>
  );
};
