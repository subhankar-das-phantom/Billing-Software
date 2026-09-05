import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  X,
  FileText,
  File,
  Calendar,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const ExportModal = ({
  isOpen,
  onClose,
  data,
  onExport,
  stats,
  entityType = 'invoices',
  isExporting = false,
  showDateRange = true,
  defaultPreset = 'today',
  initialDateRange
}) => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportDateRange, setExportDateRange] = useState({
    startDate: '',
    endDate: '',
    preset: 'today'
  });

  const toLocalYMD = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
  };

  const parseLocalYMD = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  };

  const getPresetDates = (preset) => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const [currY, currM, currD] = todayStr.split('-').map(Number);

    const getShiftedYMD = (daysBack) => {
      const d = new Date(Date.UTC(currY, currM - 1, currD - daysBack));
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    switch (preset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr, preset: 'today' };
      case 'yesterday': {
        const yStr = getShiftedYMD(1);
        return { startDate: yStr, endDate: yStr, preset: 'yesterday' };
      }
      case 'last7Days': {
        return { startDate: getShiftedYMD(6), endDate: todayStr, preset: 'last7Days' };
      }
      case 'thisMonth': {
        const monthStart = `${currY}-${String(currM).padStart(2, '0')}-01`;
        return { startDate: monthStart, endDate: todayStr, preset: 'thisMonth' };
      }
      case 'lastMonth': {
        const lastM = currM === 1 ? 12 : currM - 1;
        const lastMY = currM === 1 ? currY - 1 : currY;
        const lastMonthStart = `${lastMY}-${String(lastM).padStart(2, '0')}-01`;
        const lastDayUtc = new Date(Date.UTC(currY, currM - 1, 0));
        const lastMonthEnd = `${lastDayUtc.getUTCFullYear()}-${String(lastDayUtc.getUTCMonth() + 1).padStart(2, '0')}-${String(lastDayUtc.getUTCDate()).padStart(2, '0')}`;
        return { startDate: lastMonthStart, endDate: lastMonthEnd, preset: 'lastMonth' };
      }
      case 'thisYear': {
        const yearStart = `${currY}-01-01`;
        return { startDate: yearStart, endDate: todayStr, preset: 'thisYear' };
      }
      case 'last30Days': {
        return { startDate: getShiftedYMD(29), endDate: todayStr, preset: 'last30Days' };
      }
      case 'all':
        return { startDate: '', endDate: '', preset: 'all' };
      default:
        return { startDate: '', endDate: '', preset: 'all' };
    }
  };

  // Sync initial date range whenever modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialDateRange && (initialDateRange.startDate || initialDateRange.endDate || initialDateRange.preset)) {
        setExportDateRange(initialDateRange);
      } else if (defaultPreset) {
        setExportDateRange(getPresetDates(defaultPreset));
      }
    }
  }, [isOpen]);

  const handleExport = () => {
    if (isExporting) return;
    onExport({
      format: exportFormat,
      dateRange: exportDateRange
    });
  };

  const formatTypes = [
    {
      value: 'excel',
      label: 'Excel',
      icon: FileText,
      color: 'emerald',
      desc: 'Full data with analysis'
    },
    {
      value: 'pdf',
      label: 'PDF',
      icon: FileText,
      color: 'red',
      desc: 'Professional report'
    },
    {
      value: 'csv',
      label: 'CSV',
      icon: File,
      color: 'blue',
      desc: 'Simple spreadsheet'
    }
  ];

  const presets = [
    { value: 'today', label: 'Today', icon: '⚡' },
    { value: 'yesterday', label: 'Yesterday', icon: '⏮️' },
    { value: 'last7Days', label: 'Last 7 Days', icon: '⏱️' },
    { value: 'thisMonth', label: 'This Month', icon: '📆' },
    { value: 'lastMonth', label: 'Last Month', icon: '📋' },
    { value: 'thisYear', label: 'This Year', icon: '🗓️' },
    { value: 'last30Days', label: 'Last 30 Days', icon: '⏰' },
    { value: 'all', label: 'All Time', icon: '🌐' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            if (!isExporting) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-3xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2 bg-white/20 rounded-lg"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <Download className="w-6 h-6" />
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-bold">Export {entityType}</h2>
                    <p className="text-emerald-100 text-sm">Choose format {showDateRange && 'and date range'}</p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
                  disabled={isExporting}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">Select Export Format</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {formatTypes.map((format) => (
                    <motion.button
                      key={format.value}
                      onClick={() => setExportFormat(format.value)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        exportFormat === format.value
                          ? `border-${format.color}-500 bg-${format.color}-500/20`
                          : 'border-slate-700 hover:border-slate-600'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {exportFormat === format.value && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2"
                        >
                          <CheckCircle className={`w-5 h-5 text-${format.color}-400`} />
                        </motion.div>
                      )}
                      <format.icon
                        className={`w-10 h-10 mx-auto mb-2 ${
                          exportFormat === format.value ? `text-${format.color}-400` : 'text-slate-400'
                        }`}
                      />
                      <div className="text-center">
                        <p className="font-semibold text-white">{format.label}</p>
                        <p className="text-xs text-slate-400 mt-1">{format.desc}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Date Range Presets */}
              {showDateRange && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">Quick Select Period</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                      {presets.map((preset) => (
                        <motion.button
                          key={preset.value}
                          type="button"
                          onClick={() => setExportDateRange(getPresetDates(preset.value))}
                          className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center ${
                            exportDateRange.preset === preset.value
                              ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 shadow-sm shadow-emerald-500/20'
                              : 'border-slate-700/80 hover:border-slate-600 bg-slate-800/40 text-slate-300'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="text-xl sm:text-2xl mb-1">{preset.icon}</div>
                          <div className="text-xs sm:text-sm font-semibold">{preset.label}</div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">Or Choose Custom Date Range</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-2 font-medium">Start Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="date"
                            value={exportDateRange.startDate}
                            onChange={(e) =>
                              setExportDateRange({
                                startDate: e.target.value,
                                endDate: exportDateRange.endDate,
                                preset: 'custom'
                              })
                            }
                            className="input pl-10 w-full bg-slate-900 border-slate-700 text-slate-200 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-2 font-medium">End Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="date"
                            value={exportDateRange.endDate}
                            onChange={(e) =>
                              setExportDateRange({
                                startDate: exportDateRange.startDate,
                                endDate: e.target.value,
                                preset: 'custom'
                              })
                            }
                            min={exportDateRange.startDate}
                            className="input pl-10 w-full bg-slate-900 border-slate-700 text-slate-200 focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Selected Range Display Feedback */}
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 text-slate-300">
                      <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs sm:text-sm font-medium">
                        <span className="text-slate-400">Selected Export Scope:</span>{' '}
                        {exportDateRange.preset === 'all' ? (
                          <strong className="text-emerald-400 font-semibold">Complete History (All Time · Up to 365 Days)</strong>
                        ) : exportDateRange.startDate && exportDateRange.endDate && exportDateRange.startDate === exportDateRange.endDate ? (
                          <strong className="text-emerald-400 font-semibold">
                            Single Day · {formatDate(parseLocalYMD(exportDateRange.startDate))}
                          </strong>
                        ) : exportDateRange.startDate && exportDateRange.endDate ? (
                          <strong className="text-emerald-400 font-semibold">
                            {formatDate(parseLocalYMD(exportDateRange.startDate))} — {formatDate(parseLocalYMD(exportDateRange.endDate))}
                          </strong>
                        ) : exportDateRange.startDate ? (
                          <strong className="text-emerald-400 font-semibold">
                            From {formatDate(parseLocalYMD(exportDateRange.startDate))}
                          </strong>
                        ) : exportDateRange.endDate ? (
                          <strong className="text-emerald-400 font-semibold">
                            Until {formatDate(parseLocalYMD(exportDateRange.endDate))}
                          </strong>
                        ) : (
                          <span className="text-amber-400">No date bounds specified</span>
                        )}
                      </span>
                    </div>
                    {exportDateRange.preset && exportDateRange.preset !== 'custom' && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hidden sm:inline-block">
                        Preset: {presets.find(p => p.value === exportDateRange.preset)?.label || exportDateRange.preset}
                      </span>
                    )}
                  </motion.div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-800/50 px-6 py-4 flex items-center justify-between border-t border-slate-700">
              <motion.button
                onClick={onClose}
                disabled={isExporting}
                className="btn btn-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleExport}
                disabled={isExporting}
                className="btn btn-primary bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 px-6 py-3 disabled:opacity-70 disabled:cursor-not-allowed"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export as {exportFormat.toUpperCase()}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExportModal;
