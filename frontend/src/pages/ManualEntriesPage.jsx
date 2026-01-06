import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';
import { manualEntryService } from '../services/manualEntryService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import ManualEntryModal from '../components/ManualEntry/ManualEntryModal';
import { useToast } from '../context/ToastContext';

export default function ManualEntriesPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 20,
        search: searchQuery,
        ...filters
      };
      
      const data = await manualEntryService.getManualEntries(params);
      setEntries(data.manualEntries || []);
      setTotalPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load manual entries:', error);
      addToast('Failed to load manual entries', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filters, searchQuery, addToast]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleDelete = async (entry) => {
    setDeleting(true);
    try {
      await manualEntryService.deleteManualEntry(entry._id);
      addToast('Entry deleted successfully', 'success');
      setDeleteConfirm(null);
      loadEntries();
    } catch (error) {
      addToast(error.response?.data?.message || 'Failed to delete entry', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const getEntryTypeInfo = (entryType) => {
    // Only opening_balance is used now
    if (entryType === 'opening_balance') {
      return { label: 'Opening Balance', icon: '📊' };
    }
    return { label: entryType, icon: '📋' };
  };

  const getEntryTypeColor = (entryType) => {
    switch (entryType) {
      case 'opening_balance':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'manual_bill':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'payment_adjustment':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'credit_adjustment':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getAmountColor = (entryType) => {
    switch (entryType) {
      case 'payment_adjustment':
      case 'credit_adjustment':
        return 'text-emerald-400';
      default:
        return 'text-amber-400';
    }
  };

  const getAmountPrefix = (entryType) => {
    switch (entryType) {
      case 'payment_adjustment':
      case 'credit_adjustment':
        return '-';
      default:
        return '+';
    }
  };

  if (loading && entries.length === 0) {
    return <PageLoader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-500/20 rounded-xl">
            <Shield className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Manual Entries</h1>
            <p className="text-slate-400 text-sm">{total} total entries</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => loadEntries()}
            className="btn btn-secondary"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
          <motion.button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Create Entry
          </motion.button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} flex items-center gap-2`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Expanded Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-700">
                {/* Date Range */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Entries Table */}
      <div className="glass-card overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex p-4 bg-slate-800 rounded-full mb-4">
              <Shield className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400 mb-4">No manual entries found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Entry
            </button>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Payment</th>
                    <th>Amount</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const typeInfo = getEntryTypeInfo(entry.entryType);
                    return (
                      <motion.tr
                        key={entry._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                      >
                        <td className="text-slate-300">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-500" />
                            {formatDate(entry.entryDate)}
                          </div>
                        </td>
                        <td className="font-medium text-white">
                          {entry.customerSnapshot?.customerName || entry.customer?.customerName || 'Unknown'}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${getEntryTypeColor(entry.entryType)}`}>
                            <span>{typeInfo.icon}</span>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td>
                          <span className={`text-xs px-2 py-1 rounded ${
                            entry.paymentType === 'Credit' 
                              ? 'bg-amber-500/20 text-amber-400' 
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {entry.paymentType}
                          </span>
                        </td>
                        <td className={`font-semibold ${getAmountColor(entry.entryType)}`}>
                          {getAmountPrefix(entry.entryType)}{formatCurrency(entry.amount)}
                          {entry.entryType === 'opening_balance' && entry.paymentType === 'Credit' && entry.paidAmount > 0 && (
                            <span className="block text-xs text-slate-400">
                              Remaining: {formatCurrency(entry.amount - entry.paidAmount)}
                            </span>
                          )}
                        </td>
                        <td className="text-slate-300 max-w-xs truncate">
                          {entry.description}
                        </td>
                        <td>
                          <button
                            onClick={() => setDeleteConfirm(entry)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-700 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary btn-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Modal */}
      <ManualEntryModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadEntries();
        }}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
            />
            <motion.div
              className="modal max-w-md relative z-10"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="p-6 text-center">
                <div className="inline-flex p-4 bg-red-500/20 rounded-full mb-4">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Delete Entry?</h3>
                <p className="text-slate-400 mb-6">
                  This will reverse any balance changes made by this entry. This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="btn btn-secondary"
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirm)}
                    className="btn bg-red-600 hover:bg-red-500 text-white"
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
