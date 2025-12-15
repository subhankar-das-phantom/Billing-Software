import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Calendar,
  User,
  Package,
  DollarSign,
  CreditCard,
  CheckCircle,
  Printer,
  XCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  TrendingUp,
  Clock,
  AlertCircle
} from 'lucide-react';
import { invoiceService } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { PageLoader } from '../components/Common/Loader';
import ExportModal from '../components/Common/ExportModal';
import { useToast } from '../context/ToastContext';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  }
};

const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.03,
      type: 'spring',
      stiffness: 300,
      damping: 24
    }
  })
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    thisMonth: 0
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    loadInvoices();
  }, [page]);

  const loadInvoices = async () => {
    try {
      const data = await invoiceService.getInvoices({ page, limit: 20 });
      setInvoices(data.invoices || []);
      setTotalPages(data.pages || 1);
      
      // Calculate stats
      const today = new Date().toDateString();
      const thisMonth = new Date().getMonth();
      setStats({
        total: data.invoices?.length || 0,
        today: data.invoices?.filter(inv => 
          new Date(inv.invoiceDate).toDateString() === today
        ).length || 0,
        thisMonth: data.invoices?.filter(inv => 
          new Date(inv.invoiceDate).getMonth() === thisMonth
        ).length || 0
      });
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      invoice.customer?.customerName.toLowerCase().includes(search.toLowerCase());
    
    // Case-insensitive status matching
    const matchesStatus = statusFilter === 'all' || 
      invoice.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });


  const handleExport = async ({ format, dateRange }) => {
    try {
      let dataToExport = filteredInvoices;

      // Filter by date range if specified
      if (dateRange.startDate && dateRange.endDate) {
        const start = new Date(dateRange.startDate);
        const end = new Date(dateRange.endDate);
        end.setHours(23, 59, 59, 999); // Include full end date

        dataToExport = dataToExport.filter(invoice => {
          const invoiceDate = new Date(invoice.invoiceDate);
          return invoiceDate >= start && invoiceDate <= end;
        });
      }

      if (dataToExport.length === 0) {
        error('No invoices found for the selected date range');
        return;
      }

      // Call export service (returns blob)
      const blob = await invoiceService.exportInvoices({ 
        format,
        invoices: dataToExport.map(inv => inv._id),
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Map format to proper file extension
      const extensionMap = { excel: 'xlsx', pdf: 'pdf', csv: 'csv' };
      const extension = extensionMap[format] || 'xlsx';
      
      link.download = `invoices_export_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      success(`Successfully exported ${dataToExport.length} invoices as ${format.toUpperCase()}`);
    } catch (err) {
      error(err.response?.data?.message || 'Failed to export invoices');
    }
  };

  // Calculate export stats
  const exportStats = {
    total: filteredInvoices.length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0),
    cash: filteredInvoices.filter(inv => inv.paymentType === 'Cash').length,
    credit: filteredInvoices.filter(inv => inv.paymentType === 'Credit').length
  };


  const statusConfig = {
    Created: { icon: FileText, class: 'badge-info', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    Printed: { icon: Printer, class: 'badge-success', color: 'text-green-400', bg: 'bg-green-500/20' },
    Cancelled: { icon: XCircle, class: 'badge-danger', color: 'text-red-400', bg: 'bg-red-500/20' }
  };

  const paymentConfig = {
    Cash: { icon: DollarSign, class: 'badge-success', color: 'text-green-400' },
    Credit: { icon: CreditCard, class: 'badge-info', color: 'text-blue-400' }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="space-y-12"
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { 
            label: 'Total Invoices', 
            value: invoices.length, 
            icon: FileText,
            color: 'from-blue-500 to-blue-600',
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
          },
          { 
            label: "Today's Invoices", 
            value: stats.today, 
            icon: Clock,
            color: 'from-emerald-500 to-emerald-600',
            iconColor: 'text-emerald-400',
            bgColor: 'bg-emerald-500/20'
          },
          { 
            label: 'This Month', 
            value: stats.thisMonth, 
            icon: TrendingUp,
            color: 'from-purple-500 to-purple-600',
            iconColor: 'text-purple-400',
            bgColor: 'bg-purple-500/20'
          }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            whileHover={{ y: -4, scale: 1.02 }}
            className="glass-card p-6 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <motion.p 
                  className="text-3xl font-bold text-white"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + index * 0.1, type: 'spring', stiffness: 200 }}
                >
                  {stat.value}
                </motion.p>
              </div>
              <motion.div
                className={`p-3 rounded-xl ${stat.bgColor}`}
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
              >
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Header with Filters */}
      <motion.div variants={cardVariants} className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 bg-blue-500/20 rounded-lg"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <FileText className="w-5 h-5 text-blue-400" />
            </motion.div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">All Invoices</h2>
              <p className="text-sm text-slate-400">
                Showing {filteredInvoices.length} of {invoices.length} invoices
              </p>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link to="/invoices/create" className="btn btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Invoice
            </Link>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoices..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {search && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  whileHover={{ rotate: 90 }}
                >
                  <XCircle className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select pl-10 w-full"
            >
              <option value="all">All Status</option>
              <option value="Created">Created</option>
              <option value="Printed">Printed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Export Button */}
          <motion.button
            onClick={() => setShowExportModal(true)}
            className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 shadow-lg shadow-emerald-500/30 border-0"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5" />
            Export
          </motion.button>
        </div>
      </motion.div>

      {/* Invoices Table */}
      <AnimatePresence mode="wait">
        {filteredInvoices.length === 0 ? (
          <motion.div
            key={`empty-${statusFilter}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-12 text-center"
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
            >
              <FileText className="w-10 h-10 text-slate-400" />
            </motion.div>
            <motion.p
              className="text-slate-400 mb-6 text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {search 
                ? 'No invoices found matching your search' 
                : statusFilter !== 'all' 
                  ? `No ${statusFilter} invoices found`
                  : 'No invoices found. Create your first invoice!'}
            </motion.p>
            {!search && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Link to="/invoices/create" className="btn btn-primary inline-flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Invoice
                </Link>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={`table-${statusFilter}-${filteredInvoices.length}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="glass-card overflow-hidden"
          >
            <div className="table-container">
              <table className="table">
                <thead>
                  <motion.tr
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Action</th>
                  </motion.tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {filteredInvoices.map((invoice, index) => {
                      const StatusIcon = statusConfig[invoice.status]?.icon || FileText;
                      const PaymentIcon = paymentConfig[invoice.paymentType]?.icon || CreditCard;

                      return (
                        <motion.tr
                          key={invoice._id}
                          custom={index}
                          variants={tableRowVariants}
                          initial="hidden"
                          animate="visible"
                          exit={{ opacity: 0, x: -20 }}
                          layout
                          whileHover={{ 
                            backgroundColor: 'rgba(51, 65, 85, 0.5)',
                            x: 4
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          <td className="font-medium text-white">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              {invoice.invoiceNumber}
                            </div>
                          </td>
                          <td className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              {formatDate(invoice.invoiceDate)}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <motion.div
                                className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-500/30"
                                whileHover={{ scale: 1.1, rotate: 5 }}
                              >
                                {invoice.customer?.customerName?.charAt(0)}
                              </motion.div>
                              <div>
                                <p className="text-white font-medium">{invoice.customer?.customerName}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {invoice.customer?.phone}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="text-slate-300">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-500" />
                              {invoice.items?.length || 0} items
                            </div>
                          </td>
                          <td className="text-emerald-400 font-medium">
                            {formatCurrency(invoice.totals?.netTotal)}
                          </td>
                          <td>
                            <motion.span
                              className={`badge ${paymentConfig[invoice.paymentType]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                              whileHover={{ scale: 1.05 }}
                            >
                              <PaymentIcon className="w-3 h-3" />
                              {invoice.paymentType}
                            </motion.span>
                          </td>
                          <td>
                            <motion.span
                              className={`badge ${statusConfig[invoice.status]?.class || 'badge-info'} inline-flex items-center gap-1.5`}
                              whileHover={{ scale: 1.05 }}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {invoice.status}
                            </motion.span>
                          </td>
                          <td>
                            <motion.div whileHover={{ x: 4 }}>
                              <Link
                                to={`/invoices/${invoice._id}`}
                                className="btn btn-secondary py-1.5 px-3 text-sm inline-flex items-center gap-2 group"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Link>
                            </motion.div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <AnimatePresence>
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="p-4 border-t border-slate-700 flex items-center justify-between"
                >
                  <motion.button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary flex items-center gap-2"
                    whileHover={{ scale: page === 1 ? 1 : 1.05 }}
                    whileTap={{ scale: page === 1 ? 1 : 0.95 }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </motion.button>

                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <motion.button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          {pageNum}
                        </motion.button>
                      );
                    })}
                  </div>

                  <motion.button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn btn-secondary flex items-center gap-2"
                    whileHover={{ scale: page === totalPages ? 1 : 1.05 }}
                    whileTap={{ scale: page === totalPages ? 1 : 0.95 }}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={filteredInvoices}
        stats={exportStats}
        onExport={handleExport}
        entityType="Invoices"
      />
    </motion.div>
  );
}
