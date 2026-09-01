import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  PieChart as PieIcon
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// Clean tooltip for Area Chart
const CustomAreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-lg text-xs space-y-1.5 min-w-[150px]">
        <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-semibold text-white">
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Clean tooltip for Donut Chart
const CustomDonutTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-lg text-xs space-y-1">
        <p className="font-semibold text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.color }} />
          {data.name}
        </p>
        <p className="text-slate-300">
          Amount: <span className="font-semibold text-white">{formatCurrency(data.value)}</span>
        </p>
        {data.payload.percentage !== undefined && (
          <p className="text-slate-400 text-[11px]">
            {data.payload.percentage}% of total volume
          </p>
        )}
      </div>
    );
  }
  return null;
};

export const DashboardChartsSection = ({ 
  dailySales = [], 
  monthlySales = [], 
  overviewData = null,
  creditStats = null
}) => {
  const [chartView, setChartView] = useState('daily');

  // Prepare Area Chart Data
  const areaChartData = useMemo(() => {
    if (chartView === 'monthly' && monthlySales.length > 0) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return monthlySales.map(m => ({
        label: monthNames[m.month - 1] || `M${m.month}`,
        sales: m.revenue || 0,
        collections: m.collections || 0
      }));
    }

    if (dailySales.length > 0) {
      return dailySales.map(d => {
        const parts = d.date ? d.date.split('-') : [];
        const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date;
        return {
          label,
          sales: d.revenue || 0,
          collections: d.collections || 0
        };
      });
    }

    return [
      { label: 'Mon', sales: 0, collections: 0 },
      { label: 'Tue', sales: 0, collections: 0 },
      { label: 'Wed', sales: 0, collections: 0 },
      { label: 'Thu', sales: 0, collections: 0 },
      { label: 'Fri', sales: 0, collections: 0 },
      { label: 'Sat', sales: 0, collections: 0 },
      { label: 'Sun', sales: 0, collections: 0 }
    ];
  }, [chartView, dailySales, monthlySales]);

  // Compute Donut Distribution
  const donutData = useMemo(() => {
    const totalCollected = overviewData?.totalCollections ?? creditStats?.paymentsThisMonth ?? 0;
    const totalOutstanding = creditStats?.totalOutstanding ?? overviewData?.totalOutstanding ?? 0;
    const overdue = creditStats?.overdueAmount ?? 0;
    const regularOutstanding = Math.max(0, totalOutstanding - overdue);

    const data = [
      { name: 'Collected', value: totalCollected > 0 ? totalCollected : 1, color: '#10b981' },
      { name: 'Current Dues', value: regularOutstanding > 0 ? regularOutstanding : 0, color: '#3b82f6' },
      { name: 'Overdue (>30d)', value: overdue > 0 ? overdue : 0, color: '#f43f5e' }
    ].filter(d => d.value > 0);

    const total = data.reduce((acc, curr) => acc + curr.value, 0);
    return data.map(d => ({
      ...d,
      percentage: total > 0 ? ((d.value / total) * 100).toFixed(1) : 0
    }));
  }, [overviewData, creditStats]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 1. Main Revenue & Collections Velocity Chart */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
        {/* Chart Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white">Sales & Collections Trend</h2>
              <p className="text-xs text-slate-400">Invoiced amount compared with collected cash</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Sales
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Collections
              </span>
            </div>

            <div className="inline-flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-md text-xs">
              <button
                onClick={() => setChartView('daily')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  chartView === 'daily' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView('monthly')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  chartView === 'monthly' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={areaChartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cleanSalesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="cleanCollectionsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
              
              <XAxis 
                dataKey="label" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : val >= 1000 ? `₹${(val / 1000).toFixed(0)}k` : `₹${val}`}
              />
              
              <Tooltip content={<CustomAreaTooltip />} />

              <Area 
                type="monotone" 
                dataKey="sales" 
                name="Sales" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#cleanSalesGrad)" 
              />
              <Area 
                type="monotone" 
                dataKey="collections" 
                name="Collections" 
                stroke="#10b981" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#cleanCollectionsGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Cash Flow Donut */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-white">Cash Flow Breakdown</h2>
            <p className="text-xs text-slate-400">Collections vs Pending balances</p>
          </div>
        </div>

        <div className="h-[180px] w-full relative flex items-center justify-center my-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[10px] uppercase font-medium text-slate-400 tracking-wider">Total</span>
            <span className="text-sm sm:text-base font-bold text-white">
              {formatCurrency(donutData.reduce((acc, curr) => acc + curr.value, 0))}
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
          {donutData.map((item, i) => {
            const linkTarget = item.name === 'Collected' ? '/collections' : '/credits';
            return (
              <Link 
                key={i} 
                to={linkTarget}
                className="flex items-center justify-between p-1 rounded-md hover:bg-slate-800/60 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 group-hover:text-white transition-colors">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-white font-medium">{formatCurrency(item.value)}</span>
                  <span className="text-slate-500 text-[11px]">({item.percentage}%)</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardChartsSection;
