import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useTopCustomersQuery } from '../../queries/useTopCustomersQuery';
import { formatCurrency } from '../../../../utils/formatters';
import { useChartTheme } from '../../utils/chartTheme';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card p-3 border-indigo-500/30">
        <p className="text-sm text-slate-400 mb-1">{data.customerName}</p>
        <p className="text-indigo-400 font-bold text-base">
          {formatCurrency(data.revenue)}
        </p>
        <p className="text-xs text-slate-400 mt-1">{data.invoiceCount} invoices</p>
      </div>
    );
  }
  return null;
};

export const TopCustomersChart = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = useTopCustomersQuery(filterParams);
  const { gridStroke, axisStroke, cursorFill } = useChartTheme();
  
  const chartData = data?.data || [];
  const isEmpty = chartData.length === 0;

  return (
    <ChartWrapper
      title="Top Customers"
      subtitle="Highest revenue generating customers"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={chartData} 
          layout="vertical"
          margin={{ top: 0, right: 10, left: 20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
          <XAxis 
            type="number"
            stroke={axisStroke} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `₹${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
          />
          <YAxis 
            dataKey="customerName"
            type="category"
            stroke={axisStroke} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            width={100}
            tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: cursorFill }} />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={`hsl(220, 90%, ${65 - index * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
