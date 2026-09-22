import React from 'react';
import { ArrowRight } from 'lucide-react';
import { WORKFLOW_STEPS } from '../data/features';

export default function BusinessFlow() {
  return (
    <section id="workflows" className="py-16 sm:py-20 lg:py-24 border-t border-slate-800/80 bg-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header (No eyebrow kicker) */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight leading-tight">
            How Data Flows Through Your Enterprise
          </h2>

          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Every transaction is interconnected. From supplier procurement to invoice generation and ledger reconciliation, data updates automatically across inventory, invoices, and ledgers.
          </p>
        </div>

        {/* 6-Step Workflow Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {WORKFLOW_STEPS.map((item, idx) => (
            <div
              key={idx}
              className="relative flex flex-col p-6 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-200 group shadow-xs"
            >
              {/* Step counter pill */}
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs font-bold text-blue-400 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  STEP {item.step}
                </span>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                )}
              </div>

              <h3 className="text-lg font-semibold text-slate-100 tracking-tight mb-2">
                {item.title}
              </h3>

              <p className="text-sm text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
