import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Plus, 
  TrendingUp, 
  Calendar, 
  Package, 
  DollarSign, 
  CheckCircle, 
  Printer, 
  XCircle, 
  Wallet, 
  CreditCard, 
  Clock, 
  AlertTriangle, 
  BookOpen, 
  Edit3, 
  Truck, 
  Eye, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw,
  ShoppingBag,
  Filter
} from 'lucide-react';
import { supplierService } from '../../services/suppliers/supplierService';
import purchaseService from '../../services/purchaseService';
import { formatCurrency, formatDate, formatPhone } from '../../utils/formatters';
import SupplierFormModal from '../../components/Suppliers/SupplierFormModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { invalidateCachePattern, useMotionConfig, useFirstVisit, useMediaQuery, useSWR } from '../../hooks';
import { VirtualizedList } from '../../components/Common/VirtualizedList';
import SupplierDetailsPageSkeleton from './SupplierDetailsPageSkeleton';

/* ─────────────────────────────────────────────────────────────
   Shared content for the printable A4 supplier ledger (matches CustomerDetailsPage pattern)
───────────────────────────────────────────────────────────── */
function PrintSupplierLedgerContent({ admin, supplier, ledgerData, filters, formatDate }) {
  const ledger = ledgerData?.ledger || [];
  const summary = ledgerData?.summary || {};

  return (
    <div className="invoice-copy" style={{ padding: '8mm', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000' }}>
      {/* Firm Header */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
              {admin?.firmName || 'BHARAT ENTERPRISES'}
            </h1>
            <p style={{ fontSize: '10px', margin: '2px 0' }}>{admin?.firmAddress || ''}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px' }}>
            {admin?.firmPhone && <p style={{ margin: '1px 0' }}>Phone: {admin.firmPhone}</p>}
            {admin?.firmGSTIN && <p style={{ margin: '1px 0' }}>GSTIN: {admin.firmGSTIN}</p>}
          </div>
        </div>
        <div style={{ textAlign: 'center', margin: '8px 0 4px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', border: '1px solid #000', padding: '2px 16px' }}>
            SUPPLIER LEDGER
          </span>
        </div>
        <p style={{ textAlign: 'center', fontSize: '11px', fontStyle: 'italic', margin: '6px 0 0' }}>
          From the Books of <strong>{admin?.firmName || 'BHARAT ENTERPRISES'}</strong>
        </p>
      </div>

      {/* Supplier Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>Supplier:</strong> M/s {supplier?.name}</p>
          {supplier?.contactPerson && <p style={{ margin: '2px 0' }}><strong>Attn:</strong> {supplier.contactPerson}</p>}
          {supplier?.address && <p style={{ margin: '2px 0' }}><strong>Address:</strong> {supplier.address}</p>}
          {supplier?.phone && <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {supplier.phone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {supplier?.gstin && <p style={{ margin: '2px 0' }}><strong>GSTIN:</strong> {supplier.gstin}</p>}
          {supplier?.state && <p style={{ margin: '2px 0' }}><strong>State:</strong> {supplier.state}</p>}
          <p style={{ margin: '2px 0' }}><strong>Period:</strong> {filters?.startDate ? formatDate(filters.startDate) : 'Beginning'} to {filters?.endDate ? formatDate(filters.endDate) : 'Today'}</p>
          <p style={{ margin: '2px 0' }}><strong>Date:</strong> {formatDate(new Date())}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', border: '1px solid #000' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', background: '#f0f0f0' }}>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '10%' }}>Date</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '12%' }}>Type</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '14%' }}>Voucher / PO #</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '12%' }}>Bill / Ref #</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', width: '22%' }}>Particulars / Description</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Debit (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Credit (₹)</th>
            <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', width: '10%' }}>Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '0.5px solid #ccc', background: '#fafafa' }}>
            <td style={{ border: '1px solid #000', padding: '3px' }}>-</td>
            <td style={{ border: '1px solid #000', padding: '3px', fontWeight: 'bold' }}>Opening Balance</td>
            <td style={{ border: '1px solid #000', padding: '3px' }}>-</td>
            <td style={{ border: '1px solid #000', padding: '3px' }}>-</td>
            <td style={{ border: '1px solid #000', padding: '3px', fontStyle: 'italic' }}>Balance brought forward</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>-</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>-</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>
              {Math.abs(summary.openingBalance || 0).toFixed(2)} {(summary.openingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
            </td>
          </tr>
          {ledger.map((entry, idx) => (
            <tr key={idx} style={{ borderBottom: '0.5px solid #ccc' }}>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{formatDate(entry.date)}</td>
              <td style={{ border: '1px solid #000', padding: '3px', fontWeight: entry.credit > 0 ? 'bold' : 'normal' }}>{entry.type}</td>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{entry.ref}</td>
              <td style={{ border: '1px solid #000', padding: '3px' }}>{entry.supplierInvoiceNumber && entry.supplierInvoiceNumber !== '-' ? entry.supplierInvoiceNumber : ''}</td>
              <td style={{ border: '1px solid #000', padding: '3px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || '-'}</td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>
                {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right' }}>
                {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
              </td>
              <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'right', fontWeight: 'bold' }}>
                {Math.abs(entry.balance || 0).toFixed(2)} {(entry.balance || 0) >= 0 ? '(Cr)' : '(Dr)'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', background: '#fafafa', borderTop: '2px solid #000', borderBottom: '1px solid #ccc' }}>
            <td colSpan="5" style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>TOTAL TRANSACTIONS</td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>
              {(summary.totalDebit || 0).toFixed(2)}
            </td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>
              {(summary.totalCredit || 0).toFixed(2)}
            </td>
            <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', opacity: 0.7 }}>-</td>
          </tr>
          <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', background: '#f0f0f0', fontSize: '10px' }}>
            <td colSpan="7" style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>CLOSING BALANCE:</td>
            <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'right' }}>
              {Math.abs(summary.closingBalance || 0).toFixed(2)}{' '}
              {(summary.closingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
        <div>
          <p>E &amp; O E</p>
          <p style={{ marginTop: '4px', fontStyle: 'italic' }}>This is a computer-generated ledger statement.</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: '30px' }}></div>
          <p style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Mobile-only collapsible wrapper for the ledger print preview (matches CustomerDetailsPage)
───────────────────────────────────────────────────────────── */
function MobilePrintPreview({ ledgerPrintRef, admin, supplier, ledgerData, filters, formatDate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden no-print-hide mt-4 px-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-200 text-sm font-medium active:scale-95 transition-transform"
      >
        <span className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-blue-400" />
          Print Preview
        </span>
        <span className="text-xs text-slate-400">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-slate-700/50 overflow-x-auto bg-white shadow-lg" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div
            ref={ledgerPrintRef}
            className="invoice-print"
            style={{ width: '210mm', fontSize: '11px', color: '#000', padding: '2mm' }}
          >
            <PrintSupplierLedgerContent
              admin={admin}
              supplier={supplier}
              ledgerData={ledgerData}
              filters={filters}
              formatDate={formatDate}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupplierDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, admin, hasPermission } = useAuth();
  const { showToast } = useToast();
  const ledgerPrintRef = useRef();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const motionConfig = useMotionConfig();
  const isFirstVisit = useFirstVisit('supplier-details');

  const [activeTab, setActiveTab] = useState('purchases');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState('all');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  // Financial Year Filter Helpers
  const getInitialFY = () => {
    const today = new Date();
    const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return {
      startDate: `${year}-04-01`,
      endDate: `${year + 1}-03-31`,
      sortOrder: 'asc'
    };
  };

  const [ledgerFilters, setLedgerFilters] = useState(getInitialFY());
  const [ledgerData, setLedgerData] = useState({ ledger: [], summary: null });
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // SWR: Supplier Details & Summary
  const { data: supplierData, isLoading: supplierLoading, mutate: mutateSupplier } = useSWR(
    `supplier-${id}`,
    () => supplierService.getSupplier(id),
    { ttl: 5 * 60 * 1000 }
  );

  // SWR: Supplier Purchases List
  const { data: purchasesData, isLoading: purchasesLoading, mutate: mutatePurchases } = useSWR(
    `supplier-purchases-${id}`,
    () => purchaseService.getPurchases({ supplierId: id, limit: 100 }),
    { ttl: 5 * 60 * 1000 }
  );

  const supplier = supplierData?.supplier || null;
  const summary = supplierData?.summary || {
    purchaseCount: 0,
    totalPurchases: 0,
    openingBalance: 0,
    balance: 0
  };

  const allPurchases = purchasesData?.purchases || [];

  const filteredPurchases = useMemo(() => {
    if (purchaseStatusFilter === 'all') return allPurchases;
    return allPurchases.filter(p => p.status === purchaseStatusFilter);
  }, [allPurchases, purchaseStatusFilter]);

  // Fetch Ledger
  const loadLedger = async () => {
    if (!id) return;
    setLedgerLoading(true);
    try {
      const data = await supplierService.getSupplierLedger(id, ledgerFilters);
      setLedgerData({
        ledger: data.ledger || [],
        summary: data.summary || null
      });
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
      showToast('Failed to load supplier ledger', 'error');
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ledger' && id) {
      loadLedger();
    }
  }, [activeTab, id, ledgerFilters.startDate, ledgerFilters.endDate, ledgerFilters.sortOrder]);

  const handlePrintLedger = () => {
    document.title = `Ledger_${supplier?.name?.replace(/\s+/g, '_') || 'Supplier'}`;
    window.print();
    setTimeout(() => { document.title = 'Bharat Enterprise - Billing System'; }, 1000);
  };

  const handleReactivate = async () => {
    if (!supplier || reactivating) return;
    setReactivating(true);
    try {
      await supplierService.updateSupplier(supplier._id, {
        ...supplier,
        isActive: true
      });
      mutateSupplier();
      invalidateCachePattern('suppliers');
      showToast('Supplier reactivated successfully', 'success');
    } catch (err) {
      showToast('Failed to reactivate supplier', 'error');
    } finally {
      setReactivating(false);
    }
  };

  // Quick Preset Handlers
  const handleSetCurrentFY = () => {
    setLedgerFilters(getInitialFY());
  };

  const handleSetThisMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
    setLedgerFilters(prev => ({
      ...prev,
      startDate: `${year}-${month}-01`,
      endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
    }));
  };

  const handleSetLast30Days = () => {
    const today = new Date();
    const prior30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    setLedgerFilters(prev => ({
      ...prev,
      startDate: prior30.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0]
    }));
  };

  const handleSetAllTime = () => {
    const today = new Date();
    setLedgerFilters(prev => ({
      ...prev,
      startDate: '2020-01-01',
      endDate: today.toISOString().split('T')[0]
    }));
  };

  const shouldAnimate = motionConfig.shouldAnimate;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldAnimate ? 0.08 : 0,
        delayChildren: shouldAnimate ? 0.1 : 0
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25 }
    }
  };

  const statusConfig = {
    COMPLETED: { icon: CheckCircle, class: 'badge-success', color: 'text-emerald-400' },
    CANCELLED: { icon: XCircle, class: 'badge-danger', color: 'text-rose-400' },
    DRAFT: { icon: Clock, class: 'badge-warning', color: 'text-amber-400' }
  };

  const paymentConfig = {
    Cash: { class: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Wallet },
    Credit: { class: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: CreditCard },
    UPI: { class: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: DollarSign },
    Bank: { class: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: DollarSign }
  };

  const tabs = [
    { id: 'purchases', label: 'Purchases', icon: FileText, count: allPurchases.length },
    { id: 'ledger', label: 'Ledger', icon: BookOpen, count: null },
    { id: 'profile', label: 'Profile & Info', icon: Truck, count: null }
  ];

  if (supplierLoading) {
    return <SupplierDetailsPageSkeleton />;
  }

  if (!supplier) {
    return (
      <div className="glass-card p-12 text-center text-slate-400 max-w-lg mx-auto mt-12">
        <XCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Supplier Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">The requested supplier does not exist or has been removed.</p>
        <Link to="/suppliers" className="btn btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </Link>
      </div>
    );
  }

  const currentYear = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial={isFirstVisit ? 'hidden' : false}
        animate="visible"
        className="space-y-6 no-print"
      >
        {/* Top Header Card */}
        <motion.div variants={itemVariants} className="glass-card p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/suppliers')}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Back to Suppliers"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{supplier.name}</h1>
                  {supplier.isActive === false ? (
                    <span className="badge badge-danger text-xs">Inactive</span>
                  ) : (
                    <span className="badge badge-success text-xs">Active</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400">
                  {supplier.contactPerson && (
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-400" />
                      {supplier.contactPerson}
                    </span>
                  )}
                  {supplier.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      {formatPhone(supplier.phone)}
                    </span>
                  )}
                  {supplier.gstin && (
                    <span className="flex items-center gap-1.5 font-mono">
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                      {supplier.gstin}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
              {supplier.isActive === false ? (
                (isAdmin || hasPermission('suppliers', 'edit')) && (
                  <button
                    onClick={handleReactivate}
                    disabled={reactivating}
                    className="btn btn-secondary text-sm flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${reactivating ? 'animate-spin' : ''}`} />
                    Reactivate Supplier
                  </button>
                )
              ) : (
                <>
                  {(isAdmin || hasPermission('purchases', 'create')) && (
                    <Link
                      to={`/purchases/new?supplierId=${supplier._id}`}
                      className="btn btn-primary text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      New Purchase
                    </Link>
                  )}
                  {(isAdmin || hasPermission('suppliers', 'edit')) && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="btn btn-secondary text-sm flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit Supplier
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* 4 Summary Stats Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Total Purchases</p>
                <p className="text-2xl font-bold text-white">{summary.purchaseCount}</p>
              </div>
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Total Purchased (₹)</p>
                <p className="text-2xl font-bold text-emerald-400">{formatCurrency(summary.totalPurchases)}</p>
              </div>
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Opening Balance</p>
                <p className="text-2xl font-bold text-amber-400">{formatCurrency(summary.openingBalance)}</p>
              </div>
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5 group hover:-translate-y-1 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Net Balance Payable</p>
                <p className={`text-2xl font-bold ${summary.balance > 0 ? 'text-teal-400' : 'text-slate-200'}`}>
                  {formatCurrency(summary.balance)}
                </p>
              </div>
              <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div variants={itemVariants} className="flex border-b border-slate-700/50 gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* TAB 1: PURCHASES */}
          {activeTab === 'purchases' && (
            <motion.div
              key="purchases-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Status Filter Bar */}
              <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  {['all', 'COMPLETED', 'CANCELLED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setPurchaseStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                        purchaseStatusFilter === st
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  Showing {filteredPurchases.length} of {allPurchases.length} purchases
                </p>
              </div>

              {filteredPurchases.length === 0 ? (
                <div className="glass-card p-12 text-center text-slate-400">
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-lg">No purchases recorded for this supplier</p>
                  {(isAdmin || hasPermission('purchases', 'create')) && (
                    <Link
                      to={`/purchases/new?supplierId=${supplier._id}`}
                      className="btn btn-primary inline-flex items-center gap-2 mt-4"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Purchase
                    </Link>
                  )}
                </div>
              ) : isDesktop ? (
                /* Desktop Table */
                <div className="glass-card overflow-x-auto min-w-[750px]">
                  <div className="grid grid-cols-[130px_110px_130px_90px_130px_120px_110px_100px] items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-800/50">
                    <div>Purchase #</div>
                    <div>Date</div>
                    <div>Bill / Ref #</div>
                    <div>Items</div>
                    <div>Amount</div>
                    <div>Payment</div>
                    <div>Status</div>
                    <div className="text-right">Action</div>
                  </div>
                  <div>
                    <VirtualizedList
                      items={filteredPurchases}
                      estimateSize={() => 64}
                      getKey={(p) => p._id}
                      itemClassName="border-b border-slate-700/50 hover:bg-slate-800/40"
                      renderItem={(p) => {
                        const isCancelled = p.status === 'CANCELLED';
                        const StatusIcon = statusConfig[p.status]?.icon || ShoppingBag;
                        const PaymentIcon = paymentConfig[p.paymentType]?.icon || CreditCard;

                        return (
                          <div className={`grid grid-cols-[130px_110px_130px_90px_130px_120px_110px_100px] items-center px-4 py-3 text-sm transition-colors ${
                            isCancelled ? 'bg-rose-500/10 text-rose-400' : ''
                          }`}>
                            <div 
                              onClick={() => navigate(`/purchases/${p._id}`)} 
                              className="font-medium text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1.5"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              {p.purchaseNumber}
                            </div>
                            <div className="text-slate-300">{formatDate(p.purchaseDate)}</div>
                            <div className="text-slate-400 text-xs font-mono">{p.supplierInvoiceNumber || '-'}</div>
                            <div className="text-slate-300">{p.items?.length || 0} items</div>
                            <div className="font-bold text-emerald-400">{formatCurrency(p.totals?.grandTotal)}</div>
                            <div>
                              <span className={`badge ${paymentConfig[p.paymentType]?.class || 'badge-info'} text-xs inline-flex items-center gap-1`}>
                                <PaymentIcon className="w-3 h-3" />
                                {p.paymentType || 'Credit'}
                              </span>
                            </div>
                            <div>
                              <span className={`badge ${statusConfig[p.status]?.class || 'badge-info'} text-xs inline-flex items-center gap-1`}>
                                <StatusIcon className="w-3 h-3" />
                                {p.status}
                              </span>
                            </div>
                            <div className="text-right">
                              <button
                                onClick={() => navigate(`/purchases/${p._id}`)}
                                className="btn btn-secondary py-1 px-2.5 text-xs inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* Mobile Cards */
                <div className="space-y-3">
                  {filteredPurchases.map((p) => {
                    const isCancelled = p.status === 'CANCELLED';
                    const StatusIcon = statusConfig[p.status]?.icon || ShoppingBag;

                    return (
                      <div
                        key={p._id}
                        onClick={() => navigate(`/purchases/${p._id}`)}
                        className={`glass-card p-4 space-y-3 cursor-pointer hover:border-slate-600 transition-colors ${
                          isCancelled ? 'bg-rose-500/10 border-rose-500/20' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-white text-base">{p.purchaseNumber}</p>
                            <p className="text-xs text-slate-400">{formatDate(p.purchaseDate)}</p>
                          </div>
                          <span className={`badge ${statusConfig[p.status]?.class || 'badge-info'} text-xs`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {p.status}
                          </span>
                        </div>

                        <div className="flex justify-between items-center py-2 border-y border-slate-700/50 text-sm">
                          <span className="text-slate-400">Ref: {p.supplierInvoiceNumber || '-'}</span>
                          <span className="font-bold text-emerald-400 text-base">{formatCurrency(p.totals?.grandTotal)}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-400">
                          <span>{p.items?.length || 0} items</span>
                          <span>Mode: {p.paymentType || 'Credit'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: STATEMENT / LEDGER */}
          {activeTab === 'ledger' && (
            <motion.div
              key="ledger-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Filter and Control Bar */}
              <div className="glass-card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                      Supplier Ledger Statement
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Complete financial audit trail of purchase bills and balance history</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <motion.button
                      onClick={handlePrintLedger}
                      className="btn btn-secondary flex items-center gap-2 text-sm active:scale-95 transition-transform"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Printer className="w-4 h-4 text-blue-400" />
                      <span>Print Ledger</span>
                    </motion.button>
                    <button
                      onClick={loadLedger}
                      disabled={ledgerLoading}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                      title="Refresh Ledger"
                    >
                      <RefreshCw className={`w-4 h-4 ${ledgerLoading ? 'animate-spin text-blue-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Preset Buttons & Date Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5 text-blue-400" /> Presets:
                    </span>
                    <button
                      onClick={handleSetCurrentFY}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                    >
                      FY {currentYear}-{String(currentYear + 1).slice(2)}
                    </button>
                    <button
                      onClick={handleSetThisMonth}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                    >
                      This Month
                    </button>
                    <button
                      onClick={handleSetLast30Days}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                    >
                      Last 30 Days
                    </button>
                    <button
                      onClick={handleSetAllTime}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/60"
                    >
                      All Time
                    </button>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">From:</span>
                      <input
                        type="date"
                        value={ledgerFilters.startDate}
                        onChange={(e) => setLedgerFilters(f => ({ ...f, startDate: e.target.value }))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">To:</span>
                      <input
                        type="date"
                        value={ledgerFilters.endDate}
                        onChange={(e) => setLedgerFilters(f => ({ ...f, endDate: e.target.value }))}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <button
                      onClick={() => setLedgerFilters(f => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <span>Sort:</span>
                      <span className="text-blue-400 font-semibold">{ledgerFilters.sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Ledger Summary Cards */}
              {ledgerData.summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Opening Balance</p>
                    <p className="text-xl font-bold text-amber-400">
                      {formatCurrency(Math.abs(ledgerData.summary.openingBalance || 0))}
                      <span className="text-xs ml-1 font-normal opacity-80">
                        {(ledgerData.summary.openingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
                      </span>
                    </p>
                  </div>

                  <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Total Purchases (Credit)</p>
                    <p className="text-xl font-bold text-emerald-400">{formatCurrency(ledgerData.summary.totalCredit || 0)}</p>
                  </div>

                  <div className="glass-card p-4 border border-blue-500/20 bg-blue-500/5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Total Payments / Debit</p>
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(ledgerData.summary.totalDebit || 0)}</p>
                  </div>

                  <div className="glass-card p-4 border border-teal-500/20 bg-teal-500/5">
                    <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Closing Balance Payable</p>
                    <p className={`text-xl font-bold ${(ledgerData.summary.closingBalance || 0) > 0 ? 'text-teal-400' : 'text-slate-200'}`}>
                      {formatCurrency(Math.abs(ledgerData.summary.closingBalance || 0))}
                      <span className="text-xs ml-1 font-normal opacity-80">
                        {(ledgerData.summary.closingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Ledger Table (Desktop) & Cards (Mobile) */}
              {ledgerLoading ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-slate-400">Loading supplier ledger...</p>
                </div>
              ) : ledgerData.ledger.length === 0 ? (
                <div className="glass-card p-12 text-center text-slate-400">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-lg text-white">No transactions found</p>
                  <p className="text-sm mt-1">No purchase records or adjustments match the selected date range.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block glass-card overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="p-3.5">Date</th>
                          <th className="p-3.5">Type</th>
                          <th className="p-3.5">Voucher / PO #</th>
                          <th className="p-3.5">Bill / Ref #</th>
                          <th className="p-3.5">Particulars / Details</th>
                          <th className="p-3.5 text-right">Debit (Paid)</th>
                          <th className="p-3.5 text-right">Credit (Purchased)</th>
                          <th className="p-3.5 text-right">Balance (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/40">
                        <tr className="bg-slate-800/30">
                          <td className="p-3.5 text-slate-400">-</td>
                          <td className="p-3.5 font-semibold text-amber-400">Opening Balance</td>
                          <td className="p-3.5 text-slate-500">-</td>
                          <td className="p-3.5 text-slate-500">-</td>
                          <td className="p-3.5 text-slate-400 italic">Balance brought forward</td>
                          <td className="p-3.5 text-right text-slate-500">—</td>
                          <td className="p-3.5 text-right text-slate-500">—</td>
                          <td className="p-3.5 text-right font-bold text-white">
                            {formatCurrency(Math.abs(ledgerData.summary?.openingBalance || 0))}
                            <span className="text-xs ml-1 text-slate-400">
                              {(ledgerData.summary?.openingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
                            </span>
                          </td>
                        </tr>
                        {ledgerData.ledger.map((entry, idx) => {
                          const isPurchase = entry.type === 'Purchase';
                          return (
                            <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3.5 text-slate-300 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                  {formatDate(entry.date)}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${
                                  isPurchase ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                }`}>
                                  <ArrowUpRight className="w-3 h-3" />
                                  {entry.type}
                                </span>
                              </td>
                              <td className="p-3.5 font-medium">
                                {entry.linkId ? (
                                  <Link to={`/purchases/${entry.linkId}`} className="text-blue-400 hover:text-blue-300 hover:underline">
                                    {entry.ref}
                                  </Link>
                                ) : (
                                  <span className="text-white">{entry.ref}</span>
                                )}
                              </td>
                              <td className="p-3.5 text-slate-300 font-mono text-xs">
                                {entry.supplierInvoiceNumber || '-'}
                              </td>
                              <td className="p-3.5 text-slate-400 text-xs max-w-[260px] truncate" title={entry.description}>
                                {entry.description || '-'}
                              </td>
                              <td className="p-3.5 text-right font-medium">
                                {entry.debit > 0 ? (
                                  <span className="text-blue-400">{formatCurrency(entry.debit)}</span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right font-medium">
                                {entry.credit > 0 ? (
                                  <span className="text-emerald-400 font-semibold">{formatCurrency(entry.credit)}</span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td className="p-3.5 text-right font-bold text-white">
                                {formatCurrency(Math.abs(entry.balance || 0))}
                                <span className="text-xs ml-1 text-slate-400">
                                  {(entry.balance || 0) >= 0 ? '(Cr)' : '(Dr)'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-600 bg-slate-800/90 font-bold text-sm">
                          <td colSpan="5" className="p-4 text-right text-slate-300 uppercase">Closing Balance Payable:</td>
                          <td className="p-4 text-right text-blue-400 opacity-80">{formatCurrency(ledgerData.summary?.totalDebit || 0)}</td>
                          <td className="p-4 text-right text-emerald-400 opacity-80">{formatCurrency(ledgerData.summary?.totalCredit || 0)}</td>
                          <td className="p-4 text-right text-teal-300 text-base">
                            {formatCurrency(Math.abs(ledgerData.summary?.closingBalance || 0))}
                            <span className="text-xs ml-1 font-normal">
                              {(ledgerData.summary?.closingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3">
                    <div className="glass-card p-4 bg-slate-800/30 border border-amber-500/20">
                      <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                        <span>Opening Balance</span>
                        <span className="text-amber-400 font-semibold">Brought Forward</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-white">
                        <span>Starting Balance:</span>
                        <span>{formatCurrency(Math.abs(ledgerData.summary?.openingBalance || 0))} {(ledgerData.summary?.openingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}</span>
                      </div>
                    </div>

                    {ledgerData.ledger.map((entry, idx) => (
                      <div key={idx} className="glass-card p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            {entry.linkId ? (
                              <Link to={`/purchases/${entry.linkId}`} className="font-bold text-blue-400 text-base hover:underline">
                                {entry.ref}
                              </Link>
                            ) : (
                              <p className="font-bold text-white text-base">{entry.ref}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.date)}</p>
                          </div>
                          <span className="badge badge-success text-xs inline-flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            {entry.type}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 flex justify-between items-center py-2 border-y border-slate-700/50">
                          <span>Bill: <span className="font-mono text-slate-300">{entry.supplierInvoiceNumber || '-'}</span></span>
                          <span className="max-w-[180px] truncate text-right">{entry.description || '-'}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
                          <div>
                            <span className="text-slate-500 block">Debit</span>
                            <span className="font-medium text-slate-300">{entry.debit > 0 ? formatCurrency(entry.debit) : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Credit</span>
                            <span className="font-bold text-emerald-400">{entry.credit > 0 ? formatCurrency(entry.credit) : '—'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Balance</span>
                            <span className="font-bold text-white">{formatCurrency(Math.abs(entry.balance || 0))} {(entry.balance || 0) >= 0 ? '(Cr)' : '(Dr)'}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="glass-card p-4 bg-slate-800/90 border border-slate-600">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-slate-300">Closing Balance:</span>
                        <span className="text-teal-300 text-base">{formatCurrency(Math.abs(ledgerData.summary?.closingBalance || 0))} {(ledgerData.summary?.closingBalance || 0) >= 0 ? '(Cr)' : '(Dr)'}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* TAB 3: PROFILE & ACCOUNT DETAILS */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-bold text-white border-b border-slate-700/50 pb-3 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-400" />
                  Supplier Overview
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Supplier Name</span>
                    <span className="text-white font-medium">{supplier.name}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Contact Person</span>
                    <span className="text-white font-medium">{supplier.contactPerson || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">GSTIN</span>
                    <span className="text-white font-mono uppercase">{supplier.gstin || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Phone</span>
                    <span className="text-white">{formatPhone(supplier.phone) || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Email</span>
                    <span className="text-white">{supplier.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Address</span>
                    <span className="text-white text-right max-w-[60%]">{supplier.address || 'N/A'}{supplier.state ? `, ${supplier.state}` : ''}</span>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-bold text-white border-b border-slate-700/50 pb-3 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                  Terms & Financials
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Payment Terms</span>
                    <span className="text-white font-medium">{supplier.paymentTerms || 'Standard Terms'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Opening Balance</span>
                    <span className="text-amber-400 font-bold">{formatCurrency(supplier.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Account Created</span>
                    <span className="text-slate-300">{formatDate(supplier.createdAt)}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-800">
                    <span className="text-slate-400">Status</span>
                    <span className={supplier.isActive !== false ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {supplier.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {supplier.notes && (
                    <div className="pt-2">
                      <span className="text-slate-400 block mb-1">Notes:</span>
                      <p className="text-slate-300 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 text-xs">
                        {supplier.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SupplierFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          supplier={supplier}
          onSuccess={() => {
            mutateSupplier();
            invalidateCachePattern('suppliers');
          }}
        />
      </motion.div>

      {/* Printable Ledger Preview (visible on screen + used for print, matching CustomerDetailsPage) */}
      {ledgerData.ledger.length > 0 && supplier && activeTab === 'ledger' && (
        <>
          {/* Desktop: full A4 preview — hidden below lg */}
          <div className="hidden lg:flex justify-center no-print-hide mt-8">
            <motion.div
              ref={ledgerPrintRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="invoice-print bg-white border-2 border-slate-300 shadow-lg"
              style={{ width: '210mm', maxWidth: '100%', fontSize: '11px', color: '#000000', margin: '0 auto', padding: '2mm' }}
            >
              <PrintSupplierLedgerContent
                admin={admin}
                supplier={supplier}
                ledgerData={ledgerData}
                filters={ledgerFilters}
                formatDate={formatDate}
              />
            </motion.div>
          </div>

          {/* Mobile: collapsible print preview */}
          <MobilePrintPreview
            ledgerPrintRef={ledgerPrintRef}
            admin={admin}
            supplier={supplier}
            ledgerData={ledgerData}
            filters={ledgerFilters}
            formatDate={formatDate}
          />
        </>
      )}
    </>
  );
}
