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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
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
            className="group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 sm:p-4 transition-colors block relative overflow-hidden min-w-0"
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <span className="text-xs font-medium text-slate-400 truncate">
                {kpi.label}
              </span>
              <div className="p-2 rounded-lg bg-slate-800 text-slate-400 group-hover:text-slate-200 transition-colors shrink-0">
                <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>

            <div className="text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-100 tracking-tight mt-1.5 font-mono truncate" title={kpi.isCurrency ? `₹${kpi.value}` : String(kpi.value)}>
              {kpi.isCurrency ? '₹' : ''}
              <AnimatedCounter value={kpi.value} decimals={kpi.isCurrency ? 2 : 0} />
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 text-xs min-w-0">
              {hasGrowth ? (
                <div className="flex items-center gap-1 font-medium min-w-0 flex-1">
                  <GrowthIcon className={`w-3.5 h-3.5 ${growthColor} shrink-0`} />
                  <span className={`${growthColor} font-semibold shrink-0`}>
                    {isPositive ? '+' : ''}{kpi.growth}%
                  </span>
                  <span className="text-slate-500 text-[11px] truncate max-w-[80px] 2xl:max-w-[95px]" title={kpi.growthLabel}>
                    {kpi.growthLabel}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500 text-[11px] shrink-0">
                  Status
                </span>
              )}

              {kpi.badgeText && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] 2xl:text-[11px] font-medium border truncate max-w-[110px] 2xl:max-w-none shrink-0 ${kpi.badgeColor}`} title={kpi.badgeText}>
                  {kpi.badgeText}
                </span>
              )}
            </div>

            {kpi.linkTo && (
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </CardWrapper>
        );
      })}
    </div>
  );
};

export default DashboardKPIGrid;
