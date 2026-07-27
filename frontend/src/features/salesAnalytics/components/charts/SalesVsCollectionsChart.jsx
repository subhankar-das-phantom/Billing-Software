import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useDailySalesQuery } from '../../queries/useDailySalesQuery';
import { formatCurrency } from '../../../../utils/formatters';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border-emerald-500/30">
        <p className="text-sm text-slate-300 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className={`font-bold text-base ${entry.dataKey === 'revenue' ? 'text-blue-400' : 'text-emerald-400'}`}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const SalesVsCollectionsChart = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = useDailySalesQuery(filterParams);
  
  const chartData = data?.data || [];
  
  const isEmpty = chartData.length === 0;

  return (
    <ChartWrapper
      title="Sales vs Collections"
      subtitle="Revenue billed vs payments received"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
            }}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(value) => `₹${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            type="monotone" 
            dataKey="revenue" 
            name="Sales" 
            stroke="#3b82f6" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="collections" 
            name="Collections" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
