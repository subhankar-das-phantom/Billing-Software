import React from 'react';
import { Scale, FileText, Building, CheckCircle } from 'lucide-react';

export default function GSTShowcase() {
  const complianceFeatures = [
    {
      icon: Scale,
      title: 'Automated Tax Split Engine',
      description: 'Intelligently applies 50/50 CGST and SGST splits for intra-state billing or 100% IGST for inter-state deliveries.',
    },
    {
      icon: FileText,
      title: 'Itemized HSN Code Mapping',
      description: 'Maintains canonical HSN codes across your catalog with standard tax slabs (0%, 5%, 12%, 18%, 28%).',
    },
    {
      icon: Building,
      title: 'Drug License (DL) & GSTIN Registers',
      description: 'Tracks buyer and seller GSTINs, Drug License numbers (Forms 20B/21B), and complete physical firm addresses.',
    },
    {
      icon: CheckCircle,
      title: 'Export-Ready Tax Registers',
      description: 'Export structured invoice and purchase ledgers for seamless compilation into GSTR-1 and GSTR-3B filings.',
    },
  ];

  return (
    <section id="gst" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-900/40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Narrative (No eyebrow kicker) */}
          <div className="lg:col-span-6 flex flex-col space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
              Built from the Ground Up for Indian Regulatory Standards
            </h2>

            <p className="text-base text-slate-400 leading-relaxed">
              Eliminate tax calculation errors and compliance headaches. Bharat Enterprise adheres strictly to the statutory invoicing rules prescribed by the Goods and Services Tax Council of India.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {complianceFeatures.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                    <Icon className="w-5 h-5 text-blue-400 mb-2" />
                    <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: High-Fidelity Tax Invoice Spec Card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl relative transition-colors">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div>
                  <span className="text-xs font-mono font-semibold uppercase text-blue-400">TAX INVOICE SPECIFICATION</span>
                  <h3 className="text-base font-bold text-slate-100 mt-0.5">Statutory Bill Layout</h3>
                </div>
                <span className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  GST Standard Validated
                </span>
              </div>

              {/* Sample Tax Row breakdown */}
              <div className="space-y-4 font-mono text-xs">
                <div className="p-3.5 rounded-lg bg-slate-850 border border-slate-800 shadow-2xs">
                  <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                    <span>SELLER GSTIN</span>
                    <span className="text-slate-200 font-semibold">06AAACB1234F1Z5</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>BUYER GSTIN</span>
                    <span className="text-slate-200 font-semibold">07AAACG8008H1Z8</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-850 border border-slate-800 space-y-2 shadow-2xs">
                  <div className="flex justify-between items-center text-slate-200 font-sans font-semibold">
                    <span>Ofloxacin 200mg + Ornidazole 500mg</span>
                    <span className="font-mono text-emerald-400 font-bold">₹850.00</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <div>HSN: <span className="text-slate-200">30049099</span></div>
                    <div>Batch: <span className="text-slate-200">B24-1003</span></div>
                    <div>Exp: <span className="text-slate-200">02/28</span></div>
                    <div>GST: <span className="text-blue-400 font-semibold">12%</span></div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-slate-850 border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Taxable Value</span>
                    <span className="text-slate-200">₹850.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Central GST (CGST @ 6.0%)</span>
                    <span className="text-slate-200">₹51.00</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>State GST (SGST @ 6.0%)</span>
                    <span className="text-slate-200">₹51.00</span>
                  </div>
                  <div className="flex justify-between text-slate-100 font-bold pt-2 border-t border-slate-800 text-xs">
                    <span>Total Invoice Amount</span>
                    <span className="text-emerald-400 font-extrabold">₹952.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
