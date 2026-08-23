import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DateFilter } from './DateFilter';
import { KPICards } from './KPICards';
import { MonthlySalesTrendChart } from './charts/MonthlySalesTrendChart';
import { MonthlyRevenueChart } from './charts/MonthlyRevenueChart';
import { InvoiceCountChart } from './charts/InvoiceCountChart';
import { SalesVsCollectionsChart } from './charts/SalesVsCollectionsChart';
import { TopProductsChart } from './charts/TopProductsChart';
import { TopCustomersChart } from './charts/TopCustomersChart';
import { PaymentDistributionChart } from './charts/PaymentDistributionChart';
import { QuarterlyRevenueChart } from './charts/QuarterlyRevenueChart';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 }
  }
};

export const SalesAnalyticsSection = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filterParams = {
    period: searchParams.get('period') || 'last30days',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  };

  const setFilterParams = (newParams) => {
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (newParams.period) newSearchParams.set('period', newParams.period);
    else newSearchParams.delete('period');

    if (newParams.startDate) newSearchParams.set('startDate', newParams.startDate);
    else newSearchParams.delete('startDate');

    if (newParams.endDate) newSearchParams.set('endDate', newParams.endDate);
    else newSearchParams.delete('endDate');

    // Use replace: true so we don't spam the browser history on every click
    setSearchParams(newSearchParams, { replace: true });
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 sm:space-y-8 pb-10"
    >
      {/* Filters */}
      <motion.div variants={itemVariants} className="flex justify-end">
        <DateFilter filterParams={filterParams} onFilterChange={setFilterParams} />
      </motion.div>

      {/* KPI Cards */}
      <motion.div variants={itemVariants}>
        <KPICards filterParams={filterParams} />
      </motion.div>

      {/* Main Trends Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlySalesTrendChart filterParams={filterParams} />
        <MonthlyRevenueChart />
      </motion.div>

      {/* Secondary Trends Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <InvoiceCountChart filterParams={filterParams} />
        <SalesVsCollectionsChart filterParams={filterParams} />
      </motion.div>

      {/* Top Performers Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopProductsChart filterParams={filterParams} />
        <TopCustomersChart filterParams={filterParams} />
      </motion.div>

      {/* Distributions Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PaymentDistributionChart filterParams={filterParams} />
        <QuarterlyRevenueChart />
      </motion.div>
      
    </motion.div>
  );
};
