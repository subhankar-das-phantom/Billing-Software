import React from 'react';
import { Percent, Printer, RefreshCcw, Check } from 'lucide-react';
import ProductWindow from './ProductWindow';

export default function BillingShowcase() {
  const billingHighlights = [
    {
      icon: Percent,
      title: 'Automated GST Calculation',
      description: 'Splits CGST + SGST for intra-state billing or applies IGST for inter-state transactions based on customer state.',
    },
    {
      icon: Printer,
      title: 'Dual-Copy (2x) Print Mode',
      description: 'Generates original recipient copy and transporter/duplicate copy side-by-side in one unified print session.',
    },
    {
      icon: RefreshCcw,
      title: 'Instant Returns & Credit Notes',
      description: 'Create itemized return vouchers directly from any existing invoice, adjusting customer balance and stock seamlessly.',
    },
  ];

  return (
    <section id="billing" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Descriptive Narrative (No eyebrow kicker) */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
              GST-Ready Invoicing Built for Indian Commercial Trade
            </h2>

            <p className="text-base text-slate-400 leading-relaxed">
              Generate itemized tax invoices with HSN details, batch numbers, expiry dates, and CGST/SGST/IGST tax breakdowns.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4 pt-2">
              {billingHighlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-start space-x-3.5">
                    <div className="p-2 rounded-lg bg-slate-850 border border-slate-800 text-blue-400 shrink-0 mt-0.5">
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
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Format designed for pharmaceuticals, FMCG, and wholesale distributors</span>
            </div>
          </div>

          {/* Right Column: Editorial Framed Screenshot */}
          <div className="lg:col-span-7">
            <ProductWindow
              src="/landing/product/invoice.webp"
              mobileSrc="/landing/product/invoice-mobile.webp"
              mobileSmallSrc="/landing/product/invoice-sm.webp"
              alt="Bharat Enterprise tax invoice preview showing customer GSTIN, itemized HSN breakdown, and dual-copy printing"
              variant="editorial"
              title="Tax Invoice Details & Dual-Copy Print"
              status="Settled • ₹2,912.00"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
