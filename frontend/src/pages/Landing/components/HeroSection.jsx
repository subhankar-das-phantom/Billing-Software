import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Package } from 'lucide-react';
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

  return (
    <section id="product" className="relative pt-16 pb-12 sm:pt-20 sm:pb-16 lg:pt-20 lg:pb-16 overflow-hidden">
      {/* Background ambient lighting - fixed anchor to eliminate CLS layout shift */}
      <div
        className="absolute top-48 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-500/10 dark:bg-blue-600/15 blur-[120px] rounded-full pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
          {/* Left Column: Eyebrow, Headline, Subtitle, CTAs & Trial Info */}
          <div className="lg:col-span-5 flex flex-col justify-center text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 sm:mb-4">
              TRUSTED BY INDIAN DISTRIBUTORS, WHOLESALERS & RETAIL ENTERPRISES
            </p>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-bold text-slate-50 tracking-tight leading-[1.12]">
              The Operating System for Modern Indian Distribution
            </h1>

            <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              From GST tax invoices and batch-level stock tracking to customer khata ledgers — run your distribution enterprise with complete operational clarity.
            </p>

            {/* Side-by-side action buttons matching reference mockup */}
            <div className="mt-6 sm:mt-7 flex flex-wrap items-center gap-3 sm:gap-4">
              <Link
                to={AUTH_ACTIONS.register.href}
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-sm transition-colors group"
              >
                <span>{AUTH_ACTIONS.register.label}</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <a
                href="#workflows"
                className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium text-slate-200 hover:text-slate-50 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl shadow-2xs transition-colors"
              >
                Explore Connected Workflow
              </a>
            </div>

            {/* Reassurance notice */}
            <p className="mt-3.5 text-xs text-slate-400">
              {trialDays}-day full access trial • Tiered plans starting from ₹{minStartingPrice.toLocaleString('en-IN')}/month
            </p>
          </div>

          {/* Right Column: Hero Visual with Product Window & Floating Cards */}
          <div className="lg:col-span-7 relative">
            <ProductWindow
              src="/landing/product/dashboard-v2.webp"
              mobileSrc="/landing/product/dashboard-v2-mobile.webp"
              mobileSmallSrc="/landing/product/dashboard-v2-sm.webp"
              alt="Bharat Enterprise executive dashboard showing revenue, collections, receivables and inventory metrics"
              variant="hero"
              title="Executive Command Center"
              status="Showcase data"
              priority={true}
              badges={[]}
            />

            {/* Floating Notification Cards Stacked on Right Edge */}
            <div className="hidden xl:flex flex-col gap-3 absolute -right-4 2xl:-right-8 top-1/2 -translate-y-1/2 z-20 w-[240px] select-none">
              {/* Card 2: Monthly Revenue */}
              <div className="flex items-start gap-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl hover:shadow-2xl transition-all">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Monthly Revenue
                  </div>
                  <div className="text-xs font-bold text-slate-200">
                    ₹3,90,546 <span className="font-medium text-emerald-500 text-[11px]">(+93.4%)</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    vs. last month
                  </div>
                </div>
              </div>

              {/* Card 3: Catalog */}
              <div className="flex items-start gap-3 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-xl hover:shadow-2xl transition-all">
                <div className="w-8 h-8 rounded-lg bg-slate-850 border border-slate-750 flex items-center justify-center shrink-0 mt-0.5">
                  <Package className="w-4 h-4 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Catalog
                  </div>
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {telemetry.productsCount} SKUs • {telemetry.batchesCount} Active Batches
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Across all categories
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
