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
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        {/* Left: Title & Subtitle */}
        <div className="space-y-1">
          <div className="flex items-center justify-between lg:justify-start gap-2 text-xs text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/60 text-[10px] sm:text-xs">
              <Calendar className="w-3 h-3 text-slate-400" />
              {formattedDate} • {fiscalQuarter}
            </span>

            <div className="flex items-center gap-2">
              {isValidating ? (
                <span className="inline-flex items-center gap-1 text-slate-400 text-[10px] sm:text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                  Syncing...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] sm:text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              )}

              {/* Mobile CTA on top right */}
              <Link
                to="/invoices/create"
                className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invoice</span>
              </Link>
            </div>
          </div>

          <h1 className="text-lg sm:text-2xl font-bold text-slate-100 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Welcome back, {userName}.<span className="hidden sm:inline"> Here is your financial summary and operational overview.</span>
          </p>
        </div>

        {/* Right: Time Filter & Primary CTA */}
        <div className="flex items-center justify-between lg:justify-end gap-3 pt-1 lg:pt-0">
          {/* Segmented Filter */}
          <div className="inline-flex items-center p-0.5 sm:p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto max-w-full">
            {timeRanges.map((range) => {
              const isActive = timeRange === range.id;
              return (
                <button
                  key={range.id}
                  onClick={() => setTimeRange(range.id)}
                  className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive 
                      ? 'bg-slate-800 text-slate-100 font-semibold shadow-xs' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          {/* Desktop New Invoice Button */}
          <Link
            to="/invoices/create"
            className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors shadow-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardHero;
