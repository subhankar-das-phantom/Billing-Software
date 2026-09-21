import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, TrendingUp, PackageCheck } from 'lucide-react';
import ProductWindow from './ProductWindow';
import { AUTH_ACTIONS } from '../data/navigation';
import {
  useTrialDaysQuery,
  useStartingPriceQuery,
  useShowcaseTelemetryQuery,
} from '../../../features/saas/queries/useSubscriptionPlansQuery';

export default function HeroSection() {
  const trialDays = useTrialDaysQuery();
  const minStartingPrice = useStartingPriceQuery();
  const telemetry = useShowcaseTelemetryQuery();

  const heroBadges = React.useMemo(
    () => [
      {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        text: 'Payment Received: ₹2,912.00 (Gupta Medicos)',
        position: 'bottom-8 -left-4',
      },
      {
        icon: <TrendingUp className="w-4 h-4 text-blue-400" />,
        text: 'Monthly Revenue: ₹3,90,546 (+93.4%)',
        position: 'top-14 -right-4',
      },
      {
        icon: <PackageCheck className="w-4 h-4 text-indigo-400" />,
        text: `Catalog: ${telemetry.productsCount} SKUs • ${telemetry.batchesCount} Active Batches`,
        position: 'bottom-20 -right-2',
      },
    ],
    [telemetry]
  );

  return (
    <section id="product" className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden">
      {/* Background ambient lighting - fixed anchor to eliminate CLS layout shift */}
      <div
        className="absolute top-48 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-500/10 dark:bg-blue-600/15 blur-[120px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Positioning Header (No superfluous eyebrows, headline speaks for itself) */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-50 tracking-tight leading-[1.12]">
            The Operating System for Modern Indian Distribution
          </h1>

          {/* Subheading (Concise, punchy, truthful) */}
          <p className="mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            From GST tax invoices and batch-level stock tracking to customer khata ledgers — run your distribution enterprise with complete operational clarity.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to={AUTH_ACTIONS.register.href}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-600/30 transition-all duration-150 group"
            >
              <span>{AUTH_ACTIONS.register.label}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <a
              href="#workflows"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-200 hover:text-slate-50 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl shadow-2xs transition-colors"
            >
              Explore Connected Workflow
            </a>
          </div>

          {/* Trust reassurance notice */}
          <p className="mt-3.5 text-xs text-slate-400">
            {trialDays}-day full access trial • Tiered plans starting from ₹{minStartingPrice.toLocaleString('en-IN')}/month
          </p>
        </div>

        {/* Hero Visual: Grand Product Showcase */}
        <div className="relative mt-8 sm:mt-12">
          <ProductWindow
            src="/landing/product/dashboard.png"
            alt="Bharat Enterprise Real Live Executive Dashboard"
            variant="hero"
            title="Executive Command Center"
            status="Live Telemetry"
            priority={true}
            badges={heroBadges}
          />
        </div>
      </div>
    </section>
  );
}
