import React from 'react';
import {
  FileText,
  Boxes,
  BookOpen,
  Printer,
  ShoppingBag,
  ShieldCheck,
  BarChart3,
} from 'lucide-react';

const CAPABILITY_PILLS = [
  { icon: FileText, label: 'GST Invoicing (HSN & Tax Splits)' },
  { icon: Boxes, label: 'Batch-Level Inventory & Expiry' },
  { icon: BookOpen, label: 'B2B Customer Khata & Ledgers' },
  { icon: Printer, label: 'Dual-Copy Invoicing (Customer & Transport)' },
  { icon: ShoppingBag, label: 'Supplier & Purchase Orders' },
  { icon: BarChart3, label: 'Financial Telemetry & Cash Flow' },
  { icon: ShieldCheck, label: 'Role-Based Access (Admin & Staff)' },
];

export default function CapabilityStrip() {
  return (
    <section className="relative py-7 border-y border-slate-800/80 bg-slate-850/60 transition-colors" aria-label="Core Capabilities">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
          Engineered for Indian Distributors, Wholesalers & Retail Enterprises
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {CAPABILITY_PILLS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 shadow-2xs hover:border-slate-700 hover:text-slate-100 transition-colors"
              >
                <Icon className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
