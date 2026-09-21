import React from 'react';
import {
  Users,
  Search,
  Download,
  Store,
  CreditCard,
  History,
} from 'lucide-react';

export default function FeatureGrid() {
  const capabilities = [
    {
      icon: Users,
      title: 'Staff Roles & Permissions',
      description: 'Assign distinct roles for administrators and employees, ensuring billing staff cannot alter critical settings or view restricted financials.',
    },
    {
      icon: History,
      title: 'Immutable Audit Trail',
      description: 'Every major administrative action — price edits, voided invoices, manual balance entries — is logged with user and timestamp context.',
    },
    {
      icon: Search,
      title: 'Universal Keyboard Navigation',
      description: 'Press Ctrl+K / ⌘K from anywhere in the application to jump instantly between customers, invoices, products, and reports.',
    },
    {
      icon: Download,
      title: 'Flexible Data Exports',
      description: 'Export customer statements, stock summaries, purchase orders, and GST sales registers directly into CSV and PDF formats.',
    },
    {
      icon: Store,
      title: 'Supplier & Vendor Profiles',
      description: 'Maintain detailed supplier registries with GSTIN, terms, bank details, and cumulative procurement history.',
    },
    {
      icon: CreditCard,
      title: 'Multi-Mode Payment Receipts',
      description: 'Record settlements across Cash, UPI, Cheque, and NEFT/RTGS with reference numbers and instant printable vouchers.',
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-900/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (No eyebrow kicker) */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
            Complete Toolkit for Everyday Enterprise Operations
          </h2>

          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Beyond core billing and inventory, Bharat Enterprise gives you the operational governance tools required to run a disciplined commercial business.
          </p>
        </div>

        {/* 6-Card Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-200 shadow-2xs group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-850 border border-slate-800 flex items-center justify-center text-blue-400 mb-4 group-hover:border-slate-700 transition-colors shadow-2xs">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100 tracking-tight mb-2">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
