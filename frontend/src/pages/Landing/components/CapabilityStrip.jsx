import React from 'react';
import {
  FileText,
  Boxes,
  Users,
  Copy,
  Truck,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'GST Invoicing',
    subtitle: '(HSN & Tax Splits)',
  },
  {
    icon: Boxes,
    title: 'Batch-Level',
    subtitle: 'Inventory & Expiry',
  },
  {
    icon: Users,
    title: 'B2B Customer',
    subtitle: 'Khata & Ledgers',
  },
  {
    icon: Copy,
    title: 'Dual-Copy Invoicing',
    subtitle: '(Customer & Transport)',
  },
  {
    icon: Truck,
    title: 'Supplier &',
    subtitle: 'Purchase Orders',
  },
  {
    icon: BarChart3,
    title: 'Financial Telemetry',
    subtitle: '& Cash Flow',
  },
  {
    icon: ShieldCheck,
    title: 'Role-Based Access',
    subtitle: '(Admin & Staff)',
  },
];

export default function CapabilityStrip() {
  return (
    <section
      className="relative py-7 sm:py-8 border-y border-slate-800 bg-slate-900/60 transition-colors select-none"
      aria-label="Core Capabilities"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-6">
          Engineered for Indian Distribution
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 lg:gap-3 xl:gap-5 items-center">
          {CAPABILITIES.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-center space-x-2.5 min-w-0">
                <Icon className="w-5 h-5 text-blue-500 shrink-0" aria-hidden="true" />
                <div className="text-left min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-100 leading-tight truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-400 leading-tight truncate mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
