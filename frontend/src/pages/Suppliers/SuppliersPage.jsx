import { memo, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Truck,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  ArrowRight,
  Loader2,
  CreditCard,
  AlertCircle,
  XCircle,
  TrendingUp,
  Package,
  Building2
} from 'lucide-react';
import { supplierService } from '../../services/suppliers/supplierService';
import { formatCurrency, formatPhone } from '../../utils/formatters';
import SupplierFormModal from '../../components/Suppliers/SupplierFormModal';
import ConfirmDialog from '../../components/Common/Dialogs/ConfirmDialog';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import RefreshIndicator from '../../components/Common/Feedback/RefreshIndicator';
import { VirtualizedGrid } from '../../components/Common/VirtualizedList';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { 
  useDebounce, 
  useMotionConfig, 
  useFirstVisit, 
  useSWR, 
  invalidateCachePattern, 
  useMediaQuery 
} from '../../hooks';

const LARGE_SUPPLIER_LIST_THRESHOLD = 24;

const SupplierCard = memo(function SupplierCard({
  supplier,
  index,
  denseMode,
  shouldHover,
  openEditModal,
  setDeleteDialog,
  isAdmin,
  hasPermission
}) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/suppliers/${supplier._id}`)}
      className={`glass-card p-5 group cursor-pointer transition-all ${
        shouldHover ? 'hover:bg-slate-800/80 hover:-translate-y-1 hover:border-slate-600' : ''
      } ${supplier.isActive === false ? 'opacity-75 grayscale-[0.2] border-rose-500/20' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-500 flex items-center justify-center relative overflow-hidden shadow-lg shadow-blue-500/20 flex-shrink-0 group-hover:scale-105 group-hover:rotate-3 transition-transform">
            <span className="text-white font-bold text-lg">
              {supplier.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-white truncate text-base group-hover:text-blue-400 transition-colors">
                {supplier.name}
              </h3>
              {supplier.isActive === false && (
                <span className="px-2 py-0.5 rounded flex items-center gap-1 bg-rose-500/10 text-rose-400 text-[10px] font-semibold tracking-wider uppercase border border-rose-500/20">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
              <Phone className="w-3 h-3 text-slate-500" />
              {formatPhone(supplier.phone) || 'No Phone'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {(isAdmin || hasPermission('suppliers', 'edit')) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(supplier);
              }}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
              title="Edit Supplier"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {(isAdmin || hasPermission('suppliers', 'delete')) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialog({ open: true, supplier });
              }}
              className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete Supplier"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Supplier Meta */}
      <div className="space-y-2 text-xs mb-4">
        {supplier.contactPerson && (
          <p className="text-slate-300 flex items-center gap-2 truncate">
            <span className="text-slate-500 font-medium">Contact:</span>
            <span className="truncate">{supplier.contactPerson}</span>
          </p>
        )}
        {supplier.gstin && (
          <p className="text-slate-400 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-slate-500">GST:</span>
            <span className="font-mono uppercase tracking-wider">{supplier.gstin}</span>
          </p>
        )}
        {supplier.email && (
          <p className="text-slate-400 flex items-center gap-2 truncate">
            <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </p>
        )}
        {supplier.address && (
          <p className="text-slate-400 line-clamp-1 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span className="truncate">{supplier.address}{supplier.state ? `, ${supplier.state}` : ''}</span>
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-400">Opening Balance</p>
            <p className="font-bold text-emerald-400 text-sm">
              {formatCurrency(supplier.openingBalance || 0)}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center text-xs text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
          View Details
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </span>
      </div>
    </div>
  );
});

export default function SuppliersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search] = useDebounce(searchInput);
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [accumulatedSuppliers, setAccumulatedSuppliers] = useState([]);
  const observer = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, supplier: null });

  const { showToast } = useToast();
  const { isAdmin, hasPermission } = useAuth();
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('suppliers');
  const isMobile = useMediaQuery('(max-width: 640px)');

  // SWR: Suppliers List with search & caching
  const { data, isLoading, isValidating, mutate } = useSWR(
    `suppliers-page-${search}-${page}`,
    () => supplierService.getSuppliers({ search, page, limit: 30 }),
    { ttl: 5 * 60 * 1000 }
  );

  const suppliers = accumulatedSuppliers.length > 0 ? accumulatedSuppliers : (data?.suppliers || []);
  const totalCount = data?.total || suppliers.length;
  const hasMore = data?.pages ? page < data.pages : false;

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // Accumulate suppliers as pages arrive
  useEffect(() => {
    if (!data?.suppliers) return;

    if (page === 1) {
      setAccumulatedSuppliers(data.suppliers);
      return;
    }

    setAccumulatedSuppliers(prev => {
      const existingIds = new Set(prev.map(s => s._id));
      const newSuppliers = data.suppliers.filter(s => !existingIds.has(s._id));
      return [...prev, ...newSuppliers];
    });
  }, [data, page]);

  // Infinite Scroll Observer
  const lastElementRef = useCallback((node) => {
    if (isValidating) return;
    if (observer.current) observer.current.disconnect();

    if (node) {
      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0].isIntersecting && !isValidating && hasMore) {
            setPage(prev => prev + 1);
          }
        },
        { threshold: 0.1 }
      );
      observer.current.observe(node);
    }
  }, [isValidating, hasMore]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (statusFilter === 'active') return s.isActive !== false;
      if (statusFilter === 'inactive') return s.isActive === false;
      return true;
    });
  }, [suppliers, statusFilter]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter(s => s.isActive !== false).length;
    const inactive = suppliers.filter(s => s.isActive === false).length;
    const totalOpeningBalance = suppliers.reduce((sum, s) => sum + (s.openingBalance || 0), 0);

    return { total, active, inactive, totalOpeningBalance };
  }, [suppliers]);

  const handleDelete = async () => {
    try {
      if (deleteDialog.supplier) {
        await supplierService.deleteSupplier(deleteDialog.supplier._id);
        showToast('Supplier deleted successfully', 'success');
        invalidateCachePattern('suppliers');
        mutate();
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete supplier', 'error');
    } finally {
      setDeleteDialog({ open: false, supplier: null });
    }
  };

  const openEditModal = useCallback((supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: motionConfig.shouldAnimate ? 0.08 : 0,
        delayChildren: motionConfig.shouldAnimate ? 0.12 : 0
      }
    }
  };

  const isLargeList = filteredSuppliers.length > LARGE_SUPPLIER_LIST_THRESHOLD;

  return (
    <motion.div
      variants={containerVariants}
      initial={isFirstVisit ? "hidden" : false}
      animate="visible"
      className="p-6 max-w-7xl mx-auto space-y-6"
    >
      {/* Stats Cards (Matching CustomersPage) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Suppliers',
            value: stats.total,
            icon: Truck,
            color: 'from-blue-500 to-blue-600',
            iconColor: 'text-blue-400',
            bgColor: 'bg-blue-500/20'
          },
          {
            label: 'Active Suppliers',
            value: stats.active,
            icon: Building2,
            color: 'from-emerald-500 to-emerald-600',
            iconColor: 'text-emerald-400',
            bgColor: 'bg-emerald-500/20'
          },
          {
            label: 'Total Opening Balance',
            value: formatCurrency(stats.totalOpeningBalance),
            icon: DollarSign,
            color: 'from-teal-500 to-teal-600',
            iconColor: 'text-teal-400',
            bgColor: 'bg-teal-500/20'
          },
          {
            label: 'Inactive Suppliers',
            value: stats.inactive,
            icon: AlertCircle,
            color: 'from-amber-500 to-amber-600',
            iconColor: 'text-amber-400',
            bgColor: 'bg-amber-500/20'
          }
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-6 cursor-pointer group transition-transform hover:-translate-y-1 hover:scale-[1.02]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">
                  {stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor} transition-transform group-hover:rotate-[360deg] group-hover:scale-110 duration-700`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header with Search and Actions */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg transition-transform hover:rotate-[360deg] duration-700">
              <Truck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-white">All Suppliers</h2>
                <RefreshIndicator isRefreshing={isValidating} size="sm" />
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Showing {filteredSuppliers.length} of {totalCount} suppliers
              </p>
            </div>
          </div>

          {(isAdmin || hasPermission('suppliers', 'create')) && (
            <EnhancedButton 
              onClick={openAddModal} 
              variant="primary" 
              icon={Plus}
              className="active:scale-95 transition-transform"
            >
              Add Supplier
            </EnhancedButton>
          )}
        </div>

        {/* Search and Status Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by supplier name, contact, phone, GSTIN..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {searchInput && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  whileHover={{ rotate: 90 }}
                >
                  <XCircle className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            {['all', 'active', 'inactive'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Suppliers */}
      {isLoading && suppliers.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-3" />
          <p>Loading suppliers...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6">
            <Truck className="w-10 h-10 text-slate-400" />
          </div>
          <p className="text-slate-400 mb-6 text-lg">
            {searchInput ? 'No suppliers matching your search' : 'No suppliers found. Add your first vendor!'}
          </p>
          {(isAdmin || hasPermission('suppliers', 'create')) && !searchInput && (
            <EnhancedButton onClick={openAddModal} variant="primary" icon={Plus}>
              Add Supplier
            </EnhancedButton>
          )}
        </div>
      ) : isLargeList ? (
        <VirtualizedGrid
          items={filteredSuppliers}
          columns={{ default: 1, sm: 2, lg: 3 }}
          estimateSize={() => (isMobile ? 240 : 220)}
          gap={16}
          className="min-h-[240px]"
          getKey={(supplier) => supplier._id}
          renderItem={(supplier, index) => (
            <SupplierCard
              supplier={supplier}
              index={index}
              shouldHover={motionConfig.shouldAnimate}
              openEditModal={openEditModal}
              setDeleteDialog={setDeleteDialog}
              isAdmin={isAdmin}
              hasPermission={hasPermission}
            />
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((supplier, index) => (
            <SupplierCard
              key={supplier._id}
              supplier={supplier}
              index={index}
              shouldHover={motionConfig.shouldAnimate}
              openEditModal={openEditModal}
              setDeleteDialog={setDeleteDialog}
              isAdmin={isAdmin}
              hasPermission={hasPermission}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Loader */}
      {(hasMore || isValidating) && (
        <div ref={lastElementRef} className="p-4 glass-card flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span className="text-sm">Loading more suppliers...</span>
        </div>
      )}

      {/* Supplier Modal */}
      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        supplier={editingSupplier}
        onSuccess={() => {
          invalidateCachePattern('suppliers');
          mutate();
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, supplier: null })}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete ${deleteDialog.supplier?.name}? This action cannot be undone.`}
        confirmText="Delete Supplier"
        isDestructive
      />
    </motion.div>
  );
}
