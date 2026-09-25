import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Package } from 'lucide-react';
import ProductWindow from './ProductWindow';
import { AUTH_ACTIONS } from '../data/navigation';
import { useSubscriptionPlansQuery } from '../../../features/saas/queries/useSubscriptionPlansQuery';

export default function HeroSection() {
  const { data: plansData, isError } = useSubscriptionPlansQuery();
  const trialDays = plansData?.trialDays;
  const minStartingPrice = plansData?.minStartingPrice;
  const telemetry = plansData?.telemetry || {
    productsCount: 50,
    batchesCount: 112,
    firmName: 'Bharat Healthcare & Distributors',
  };

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
          <div className="lg:col-span-6 flex flex-col justify-center text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 sm:mb-4">
              BUILT FOR INDIAN DISTRIBUTORS, WHOLESALERS & RETAIL ENTERPRISES
            </p>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[40px] xl:text-[46px] 2xl:text-[48px] font-bold text-slate-50 tracking-tight leading-[1.14]">
              <span className="lg:block">The Operating System for </span>
              <span>Modern Indian Distribution</span>
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
            <p className="mt-5 sm:mt-6 pt-1 text-xs text-slate-400">
              {!isError && trialDays && minStartingPrice ? (
                <>
                  {trialDays}-day full access trial • Tiered plans starting from ₹{minStartingPrice.toLocaleString('en-IN')}/month
                </>
              ) : (
                'Flexible plans for growing distribution businesses'
              )}
            </p>
          </div>

          {/* Right Column: Hero Visual with Product Window & Floating Cards */}
          <div className="lg:col-span-6 relative">
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

            {/* Floating Notification Cards Stacked on Right Edge with Distinct Glassmorphism */}
            <div className="hidden xl:flex flex-col gap-3.5 absolute -right-6 2xl:-right-10 top-1/2 -translate-y-1/2 z-30 w-[256px] select-none pointer-events-auto">
              {/* Card 1: Monthly Revenue */}
              <div className="group/card bg-slate-900/90 backdrop-blur-xl border border-slate-750/90 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-2xl hover:border-blue-500/40 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                    Showcase metrics
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Sample
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">
                      Monthly Revenue
                    </div>
                    <div className="text-sm font-bold text-slate-100 tracking-tight">
                      ₹3,90,546 <span className="font-medium text-emerald-400 text-xs">(+93.4%)</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      vs. last month
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Catalog */}
              <div className="group/card bg-slate-900/90 backdrop-blur-xl border border-slate-750/90 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] hover:shadow-2xl hover:border-slate-650 hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Showcase snapshot
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Sample
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">
                      Active Catalog
                    </div>
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {telemetry.productsCount} SKUs • {telemetry.batchesCount} Batches
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Inventory overview
                    </div>
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
