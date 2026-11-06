import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Clock,
  X,
  ArrowRight,
  Sparkles,
  Tag,
  Bell,
  Copy,
  Check,
} from 'lucide-react';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSubscription } from '../../contexts/SubscriptionContext';
import api from '../../services/api';

const SUPPORT_EMAIL = 'support.bharatenterprise@gmail.com';

/**
 * SubscriptionBanner — shown in DashboardLayout when subscription
 * is in grace period, expired, or trial ending soon, or when an active
 * promotional campaign/offer is available.
 * Fully responsive with Zero-CLS GPU-accelerated transitions.
 */
export default function SubscriptionBanner() {
  const { isGrace, isExpired, isTrial, daysRemaining, planName } = useSubscription();
  const navigate = useNavigate();

  // ─── Subscription Alert Dismissal ──────────────────────────────
  const [subDismissed, setSubDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('dismissed_subscription_banner') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissSub = () => {
    setSubDismissed(true);
    try {
      sessionStorage.setItem('dismissed_subscription_banner', 'true');
    } catch {
      // Ignore storage errors in private browsing
    }
  };

  // ─── Active Promotional Offers Query ────────────────────────────
  const { data: activeOffers } = useQuery({
    queryKey: ['saas-active-offers'],
    queryFn: async () => {
      try {
        const res = await api.get('/saas/offers/active');
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
    retry: false,
  });

  // ─── Promo Dismissal & Copy State ───────────────────────────────
  const [dismissedPromoIds, setDismissedPromoIds] = useState(() => {
    const set = new Set();
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('dismissed_promo_')) {
          set.add(key.replace('dismissed_promo_', ''));
        }
      }
    } catch {
      // Storage access safety
    }
    return set;
  });

  const [copiedCode, setCopiedCode] = useState(null);

  const handleCopyPromo = useCallback((code) => {
    if (!code) return;
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => {
        setCopiedCode(null);
      }, 2000);
    } catch {
      // Clipboard fallback
    }
  }, []);

  const handleDismissPromo = useCallback((offerId) => {
    if (!offerId) return;
    try {
      sessionStorage.setItem(`dismissed_promo_${offerId}`, 'true');
    } catch {
      // Ignore storage errors
    }
    setDismissedPromoIds((prev) => new Set([...prev, offerId]));
  }, []);

  // Determine if subscription warning applies
  const showSubAlert =
    !subDismissed && (isGrace || isExpired || (isTrial && daysRemaining <= 7));

  // Determine the active promotional offer to show
  const activePromo = (activeOffers || []).find((offer) => {
    const offerKey = String(offer._id || offer.promoCode || '');
    return offerKey && !dismissedPromoIds.has(offerKey);
  });

  // If neither banner applies, render nothing
  if (!showSubAlert && !activePromo) {
    return null;
  }

  // ─── Subscription Alert Styling & Node ──────────────────────────
  let subBgClass, subBorderClass, subIconColor, SubIcon, subTitle, subButtonLabel, subMessageNode;

  if (showSubAlert) {
    if (isExpired) {
      subBgClass = 'bg-red-500/10';
      subBorderClass = 'border-red-500/30';
      subIconColor = 'text-red-400';
      SubIcon = AlertTriangle;
      subTitle = 'Subscription Expired';
      subButtonLabel = 'Renew Subscription';
      subMessageNode = (
        <span>
          Your account is in read-only mode. To renew your plan, contact us at{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Subscription%20Renewal%20Inquiry`}
            className="text-red-300 hover:text-red-200 underline font-medium break-all"
          >
            {SUPPORT_EMAIL}
          </a>.
        </span>
      );
    } else if (isGrace) {
      subBgClass = 'bg-amber-500/10';
      subBorderClass = 'border-amber-500/30';
      subIconColor = 'text-amber-400';
      SubIcon = Clock;
      subTitle = 'Grace Period Active';
      subButtonLabel = 'Renew Plan';
      subMessageNode = (
        <span>
          Your subscription has expired (
          <strong className="text-amber-200 font-semibold">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
          </strong>
          ). To renew, contact{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Grace%20Period%20Renewal%20Inquiry`}
            className="text-amber-300 hover:text-amber-200 underline font-medium break-all"
          >
            {SUPPORT_EMAIL}
          </a>.
        </span>
      );
    } else {
      // Trial ending soon
      subBgClass = 'bg-blue-500/10';
      subBorderClass = 'border-blue-500/30';
      subIconColor = 'text-blue-400';
      SubIcon = Clock;
      subTitle = 'Trial Ending Soon';
      subButtonLabel = 'Upgrade Plan';
      subMessageNode = (
        <span>
          Your trial of the <strong className="text-slate-100 font-semibold">{planName}</strong> plan ends in{' '}
          <strong className="text-blue-300 font-semibold">
            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
          </strong>
          . To upgrade, contact{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Trial%20Upgrade%20Inquiry%20for%20${encodeURIComponent(planName)}`}
            className="text-blue-400 hover:text-blue-300 underline font-medium break-all"
          >
            {SUPPORT_EMAIL}
          </a>.
        </span>
      );
    }
  }

  // ─── Promo Banner Badge Configuration ───────────────────────────
  let promoBadgeLabel = 'SPECIAL OFFER';
  let promoBadgeClass = 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
  let PromoIcon = Sparkles;

  if (activePromo) {
    const rawBadge = (activePromo.badge || 'SPECIAL OFFER').toUpperCase();
    if (rawBadge.includes('ANNOUNCEMENT')) {
      promoBadgeLabel = 'ANNOUNCEMENT';
      promoBadgeClass = 'bg-sky-950/80 text-sky-300 border-sky-500/40';
      PromoIcon = Bell;
    } else if (rawBadge.includes('DISCOUNT')) {
      promoBadgeLabel = 'DISCOUNT';
      promoBadgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      PromoIcon = Tag;
    } else {
      promoBadgeLabel = 'SPECIAL OFFER';
      promoBadgeClass = 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      PromoIcon = Sparkles;
    }
  }

  return (
    <div className="space-y-3 mb-4 sm:mb-6">
      {/* ── 1. Critical Subscription Lifecycle Alert ── */}
      <AnimatePresence>
        {showSubAlert && (
          <motion.div
            key="subscription-alert-banner"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`relative ${subBgClass} border ${subBorderClass} rounded-xl p-3.5 sm:p-4 shadow-sm no-print subscription-banner will-change-[transform,opacity]`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4">
              <div className="flex items-start gap-3 min-w-0 pr-8 sm:pr-0">
                <div className={`p-2 rounded-lg ${subBgClass} flex-shrink-0 mt-0.5 sm:mt-0`}>
                  <SubIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${subIconColor}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className={`font-semibold text-xs sm:text-sm ${subIconColor} leading-tight`}>
                    {subTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300/90 mt-1 leading-relaxed">
                    {subMessageNode}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                <button
                  type="button"
                  className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold cursor-pointer ${
                    isExpired
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  } transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm min-h-[44px] sm:min-h-[36px]`}
                  onClick={() => {
                    navigate('/subscription');
                  }}
                >
                  <span>{subButtonLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {!isExpired && (
                  <button
                    type="button"
                    onClick={handleDismissSub}
                    className="absolute top-3 right-3 sm:static p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors active:scale-90 cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                    aria-label="Dismiss notification"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4 pointer-events-none" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. Promotional Campaign & Special Offer Banner ── */}
      <AnimatePresence>
        {activePromo && (
          <motion.div
            key={`promo-banner-${activePromo._id || activePromo.promoCode}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900 border border-cyan-500/30 rounded-xl p-3.5 sm:p-4 shadow-md no-print promo-campaign-banner will-change-[transform,opacity]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              {/* Left / Content: Badge, Title, Message */}
              <div className="flex items-start gap-3 min-w-0 pr-8 sm:pr-0">
                <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 flex-shrink-0 mt-0.5 sm:mt-0">
                  <PromoIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${promoBadgeClass}`}
                    >
                      {promoBadgeLabel}
                    </span>
                    <h3 className="font-semibold text-xs sm:text-sm text-slate-100 leading-tight">
                      {activePromo.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                    {activePromo.message}
                  </p>
                </div>
              </div>

              {/* Right / Actions: Promo Code Pill, CTA Button & Dismiss */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-shrink-0 w-full sm:w-auto pt-1 sm:pt-0">
                {/* Promo Code Pill with 1-Click Copy Affordance */}
                {activePromo.promoCode && (
                  <button
                    type="button"
                    onClick={() => handleCopyPromo(activePromo.promoCode)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-dashed border-cyan-500/60 hover:border-cyan-400 text-cyan-300 font-mono text-xs cursor-pointer shadow-xs active:scale-95 transition-all group min-h-[38px] sm:min-h-[36px]"
                    title="Click to copy promo code"
                  >
                    {copiedCode === activePromo.promoCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold tracking-wide">
                          {activePromo.promoCode}
                        </span>
                        <Copy className="w-3 h-3 text-cyan-400/80 group-hover:text-cyan-300" />
                      </>
                    )}
                  </button>
                )}

                {/* Primary CTA Button */}
                <button
                  type="button"
                  onClick={() => {
                    navigate(activePromo.ctaUrl || '/subscription');
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer min-h-[44px] sm:min-h-[36px]"
                >
                  <span>{activePromo.ctaText || 'Claim Offer'}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                {/* Dismiss Button */}
                <button
                  type="button"
                  onClick={() =>
                    handleDismissPromo(String(activePromo._id || activePromo.promoCode))
                  }
                  className="absolute top-3 right-3 sm:static p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors active:scale-90 cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center"
                  aria-label="Dismiss promotional offer"
                  title="Dismiss"
                >
                  <X className="w-4 h-4 pointer-events-none" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
