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
      document.title = `Invoice #${data.invoiceNumber} — ${data.distributor?.firmName || 'Bharat Enterprise'}`;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 sm:py-10 px-4 sm:px-6 flex flex-col justify-between">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Top Floating Action Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-800/90 shadow-xl no-print ${
          isLowPerformance || isMobile ? 'bg-slate-900' : 'bg-slate-900/80 backdrop-blur-md'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold font-mono text-sm">
              BE
            </div>
            <div>
              <p className="text-xs text-slate-400">Invoice from</p>
              <h2 className="text-sm font-semibold text-slate-200 truncate max-w-xs sm:max-w-md">
                {distributor.firmName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium border-slate-700 hover:text-slate-100"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>Print</span>
            </button>

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

        {/* Main Invoice Sheet */}
        <motion.div
          initial={shouldAnimate && !isLowPerformance ? { opacity: 0, y: 8 } : { opacity: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: shouldAnimate && !isLowPerformance ? (duration?.normal ?? 0.15) : 0.05,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="glass-card p-6 sm:p-8 space-y-6 border border-slate-800/90 shadow-2xl bg-slate-900/60 will-change-[transform,opacity]"
        >
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
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-2 text-center">HSN</th>
                    <th className="py-2.5 px-2 text-center">Batch</th>
                    <th className="py-2.5 px-2 text-center">Expiry</th>
                    <th className="py-2.5 px-2 text-right">Qty</th>
                    <th className="py-2.5 px-2 text-right">Rate</th>
                    <th className="py-2.5 px-2 text-center">Disc</th>
                    <th className="py-2.5 px-2 text-center">GST</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {items.map((item, idx) => (
                    <tr key={idx} className={!isTouchDevice && !isLowPerformance ? "hover:bg-slate-800/20 transition-colors" : ""}>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-sans">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                        {item.productName}
                        {item.pack && <span className="text-slate-400 font-normal ml-1">({item.pack})</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{item.hsnCode || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{item.batchNo || '-'}</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{item.expiryDate || '-'}</td>
                      <td className="py-2.5 px-2 text-right text-slate-200">
                        {item.quantity}
                        {item.freeQuantity > 0 && (
                          <span className="text-emerald-400 text-[10px] ml-1">+{item.freeQuantity}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-300">₹{item.rate.toFixed(2)}</td>
                      <td className="py-2.5 px-2 text-center text-slate-400">
                        {item.discountPercentage > 0 ? `${item.discountPercentage}%` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-center text-slate-400">{item.gstPercentage}%</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-100">
                        ₹{item.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
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
                    <p className="text-xs text-slate-400">Balance Due</p>
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
