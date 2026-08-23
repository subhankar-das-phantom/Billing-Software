import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  Users,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  ArrowRight,
  Loader2,
  User,
  CreditCard,
  AlertCircle,
  SlidersHorizontal
} from 'lucide-react';
import { customerService } from '../../services/customers/customerService';
import { formatCurrency, formatPhone } from '../../utils/formatters';
import { getCustomerTheme } from '../../utils/customerTheme';
import { CustomersPageSkeleton } from './CustomersPageSkeleton';
import Modal from '../../components/Common/Modals/Modal';
import ConfirmDialog from '../../components/Common/Dialogs/ConfirmDialog';
import EnhancedButton from '../../components/Common/Buttons/EnhancedButton';
import { VirtualizedGrid } from '../../components/Common/VirtualizedList';
import { useToast } from '../../contexts/ToastContext';
import { useDebounce, useMotionConfig, useFirstVisit, useSWR, invalidateCachePattern, useTransitionDelay, useMediaQuery, useCustomerFilters } from '../../hooks';
import CustomerFilterPanel from './CustomerFilterPanel';

const initialCustomerState = {
  customerName: '',
  address: '',
  phone: '',
  email: '',
  gstin: '',
  dlNo: '',
  customerCode: '',
  isActive: true
};

const LARGE_CUSTOMER_LIST_THRESHOLD = 24;

