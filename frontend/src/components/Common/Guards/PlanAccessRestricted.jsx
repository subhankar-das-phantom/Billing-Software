import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, LayoutDashboard } from 'lucide-react';
import { FEATURE_LABELS, FEATURE_TIER_NAMES } from '../../../saas/features';

export default function PlanAccessRestricted({ feature, currentPlan = 'Starter' }) {
  const navigate = useNavigate();
  const featureName = FEATURE_LABELS[feature] || 'Enterprise Capability';
  const requiredTier = FEATURE_TIER_NAMES[feature] || 'Business';
  const SUPPORT_EMAIL = 'support.bharatenterprise@gmail.com';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4 text-center">
      <div className="glass-card max-w-lg w-full p-8 border border-slate-800 bg-slate-900/80 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Lock Icon */}
          <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          {/* Title & Tier Badge */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {requiredTier} Plan Required
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {featureName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              This domain is not included in your current <span className="text-slate-200 font-semibold">{currentPlan}</span> plan. Upgrade to the <span className="text-blue-400 font-semibold">{requiredTier}</span> plan to unlock full access.
            </p>
          </div>

          {/* Support Email helper */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
            To upgrade or renew your plan, contact{' '}
            <a 
              href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade%20Inquiry%20for%20${encodeURIComponent(featureName)}`} 
              className="text-blue-400 hover:underline font-mono"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
            <button
              onClick={() => navigate('/subscription')}
              className="w-full sm:flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              Contact us to upgrade this plan.
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
