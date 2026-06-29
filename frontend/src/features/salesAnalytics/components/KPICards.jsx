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
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/20 text-blue-400',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/20 text-amber-400',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/20 text-purple-400',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/20 text-rose-400',
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20 text-indigo-400',
  };

  const colorClasses = colors[color] || colors.blue;
  const [bgGradient, shadow, textColor] = colorClasses.split(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5 relative overflow-hidden group"
    >
      <motion.div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${bgGradient} ${shadow} shadow-lg`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>

        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-lg font-medium text-slate-400">{prefix}</span>}
          <div className="text-2xl font-bold text-white tracking-tight">
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
