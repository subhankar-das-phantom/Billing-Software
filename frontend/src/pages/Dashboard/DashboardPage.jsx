import React, { useState, useMemo } from 'react';
import { dashboardService } from '../../services/dashboard/dashboardService';
import { salesAnalyticsApi } from '../../features/salesAnalytics/api/salesAnalyticsApi';
import creditService from '../../services/credits/creditService';
import { useSWR } from '../../hooks';
import { DashboardPageSkeleton } from './DashboardPageSkeleton';

// Subcomponents
import { DashboardHero } from '../../components/Dashboard/DashboardHero';
import { DashboardKPIGrid } from '../../components/Dashboard/DashboardKPIGrid';
import { DashboardChartsSection } from '../../components/Dashboard/DashboardChartsSection';
import { DashboardActivityHub } from '../../components/Dashboard/DashboardActivityHub';
import { DashboardAlertsAndTopProducts } from '../../components/Dashboard/DashboardAlertsAndTopProducts';
import { DashboardQuickActions } from '../../components/Dashboard/DashboardQuickActions';

export default function DashboardPage() {
  // Global time horizon: 'today' | '7d' | '30d' | 'month' | 'year'
  const [timeRange, setTimeRange] = useState('30d');

  // Convert UI timeRange to backend period param
  const periodParam = useMemo(() => {
    switch (timeRange) {
      case 'today': return 'today';
      case '7d': return 'last7days';
      case '30d': return 'last30days';
      case 'month': return 'thisMonth';
      case 'year': return 'thisYear';
      default: return 'last30days';
    }
  }, [timeRange]);

  // 1. Primary Dashboard Stats
  const { 
    data: statsData, 
    isLoading: statsLoading, 
    isValidating: statsValidating 
  } = useSWR(
    'dashboard-stats',
    () => dashboardService.getStats(),
    { ttl: 2 * 60 * 1000 }
  );

  // 2. Low Stock Alerts
  const { 
    data: lowStockData, 
    isLoading: lowStockLoading, 
    isValidating: lowStockValidating 
  } = useSWR(
    'dashboard-low-stock',
    () => dashboardService.getLowStock(10),
    { ttl: 5 * 60 * 1000 }
  );

  // 3. Sales & Collections Daily Analytics
  const { 
    data: dailySalesData, 
    isValidating: dailyValidating 
  } = useSWR(
    `dashboard-daily-sales-${periodParam}`,
    () => salesAnalyticsApi.getDailySales({ period: periodParam }),
    { ttl: 2 * 60 * 1000 }
  );

  // 4. Monthly Trend Analytics
  const { 
    data: monthlySalesData, 
    isValidating: monthlyValidating 
  } = useSWR(
    'dashboard-monthly-sales',
    () => salesAnalyticsApi.getMonthlySales({ year: new Date().getFullYear() }),
    { ttl: 5 * 60 * 1000 }
  );

  // 5. High-Level Sales Overview
  const { 
    data: overviewDataResponse, 
    isValidating: overviewValidating 
  } = useSWR(
    `dashboard-sales-overview-${periodParam}`,
    () => salesAnalyticsApi.getOverview({ period: periodParam }),
    { ttl: 2 * 60 * 1000 }
  );

  // 6. Top Selling Products
  const { 
    data: topProductsResponse, 
    isValidating: topProductsValidating 
  } = useSWR(
    `dashboard-top-products-${periodParam}`,
    () => salesAnalyticsApi.getTopProducts({ period: periodParam, limit: 5 }),
    { ttl: 5 * 60 * 1000 }
  );

  // 7. Credit & Receivables Summary
  const { 
    data: creditStatsData, 
    isValidating: creditValidating 
  } = useSWR(
    'dashboard-credit-stats',
    () => creditService.getCreditStats(),
    { ttl: 2 * 60 * 1000 }
  );

  // 8. Recent Payments
  const { 
    data: recentPaymentsData, 
    isValidating: paymentsValidating 
  } = useSWR(
    'dashboard-recent-payments',
    () => creditService.getRecentPayments(6),
    { ttl: 2 * 60 * 1000 }
  );

  // Extract structured datasets
  const stats = statsData?.stats || null;
  const recentInvoices = statsData?.recentInvoices || [];
  const lowStock = lowStockData?.products || [];
  const dailySales = dailySalesData?.data || [];
  const monthlySales = monthlySalesData?.data || [];
  const overviewData = overviewDataResponse?.data || null;
  const topProducts = topProductsResponse?.data || [];
  const creditStats = creditStatsData?.stats || null;
  const recentPayments = recentPaymentsData?.payments || [];

  const isValidating = statsValidating || lowStockValidating || dailyValidating || monthlyValidating || overviewValidating || topProductsValidating || creditValidating || paymentsValidating;
  const initialLoading = (statsLoading || lowStockLoading) && !stats;

  if (initialLoading) {
    return <DashboardPageSkeleton />;
  }

  return (
    <div className="space-y-4 pb-10">
      {/* 1. Clean Header */}
      <DashboardHero
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        isValidating={isValidating}
      />

      {/* 2. Executive KPI Grid */}
      <DashboardKPIGrid
        stats={stats}
        creditStats={creditStats}
        overviewData={overviewData}
      />

      {/* 3. Performance Trend & Cash Flow Breakdown */}
      <DashboardChartsSection
        dailySales={dailySales}
        monthlySales={monthlySales}
        overviewData={overviewData}
        creditStats={creditStats}
      />

      {/* 4. Feeds & Operations Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Multi-Tab Activity Hub (2 cols) */}
        <div className="lg:col-span-2">
          <DashboardActivityHub
            recentInvoices={recentInvoices}
            recentPayments={recentPayments}
          />
        </div>

        {/* Stock Alerts & Top Movers (1 col) */}
        <div>
          <DashboardAlertsAndTopProducts
            lowStock={lowStock}
            topProducts={topProducts}
          />
        </div>
      </div>

      {/* 5. Quick Actions Dock */}
      <DashboardQuickActions />
    </div>
  );
}
