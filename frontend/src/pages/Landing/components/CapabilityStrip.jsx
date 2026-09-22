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

const CAPABILITIES = [
  { icon: FileText, label: 'GST Invoicing' },
  { icon: Boxes, label: 'Batch-Level Inventory' },
  { icon: BookOpen, label: 'Customer Khata' },
  { icon: Printer, label: 'Dual-Copy Invoicing' },
  { icon: ShoppingBag, label: 'Purchase Orders' },
  { icon: BarChart3, label: 'Financial Telemetry' },
  { icon: ShieldCheck, label: 'Role-Based Access' },
];

export default function CapabilityStrip() {
  return (
    <section
      className="relative py-6 border-y border-slate-800/80 bg-slate-900/50 transition-colors select-none"
      aria-label="Core Capabilities"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 mb-3.5">
          Engineered for Indian Distribution
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 sm:gap-x-7 gap-y-2.5 text-xs font-medium text-slate-300">
          {CAPABILITIES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <React.Fragment key={idx}>
                <div className="inline-flex items-center space-x-2 text-slate-300 hover:text-slate-100 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {idx < CAPABILITIES.length - 1 && (
                  <span className="hidden sm:inline text-slate-600 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}
