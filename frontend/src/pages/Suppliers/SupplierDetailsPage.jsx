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
  ShoppingBag
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
   Shared content for the printable A4 supplier ledger
───────────────────────────────────────────────────────────── */
function PrintSupplierLedgerContent({ admin, supplier, purchases = [], summary, formatDate }) {
  const openingBalance = supplier?.openingBalance || 0;
  let runningBalance = openingBalance;

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
            SUPPLIER STATEMENT OF ACCOUNT
          </span>
        </div>
        <p style={{ textAlign: 'center', fontSize: '11px', fontStyle: 'italic', margin: '6px 0 0' }}>
          Statement generated from <strong>{admin?.firmName || 'BHARAT ENTERPRISES'}</strong>
        </p>
      </div>

      {/* Supplier Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '10px' }}>
        <div>
          <p style={{ margin: '2px 0' }}><strong>Supplier:</strong> M/s {supplier?.name}</p>
          {supplier?.address && <p style={{ margin: '2px 0' }}><strong>Address:</strong> {supplier.address}</p>}
          {supplier?.phone && <p style={{ margin: '2px 0' }}><strong>Phone:</strong> {supplier.phone}</p>}
        </div>
        <div style={{ textAlign: 'right' }}>
          {supplier?.gstin && <p style={{ margin: '2px 0' }}><strong>GSTIN:</strong> {supplier.gstin}</p>}
          {supplier?.state && <p style={{ margin: '2px 0' }}><strong>State:</strong> {supplier.state}</p>}
          <p style={{ margin: '2px 0' }}><strong>Date:</strong> {formatDate(new Date())}</p>
        </div>
      </div>

      {/* Ledger Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginTop: '8px' }}>
        <thead>
          <tr style={{ background: '#f0f0f0', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}>
            <th style={{ padding: '4px', textAlign: 'left' }}>Date</th>
            <th style={{ padding: '4px', textAlign: 'left' }}>Particulars</th>
            <th style={{ padding: '4px', textAlign: 'center' }}>Bill / Ref #</th>
            <th style={{ padding: '4px', textAlign: 'right' }}>Purchase (Dr)</th>
            <th style={{ padding: '4px', textAlign: 'right' }}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px dashed #ccc' }}>
            <td style={{ padding: '4px' }}>-</td>
            <td style={{ padding: '4px' }}><strong>Opening Balance</strong></td>
            <td style={{ padding: '4px', textAlign: 'center' }}>-</td>
            <td style={{ padding: '4px', textAlign: 'right' }}>-</td>
            <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(openingBalance)}</td>
          </tr>
          {purchases.filter(p => p.status !== 'CANCELLED').map((p) => {
            const amount = p.totals?.grandTotal || 0;
            runningBalance += amount;
            return (
              <tr key={p._id} style={{ borderBottom: '1px dashed #ccc' }}>
                <td style={{ padding: '4px' }}>{formatDate(p.purchaseDate)}</td>
                <td style={{ padding: '4px' }}>Purchase Bill #{p.purchaseNumber}</td>
                <td style={{ padding: '4px', textAlign: 'center' }}>{p.supplierInvoiceNumber || '-'}</td>
                <td style={{ padding: '4px', textAlign: 'right' }}>{formatCurrency(amount)}</td>
                <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(runningBalance)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', background: '#f5f5f5' }}>
            <td colSpan="3" style={{ padding: '6px', textAlign: 'right' }}>CLOSING BALANCE PAYABLE:</td>
            <td style={{ padding: '6px', textAlign: 'right' }}>{formatCurrency(summary?.totalPurchases || 0)}</td>
            <td style={{ padding: '6px', textAlign: 'right', color: '#000', fontSize: '11px' }}>{formatCurrency(summary?.balance || runningBalance)}</td>
          </tr>
        </tfoot>
      </table>
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

  const handlePrintStatement = () => {
    document.title = `Statement_${supplier?.name?.replace(/\s+/g, '_') || 'Supplier'}`;
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

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: motionConfig.isMobile ? 'tween' : 'spring',
        duration: motionConfig.isMobile ? 0.2 : undefined,
        stiffness: motionConfig.isMobile ? undefined : 300,
        damping: motionConfig.isMobile ? undefined : 24
      }
    }
  };

  const statusConfig = {
    COMPLETED: { icon: CheckCircle, class: 'badge-success', color: 'text-emerald-400' },
    DRAFT: { icon: ShoppingBag, class: 'badge-info', color: 'text-blue-400' },
    CANCELLED: { icon: XCircle, class: 'badge-danger', color: 'text-rose-400' }
  };

  const paymentConfig = {
    Cash: { icon: DollarSign, class: 'badge-success' },
    Credit: { icon: CreditCard, class: 'badge-info' },
    'Bank Transfer': { icon: CreditCard, class: 'badge-purple' },
    UPI: { icon: CreditCard, class: 'badge-teal' },
    Cheque: { icon: CreditCard, class: 'badge-amber' }
  };

  const tabs = [
    { id: 'purchases', label: 'Purchases & Bills', icon: FileText, count: summary.purchaseCount },
    { id: 'ledger', label: 'Statement / Ledger', icon: BookOpen, count: null },
    { id: 'profile', label: 'Profile & Details', icon: Truck, count: null }
  ];

  if (supplierLoading && !supplier) {
    return <SupplierDetailsPageSkeleton />;
  }

  if (!supplier) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl text-white mb-4">Supplier not found</h2>
        <Link to="/suppliers" className="btn btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Suppliers
        </Link>
      </div>
    );
  }

  return (
    <>
      <motion.div
        variants={containerVariants}
        initial={isFirstVisit ? "hidden" : false}
        animate="visible"
        className="space-y-6 no-print max-w-7xl mx-auto p-4 sm:p-6"
      >
        {/* Back Button */}
        <motion.div variants={itemVariants}>
          <Link
            to="/suppliers"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
          >
            <motion.div whileHover={{ x: -4 }} transition={{ type: 'spring', stiffness: 400 }}>
              <ArrowLeft className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
            </motion.div>
            Back to Suppliers
          </Link>
        </motion.div>

        {/* Supplier Info Glass Card */}
        <motion.div
          variants={itemVariants}
          className={`glass-card p-6 ${supplier.isActive === false ? 'opacity-90 border-red-500/30 grayscale-[0.2]' : ''}`}
        >
          <div className="flex flex-col xl:flex-row xl:items-start gap-6">
            {/* Avatar */}
            <motion.div
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20 relative overflow-hidden"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <span className="text-white font-bold text-3xl relative z-10">
                {supplier.name?.charAt(0)?.toUpperCase()}
              </span>
            </motion.div>

            {/* Supplier Header & Contact details */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {supplier.name}
                  </h1>
                  {supplier.isActive === false ? (
                    <>
                      <span className="px-2.5 py-0.5 rounded flex items-center gap-1 bg-rose-500/10 text-rose-400 text-xs font-semibold tracking-wider uppercase border border-rose-500/20">
                        Inactive
                      </span>
                      <button
                        onClick={handleReactivate}
                        disabled={reactivating}
                        className="px-3 py-1 bg-slate-700 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors border border-slate-600"
                      >
                        {reactivating ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    </>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-wider uppercase border border-emerald-500/20">
                      Active
                    </span>
                  )}
                  {supplier.contactPerson && (
                    <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                      Contact: {supplier.contactPerson}
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(isAdmin || hasPermission('purchases', 'create')) && (
                    <Link
                      to={`/purchases/new?supplierId=${supplier._id}`}
                      className="btn btn-primary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                    >
                      <Plus className="w-4 h-4" />
                      New Purchase
                    </Link>
                  )}
                  {(isAdmin || hasPermission('suppliers', 'edit')) && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={handlePrintStatement}
                    className="btn btn-secondary flex items-center gap-2 text-xs sm:text-sm py-2 px-3 sm:px-4 active:scale-95 transition-transform"
                    title="Print Statement"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>

              {/* Contact Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-400">Phone:</span>
                  <a href={`tel:${supplier.phone}`} className="hover:text-blue-400 font-medium truncate">
                    {formatPhone(supplier.phone) || 'N/A'}
                  </a>
                </div>

                {supplier.email && (
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Email:</span>
                    <a href={`mailto:${supplier.email}`} className="hover:text-blue-400 font-medium truncate">
                      {supplier.email}
                    </a>
                  </div>
                )}

                {supplier.gstin && (
                  <div className="flex items-center gap-2.5 text-slate-300">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">GSTIN:</span>
                    <span className="font-medium uppercase tracking-wider">{supplier.gstin}</span>
                  </div>
                )}

                {supplier.address && (
                  <div className="flex items-center gap-2.5 text-slate-300 md:col-span-2 xl:col-span-1">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-400">Location:</span>
                    <span className="font-medium truncate">{supplier.address}{supplier.state ? `, ${supplier.state}` : ''}</span>
                  </div>
                )}
              </div>
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
                  {['all', 'COMPLETED', 'DRAFT', 'CANCELLED'].map((st) => (
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
              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-700/50 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                      Supplier Statement of Account
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Live statement derived from purchase bills and opening balance</p>
                  </div>
                  <button
                    onClick={handlePrintStatement}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Statement
                  </button>
                </div>

                {/* Statement Table Preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase">
                        <th className="p-3">Date</th>
                        <th className="p-3">Particulars</th>
                        <th className="p-3 text-center">Ref / Bill #</th>
                        <th className="p-3 text-right">Debit (Purchased)</th>
                        <th className="p-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40">
                      <tr>
                        <td className="p-3 text-slate-400">-</td>
                        <td className="p-3 font-semibold text-amber-400">Opening Balance</td>
                        <td className="p-3 text-center text-slate-500">-</td>
                        <td className="p-3 text-right text-slate-400">-</td>
                        <td className="p-3 text-right font-bold text-white">{formatCurrency(summary.openingBalance)}</td>
                      </tr>
                      {(() => {
                        let running = summary.openingBalance;
                        return allPurchases.filter(p => p.status !== 'CANCELLED').map((p) => {
                          const amt = p.totals?.grandTotal || 0;
                          running += amt;
                          return (
                            <tr key={p._id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-3 text-slate-300">{formatDate(p.purchaseDate)}</td>
                              <td className="p-3 text-white flex items-center gap-2">
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                                Purchase Bill #{p.purchaseNumber}
                              </td>
                              <td className="p-3 text-center text-slate-400 text-xs font-mono">{p.supplierInvoiceNumber || '-'}</td>
                              <td className="p-3 text-right font-medium text-emerald-400">{formatCurrency(amt)}</td>
                              <td className="p-3 text-right font-bold text-white">{formatCurrency(running)}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-600 bg-slate-800/80 font-bold text-sm">
                        <td colSpan="3" className="p-4 text-right text-slate-300">TOTAL BALANCE PAYABLE:</td>
                        <td className="p-4 text-right text-emerald-400">{formatCurrency(summary.totalPurchases)}</td>
                        <td className="p-4 text-right text-teal-300 text-base">{formatCurrency(summary.balance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
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

      {/* Hidden printable A4 ledger */}
      <div style={{ display: 'none' }}>
        <div ref={ledgerPrintRef} className="invoice-print" style={{ width: '210mm', padding: '4mm' }}>
          <PrintSupplierLedgerContent
            admin={admin}
            supplier={supplier}
            purchases={allPurchases}
            summary={summary}
            formatDate={formatDate}
          />
        </div>
      </div>
    </>
  );
}
