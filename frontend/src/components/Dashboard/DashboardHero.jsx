import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Calendar,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const DashboardHero = ({ 
  timeRange, 
  setTimeRange, 
  isValidating = false 
}) => {
  const { user } = useAuth();

  // Format today's date & Indian financial year quarter
  const { formattedDate, fiscalQuarter } = useMemo(() => {
    const now = new Date();
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    const formatted = now.toLocaleDateString('en-IN', options);

    const month = now.getMonth();
    const year = now.getFullYear();
    let q = 'Q4';
    let fy = `${year - 1}-${String(year).slice(-2)}`;

    if (month >= 3 && month <= 5) {
      q = 'Q1';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    } else if (month >= 6 && month <= 8) {
      q = 'Q2';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    } else if (month >= 9 && month <= 11) {
      q = 'Q3';
      fy = `${year}-${String(year + 1).slice(-2)}`;
    }

    return {
      formattedDate: formatted,
      fiscalQuarter: `${q} FY${fy}`
    };
  }, []);

  const timeRanges = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' }
  ];

  const userName = user?.name || user?.businessName || user?.username || 'Admin';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formattedDate} • {fiscalQuarter}
            </span>

            {isValidating ? (
              <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                Syncing...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Welcome back, {userName}. Here is your financial summary and operational overview.
          </p>
        </div>

        {/* Right: Time Filter & Primary CTA */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Filter */}
          <div className="inline-flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {timeRanges.map((range) => {
              const isActive = timeRange === range.id;
              return (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    isActive 
                      ? 'bg-slate-800 text-white font-semibold shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          {/* New Invoice Button */}
          <Link
            to="/invoices/create"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
            <kbd className="hidden sm:inline-flex items-center px-1 text-[10px] font-mono bg-blue-700/80 text-blue-100 rounded">
              Alt+N
            </kbd>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardHero;
