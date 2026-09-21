import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { AUTH_ACTIONS } from '../data/navigation';
import {
  useTrialDaysQuery,
  useStartingPriceQuery,
} from '../../../features/saas/queries/useSubscriptionPlansQuery';

export default function FinalCTA() {
  const trialDays = useTrialDaysQuery();
  const minStartingPrice = useStartingPriceQuery();

  return (
    <section className="py-20 lg:py-28 border-t border-slate-800/80 bg-slate-950 relative overflow-hidden transition-colors">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-8 sm:p-14 text-center shadow-xl transition-colors">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-50 tracking-tight leading-tight max-w-2xl mx-auto">
            Ready to Streamline Your Distribution & Billing?
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Eliminate ledger errors, track batch expiry with precision, and generate compliant GST invoices.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to={AUTH_ACTIONS.register.href}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-150 group"
            >
              <span>{AUTH_ACTIONS.register.label}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              to={AUTH_ACTIONS.login.href}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-medium text-slate-200 hover:text-slate-50 bg-slate-850 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors"
            >
              {AUTH_ACTIONS.login.label}
            </Link>
          </div>

          {/* Value points */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{trialDays}-Day Trial Period</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Full GST Compliance</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Plans from ₹{minStartingPrice.toLocaleString('en-IN')}/mo</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
