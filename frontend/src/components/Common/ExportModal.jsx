import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  X,
  FileText,
  File,
  Calendar,
  CheckCircle
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const ExportModal = ({ isOpen, onClose, data, onExport, stats, entityType = 'invoices' }) => {
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportDateRange, setExportDateRange] = useState({
    startDate: '',
    endDate: '',
    preset: 'all'
  });

  const getPresetDates = (preset) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (preset) {
      case 'all':
        return { startDate: '', endDate: '', preset: 'all' };
      case 'thisMonth': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          preset
        };
      }
      case 'lastMonth': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          preset
        };
      }
      case 'thisYear': {
        const start = new Date(now.getFullYear(), 0, 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          preset
        };
      }
      case 'last30Days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 30);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          preset
        };
      }
      case 'last90Days': {
        const start = new Date(today);
        start.setDate(start.getDate() - 90);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0],
          preset
        };
      }
      default:
        return { startDate: '', endDate: '', preset: 'all' };
    }
  };

  const handleExport = () => {
    onExport({
      format: exportFormat,
      dateRange: exportDateRange
    });
    onClose();
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
    { value: 'all', label: 'All Time', icon: '📅' },
    { value: 'thisMonth', label: 'This Month', icon: '📆' },
    { value: 'lastMonth', label: 'Last Month', icon: '📋' },
    { value: 'thisYear', label: 'This Year', icon: '🗓️' },
    { value: 'last30Days', label: 'Last 30 Days', icon: '⏰' },
    { value: 'last90Days', label: 'Last 90 Days', icon: '📊' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
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
                    <p className="text-emerald-100 text-sm">Choose format and date range</p>
                  </div>
                </div>
                <motion.button
                  onClick={onClose}
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
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl border border-slate-600">
                  {Object.entries(stats).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <p className="text-xs text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                      <p className="text-lg font-bold text-white">
                        {typeof value === 'number' && key.includes('total') ? formatCurrency(value) : value}
                      </p>
                    </div>
                  ))}
                </div>
              )}

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
              <div>
                <label className="block text-sm font-semibold text-white mb-3">Quick Select Period</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {presets.map((preset) => (
                    <motion.button
                      key={preset.value}
                      onClick={() => setExportDateRange(getPresetDates(preset.value))}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        exportDateRange.preset === preset.value
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                          : 'border-slate-700 hover:border-slate-600 text-slate-300'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="text-2xl mb-1">{preset.icon}</div>
                      <div className="text-sm font-medium">{preset.label}</div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Custom Date Range */}
              <div>
                <label className="block text-sm font-semibold text-white mb-3">Or Choose Custom Date Range</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Start Date</label>
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
                        className="input pl-10 w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">End Date</label>
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
                        className="input pl-10 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Range Display */}
              {exportDateRange.startDate && exportDateRange.endDate && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-500/20 border border-blue-500/30 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 text-blue-400">
                    <Calendar className="w-5 h-5" />
                    <span className="font-medium text-sm">
                      Selected Period:{' '}
                      {new Date(exportDateRange.startDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}{' '}
                      -{' '}
                      {new Date(exportDateRange.endDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-800/50 px-6 py-4 flex items-center justify-between border-t border-slate-700">
              <motion.button
                onClick={onClose}
                className="btn btn-secondary"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={handleExport}
                className="btn btn-primary bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 flex items-center gap-2 px-6 py-3"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4" />
                Export as {exportFormat.toUpperCase()}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExportModal;
