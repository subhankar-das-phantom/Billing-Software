import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useDailySalesQuery } from '../../queries/useDailySalesQuery';
import { useChartTheme } from '../../utils/chartTheme';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border-purple-500/30">
        <p className="text-sm text-slate-400 mb-1">{label}</p>
        <p className="text-purple-500 font-bold text-base">
          {payload[0].value} Invoices
        </p>
      </div>
    );
  }
  return null;
};

export const InvoiceCountChart = ({ filterParams }) => {
  const { data, isLoading, isError, refetch } = useDailySalesQuery(filterParams);
  const { gridStroke, axisStroke } = useChartTheme();
  
  const chartData = data?.data || [];
  const isEmpty = chartData.length === 0;

  return (
    <ChartWrapper
      title="Invoice Volume"
      subtitle="Number of invoices generated"
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke={axisStroke} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(val) => {
              const d = new Date(val);
              return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
            }}
          />
          <YAxis 
            stroke={axisStroke} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area 
            type="monotone" 
            dataKey="invoiceCount" 
            stroke="#a855f7" 
            fillOpacity={1} 
            fill="url(#colorInvoices)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
