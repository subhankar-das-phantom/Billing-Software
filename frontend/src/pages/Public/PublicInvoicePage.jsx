import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Download,
  Printer,
  FileText,
  AlertCircle,
  Building,
  User,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  CreditCard,
  Phone,
  MapPin,
  ShieldCheck
} from 'lucide-react';
import { shareService } from '../../services/sharing/shareService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useMotionConfig } from '../../hooks/useMotionConfig';
import { useDeviceType } from '../../hooks/useDeviceType';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';

const getBatchGroups = (allocations) => {
  if (!Array.isArray(allocations) || allocations.length === 0) return [];
  const groupsMap = allocations.reduce((acc, alloc) => {
    const displayName = alloc.batchNo && alloc.batchNo !== 'UNNAMED' ? alloc.batchNo : 'No Batch #';
    let expiryStr = '-';
    if (alloc.expiryDate) {
      if (typeof alloc.expiryDate === 'string' && /^\d{2}\/\d{2}$/.test(alloc.expiryDate.trim())) {
        expiryStr = alloc.expiryDate.trim();
      } else {
        const d = new Date(alloc.expiryDate);
        if (!Number.isNaN(d.getTime())) {
          expiryStr = d.toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' });
        }
      }
    }

    const key = `${displayName}|${expiryStr}`;
    if (!acc[key]) {
      acc[key] = { name: displayName, expiry: expiryStr, qtys: [] };
    }
    acc[key].qtys.push(Number(alloc.quantity) || 0);
    return acc;
  }, {});
  return Object.values(groupsMap);
};

const DEFAULT_INVOICE_COLUMNS = [
  'qty', 'free', 'productName', 'hsn', 'batchNo',
  'expiry', 'mrp', 'rate', 'net', 'disc',
  'gst', 'amount'
];

