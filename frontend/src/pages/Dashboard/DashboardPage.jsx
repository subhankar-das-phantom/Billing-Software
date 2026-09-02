import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardService } from '../../services/dashboard/dashboardService';
import { salesAnalyticsApi } from '../../features/salesAnalytics/api/salesAnalyticsApi';
import creditService from '../../services/credits/creditService';
import { useSWR } from '../../hooks';
import { DashboardPageSkeleton } from './DashboardPageSkeleton';

// Subcomponents
import { EmployeeDashboard } from '../../components/Dashboard/EmployeeDashboard';
import { DashboardHero } from '../../components/Dashboard/DashboardHero';
import { DashboardKPIGrid } from '../../components/Dashboard/DashboardKPIGrid';
import { DashboardChartsSection } from '../../components/Dashboard/DashboardChartsSection';
import { DashboardActivityHub } from '../../components/Dashboard/DashboardActivityHub';
import { DashboardAlertsAndTopProducts } from '../../components/Dashboard/DashboardAlertsAndTopProducts';
import { DashboardQuickActions } from '../../components/Dashboard/DashboardQuickActions';

export default function DashboardPage() {
  const { userRole, hasPermission } = useAuth();
  const isAdmin = userRole === 'admin';
  const isEmployee = userRole === 'employee';

  const canViewInventory = isAdmin || hasPermission('inventory', 'view') || hasPermission('ledger', 'view');

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

  // 1. Primary Dashboard Stats (safe for both: returns executive stats for admin, employeeStats for employee)
  const { 
    data: statsData, 
    isLoading: statsLoading, 
    isValidating: statsValidating 
  } = useSWR(
    'dashboard-stats',
    () => dashboardService.getStats(),
    { ttl: 2 * 60 * 1000 }
  );

  // 2. Low Stock Alerts (fetched if admin or permitted employee)
  const { 
    data: lowStockData, 
    isLoading: lowStockLoading, 
    isValidating: lowStockValidating 
  } = useSWR(
    canViewInventory ? 'dashboard-low-stock' : null,
    () => dashboardService.getLowStock(10),
    { ttl: 5 * 60 * 1000 }
  );

  // 3. Sales & Collections Daily Analytics (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: dailySalesData, 
    isValidating: dailyValidating 
  } = useSWR(
    isAdmin ? `dashboard-daily-sales-${periodParam}` : null,
    () => salesAnalyticsApi.getDailySales({ period: periodParam }),
    { ttl: 2 * 60 * 1000 }
  );

  // 4. Monthly Trend Analytics (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: monthlySalesData, 
    isValidating: monthlyValidating 
  } = useSWR(
    isAdmin ? 'dashboard-monthly-sales' : null,
    () => salesAnalyticsApi.getMonthlySales({ year: new Date().getFullYear() }),
    { ttl: 5 * 60 * 1000 }
  );

  // 5. High-Level Sales Overview (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: overviewDataResponse, 
    isValidating: overviewValidating 
  } = useSWR(
    isAdmin ? `dashboard-sales-overview-${periodParam}` : null,
    () => salesAnalyticsApi.getOverview({ period: periodParam }),
    { ttl: 2 * 60 * 1000 }
  );

  // 6. Top Selling Products (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: topProductsResponse, 
    isValidating: topProductsValidating 
  } = useSWR(
    isAdmin ? `dashboard-top-products-${periodParam}` : null,
    () => salesAnalyticsApi.getTopProducts({ period: periodParam, limit: 5 }),
    { ttl: 5 * 60 * 1000 }
  );

  // 7. Credit & Receivables Summary (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: creditStatsData, 
    isValidating: creditValidating 
  } = useSWR(
    isAdmin ? 'dashboard-credit-stats' : null,
    () => creditService.getCreditStats(),
    { ttl: 2 * 60 * 1000 }
  );

  // 8. Recent Payments (ADMIN ONLY - conditional null key avoids 403)
  const { 
    data: recentPaymentsData, 
    isValidating: paymentsValidating 
  } = useSWR(
    isAdmin ? 'dashboard-recent-payments' : null,
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
  
  const initialLoading = isEmployee
    ? statsLoading && !statsData
    : (statsLoading || lowStockLoading) && !stats;

  if (initialLoading) {
    return <DashboardPageSkeleton />;
  }

  // Employee Operational Dashboard (dedicated layout, no executive widgets mounted)
  if (isEmployee) {
    return (
      <EmployeeDashboard
        statsData={statsData}
        lowStockData={lowStockData}
        isValidating={statsValidating || lowStockValidating}
      />
    );
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
