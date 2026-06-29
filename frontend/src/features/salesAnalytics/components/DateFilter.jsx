import React from 'react';
import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export const DateFilter = ({ filterParams, onFilterChange }) => {
  const isCustom = filterParams.period === 'custom';

  const handlePeriodChange = (e) => {
    const newPeriod = e.target.value;
    if (newPeriod === 'custom') {
      onFilterChange({ ...filterParams, period: newPeriod });
    } else {
      onFilterChange({ period: newPeriod, startDate: '', endDate: '' });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-slate-400" />
        <select
          value={filterParams.period}
          onChange={handlePeriodChange}
          className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value} className="bg-slate-800 text-white">
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {isCustom && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          className="flex items-center gap-2"
        >
          <input
            type="date"
            value={filterParams.startDate}
            onChange={(e) => onFilterChange({ ...filterParams, startDate: e.target.value })}
            className="input text-xs sm:text-sm py-1.5 px-3 h-auto"
            max={filterParams.endDate || undefined}
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={filterParams.endDate}
            onChange={(e) => onFilterChange({ ...filterParams, endDate: e.target.value })}
            className="input text-xs sm:text-sm py-1.5 px-3 h-auto"
            min={filterParams.startDate || undefined}
          />
        </motion.div>
      )}
    </div>
  );
};
