import React from 'react';
import { BookOpen, Receipt, FileSpreadsheet, Check } from 'lucide-react';
import ProductWindow from './ProductWindow';

export default function CustomerShowcase() {
  const ledgerHighlights = [
    {
      icon: BookOpen,
      title: 'Real-Time Running Account Balances',
      description: 'Every invoice, partial payment, debit entry, or credit note automatically reflects in the customer\'s cumulative balance.',
    },
    {
      icon: Receipt,
      title: 'Payment Receipts & Reconciliation',
      description: 'Record cash, cheque, UPI, or NEFT/RTGS collections with payment mode, date, and reference numbers for clean reconciliation.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Complete Ledger Statement History',
      description: 'Review chronological debit and credit movements, verify opening balances, and export detailed account statements for clients.',
    },
  ];

  return (
    <section id="ledger" className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Descriptive Narrative (No eyebrow kicker) */}
          <div className="lg:col-span-5 flex flex-col space-y-6">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
              Maintain Complete Customer Khata and Running Balances
            </h2>

            <p className="text-base text-slate-400 leading-relaxed">
              Track outstanding balances per customer account without spreadsheet drift. View complete invoice histories, record collections, and issue official payment receipts.
            </p>

            <div className="space-y-4 pt-2">
              {ledgerHighlights.map((item, idx) => {
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

            <div className="pt-2 flex items-center space-x-2 text-xs text-slate-400">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Stores customer GSTIN, Drug License (DL), phone, and address profile</span>
            </div>
          </div>

          {/* Right Column: Standard Product Window */}
          <div className="lg:col-span-7">
            <ProductWindow
              src="/landing/product/customer-ledger.png"
              alt="Customer Ledger Profile and Outstanding Balance in Bharat Enterprise"
              variant="standard"
              title="Customer Profile: Sharma Medicals"
              status="Outstanding: ₹430.64"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
