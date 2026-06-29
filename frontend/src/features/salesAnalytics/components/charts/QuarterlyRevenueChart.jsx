import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useMonthlySalesQuery } from '../../queries/useMonthlySalesQuery';
import { formatCurrency } from '../../../../utils/formatters';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card p-3 border-fuchsia-500/30">
        <p className="text-sm text-slate-300 mb-1">{data.quarter}</p>
        <p className="text-fuchsia-400 font-bold text-base">
          {formatCurrency(data.revenue)}
        </p>
      </div>
    );
  }
  return null;
};

export const QuarterlyRevenueChart = ({ year = new Date().getFullYear() }) => {
  const { data, isLoading, isError, refetch } = useMonthlySalesQuery(year);
  
  const monthlyData = data?.data || [];
  
  // Aggregate monthly into quarters
  const quarterlyData = [
    { quarter: 'Q1', revenue: 0 },
    { quarter: 'Q2', revenue: 0 },
    { quarter: 'Q3', revenue: 0 },
    { quarter: 'Q4', revenue: 0 },
  ];
  
  monthlyData.forEach(item => {
    if (item.month >= 1 && item.month <= 3) quarterlyData[0].revenue += item.revenue;
    else if (item.month >= 4 && item.month <= 6) quarterlyData[1].revenue += item.revenue;
    else if (item.month >= 7 && item.month <= 9) quarterlyData[2].revenue += item.revenue;
    else if (item.month >= 10 && item.month <= 12) quarterlyData[3].revenue += item.revenue;
  });

  const isEmpty = quarterlyData.every(d => d.revenue === 0);

  return (
    <ChartWrapper
      title="Quarterly Revenue"
      subtitle={`Revenue by quarter for ${year}`}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={() => refetch()}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={quarterlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorQtr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d946ef" stopOpacity={1}/>
              <stop offset="100%" stopColor="#a21caf" stopOpacity={0.6}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="quarter" 
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            stroke="#94a3b8" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `₹${value > 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b' }} />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={40}>
            {quarterlyData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="url(#colorQtr)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
};
