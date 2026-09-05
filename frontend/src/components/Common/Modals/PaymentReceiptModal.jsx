import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  Printer,
  Copy,
  Check,
  Building2,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  FileText,
  User,
  Phone,
  Hash,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { formatCurrency, formatDate, formatPaymentTime } from '../../../utils/formatters';
import { amountToWords } from '../../../utils/calculations';
import { useAuth } from '../../../contexts/AuthContext';

const METHOD_ICONS = {
  'Cash': Banknote,
  'UPI': Smartphone,
  'Bank Transfer': Building2,
  'Cheque': FileText,
  'NEFT/RTGS': Building2
};

const METHOD_BADGES = {
  'Cash': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'UPI': 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'Bank Transfer': 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'Cheque': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'NEFT/RTGS': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
};

export default function PaymentReceiptModal({ isOpen, onClose, payment }) {
  const { admin } = useAuth();
  const [copiedField, setCopiedField] = useState(null);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !payment) return null;

  const MethodIcon = METHOD_ICONS[payment.paymentMethod] || CreditCard;
  const methodBadge = METHOD_BADGES[payment.paymentMethod] || 'bg-slate-700/40 text-slate-300 border-slate-600';

  const copyToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const firmName = admin?.firmName || admin?.name || 'Bharat Enterprise';
  const firmGstin = admin?.gstin || '';
  const firmAddress = admin?.address || '';
  const firmPhone = admin?.phone || '';

  const displayTime = formatPaymentTime(payment);

  const displayDate = payment.paymentDate ? formatDate(payment.paymentDate) : '-';
  const displayId = payment.id ? (payment.id.startsWith('#') ? payment.id : `#PMT-${payment.id.slice(-8).toUpperCase()}`) : '#PMT-RECEIPT';

  return createPortal(
    <>
      {/* On-Screen Modal Window (strictly hidden on print) */}
      <div
        className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        >
          {/* Header - Fixed & Pinned at Top */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 sm:hidden rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Back to Collections"
                aria-label="Back to Collections"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-white">Payment Receipt Voucher</h2>
                <p className="text-[11px] sm:text-xs text-slate-400 font-mono">
                  {displayId} · {displayDate}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Receipt Body - Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6 overscroll-contain">
            {/* Store & Identification Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{firmName}</h3>
                {firmGstin && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">GSTIN: {firmGstin}</p>
                )}
                {firmAddress && <p className="text-xs text-slate-400 mt-0.5">{firmAddress}</p>}
              </div>
              <div className="sm:text-right">
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  Payment ID
                </span>
                <p className="text-sm font-bold text-white font-mono">{displayId}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1 sm:justify-end">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {displayTime}
                </p>
              </div>
            </div>

            {/* Customer & Allocation Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Info */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> Received From
                </span>
                <p className="text-sm font-bold text-white truncate">
                  {payment.customer?.name || 'Walk-in Customer'}
                </p>
                {payment.customer?.phone ? (
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    {payment.customer.phone}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">No phone provided</p>
                )}
              </div>

              {/* Allocation Info */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" /> Settled Against
                </span>
                {payment.invoice ? (
                  <div>
                    <p className="text-sm font-semibold text-blue-400 font-mono">
                      {payment.invoice.invoiceNumber || 'Invoice'}
                    </p>
                    {payment.invoice.netTotal != null && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Net Invoice: {formatCurrency(payment.invoice.netTotal)}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-amber-400">
                      {payment.entryType ? 'Manual Adjustment' : 'Account Settlement'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Opening balance / On-account</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method & Reference Bar */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${methodBadge}`}>
                  <MethodIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Payment Channel
                  </span>
                  <p className="text-sm font-bold text-white">{payment.paymentMethod || 'Cash'}</p>
                </div>
              </div>

              {/* Reference / UTR */}
              <div className="sm:text-right">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  UTR / Reference No
                </span>
                {payment.referenceNumber ? (
                  <div className="flex items-center gap-2 mt-0.5 sm:justify-end">
                    <span className="text-xs font-mono font-semibold text-white bg-slate-800/80 px-2 py-1 rounded border border-slate-700">
                      {payment.referenceNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.referenceNumber, 'utr')}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Copy Reference"
                    >
                      {copiedField === 'utr' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">None recorded</p>
                )}
              </div>
            </div>

            {/* Amount Box */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1.5">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                Amount Received
              </span>
              <p className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                {formatCurrency(payment.amount)}
              </p>
              <p className="text-xs text-slate-400 italic">
                {amountToWords(payment.amount)}
              </p>
            </div>

            {/* Notes & Recorded By */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-xs text-slate-400">
              <div className="truncate max-w-sm">
                {payment.notes ? (
                  <p>
                    <span className="text-slate-500 font-medium">Remarks:</span> {payment.notes}
                  </p>
                ) : (
                  <p className="text-slate-600">No additional remarks</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto text-slate-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                Recorded by: <span className="text-white font-medium">{payment.recordedBy?.name || 'Admin'}</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions - Fixed & Pinned at Bottom */}
          <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-slate-700/80"
              id="close-receipt-modal-btn"
            >
              <X className="w-3.5 h-3.5" />
              Close Receipt
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  const summaryText = `Payment Receipt ${displayId}\nCustomer: ${payment.customer?.name || 'Customer'}\nAmount: ${formatCurrency(payment.amount)}\nMethod: ${payment.paymentMethod}\nUTR: ${payment.referenceNumber || 'N/A'}\nDate: ${displayDate} ${displayTime}`;
                  copyToClipboard(summaryText, 'all');
                }}
                className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Details
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Slip
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Printable Receipt Layout (strictly visible in @media print) */}
      <div className="hidden print:block invoice-print p-6 text-black bg-white w-full max-w-[210mm]">
        <div className="text-center pb-4 border-b border-black">
          <h1 className="text-xl font-bold uppercase">{firmName}</h1>
          {firmGstin && <p className="text-xs">GSTIN: {firmGstin}</p>}
          {firmAddress && <p className="text-xs">{firmAddress}</p>}
          {firmPhone && <p className="text-xs">Phone: {firmPhone}</p>}
          <h2 className="text-sm font-bold uppercase tracking-wider mt-2 bg-gray-100 py-1 inline-block px-4 border border-gray-400">
            Payment Receipt Voucher
          </h2>
        </div>

        <div className="py-4 grid grid-cols-2 gap-4 text-xs border-b border-black">
          <div>
            <p><strong>Receipt / Payment ID:</strong> {displayId}</p>
            <p><strong>Date & Time:</strong> {displayDate} at {displayTime}</p>
            <p><strong>Payment Mode:</strong> {payment.paymentMethod || 'Cash'}</p>
            {payment.referenceNumber && <p><strong>UTR / Cheque Ref:</strong> {payment.referenceNumber}</p>}
          </div>
          <div className="text-right">
            <p><strong>Received From:</strong> {payment.customer?.name || 'Walk-in Customer'}</p>
            {payment.customer?.phone && <p><strong>Phone:</strong> {payment.customer.phone}</p>}
            <p><strong>Settled Against:</strong> {payment.invoice?.invoiceNumber || (payment.entryType ? 'Manual Adjustment' : 'Account Settlement')}</p>
            <p><strong>Recorded By:</strong> {payment.recordedBy?.name || 'Admin'}</p>
          </div>
        </div>

        <div className="py-6 text-center my-4 border border-gray-400 bg-gray-50">
          <span className="text-xs uppercase tracking-wider font-semibold">Total Amount Received</span>
          <p className="text-3xl font-bold mt-1">{formatCurrency(payment.amount)}</p>
          <p className="text-xs italic mt-1 font-medium">{amountToWords(payment.amount)}</p>
        </div>

        {payment.notes && (
          <div className="text-xs py-2">
            <p><strong>Remarks / Notes:</strong> {payment.notes}</p>
          </div>
        )}

        <div className="pt-12 mt-8 border-t border-gray-300 flex justify-between text-xs">
          <div>
            <p className="border-t border-black pt-1 w-40 text-center">Customer Signature</p>
          </div>
          <div className="text-right">
            <p className="border-t border-black pt-1 w-40 text-center ml-auto">Authorized Cashier</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
