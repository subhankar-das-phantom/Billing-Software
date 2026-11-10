/**
 * Bharat Enterprise Billing System — Platform B2B Statutory GST Tax Invoice Drawer
 * Slide-over inspection drawer for statutory SAC 998313 tax invoices issued to tenants.
 * Features dual supplier/recipient B2B GST compliance headers, itemized SAC breakdown,
 * exact paise currency precision, Indian numbering system amount-in-words generator,
 * settlement audit snapshot, and 1-click browser print / PDF export.
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Printer,
  X,
  Building2,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import api from '../../services/api';
import type { PlatformTaxInvoiceDTO } from '../../types';

export interface TaxInvoiceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId?: string | null;
  invoiceData?: PlatformTaxInvoiceDTO | null;
}

// ─── Indian Numbering System Amount-In-Words Converter ──────────────
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(n: number): string {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  } else if (n > 0) {
    str += ONES[n];
  }
  return str.trim();
}

function numberToIndianRupeesWords(num: number): string {
  if (!num || isNaN(num) || num === 0) return 'Zero Rupees Only';

  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  const rupeePart = parts[0] ?? '0';
  const paisePart = parts[1] ?? '0';
  let rupees = parseInt(rupeePart, 10);
  const paise = parseInt(paisePart, 10);

  let result = '';

  // Crores (10,000,000)
  if (rupees >= 10000000) {
    const crores = Math.floor(rupees / 10000000);
    result += convertBelowThousand(crores) + ' Crore ';
    rupees %= 10000000;
  }

  // Lakhs (100,000)
  if (rupees >= 100000) {
    const lakhs = Math.floor(rupees / 100000);
    result += convertBelowThousand(lakhs) + ' Lakh ';
    rupees %= 100000;
  }

  // Thousands (1,000)
  if (rupees >= 1000) {
    const thousands = Math.floor(rupees / 1000);
    result += convertBelowThousand(thousands) + ' Thousand ';
    rupees %= 1000;
  }

  // Hundreds & Below
  if (rupees > 0) {
    result += convertBelowThousand(rupees);
  }

  result = result.trim() + ' Rupees';

  if (paise > 0) {
    result += ' and ' + convertBelowThousand(paise) + ' Paise';
  }

  return result + ' Only';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDateIST(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// Fallback Issuer profile for statutory invoice compliance
const DEFAULT_SUPPLIER = {
  legalName: 'Bharat Enterprise Technologies Private Limited',
  tradeName: 'Bharat Enterprise Platform',
  gstin: '27AABCB1234M1Z5',
  stateCode: '27',
  stateName: 'Maharashtra',
  address: 'Level 14, Tower B, Tech Horizon Business Park, BKC, Mumbai - 400051',
  email: 'billing@bharatenterprise.com',
  phone: '+91 22 4567 8900',
};

export const TaxInvoiceDrawer: React.FC<TaxInvoiceDrawerProps> = ({
  isOpen,
  onClose,
  invoiceId,
  invoiceData,
}) => {
  const [copiedUTR, setCopiedUTR] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Query invoice data if invoiceId is provided and invoiceData not passed
  const { data: fetchedInvoice, isLoading } = useQuery({
    queryKey: ['platform-invoice', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      try {
        const res = await api.get<{ success: boolean; data: PlatformTaxInvoiceDTO }>(
          `/subscriptions/invoices/${invoiceId}`
        );
        return res.data.data;
      } catch {
        return null;
      }
    },
    enabled: isOpen && Boolean(invoiceId) && !invoiceData,
    staleTime: 60000,
  });

  const invoice: PlatformTaxInvoiceDTO | null = invoiceData || fetchedInvoice || null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyUTR = (utr?: string) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr);
    setCopiedUTR(true);
    setTimeout(() => setCopiedUTR(false), 2000);
  };

  if (typeof document === 'undefined') return null;

  const supplier = invoice?.supplier || DEFAULT_SUPPLIER;
  const recipient = invoice?.recipient;
  const items = invoice?.items || [];
  const grandTotal = invoice?.grandTotal || 0;
  const inWords = invoice?.amountInWords || numberToIndianRupeesWords(grandTotal);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end overflow-hidden no-print select-none">
          {/* Backdrop with smooth opacity fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Slide-over Inspection Drawer with GPU-accelerated X-slide */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            role="dialog"
            aria-modal="true"
            aria-label="Statutory Tax Invoice"
            className="relative z-10 w-full max-w-3xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl shadow-black/90 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Sticky Drawer Header ───────────────────────────────── */}
            <div className="sticky top-0 z-20 shrink-0 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur-xs min-h-[56px]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-100 font-mono tracking-tight truncate">
                      {invoice?.invoiceNumber || (invoiceId ? `INV-${invoiceId}` : 'Tax Invoice')}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {invoice?.status || 'ISSUED'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Statutory B2B GST Tax Invoice • Dated: {formatDateIST(invoice?.invoiceDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 cursor-pointer min-h-[36px]"
                  title="Print / Save as PDF"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Print / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer"
                  aria-label="Close drawer"
                >
                  <X className="w-5 h-5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* ── Scrollable Document Content Body ──────────────────── */}
            <div
              ref={printRef}
              className="p-5 overflow-y-auto flex-1 overscroll-contain space-y-6 text-xs text-slate-200"
            >
              {isLoading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading statutory tax invoice record...</p>
                </div>
              ) : !invoice && !invoiceId ? (
                <div className="py-20 text-center space-y-2 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
                  <p>No invoice selected.</p>
                </div>
              ) : (
                <>
                  {/* Document Title Banner */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                        TAX INVOICE (RULE 46 OF CGST RULES, 2017)
                      </div>
                      <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                        {invoice?.invoiceNumber || 'PL-INV-2026-27-00001'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">Financial Year</div>
                      <div className="text-xs font-semibold text-slate-200 font-mono">
                        {invoice?.financialYear || '2026-27'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Invoice Date</div>
                      <div className="text-xs font-semibold text-slate-200 font-mono">
                        {formatDateIST(invoice?.invoiceDate)}
                      </div>
                    </div>
                  </div>

                  {/* Dual Supplier & Recipient B2B Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Platform Issuer (Supplier) */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                        <Building2 className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
                          Issuer (Supplier)
                        </span>
                      </div>
                      <div className="font-semibold text-slate-100 text-sm">{supplier.legalName}</div>
                      <div className="text-slate-400 text-[11px] leading-relaxed">
                        {supplier.address}
                      </div>
                      <div className="pt-1 space-y-1 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400">GSTIN: </span>
                          <span className="font-semibold text-slate-200">{supplier.gstin}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">State / Code: </span>
                          <span className="text-slate-200">
                            {supplier.stateName} ({supplier.stateCode})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Email: </span>
                          <span className="text-slate-200">{supplier.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tenant Recipient */}
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
                          Recipient (B2B Customer)
                        </span>
                      </div>
                      <div className="font-semibold text-slate-100 text-sm">
                        {recipient?.firmName || 'Tenant Account'}
                      </div>
                      <div className="text-slate-400 text-[11px] leading-relaxed">
                        {recipient?.address || 'Registered Tenant Address'}
                      </div>
                      <div className="pt-1 space-y-1 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400">GSTIN: </span>
                          <span className="font-semibold text-slate-200">
                            {recipient?.gstin || 'Unregistered / Consumer'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Place of Supply: </span>
                          <span className="text-slate-200">
                            {recipient?.stateName || 'Maharashtra'} ({recipient?.stateCode || '27'})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Email: </span>
                          <span className="text-slate-200">{recipient?.email || '—'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Items Table ───────────────────────────────────────── */}
                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Description of Services</th>
                          <th className="py-2.5 px-3 text-center">SAC</th>
                          <th className="py-2.5 px-3 text-right">Taxable</th>
                          <th className="py-2.5 px-3 text-right">GST Rate</th>
                          <th className="py-2.5 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                        {items.length > 0 ? (
                          items.map((item, index) => (
                            <tr key={index} className="hover:bg-slate-800/30">
                              <td className="py-3 px-3 text-slate-400">{index + 1}</td>
                              <td className="py-3 px-3 font-sans">
                                <div className="font-semibold text-slate-200">
                                  {item.description}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Tenure: {item.durationMonths} Months
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center text-slate-300">
                                {item.sacCode || '998313'}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-200">
                                {formatCurrency(item.taxableAmount)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                                {item.cgstRate && item.sgstRate
                                  ? `CGST ${item.cgstRate}% + SGST ${item.sgstRate}%`
                                  : `IGST ${item.igstRate || 18}%`}
                              </td>
                              <td className="py-3 px-3 text-right font-semibold text-slate-100">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="py-3 px-3 text-slate-400">1</td>
                            <td className="py-3 px-3 font-sans">
                              <div className="font-semibold text-slate-200">
                                SaaS Platform Subscription Access Fee
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Multi-Tenant Cloud ERP & Statutory Billing Software
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center text-slate-300">998313</td>
                            <td className="py-3 px-3 text-right text-slate-200">
                              {formatCurrency(invoice?.subtotal || 0)}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                              {invoice?.cgst && invoice?.sgst
                                ? 'CGST 9% + SGST 9%'
                                : 'IGST 18%'}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-slate-100">
                              {formatCurrency(grandTotal)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* ── Totals & Round-Off Card ───────────────────────────── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    {/* Amount in Words */}
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Invoice Amount in Words (INR)
                      </div>
                      <div className="font-serif italic text-slate-200 text-xs leading-relaxed">
                        "{inWords}"
                      </div>
                    </div>

                    {/* Tax & Total Calculation Breakdown */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Taxable Subtotal:</span>
                        <span className="text-slate-200">
                          {formatCurrency(invoice?.subtotal || 0)}
                        </span>
                      </div>

                      {invoice?.cgst && invoice?.sgst ? (
                        <>
                          <div className="flex justify-between text-slate-400">
                            <span>Central GST (CGST 9%):</span>
                            <span className="text-slate-200">{formatCurrency(invoice.cgst)}</span>
                          </div>
                          <div className="flex justify-between text-slate-400">
                            <span>State GST (SGST 9%):</span>
                            <span className="text-slate-200">{formatCurrency(invoice.sgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-400">
                          <span>Integrated GST (IGST 18%):</span>
                          <span className="text-slate-200">
                            {formatCurrency(invoice?.igst || 0)}
                          </span>
                        </div>
                      )}

                      {invoice?.roundOff !== undefined && invoice?.roundOff !== 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Round Off:</span>
                          <span className="text-slate-200">
                            {invoice.roundOff > 0 ? `+${invoice.roundOff.toFixed(2)}` : invoice.roundOff.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
                        <span className="font-semibold text-slate-100 font-sans">Total Payable:</span>
                        <span className="font-bold text-emerald-400 font-mono text-base">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Payment Settlement Snapshot ───────────────────────── */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-slate-100 text-xs uppercase tracking-wider">
                        Payment Settlement Snapshot
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 font-sans">Payment Mode</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {invoice?.payment?.mode || 'OFFLINE / NEFT'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          UTR / Reference Number
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-200 truncate">
                            {invoice?.payment?.utrNumber || 'N/A'}
                          </span>
                          {invoice?.payment?.utrNumber && (
                            <button
                              type="button"
                              onClick={() => handleCopyUTR(invoice.payment.utrNumber)}
                              className="text-slate-400 hover:text-slate-200 p-0.5"
                              title="Copy UTR"
                            >
                              {copiedUTR ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 font-sans">Clearing Date</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {formatDateIST(
                            invoice?.payment?.clearingDate || invoice?.payment?.paidDate || invoice?.invoiceDate
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Digital Verification & Legal Disclaimer */}
                  <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3 text-slate-400 text-[11px] leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      This is a digitally generated tax invoice per Rule 46 of CGST Rules, 2017.
                      Platform electronic signature authenticated by Bharat Enterprise Control Plane.
                      No physical signature required.
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Pinned Bottom Bar ──────────────────────────────────── */}
            <div className="sticky bottom-0 z-20 shrink-0 px-5 py-3 bg-slate-900/95 backdrop-blur-xs border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                SAC 998313 • Statutory SaaS Information Technology Services
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors min-h-[40px]"
              >
                Close Drawer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default TaxInvoiceDrawer;
