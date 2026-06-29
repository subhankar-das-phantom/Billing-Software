import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { usePaymentTrendsQuery } from '../../queries/usePaymentTrendsQuery';
import { formatCurrency } from '../../../../utils/formatters';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card p-3" style={{ borderColor: `${data.fill}40`, borderWidth: '1px' }}>
        <p className="text-sm text-slate-300 mb-1">{data.method}</p>
        <p className="font-bold text-base" style={{ color: data.fill }}>
          {formatCurrency(data.amount)}
        </p>
      </div>
    );
  }
  return null;
};

export const PaymentDistributionChart = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = usePaymentTrendsQuery(filterParams);
  
  const chartData = data?.data || [];
  const isEmpty = chartData.length === 0;

  return (
    <ChartWrapper
      title="Payment Distribution"
      subtitle="Revenue by payment method"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="amount"
            nameKey="method"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
