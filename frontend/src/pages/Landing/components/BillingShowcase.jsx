import React from 'react';
import { Percent, Printer, FileText, Check } from 'lucide-react';
import ProductWindow from './ProductWindow';

export default function BillingShowcase() {
  const billingHighlights = [
    {
      icon: Percent,
      title: 'Automated GST Calculation',
      description: 'Applies CGST + SGST for intra-state billing or IGST for inter-state transactions based on customer state.',
    },
    {
      icon: Printer,
      title: 'Dual-Copy (2x) Print Mode',
      description: 'Generates original recipient copy and transporter/duplicate copy side-by-side in one unified print session.',
    },
    {
      icon: FileText,
      title: 'Instant Returns & Credit Notes',
      description: 'Create itemized return vouchers directly from any existing invoice, adjusting customer balance and stock seamlessly.',
    },
  ];

  return (
    <section id="billing" className="py-16 sm:py-20 lg:py-24 border-t border-slate-800 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-14 items-center">
          {/* Left Column: Descriptive Narrative & Feature Highlights */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-6">
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-blue-500 mb-2.5">
                BILLING & TAX
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
                GST-Ready Invoicing Built for Indian Commercial Trade
              </h2>
            </div>

            <p className="text-base text-slate-400 leading-relaxed">
              Generate itemized tax invoices with HSN details, batch numbers, expiry dates, and CGST/SGST/IGST tax breakdowns.
            </p>

            {/* Feature Highlights with Rounded Blue-Tinted Icon Containers */}
            <div className="space-y-4 pt-1">
              {billingHighlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0 mt-0.5">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro proof pill */}
            <div className="pt-2 flex items-center space-x-2 text-xs text-slate-400">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Format designed for pharmaceuticals, FMCG, and wholesale distributors</span>
            </div>
          </div>

          {/* Right Column: Framed Screenshot with macOS Chrome */}
          <div className="lg:col-span-7 xl:col-span-7">
            <ProductWindow
              src="/landing/product/invoice.webp"
              mobileSrc="/landing/product/invoice-mobile.webp"
              mobileSmallSrc="/landing/product/invoice-sm.webp"
              alt="Bharat Enterprise tax invoice preview showing customer GSTIN, itemized HSN breakdown, and dual-copy printing"
              variant="window"
              title="Tax Invoice Details & Dual-Copy Print"
              status="Settled • ₹2,912.00"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
