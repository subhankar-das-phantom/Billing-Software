import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useDailySalesQuery } from '../../queries/useDailySalesQuery';
import { formatCurrency } from '../../../../utils/formatters';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border-accent2-500/30">
        <p className="text-sm text-slate-300 mb-1">{label}</p>
        <p className="text-emerald-400 font-bold text-base">
          Revenue: {formatCurrency(payload[0].value)}
        </p>
        {payload[1] && (
          <p className="text-blue-400 font-medium text-sm mt-1">
            Invoices: {payload[1].value}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const MonthlySalesTrendChart = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = useDailySalesQuery(filterParams);
  
  const chartData = data?.data || [];
  const isEmpty = chartData.length === 0;

  return (
    <ChartWrapper
      title="Sales Trend"
      subtitle="Daily revenue and invoice volume"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
            </linearGradient>
          </defs>
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
            yAxisId="left"
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            tickFormatter={(value) => `₹${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="revenue" 
            name="Revenue" 
            stroke="#34d399" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, fill: "#34d399", stroke: "#0f172a", strokeWidth: 2 }}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="invoiceCount" 
            name="Invoices" 
            stroke="#60a5fa" 
            strokeWidth={2} 
            dot={false} 
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
