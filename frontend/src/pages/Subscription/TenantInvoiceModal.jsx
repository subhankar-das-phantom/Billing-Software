import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Printer,
  ArrowLeft,
  Building2,
  FileCheck,
  ShieldCheck,
  Download,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { amountToWords } from '../../utils/calculations';

export default function TenantInvoiceModal({ isOpen, onClose, invoice }) {
  const printableRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  // Indian standard currency formatting preserving exact paise
  const formatCurrency = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    });
  };

  const formatDate = (val) => {
    if (!val) return 'N/A';
    try {
      return new Date(val).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(val);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const seller = invoice.seller || {
    companyName: 'Bharat Enterprise Technologies Pvt. Ltd.',
    address: 'BKC Tech Park, Bandra Kurla Complex, Bandra East, Mumbai - 400051',
    state: 'Maharashtra (27)',
    gstin: '27AABCB9823Q1Z2',
    pan: 'AABCB9823Q',
    cin: 'U72900MH2024PTC123456',
    supportEmail: 'support.bharatenterprise@gmail.com',
  };

  const buyer = invoice.buyer || {
    firmName: 'Subscribed Business',
    contactPerson: '',
    email: '',
    phone: '',
    address: 'Registered Business Address',
    gstin: 'UNREGISTERED',
    placeOfSupply: 'Maharashtra (27)',
  };

  const totalAmount = Number(invoice.totalAmount || 0);
  const taxableAmount = Number(invoice.taxableAmount || 0);
  const cgstAmount = Number(invoice.cgstAmount || 0);
  const sgstAmount = Number(invoice.sgstAmount || 0);
  const igstAmount = Number(invoice.igstAmount || 0);
  const words = amountToWords(totalAmount);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
        {/* Backdrop Tap Dismissal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs will-change-[opacity] no-print"
        />

        {/* Modal Dialog Card */}
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tenant-tax-invoice-title"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden z-10 my-4 flex flex-col max-h-[94vh] will-change-[transform,opacity]"
        >
          {/* Top Action Header (Hidden in Print) */}
          <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3.5 border-b border-slate-800/80 flex items-center justify-between no-print">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 id="tenant-tax-invoice-title" className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-400" />
                  Tax Invoice {invoice.invoiceNumber}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Statutory GST Rule 46 B2B Invoice
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 min-h-[40px] cursor-pointer"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print / Save PDF</span>
                <span className="sm:hidden">Print</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Statutory Invoice Document Container */}
          <div className="overflow-y-auto p-3 sm:p-6 bg-slate-950/40">
            <div
              id="printable-tax-invoice"
              ref={printableRef}
              className="bg-white text-slate-900 rounded-xl p-5 sm:p-8 shadow-sm border border-slate-200 font-sans text-xs space-y-5"
            >
              {/* 1. Header: Brand + Title + Statutory Label */}
              <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    B
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      BHARAT ENTERPRISE
                    </h1>
                    <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">
                      Next-Gen Enterprise Billing & SaaS Infrastructure
                    </p>
                  </div>
                </div>

                <div className="sm:text-right">
                  <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white">
                    TAX INVOICE
                  </span>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    (Original for Recipient / B2B Supply)
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono font-bold mt-0.5">
                    GST Rule 46 Compliant
                  </p>
                </div>
              </div>

              {/* 2. Top Info Grid: Seller Details vs Invoice Meta */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                {/* Left: Seller Details */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Issued By (Supplier / SaaS Service Provider):
                  </span>
                  <h2 className="text-xs font-bold text-slate-900">{seller.companyName}</h2>
                  <p className="text-[11px] text-slate-600 leading-snug">{seller.address}</p>
                  <div className="pt-1 text-[11px] space-y-0.5 font-mono text-slate-700">
                    <p>
                      <strong className="text-slate-900">GSTIN:</strong> {seller.gstin}
                    </p>
                    <p>
                      <strong className="text-slate-900">PAN:</strong> {seller.pan} |{' '}
                      <strong className="text-slate-900">State:</strong> {seller.state}
                    </p>
                    {seller.cin && (
                      <p>
                        <strong className="text-slate-900">CIN:</strong> {seller.cin}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: Invoice Metadata */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Invoice Number:</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Invoice Date:</span>
                    <span className="font-semibold text-slate-800">
                      {formatDate(invoice.invoiceDate)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Place of Supply:</span>
                    <span className="font-semibold text-slate-800">
                      {buyer.placeOfSupply || 'Maharashtra (27)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">SAC Code:</span>
                    <span className="font-mono font-bold text-slate-800">998313</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Reverse Charge (RCM):</span>
                    <span className="font-semibold text-slate-800">No</span>
                  </div>
                </div>
              </div>

              {/* 3. Billed To (Buyer / Recipient) */}
              <div className="bg-slate-50/80 rounded-lg p-3.5 border border-slate-200 space-y-1 text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Billed To (B2B Recipient / Customer):
                </span>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{buyer.firmName}</h3>
                    <p className="text-slate-600 leading-snug">{buyer.address}</p>
                    {buyer.contactPerson && (
                      <p className="text-slate-500 mt-0.5">
                        Attn: {buyer.contactPerson} {buyer.phone ? `(${buyer.phone})` : ''}
                      </p>
                    )}
                  </div>
                  <div className="sm:text-right font-mono text-[11px] text-slate-700">
                    <p>
                      <strong className="text-slate-900">GSTIN:</strong>{' '}
                      <span className="font-bold">{buyer.gstin || 'UNREGISTERED'}</span>
                    </p>
                    {buyer.email && (
                      <p className="font-sans text-slate-500 text-[10px]">{buyer.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Itemized Statutory Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Description of Services</th>
                      <th className="py-2.5 px-3 text-center">SAC</th>
                      <th className="py-2.5 px-3 text-center">Duration</th>
                      <th className="py-2.5 px-3 text-right">Taxable Value (₹)</th>
                      <th className="py-2.5 px-3 text-right">GST Rate</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3 text-center font-mono text-slate-500">1</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">
                          {invoice.description || `Bharat Enterprise SaaS — ${invoice.planName} Tier`}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Cloud Billing, Multi-User RBAC, Automated GST E-Invoicing & Inventory
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-700">
                        {invoice.sacCode || '998313'}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 font-medium">
                        {invoice.durationMonths || 1} Month{invoice.durationMonths > 1 ? 's' : ''}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                        ₹{formatCurrency(taxableAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {invoice.gstRate || 18}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 5. Tax Breakdown & Grand Total Calculation */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-1">
                {/* Left: Amount in Words & Payment Settlement */}
                <div className="space-y-3 sm:max-w-xs flex-1">
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Amount in Words:
                    </span>
                    <p className="text-xs font-bold text-slate-900 italic mt-0.5">
                      {words}
                    </p>
                  </div>

                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Payment Settled & Verified</span>
                    </div>
                    <div className="text-[11px] text-emerald-950 font-mono space-y-0.5">
                      <p>
                        <span className="text-emerald-700">Mode:</span> {invoice.paymentMode || 'BANK_TRANSFER'}
                      </p>
                      <p>
                        <span className="text-emerald-700">UTR / Ref:</span>{' '}
                        <span className="font-bold">{invoice.utrNumber || 'VERIFIED'}</span>
                      </p>
                      <p>
                        <span className="text-emerald-700">Paid Date:</span>{' '}
                        {formatDate(invoice.paidDate || invoice.invoiceDate)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Tax Summary Block */}
                <div className="w-full sm:w-72 bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Taxable Amount:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      ₹{formatCurrency(taxableAmount)}
                    </span>
                  </div>

                  {cgstAmount > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>CGST (9.0%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{formatCurrency(cgstAmount)}
                      </span>
                    </div>
                  )}

                  {sgstAmount > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>SGST (9.0%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{formatCurrency(sgstAmount)}
                      </span>
                    </div>
                  )}

                  {igstAmount > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-600">
                      <span>IGST (18.0%):</span>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹{formatCurrency(igstAmount)}
                      </span>
                    </div>
                  )}

                  {invoice.roundOff !== 0 && (
                    <div className="flex justify-between py-0.5 text-slate-500 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono text-slate-700">
                        {invoice.roundOff > 0 ? `+₹${invoice.roundOff.toFixed(2)}` : `-₹${Math.abs(invoice.roundOff).toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-base font-black">
                      ₹{formatCurrency(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. Terms, Statutory Declarations & Digital Signatory */}
              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-end gap-4 text-[10px] text-slate-500">
                <div className="space-y-1 max-w-sm">
                  <p className="font-bold text-slate-700 uppercase tracking-wider">
                    Terms & Declarations:
                  </p>
                  <p>1. This is a computer-generated tax invoice issued under CGST Rules, 2017 (Rule 46).</p>
                  <p>2. Input Tax Credit (ITC) is subject to the conditions of Section 16 of the CGST Act, 2017.</p>
                  <p>3. Disputes, if any, shall be subject to the exclusive jurisdiction of courts in Mumbai.</p>
                </div>

                <div className="text-right border border-dashed border-slate-300 rounded-lg p-2.5 sm:min-w-[180px]">
                  <p className="font-bold text-slate-800">For Bharat Enterprise Technologies Pvt Ltd</p>
                  <div className="h-9 flex items-center justify-end">
                    <span className="text-[10px] font-mono text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      ✓ Digitally Signed & Authorized
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400">Authorized Signatory</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer (Hidden in Print) */}
          <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3 border-t border-slate-800/80 flex items-center justify-between no-print">
            <span className="text-xs text-slate-400">
              Invoice #{invoice.invoiceNumber}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all cursor-pointer min-h-[40px]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