export default function PublicInvoicePage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Performance and device-aware motion tuning
  const { shouldAnimate, isLowPerformance, isReducedPerformance, duration } = useMotionConfig();
  const { isMobile, isTouchDevice } = useDeviceType();
  const { performanceMode } = usePerformanceMode();

  useEffect(() => {
    let isMounted = true;
    const loadSharedInvoice = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await shareService.getPublicShare(token);
        if (isMounted) {
          setData(res.data);
        }
      } catch (err) {
        if (isMounted) {
          const status = err.response?.status;
          if (status === 404) {
            setError('This invoice link is invalid, expired, or has been revoked by the issuer.');
          } else if (status === 429) {
            setError('Too many requests. Please wait a few minutes before trying again.');
          } else {
            setError('Unable to load the shared invoice at this time. Please try again later.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (token) {
      loadSharedInvoice();
    }
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Set document title
  useEffect(() => {
    if (data?.invoiceNumber) {
      document.title = `Invoice #${data.invoiceNumber}${data.distributor?.firmName ? ` — ${data.distributor.firmName}` : ''}`;
    }
    return () => {
      document.title = 'Bharat Enterprise - Billing System';
    };
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!token || downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      const blob = await shareService.getPublicSharePDFBlob(token);
      const invNum = data?.invoiceNumber ? data.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, '_') : 'Invoice';
      const fileName = `Invoice_${invNum}.pdf`;

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error('Failed to download invoice PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyUpi = async (upiId) => {
    if (!upiId) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(upiId);
        setCopiedUpi(true);
        setTimeout(() => setCopiedUpi(false), 2000);
      }
    } catch (e) {
      console.warn('Failed to copy UPI:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/10 ${shouldAnimate && !isLowPerformance ? 'animate-pulse' : ''}`}>
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Clock className={`w-4 h-4 text-blue-400 ${shouldAnimate && !isLowPerformance ? 'animate-spin' : ''}`} />
            <span>Verifying secure document link...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <motion.div
          initial={shouldAnimate && !isLowPerformance ? { opacity: 0, y: 8 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldAnimate && !isLowPerformance ? (duration?.normal ?? 0.15) : 0.05,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="glass-card max-w-md w-full p-8 text-center border-slate-800 shadow-2xl will-change-[transform,opacity]"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-900/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 mb-2">Document Unavailable</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">
            {error || 'The requested document could not be loaded.'}
          </p>
          <p className="text-xs text-slate-500 border-t border-slate-800/80 pt-4">
            If you need access to this invoice, please contact the sender for an updated link.
          </p>
        </motion.div>
      </div>
    );
  }

  const { distributor, customer, items, totals, paidAmount, dueAmount } = data;
  const isPaid = dueAmount <= 0;
  const isCancelled = data.status === 'Cancelled';
  const canPrint = data.allowPublicPrint === true;

  const visibleColumns = Array.isArray(data.invoiceColumns) && data.invoiceColumns.length > 0
    ? data.invoiceColumns
    : DEFAULT_INVOICE_COLUMNS;

  const ALL_PRINT_COLUMNS = [
    {
      key: 'qty',
      label: 'Qty',
      width: '4%',
      align: 'text-center',
      render: (item) => item.quantity ?? item.quantitySold ?? 0
    },
    {
      key: 'free',
      label: 'Fr',
      width: '3%',
      align: 'text-center',
      render: (item) => item.freeQuantity || 0
    },
    {
      key: 'productName',
      label: 'Product Name',
      width: '33%',
      align: 'text-left',
      render: (item) => (
        <>
          {item.productName || item.product?.productName || '-'}
          {item.pack && <span className="font-normal ml-0.5">({item.pack})</span>}
        </>
      )
    },
    {
      key: 'hsn',
      label: 'HSN',
      width: '7%',
      align: 'text-center',
      render: (item) => item.hsnCode || '-'
    },
    {
      key: 'batchNo',
      label: 'Batch',
      width: '10%',
      align: 'text-center',
      render: (item) => {
        const groups = getBatchGroups(item.batchAllocations);
        if (groups.length > 0) {
          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, gIdx) => {
                const displayQty = g.name === 'No Batch #' ? g.qtys.join('+') : g.qtys.reduce((sum, q) => sum + q, 0);
                return (
                  <span key={gIdx} className="whitespace-nowrap">
                    {g.name} ({displayQty})
                  </span>
                );
              })}
            </div>
          );
        }
        return item.batchNo && item.batchNo !== 'UNNAMED' ? item.batchNo : 'No Batch #';
      }
    },
    {
      key: 'expiry',
      label: 'Expiry',
      width: '7%',
      align: 'text-center',
      render: (item) => {
        const groups = getBatchGroups(item.batchAllocations);
        if (groups.length > 0) {
          return (
            <div className="flex flex-col gap-0.5">
              {groups.map((g, gIdx) => (
                <span key={gIdx} className="whitespace-nowrap">{g.expiry}</span>
              ))}
            </div>
          );
        }
        return item.expiryDate || '-';
      }
    },
    {
      key: 'mrp',
      label: 'MRP',
      width: '8%',
      align: 'text-right',
      render: (item) => (item.mrp > 0 ? Number(item.mrp).toFixed(2) : '-')
    },
    {
      key: 'rate',
      label: 'Rate',
      width: '7%',
      align: 'text-right',
      render: (item) => (Number(item.rate) || 0).toFixed(2)
    },
    {
      key: 'net',
      label: 'Net',
      width: '7%',
      align: 'text-right',
      render: (item) => {
        const rate = Number(item.rate) || 0;
        const gst = Number(item.gstPercentage) || 0;
        const net = item.netRate != null ? Number(item.netRate) : (rate * (1 + gst / 100));
        return net.toFixed(2);
      }
    },
    {
      key: 'disc',
      label: 'Disc%',
      width: '5%',
      align: 'text-center',
      render: (item) => (item.discountPercentage > 0 ? `${item.discountPercentage}%` : '0%')
    },
    {
      key: 'gst',
      label: 'GST%',
      width: '4%',
      align: 'text-center',
      render: (item) => `${item.gstPercentage || 0}%`
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '9%',
      align: 'text-right',
      render: (item) => Number(item.totalAmount || 0).toFixed(2)
    }
  ];

  const activePrintColumns = ALL_PRINT_COLUMNS.filter((col) => visibleColumns.includes(col.key));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 sm:py-10 px-4 sm:px-6 flex flex-col justify-between print:min-h-0 print:p-0 print:bg-white print:text-black print:block">
      <div className="max-w-4xl mx-auto w-full space-y-6 print:max-w-none print:m-0 print:p-0 print:space-y-0">
        {/* Top Floating Action Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800/90 shadow-xl no-print ${
          isLowPerformance || isMobile ? 'bg-slate-900' : 'bg-slate-900/80 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-sm">
              {(distributor.firmName || '')
                .split(' ')
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'INV'}
            </div>
            <div>
              <p className="text-xs text-slate-400">Invoice from</p>
              <h2 className="text-sm font-semibold text-slate-200 truncate max-w-xs sm:max-w-md">
                {distributor.firmName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {canPrint && (
              <button
                type="button"
                onClick={handlePrint}
                className="btn btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium border-slate-700 hover:text-slate-100"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span>Print</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="btn btn-primary flex items-center gap-1.5 py-1.5 px-3.5 text-xs font-medium shadow-md shadow-blue-900/30 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {downloadingPdf ? (
                <Clock className={`w-3.5 h-3.5 ${shouldAnimate && !isLowPerformance ? 'animate-spin' : ''}`} />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>

        {/* Main Interactive Screen Invoice Sheet (Hidden on print) */}
        <motion.div
          initial={shouldAnimate && !isLowPerformance ? { opacity: 0, y: 8 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldAnimate && !isLowPerformance ? (duration?.normal ?? 0.15) : 0.05,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="glass-card p-6 sm:p-8 space-y-6 border border-slate-800/90 shadow-2xl bg-slate-900/60 will-change-[transform,opacity] no-print"
        >
          {/* Cancelled Bill Alert Callout */}
          {isCancelled && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>This invoice has been <strong>cancelled</strong> by the issuer and is void for statutory tax deduction and payment.</span>
            </div>
          )}
          {/* Header: Issuer Details & Invoice Meta */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-800">
            {/* Left: Distributor / Firm Info */}
            <div className="space-y-1.5 max-w-md">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25 mb-1">
                Tax Invoice
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                {distributor.firmName}
              </h1>
              {distributor.firmAddress && (
                <p className="text-xs text-slate-400 leading-relaxed">
                  {distributor.firmAddress}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                {distributor.firmPhone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {distributor.firmPhone}
                  </span>
                )}
                {distributor.firmGSTIN && (
                  <span>
                    <strong className="text-slate-300">GSTIN:</strong> {distributor.firmGSTIN}
                  </span>
                )}
                {distributor.firmDL && (
                  <span>
                    <strong className="text-slate-300">DL:</strong> {distributor.firmDL}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Invoice Identity & Status Pill */}
            <div className="space-y-2 md:text-right flex flex-col md:items-end">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xl sm:text-2xl font-bold text-slate-100">
                  #{data.invoiceNumber}
                </span>
                {isCancelled ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Cancelled
                  </span>
                ) : isPaid ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Clock className="w-3.5 h-3.5" />
                    Payment Due
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400">
                <span className="text-slate-500">Date:</span> {formatDate(data.invoiceDate)}
              </p>
              <p className="text-xs text-slate-400">
                <span className="text-slate-500">Bill Type:</span>{' '}
                <span className="font-medium text-slate-300 uppercase">{data.paymentType || 'Credit'}</span>
              </p>
            </div>
          </div>

          {/* Payment Instructions (Rendered ONLY if enabled by distributor) */}
          {distributor.paymentInformation && (
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Payment Instructions</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
                    {distributor.paymentInformation.upiId && (
                      <span>
                        <span className="text-slate-500 font-sans">UPI:</span>{' '}
                        {distributor.paymentInformation.upiId}
                      </span>
                    )}
                    {distributor.paymentInformation.accountNumber && (
                      <span>
                        <span className="text-slate-500 font-sans">A/C:</span>{' '}
                        {distributor.paymentInformation.accountNumber}
                      </span>
                    )}
                    {distributor.paymentInformation.ifscCode && (
                      <span>
                        <span className="text-slate-500 font-sans">IFSC:</span>{' '}
                        {distributor.paymentInformation.ifscCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {distributor.paymentInformation.upiId && (
                <button
                  type="button"
                  onClick={() => handleCopyUpi(distributor.paymentInformation.upiId)}
                  className="btn btn-secondary flex items-center gap-1.5 py-1 px-2.5 text-xs text-slate-300 hover:text-slate-100 self-start sm:self-auto no-print"
                >
                  {copiedUpi ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{copiedUpi ? 'Copied' : 'Copy UPI'}</span>
                </button>
              )}
            </div>
          )}

          {/* Billed To Customer Details */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Billed To
            </p>
            <h3 className="text-base font-semibold text-slate-100">
              M/s {customer.customerName}
            </h3>
            {customer.address && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {customer.address}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
              {customer.phone && (
                <span>
                  <strong className="text-slate-300">Ph:</strong> {customer.phone}
                </span>
              )}
              {customer.gstin && (
                <span>
                  <strong className="text-slate-300">GSTIN:</strong> {customer.gstin}
                </span>
              )}
              {customer.dlNo && (
                <span>
                  <strong className="text-slate-300">DL:</strong> {customer.dlNo}
                </span>
              )}
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-2 text-center w-12">Qty</th>
                    <th className="py-2.5 px-2 text-center w-10">Fr</th>
                    <th className="py-2.5 px-3 text-left">Product Name</th>
                    <th className="py-2.5 px-2 text-center">HSN</th>
                    <th className="py-2.5 px-2 text-center">Batch</th>
                    <th className="py-2.5 px-2 text-center">Expiry</th>
                    <th className="py-2.5 px-2 text-right">MRP</th>
                    <th className="py-2.5 px-2 text-right">Rate</th>
                    <th className="py-2.5 px-2 text-right">Net</th>
                    <th className="py-2.5 px-2 text-center">Disc%</th>
                    <th className="py-2.5 px-2 text-center">GST%</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {items.map((item, idx) => {
                    const groups = getBatchGroups(item.batchAllocations);
                    const hasBatchAllocations = groups.length > 0;
                    const rate = Number(item.rate) || 0;
                    const gst = Number(item.gstPercentage) || 0;
                    const net = item.netRate != null ? Number(item.netRate) : (rate * (1 + gst / 100));

                    return (
                      <tr key={idx} className={!isTouchDevice && !isLowPerformance ? "hover:bg-slate-800/20 transition-colors" : ""}>
                        {/* Qty */}
                        <td className="py-2.5 px-2 text-center text-slate-200 font-semibold">{item.quantity}</td>

                        {/* Free */}
                        <td className="py-2.5 px-2 text-center text-slate-400">{item.freeQuantity || 0}</td>

                        {/* Product Name */}
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-200 text-left">
                          {item.productName}
                          {item.pack && <span className="text-slate-400 font-normal ml-1">({item.pack})</span>}
                        </td>

                        {/* HSN */}
                        <td className="py-2.5 px-2 text-center text-slate-400">{item.hsnCode || '-'}</td>

                        {/* Batch */}
                        <td className="py-2.5 px-2 text-center text-slate-300">
                          {hasBatchAllocations ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              {groups.map((g, gIdx) => {
                                const displayQty = g.name === 'No Batch #' ? g.qtys.join('+') : g.qtys.reduce((sum, q) => sum + q, 0);
                                return (
                                  <span key={gIdx} className="whitespace-nowrap">
                                    {g.name} ({displayQty})
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            item.batchNo && item.batchNo !== 'UNNAMED' ? item.batchNo : 'No Batch #'
                          )}
                        </td>

                        {/* Expiry */}
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          {hasBatchAllocations ? (
                            <div className="flex flex-col gap-0.5 items-center">
                              {groups.map((g, gIdx) => (
                                <span key={gIdx} className="whitespace-nowrap">{g.expiry}</span>
                              ))}
                            </div>
                          ) : (
                            item.expiryDate || '-'
                          )}
                        </td>

                        {/* MRP */}
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {item.mrp > 0 ? Number(item.mrp).toFixed(2) : '-'}
                        </td>

                        {/* Rate */}
                        <td className="py-2.5 px-2 text-right text-slate-300">
                          {rate.toFixed(2)}
                        </td>

                        {/* Net */}
                        <td className="py-2.5 px-2 text-right text-slate-300 font-medium">
                          {net.toFixed(2)}
                        </td>

                        {/* Disc% */}
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          {item.discountPercentage > 0 ? `${item.discountPercentage}%` : '0%'}
                        </td>

                        {/* GST% */}
                        <td className="py-2.5 px-2 text-center text-slate-400">
                          {gst}%
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                          {Number(item.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Left: Amount in Words & Dues status */}
            <div className="space-y-3">
              {totals.amountInWords && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Amount in Words
                  </p>
                  <p className="text-xs text-slate-300 font-medium uppercase leading-snug">
                    {totals.amountInWords}
                  </p>
                </div>
              )}

              {/* Balance Summary Box */}
              {!isCancelled && (
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Bill Balance Due</p>
                    <p className={`text-lg font-bold font-mono ${dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {formatCurrency(dueAmount)}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    dueAmount > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                  }`}>
                    {dueAmount > 0 ? 'Due for Payment' : 'Fully Settled'}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Detailed Financial Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400 py-1">
                <span>Taxable Amount</span>
                <span className="font-mono text-slate-300">₹{totals.totalTaxable.toFixed(2)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-rose-400 py-1">
                  <span>Total Discount</span>
                  <span className="font-mono">-₹{totals.totalDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400 py-1">
                <span>CGST</span>
                <span className="font-mono text-slate-300">₹{totals.totalCGST.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400 py-1">
                <span>SGST</span>
                <span className="font-mono text-slate-300">₹{totals.totalSGST.toFixed(2)}</span>
              </div>
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-slate-400 py-1">
                  <span>Round Off</span>
                  <span className="font-mono text-slate-300">
                    {totals.roundOff >= 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-100 pt-2.5 border-t border-slate-700/80">
                <span>Grand Total</span>
                <span className="font-mono text-base text-blue-400">
                  {formatCurrency(totals.netTotal)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Dedicated Printable A4 Tax Invoice (Strictly visible in @media print, hidden on screen) */}
        {canPrint && (
          <div
            className="hidden print:block invoice-print bg-white my-0 mx-auto"
          style={{
            width: '100%',
            maxWidth: '210mm',
            fontSize: '11px',
            color: '#000000',
            margin: '0 auto',
            padding: '2mm',
            boxSizing: 'border-box'
          }}
        >
          <div
            className="invoice-copy bg-white flex flex-col relative"
            style={{
              width: '100%',
              minHeight: '130mm',
              fontSize: '11px',
              color: '#000000',
              padding: '3mm',
              boxSizing: 'border-box',
              position: 'relative'
            }}
          >
            {/* Prominent Cancelled Watermark Stamp */}
            {isCancelled && (
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
                style={{ zIndex: 20 }}
              >
                <div
                  style={{
                    transform: 'rotate(-26deg)',
                    fontSize: '68px',
                    fontWeight: '900',
                    color: 'rgba(220, 38, 38, 0.25)',
                    border: '5px dashed rgba(220, 38, 38, 0.40)',
                    borderRadius: '8px',
                    padding: '8px 48px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                    lineHeight: '1'
                  }}
                >
                  CANCELLED
                </div>
              </div>
            )}

            {/* Cancelled Banner for Physical Print */}
            {isCancelled && (
              <div
                className="w-full text-center py-1 mb-1 font-bold text-[11px]"
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1.5px dashed #b91c1c',
                  letterSpacing: '0.04em'
                }}
              >
                *** VOID / CANCELLED INVOICE — EXCLUDED FROM STATUTORY ACCOUNTS & TAX CREDIT ***
              </div>
            )}
            {/* Header: Issuer Details & Invoice Meta */}
            <div
              className="grid grid-cols-2 gap-2 border-b border-black pb-1 mb-1"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                borderBottom: '1px solid black',
                paddingBottom: '4px',
                marginBottom: '4px'
              }}
            >
              <div className="text-left">
                {distributor.firmName && (
                  <h1 className="font-bold mb-0.5" style={{ fontSize: '18px', margin: 0 }}>
                    {distributor.firmName}
                  </h1>
                )}
                {distributor.firmAddress && (
                  <p className="text-[11px] leading-tight" style={{ margin: '2px 0 0 0' }}>
                    {distributor.firmAddress}
                  </p>
                )}
              </div>

              <div
                className="flex justify-end text-[11px] leading-tight"
                style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'right' }}
              >
                {distributor.paymentInformation && (
                  <div
                    className="text-left border-l border-r border-black px-2 mr-2"
                    style={{
                      borderLeft: '1px solid black',
                      borderRight: '1px solid black',
                      padding: '0 8px',
                      marginRight: '8px',
                      textAlign: 'left'
                    }}
                  >
                    {distributor.paymentInformation.upiId && (
                      <p style={{ margin: '1px 0' }}>UPI: {distributor.paymentInformation.upiId}</p>
                    )}
                    {distributor.paymentInformation.accountNumber && (
                      <p style={{ margin: '1px 0' }}>A/C: {distributor.paymentInformation.accountNumber}</p>
                    )}
                    {distributor.paymentInformation.ifscCode && (
                      <p style={{ margin: '1px 0' }}>IFSC: {distributor.paymentInformation.ifscCode}</p>
                    )}
                  </div>
                )}
                <div className="text-left" style={{ textAlign: 'left' }}>
                  {distributor.firmPhone && <p style={{ margin: '1px 0' }}>Phone: {distributor.firmPhone}</p>}
                  {distributor.firmDL && <p style={{ margin: '1px 0' }}>DL No: {distributor.firmDL}</p>}
                  {distributor.firmGSTIN && <p style={{ margin: '1px 0' }}>GSTIN: {distributor.firmGSTIN}</p>}
                </div>
              </div>
            </div>

            {/* Buyer & Invoice Details (3 Columns) */}
            <div
              className="grid grid-cols-3 gap-2 mb-1 text-[11px]"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '4px' }}
            >
              <div>
                <p className="font-bold mb-0.5">M/s {customer.customerName}</p>
                {customer.address && <p className="leading-tight">{customer.address}</p>}
                {customer.phone && <p className="mt-0.5">Ph: {customer.phone}</p>}
              </div>
              <div
                className="border-l border-black pl-2"
                style={{ borderLeft: '1px solid black', paddingLeft: '8px' }}
              >
                {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
                {customer.dlNo && <p>DL No: {customer.dlNo}</p>}
              </div>
              <div className="text-right" style={{ textAlign: 'right' }}>
                <p className="font-bold">Invoice No: {data.invoiceNumber}</p>
                <p><span className="font-bold">Date:</span> {formatDate(data.invoiceDate)}</p>
                {isCancelled ? (
                  <p className="font-bold" style={{ color: '#b91c1c' }}>STATUS: CANCELLED</p>
                ) : (
                  <p><span className="font-bold">Bill Type:</span> {(data.paymentType || 'Credit').toUpperCase()}</p>
                )}
              </div>
            </div>

            {/* Products Table */}
            <div className="mb-1">
              <table
                className="w-full border-collapse text-[9px]"
                style={{ border: '0.5px solid black' }}
              >
                <thead>
                  <tr style={{ borderBottom: '0.5px solid black' }}>
                    {activePrintColumns.map((col, cIdx) => (
                      <th
                        key={col.key}
                        className={`${cIdx < activePrintColumns.length - 1 ? 'border-r border-black' : ''} p-0.5 font-bold ${col.align}`}
                        style={{ width: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isLast = idx === items.length - 1;

                    return (
                      <tr
                        key={idx}
                        style={{ borderBottom: isLast ? 'none' : '0.5px solid #ddd' }}
                      >
                        {activePrintColumns.map((col, cIdx) => (
                          <td
                            key={col.key}
                            className={`${cIdx < activePrintColumns.length - 1 ? 'border-r border-black' : ''} p-0.5 font-bold ${col.align}`}
                          >
                            {col.render(item)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary and Financial Breakdown */}
            <div className="mt-auto">
              <div className="grid grid-cols-2 gap-2 mb-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div className="text-[11px]">
                  {isCancelled ? (
                    <p className="font-bold" style={{ color: '#b91c1c' }}>
                      Status: CANCELLED (Voided — Zero Payment Obligation)
                    </p>
                  ) : (
                    <p className="font-bold">
                      Bill Balance Due: {dueAmount > 0 ? formatCurrency(dueAmount) : '₹0.00 (Fully Settled)'}
                    </p>
                  )}
                  {totals.amountInWords && (
                    <div className="border-t border-black mt-1 pt-0.5">
                      <p className="font-bold mb-0.5">Amount in Words:</p>
                      <p className="uppercase">{totals.amountInWords}</p>
                    </div>
                  )}
                  {data.notes && (
                    <div className="mt-1 pt-0.5 text-[10px] text-gray-700">
                      <p><span className="font-bold">Notes:</span> {data.notes}</p>
                    </div>
                  )}
                </div>

                <div className="text-[11px]">
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td className="py-0">Taxable:</td>
                        <td className="text-right font-semibold">₹{totals.totalTaxable.toFixed(2)}</td>
                      </tr>
                      {totals.totalDiscount > 0 && (
                        <tr>
                          <td className="py-0">Discount:</td>
                          <td className="text-right" style={{ color: '#dc2626' }}>-₹{totals.totalDiscount.toFixed(2)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-0">CGST:</td>
                        <td className="text-right">₹{totals.totalCGST.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="py-0">SGST:</td>
                        <td className="text-right">₹{totals.totalSGST.toFixed(2)}</td>
                      </tr>
                      {totals.roundOff !== 0 && (
                        <tr>
                          <td className="py-0">Round Off:</td>
                          <td className="text-right">
                            {totals.roundOff >= 0 ? `+₹${totals.roundOff.toFixed(2)}` : `-₹${Math.abs(totals.roundOff).toFixed(2)}`}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-black" style={{ borderTop: '1px solid black' }}>
                        <td className="py-0.5 font-bold">NET:</td>
                        <td className="text-right font-bold text-[13px]">
                          {formatCurrency(totals.netTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatory Footer */}
              <div className="border-t border-black pt-1 text-[11px]" style={{ borderTop: '1px solid black' }}>
                <div className="flex justify-between items-end">
                  <div>
                    <p>E & O E</p>
                  </div>
                  <div className="text-center">
                    <div className="h-6"></div>
                    <p className="border-t border-black pt-0.5" style={{ borderTop: '1px solid black' }}>
                      {distributor.firmName ? `For ${distributor.firmName}` : ''}
                      {distributor.firmName && <br />}
                      <span className="font-bold">Authorized Signatory</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {/* Public Footer */}
      <footer className="mt-12 text-center text-xs text-slate-500 space-y-1 no-print">
        <p className="flex items-center justify-center gap-1.5 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Verified Secure Document</span>
        </p>
        <p>Powered by Bharat Enterprise Billing System</p>
      </footer>
    </div>
  );
}
