import React from 'react';
import { Link } from 'react-router-dom';
import { 
  IndianRupee, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Package, 
  Receipt,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

export const DashboardKPIGrid = ({ 
  stats, 
  creditStats,
  overviewData 
}) => {
  const todayGrowth = stats?.growth?.todaySales;
  const monthGrowth = stats?.growth?.monthSales;
  const collectionsGrowth = overviewData?.growth?.collections;

  const totalOutstanding = creditStats?.totalOutstanding ?? overviewData?.totalOutstanding ?? 0;
  const overdueAmount = creditStats?.overdueAmount ?? 0;
  const lowStockCount = stats?.lowStockCount ?? 0;
  const todayInvoices = stats?.todayInvoices ?? 0;

  const kpis = [
    {
      id: 'today-sales',
      label: "Today's Sales",
      value: stats?.todaySales ?? 0,
      isCurrency: true,
      icon: IndianRupee,
      iconColor: 'text-blue-400',
      badgeText: `${todayInvoices} bills`,
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      growth: todayGrowth,
      growthLabel: 'vs yesterday'
    },
    {
      id: 'month-sales',
      label: 'Monthly Revenue',
      value: stats?.monthSales ?? 0,
      isCurrency: true,
      icon: Calendar,
      iconColor: 'text-violet-400',
      badgeText: 'MTD Invoiced',
      badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
      growth: monthGrowth,
      growthLabel: 'vs last mo'
    },
    {
      id: 'collections',
      label: 'Cash Collections',
      value: creditStats?.paymentsThisMonth ?? overviewData?.totalCollections ?? 0,
      isCurrency: true,
      icon: Wallet,
      iconColor: 'text-emerald-400',
      badgeText: `${creditStats?.paymentsThisMonthCount ?? 0} receipts`,
      badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      growth: collectionsGrowth,
      growthLabel: 'vs prior period',
      linkTo: '/collections'
    },
    {
      id: 'outstanding',
      label: 'Receivables & Dues',
      value: totalOutstanding,
      isCurrency: true,
      icon: Receipt,
      iconColor: 'text-amber-400',
      badgeText: overdueAmount > 0 ? `₹${Math.round(overdueAmount).toLocaleString('en-IN')} Overdue` : 'Settled',
      badgeColor: overdueAmount > 0 ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      linkTo: '/credits'
    },
    {
      id: 'inventory-health',
      label: 'Active Catalog',
      value: stats?.totalProducts ?? 0,
      isCurrency: false,
      icon: Package,
      iconColor: 'text-teal-400',
      badgeText: lowStockCount > 0 ? `${lowStockCount} low stock` : 'Healthy',
      badgeColor: lowStockCount > 0 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      linkTo: '/products'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const hasGrowth = kpi.growth !== undefined && kpi.growth !== null;
        const isPositive = (kpi.growth || 0) >= 0;
        const GrowthIcon = isPositive ? TrendingUp : TrendingDown;
        const growthColor = isPositive ? 'text-emerald-400' : 'text-rose-400';

        const CardWrapper = kpi.linkTo ? Link : 'div';
        const cardProps = kpi.linkTo ? { to: kpi.linkTo } : {};

        return (
          <CardWrapper
            key={kpi.id}
            {...cardProps}
            className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 transition-colors block relative"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-medium text-slate-400">
                {kpi.label}
              </span>
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-slate-200 transition-colors">
                <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>

            <div className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-2">
              {kpi.isCurrency ? '₹' : ''}
              <AnimatedCounter value={kpi.value} />
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
              {hasGrowth ? (
                <div className="flex items-center gap-1 font-medium">
                  <GrowthIcon className={`w-3 h-3 ${growthColor}`} />
                  <span className={growthColor}>
                    {isPositive ? '+' : ''}{kpi.growth}%
                  </span>
                  <span className="text-slate-500 text-[11px] hidden sm:inline truncate">
                    {kpi.growthLabel}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 text-[11px]">
                  Status
                </span>
              )}

              {kpi.badgeText && (
                <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${kpi.badgeColor}`}>
                  {kpi.badgeText}
                </span>
              )}
            </div>

            {kpi.linkTo && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </CardWrapper>
        );
      })}
    </div>
  );
};

export default DashboardKPIGrid;