const CustomerCard = memo(function CustomerCard({
  customer,
  index,
  denseMode,
  shouldHover,
  shouldStagger,
  openEditModal,
  setDeleteDialog
}) {
  const theme = getCustomerTheme(customer.theme);

  return (
    <div
      className={`glass-card p-5 group ${shouldHover ? 'cursor-pointer hover:bg-slate-800/80 transition-colors hover:-translate-y-1' : ''
        } ${customer.isActive === false ? 'opacity-75 grayscale-[0.2] border-red-500/20' : ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center relative overflow-hidden shadow-lg ${theme.shadow} flex-shrink-0`}>
            <span className="text-white font-bold text-lg">
              {customer.customerName?.charAt(0)}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-white truncate">
                {customer.customerName}
              </h3>
              {customer.isActive === false && (
                <span className="px-2 py-0.5 rounded flex items-center gap-1 bg-red-500/10 text-red-400 text-[10px] font-semibold tracking-wider uppercase border border-red-500/20">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {formatPhone(customer.phone)}
            </p>
          </div>
        </div>

        <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(customer);
            }}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialog({ open: true, customer });
            }}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm mb-4">
        {customer.address && (
          <p className="text-slate-400 line-clamp-2 flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-500" />
            <span>{customer.address}</span>
          </p>
        )}
        {customer.gstin && (
          <p className="text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">GST:</span>
            <span>{customer.gstin}</span>
          </p>
        )}
        {customer.email && (
          <p className="text-slate-400 flex items-center gap-2 truncate">
            <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="truncate">{customer.email}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Outstanding</p>
            <p className="font-semibold text-emerald-400">
              {formatCurrency(
                customer.calculatedOutstanding ?? customer.outstandingBalance ?? 0
              )}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500 mb-1">
            {customer.invoiceCount || 0} Invoices
          </p>
          <Link
            to={`/customers/${customer._id}`}
            className="text-sm text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 font-medium"
          >
            View Details
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
});

export default function CustomersPage() {
  // ── Filter state (URL-synced) ─────────────────────────────────
  const {
    filters,
    apiParams,
    activeFilterCount,
    isFiltered,
    applyFilters,
    resetFilters,
    setSearch,
    search,
  } = useCustomerFilters();

  const [searchInput, setSearchInput] = useState(search);
  const [debouncedSearch, flushSearch] = useDebounce(searchInput);
  const [page, setPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState(initialCustomerState);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, customer: null });
  const { success, error } = useToast();
  const observer = useRef(null);

  // Sync debounced search to URL params
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  // Sync searchInput when URL search changes externally (e.g. browser back)
  useEffect(() => {
    setSearchInput(prev => prev !== search ? search : prev);
  }, [search]);

  // Track which SWR key the latest accumulated data belongs to,
  // so we can discard stale responses from previous search terms.
  const activeSWRKeyRef = useRef('');

  // Adaptive motion configuration
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('customers');
  const transitionReady = useTransitionDelay(250, isFirstVisit);
  const isDesktopGrid = useMediaQuery('(min-width: 1024px)');
  const isTabletGrid = useMediaQuery('(min-width: 768px)');

  // Build the SWR cache key — includes all filter params for correct caching
  const filterKey = JSON.stringify(apiParams);
  const swrKey = `customers-${filterKey}-${page}`;

  // SWR: Instant cached data + background revalidation
  const { data, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => customerService.getCustomers({ ...apiParams, page, limit: 25, includeOutstanding: true }),
    { ttl: 5 * 60 * 1000 } // 5 minute cache
  );

  // Seed accumulatedCustomers & dataReady from SWR cache so that
  // navigating back to this page doesn't flash "Searching customers..."
  const [accumulatedCustomers, setAccumulatedCustomers] = useState(() => {
    return data?.customers ?? [];
  });
  const [dataReady, setDataReady] = useState(() => {
    return !!(data?.customers);
  });

  // Extract customers from SWR response
  const hasMore = data?.pages ? page < data.pages : false;

  // Accumulate customers as new pages are loaded.
  // Guard: only accept data that matches the CURRENT SWR key to
  // prevent stale responses from a previous search term leaking in.
  useEffect(() => {
    if (!data?.customers) return;

    // If the key changed since we last accumulated, this data belongs
    // to a different (older) request — ignore it.
    if (activeSWRKeyRef.current !== swrKey) return;

    if (page === 1) {
      setAccumulatedCustomers(data.customers);
    } else {
      setAccumulatedCustomers(prev => {
        const existingIds = new Set(prev.map(c => c._id));
        const newCustomers = data.customers.filter(c => !existingIds.has(c._id));
        return [...prev, ...newCustomers];
      });
    }

    // Mark that we've received real data for this search term.
    setDataReady(true);
  }, [data, page, swrKey]);

  // Reset pagination when filters change.
  // DON'T clear accumulatedCustomers here — that creates a window where
  // customers.length === 0 and the empty-state flashes. Instead, let
  // the data-arrival effect above replace accumulatedCustomers atomically.
  useEffect(() => {
    setPage(1);
    setDataReady(false);
    activeSWRKeyRef.current = `customers-${filterKey}-1`;
  }, [filterKey]);

  // Also update the active key when page increments (infinite scroll)
  useEffect(() => {
    activeSWRKeyRef.current = swrKey;
  }, [swrKey]);

  // Intersection Observer for Infinite Scroll
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

  // Extract customers from accumulated state
  const customers = accumulatedCustomers;
  // Only show full-page loader on the very first load — never during search
  // (PageLoader replaces the entire UI including the search input, eating keystrokes)
  const loading = isLoading && customers.length === 0 && page === 1 && !search && !searchInput && !isFiltered;

  const handleSearch = (e) => {
    e.preventDefault();
    flushSearch();
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData(initialCustomerState);
    setModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      customerName: customer.customerName || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gstin: customer.gstin || '',
      dlNo: customer.dlNo || '',
      customerCode: customer.customerCode || '',
      isActive: customer.isActive ?? true
    });
    setModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName || !formData.phone) {
      error('Please fill customer name and phone');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer._id, formData);
        success('Customer updated successfully');
      } else {
        await customerService.createCustomer(formData);
        success('Customer created successfully');
      }

      setModalOpen(false);
      // Invalidate customers cache and revalidate
      invalidateCachePattern('customers');
      setPage(1);
      setDataReady(false);
      setAccumulatedCustomers([]);
      mutate();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await customerService.deleteCustomer(deleteDialog.customer._id);
      success('Customer deleted successfully');
      setDeleteDialog({ open: false, customer: null });
      // Invalidate customers cache and revalidate
      invalidateCachePattern('customers');
      setPage(1);
      setDataReady(false);
      setAccumulatedCustomers([]);
      mutate();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const formItemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: motionConfig.shouldStagger ? i * 0.05 : 0,
        type: 'spring',
        stiffness: 300,
        damping: 24
      }
    })
  };

  const denseMode = customers.length > LARGE_CUSTOMER_LIST_THRESHOLD;
  const shouldStaggerCards = motionConfig.shouldStagger && !denseMode;
  const shouldHoverCards = motionConfig.shouldHover && !denseMode;
  const customerGridLanes = isDesktopGrid ? 3 : isTabletGrid ? 2 : 1;

  if (loading) {
    return <CustomersPageSkeleton />;
  }

  return (
    <motion.div
      initial={isFirstVisit ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-12"
    >
      {/* Header */}
      <motion.div
        initial={isFirstVisit ? { opacity: 0, y: -20 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 justify-between mb-2"
      >
        {/* Search Form */}
        <motion.form
          onSubmit={handleSearch}
          className="flex gap-2 flex-1 max-w-md relative"
          animate={!motionConfig.isMobile && searchFocused ? { scale: 1.02 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 400 }}
        >
          <motion.div className="relative flex-1">
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search by name, phone, GSTIN..."
              className="input pl-10 w-full"
            />
            <AnimatePresence>
              {searchInput && (
                <motion.button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.button
            type="submit"
            className="btn btn-secondary"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isValidating}
          >
            {isValidating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </motion.button>
        </motion.form>

        {/* Filter & Add buttons */}
        <motion.div
          initial={isFirstVisit ? { opacity: 0, x: 20 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          {/* Filter Button */}
          <motion.button
            type="button"
            onClick={() => setFilterPanelOpen(true)}
            className={`relative btn ${
              isFiltered
                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                : 'btn-secondary'
            } flex items-center gap-2`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-blue-500/40"
              >
                {activeFilterCount}
              </motion.span>
            )}
          </motion.button>

          <EnhancedButton
            onClick={openCreateModal}
            icon={Plus}
          >
            Add Customer
          </EnhancedButton>
        </motion.div>
      </motion.div>

      {/* Customers Grid */}
      {/* Only show empty state when data has actually been received for the current
          search term (dataReady). This prevents the "no results" message from flashing
          while SWR is still fetching or revalidating. */}
      <AnimatePresence>
        {!transitionReady ? (
          <div className="glass-card p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : dataReady && customers.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-12 text-center"
          >
            <motion.div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-800 mb-6"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
            >
              <Users className="w-10 h-10 text-slate-400" />
            </motion.div>
            <motion.p
              className="text-slate-400 mb-6 text-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {search ? 'No customers found for your search.' : 'No customers found. Add your first customer!'}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <EnhancedButton
                onClick={openCreateModal}
                icon={Plus}
              >
                Add Customer
              </EnhancedButton>
            </motion.div>
          </motion.div>
        ) : customers.length > 0 ? (
          <VirtualizedGrid
            items={customers}
            lanes={customerGridLanes}
            gap={16}
            estimateSize={() => 245}
            getKey={(customer) => customer._id}
            className="min-h-[245px]"
            renderItem={(customer, index) => (
              <CustomerCard
                customer={customer}
                index={index}
                denseMode={denseMode}
                shouldHover={shouldHoverCards}
                shouldStagger={shouldStaggerCards}
                openEditModal={openEditModal}
                setDeleteDialog={setDeleteDialog}
              />
            )}
          />
        ) : null}
      </AnimatePresence>

      {/* Inline loading indicator during search (not the full-page PageLoader) */}
      {!dataReady && customers.length === 0 && (search || isValidating) && (
        <div className="flex justify-center items-center p-8 glass-card">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-3" />
          <span className="text-sm font-medium text-slate-400">Searching customers...</span>
        </div>
      )}

      {/* Infinite Scroll Loading Indicator */}
      {hasMore && (
        <div ref={lastElementRef} className="flex justify-center items-center p-4 my-4 h-16">
          {isValidating && (
            <div className="flex items-center glass-card px-6 py-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-3" />
              <span className="text-sm font-medium text-slate-400">Loading more...</span>
            </div>
          )}
        </div>
      )}

      {/* Customer Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
          >
            {/* Customer Name */}
            <motion.div
              className="md:col-span-2"
              custom={0}
              variants={formItemVariants}
            >
              <label className="label flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Customer Name *
              </label>
              <input
                type="text"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                className="input"
                placeholder="Enter customer name"
                required
              />
            </motion.div>

            {/* Phone */}
            <motion.div custom={1} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="input"
                placeholder="10-digit phone number"
                required
              />
            </motion.div>

            {/* Email */}
            <motion.div custom={2} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="input"
                placeholder="email@example.com"
              />
            </motion.div>

            {/* Address */}
            <motion.div
              className="md:col-span-2"
              custom={3}
              variants={formItemVariants}
            >
              <label className="label flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="input"
                placeholder="Full address"
                rows={2}
              />
            </motion.div>

            {/* GSTIN */}
            <motion.div custom={4} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                GSTIN
              </label>
              <input
                type="text"
                name="gstin"
                value={formData.gstin}
                onChange={handleInputChange}
                className="input"
                placeholder="GST Number"
              />
            </motion.div>

            {/* DL Number */}
            <motion.div custom={5} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                DL Number
              </label>
              <input
                type="text"
                name="dlNo"
                value={formData.dlNo}
                onChange={handleInputChange}
                className="input"
                placeholder="Drug License Number"
              />
            </motion.div>

            {/* Customer Code */}
            <motion.div custom={6} variants={formItemVariants}>
              <label className="label flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                Customer Code
              </label>
              <input
                type="text"
                name="customerCode"
                value={formData.customerCode}
                onChange={handleInputChange}
                className="input"
                placeholder="Internal code (optional)"
              />
            </motion.div>

            {/* Active Status (Only when editing) */}
            {editingCustomer && (
              <motion.div custom={7} variants={formItemVariants} className="md:col-span-2 flex items-center justify-between p-4 glass-card mt-2">
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Active Customer</h4>
                  <p className="text-xs text-slate-400 mt-1">Inactive customers cannot have new invoices, payments, or manual entries created.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </label>
              </motion.div>
            )}
          </motion.div>

          {/* Form Actions */}
          <motion.div
            className="flex justify-end gap-3 pt-6 mt-2 border-t border-slate-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <motion.button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel
            </motion.button>
            <EnhancedButton
              type="submit"
              disabled={saving}
              icon={saving ? Loader2 : null}
            >
              {saving ? 'Saving...' : (editingCustomer ? 'Update Customer' : 'Add Customer')}
            </EnhancedButton>
          </motion.div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, customer: null })}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${deleteDialog.customer?.customerName}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Filter Panel */}
      <CustomerFilterPanel
        isOpen={filterPanelOpen}
        onClose={() => setFilterPanelOpen(false)}
        onApply={applyFilters}
        onReset={resetFilters}
        currentFilters={filters}
      />
    </motion.div>
  );
}
