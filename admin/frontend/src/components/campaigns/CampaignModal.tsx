/**
 * Bharat Enterprise Billing System — Platform Campaign & Broadcast Modal
 * Author promotional campaigns, seasonal discount coupons, and broadcast announcements
 * with a live real-time WYSIWYG tenant banner preview.
 * Mobile-first touch ergonomics: 44px touch targets, pinned action footer with safe-area padding,
 * and double-click submission locks.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Megaphone,
  Sparkles,
  Tag,
  Calendar,
  Layers,
  Info,
  Check,
  ExternalLink,
  Clock,
  Send,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Modal from '../common/Modal';
import api from '../../services/api';

export interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: any | null;
  onSuccess?: () => void;
}

export type CampaignType =
  | 'PROMOTIONAL_OFFER'
  | 'BROADCAST_ANNOUNCEMENT'
  | 'SYSTEM_ALERT'
  | 'DISCOUNT_COUPON'
  | 'FEATURE_RELEASE';

export type TargetAudience = 'ALL_TENANTS' | 'BY_PLAN' | 'BY_STATUS' | 'SPECIFIC_TENANTS';

export type DiscountType = 'PERCENTAGE' | 'FLAT' | 'BONUS_DAYS' | 'NONE';

export type BannerStyle = 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';

export type CampaignPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const CAMPAIGN_TYPES: { value: CampaignType; label: string; desc: string }[] = [
  { value: 'PROMOTIONAL_OFFER', label: 'Promotional Offer', desc: 'Seasonal discount or upgrade incentive' },
  { value: 'BROADCAST_ANNOUNCEMENT', label: 'Announcement', desc: 'General platform update or policy note' },
  { value: 'SYSTEM_ALERT', label: 'System Alert', desc: 'Scheduled maintenance or operational notice' },
  { value: 'DISCOUNT_COUPON', label: 'Discount Voucher', desc: 'Redeemable coupon code for checkout' },
  { value: 'FEATURE_RELEASE', label: 'Feature Launch', desc: 'New module or capability showcase' },
];

const TARGET_AUDIENCES: { value: TargetAudience; label: string; desc: string }[] = [
  { value: 'ALL_TENANTS', label: 'All Tenants', desc: 'Broadcast to every registered business' },
  { value: 'BY_PLAN', label: 'Filter by Plan Tier', desc: 'Target Starter, Business, or Pro firms' },
  { value: 'BY_STATUS', label: 'Filter by Status', desc: 'Target Trial, Active, Grace, or Expired' },
  { value: 'SPECIFIC_TENANTS', label: 'Specific Tenant IDs', desc: 'Target exact enterprise tenant accounts' },
];

const BANNER_STYLES: { value: BannerStyle; label: string; bgClass: string; borderClass: string; textClass: string; previewBg: string }[] = [
  { value: 'emerald', label: 'Emerald', bgClass: 'bg-emerald-950/80', borderClass: 'border-emerald-500/70', textClass: 'text-emerald-100', previewBg: 'bg-emerald-500' },
  { value: 'blue', label: 'Ocean Blue', bgClass: 'bg-blue-950/80', borderClass: 'border-blue-500/70', textClass: 'text-blue-100', previewBg: 'bg-blue-500' },
  { value: 'amber', label: 'Amber Gold', bgClass: 'bg-amber-950/80', borderClass: 'border-amber-500/70', textClass: 'text-amber-100', previewBg: 'bg-amber-500' },
  { value: 'rose', label: 'Rose Red', bgClass: 'bg-rose-950/80', borderClass: 'border-rose-500/70', textClass: 'text-rose-100', previewBg: 'bg-rose-500' },
  { value: 'purple', label: 'Royal Violet', bgClass: 'bg-purple-950/80', borderClass: 'border-purple-500/70', textClass: 'text-purple-100', previewBg: 'bg-purple-500' },
];

const PLAN_OPTIONS = ['starter', 'business', 'professional'];
const STATUS_OPTIONS = ['trial', 'active', 'grace', 'expired'];
const PRIORITY_OPTIONS: CampaignPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0] || '';
  } catch {
    return '';
  }
}

export const CampaignModal: React.FC<CampaignModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onSuccess,
}) => {
  const isEditing = Boolean(campaign?._id);

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [campaignType, setCampaignType] = useState<CampaignType>('PROMOTIONAL_OFFER');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('ALL_TENANTS');
  const [targetPlanCodes, setTargetPlanCodes] = useState<string[]>(['starter', 'business']);
  const [targetStatuses, setTargetStatuses] = useState<string[]>(['trial', 'active']);
  const [targetTenantIds, setTargetTenantIds] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState<number | string>(20);
  const [bannerStyle, setBannerStyle] = useState<BannerStyle>('emerald');
  const [ctaLabel, setCtaLabel] = useState('Upgrade Now');
  const [ctaRoute, setCtaRoute] = useState('/subscription');
  const [startDate, setStartDate] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(true);
  const [priority, setPriority] = useState<CampaignPriority>('NORMAL');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Anti-race click lock ref
  const isSubmittingRef = useRef(false);

  // Synchronize state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (campaign) {
        setTitle(campaign.title || '');
        setMessage(campaign.message || '');
        setCampaignType(campaign.campaignType || 'PROMOTIONAL_OFFER');
        setTargetAudience(campaign.targetAudience || 'ALL_TENANTS');
        setTargetPlanCodes(Array.isArray(campaign.targetPlanCodes) ? campaign.targetPlanCodes : ['starter', 'business']);
        setTargetStatuses(Array.isArray(campaign.targetStatuses) ? campaign.targetStatuses : ['trial', 'active']);
        setTargetTenantIds(Array.isArray(campaign.targetTenantIds) ? campaign.targetTenantIds.join(', ') : (campaign.targetTenantIds || ''));
        setPromoCode(campaign.promoCode || '');
        setDiscountType(campaign.discountType || 'PERCENTAGE');
        setDiscountValue(campaign.discountValue ?? 20);
        setBannerStyle(campaign.bannerStyle || 'emerald');
        setCtaLabel(campaign.ctaLabel || 'Upgrade Now');
        setCtaRoute(campaign.ctaRoute || '/subscription');
        setStartDate(toDateInputValue(campaign.startDate));
        setExpiresAt(toDateInputValue(campaign.expiresAt));
        setActive(campaign.active !== false);
        setPriority(campaign.priority || 'NORMAL');
      } else {
        setTitle('');
        setMessage('');
        setCampaignType('PROMOTIONAL_OFFER');
        setTargetAudience('ALL_TENANTS');
        setTargetPlanCodes(['starter', 'business']);
        setTargetStatuses(['trial', 'active']);
        setTargetTenantIds('');
        setPromoCode('GROWTH30');
        setDiscountType('PERCENTAGE');
        setDiscountValue(30);
        setBannerStyle('emerald');
        setCtaLabel('Upgrade Now');
        setCtaRoute('/subscription');
        setStartDate(toDateInputValue(new Date().toISOString()));
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30);
        setExpiresAt(toDateInputValue(defaultExpiry.toISOString()));
        setActive(true);
        setPriority('NORMAL');
      }
      setReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen, campaign]);

  const togglePlanCode = (code: string) => {
    setTargetPlanCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleStatusOption = (st: string) => {
    setTargetStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const minReasonLength = 10;
  const isReasonValid = reason.trim().length >= minReasonLength;
  const isTitleValid = title.trim().length > 0;
  const isMessageValid = message.trim().length > 0;
  const canSubmit = isTitleValid && isMessageValid && isReasonValid && !isSubmitting;

  const handleClose = () => {
    if (isSubmittingRef.current || isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      title: title.trim(),
      message: message.trim(),
      campaignType,
      targetAudience,
      targetPlanCodes: targetAudience === 'BY_PLAN' ? targetPlanCodes : [],
      targetStatuses: targetAudience === 'BY_STATUS' ? targetStatuses : [],
      targetTenantIds:
        targetAudience === 'SPECIFIC_TENANTS'
          ? targetTenantIds
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
          : [],
      promoCode: promoCode.trim().toUpperCase(),
      discountType,
      discountValue: discountType !== 'NONE' ? Number(discountValue) || 0 : 0,
      bannerStyle,
      ctaLabel: ctaLabel.trim(),
      ctaRoute: ctaRoute.trim(),
      startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      active,
      priority,
      reason: reason.trim(),
    };

    try {
      if (isEditing && campaign?._id) {
        await api.put(`/campaigns/${campaign._id}`, payload);
      } else {
        await api.post('/campaigns', payload);
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      // If endpoint doesn't exist yet on backend, provide clean feedback
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save campaign. Ensure all required fields and minimum 10-character reason are provided.';
      setErrorMessage(msg);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Selected Banner Style Details for WYSIWYG
  const activeStyle = useMemo(() => {
    return (
      BANNER_STYLES.find((b) => b.value === bannerStyle) ?? BANNER_STYLES[0]!
    );
  }, [bannerStyle]);

  // Pinned Bottom Action Bar
  const footerContent = (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end w-full">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer flex items-center justify-center"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={!canSubmit}
        className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send className="w-3.5 h-3.5 text-white shrink-0" />
        <span>
          {isSubmitting
            ? isEditing
              ? 'Saving Changes...'
              : 'Broadcasting...'
            : isEditing
            ? 'Update Campaign'
            : 'Publish Campaign'}
        </span>
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Megaphone className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-bold text-slate-100 truncate text-sm sm:text-base">
            {isEditing ? `Edit Campaign: ${campaign?.title || 'Notice'}` : 'Author Promotional Campaign'}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-950/70 text-blue-300 border border-blue-800/70">
            {campaignType.replace(/_/g, ' ')}
          </span>
        </div>
      }
      description="Create multi-tenant banner broadcasts, upgrade incentives, and promotional coupon vouchers."
      maxWidth="2xl"
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ═════════════════════════════════════════════════════════════
            LIVE WYSIWYG BANNER PREVIEW
            ═════════════════════════════════════════════════════════════ */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Live Tenant Banner Preview</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Renders live in tenant top bar
            </span>
          </div>

          <div
            className={`p-3.5 sm:p-4 rounded-xl border ${activeStyle.bgClass} ${activeStyle.borderClass} ${activeStyle.textClass} shadow-lg transition-all space-y-2`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      priority === 'URGENT' ? 'bg-rose-400' : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      priority === 'URGENT' ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                </span>

                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider bg-black/40 border border-white/10">
                  {campaignType.replace(/_/g, ' ')}
                </span>

                {priority !== 'NORMAL' && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      priority === 'URGENT'
                        ? 'bg-rose-600 text-white'
                        : priority === 'HIGH'
                        ? 'bg-amber-500 text-black'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {priority}
                  </span>
                )}
              </div>

              {/* Promo Code Coupon Tag Preview */}
              {promoCode && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/50 border border-white/20 text-xs font-mono font-bold">
                  <Tag className="w-3 h-3 text-amber-300" />
                  <span className="tracking-wider text-amber-200">{promoCode.toUpperCase()}</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm sm:text-base font-bold tracking-tight text-white">
                {title || 'Headline: Special Festive Commercial Offer'}
              </h4>
              <p className="text-xs mt-0.5 leading-relaxed text-white/90">
                {message ||
                  'Upgrade to the Annual Professional plan today and claim 30% off standard renewal pricing with unlimited GST invoices and batch tracking.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 flex-wrap">
              {discountType !== 'NONE' && (
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {discountType === 'PERCENTAGE' && `${discountValue}% OFF Renewal`}
                    {discountType === 'FLAT' && `₹${discountValue} Flat Discount`}
                    {discountType === 'BONUS_DAYS' && `+${discountValue} Days Free Extension`}
                  </span>
                </div>
              )}

              {ctaLabel && (
                <div className="ml-auto">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-950 shadow-sm cursor-pointer hover:bg-slate-100 transition-colors">
                    <span>{ctaLabel}</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            CAMPAIGN CORE FIELDS
            ═════════════════════════════════════════════════════════════ */}
        {/* Row 1: Title & Active Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-9 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label className="text-slate-300 font-medium">
                Campaign Headline / Title <span className="text-rose-400">*</span>
              </label>
              <span className="text-slate-500 text-[11px] font-mono">{title.length}/200</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 200))}
              disabled={isSubmitting}
              placeholder="e.g. Diwali Super Saver: 30% Off Professional Annual Subscription"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans"
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="block text-xs font-medium text-slate-300">Live Status</label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              disabled={isSubmitting}
              className={`w-full min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {active ? (
                <>
                  <ToggleRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Draft</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Campaign Message Body */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-300 font-medium">
              Announcement Message Body <span className="text-rose-400">*</span>
            </label>
            <span className="text-slate-500 text-[11px] font-mono">{message.length}/1000</span>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            disabled={isSubmitting}
            rows={3}
            placeholder="Enter announcement description, benefits, terms, and call-to-action details..."
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans min-h-[80px]"
          />
        </div>

        {/* Row 2: Campaign Type & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">Campaign Category</label>
            <select
              value={campaignType}
              onChange={(e) => setCampaignType(e.target.value as any)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-slate-900 text-slate-100 py-1">
                  {t.label} — {t.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">Broadcast Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p} className="bg-slate-900 text-slate-100 py-1">
                  {p} PRIORITY
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            TARGET AUDIENCE SCOPE
            ═════════════════════════════════════════════════════════════ */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
          <label className="block text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Target Audience Scope</span>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TARGET_AUDIENCES.map((aud) => {
              const isSelected = targetAudience === aud.value;
              return (
                <button
                  key={aud.value}
                  type="button"
                  onClick={() => setTargetAudience(aud.value)}
                  disabled={isSubmitting}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer min-h-[44px] flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-950/40 border-blue-500/70 text-blue-300 ring-1 ring-blue-500/30'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xs font-semibold block">{aud.label}</span>
                  <span className="text-[10px] text-slate-500 block truncate">{aud.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Conditional Sub-filters */}
          {targetAudience === 'BY_PLAN' && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <span className="text-xs text-slate-300 block">Select Target Plans:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {PLAN_OPTIONS.map((planCode) => {
                  const isChecked = targetPlanCodes.includes(planCode);
                  return (
                    <button
                      key={planCode}
                      type="button"
                      onClick={() => togglePlanCode(planCode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 border ${
                        isChecked
                          ? 'bg-blue-950/60 border-blue-500/70 text-blue-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-blue-400" />}
                      <span>{planCode}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetAudience === 'BY_STATUS' && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <span className="text-xs text-slate-300 block">Select Subscription Lifecycle States:</span>
              <div className="flex items-center gap-2 flex-wrap">
                {STATUS_OPTIONS.map((st) => {
                  const isChecked = targetStatuses.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleStatusOption(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase transition-colors cursor-pointer min-h-[38px] flex items-center gap-1.5 border ${
                        isChecked
                          ? 'bg-blue-950/60 border-blue-500/70 text-blue-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 text-blue-400" />}
                      <span>{st}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetAudience === 'SPECIFIC_TENANTS' && (
            <div className="pt-2 border-t border-slate-800/80 space-y-1">
              <span className="text-xs text-slate-300 block">Enter Target Tenant IDs (comma-separated):</span>
              <input
                type="text"
                value={targetTenantIds}
                onChange={(e) => setTargetTenantIds(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. 660f1b2c3d4e5f, 660f1b2c3d4e6a"
                className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* ═════════════════════════════════════════════════════════════
            COMMERCIAL PARAMETERS & PROMO CODE
            ═════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Promo Code */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Promo Voucher Code</span>
            </label>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase().trim())}
              disabled={isSubmitting}
              placeholder="e.g. FESTIVE30"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all uppercase"
            />
          </div>

          {/* Discount Type */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">Discount Structure</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="PERCENTAGE" className="bg-slate-900 text-slate-100 py-1">Percentage (%) Discount</option>
              <option value="FLAT" className="bg-slate-900 text-slate-100 py-1">Flat ₹ Amount Discount</option>
              <option value="BONUS_DAYS" className="bg-slate-900 text-slate-100 py-1">Bonus Tenure Days</option>
              <option value="NONE" className="bg-slate-900 text-slate-100 py-1">None / Informational</option>
            </select>
          </div>

          {/* Discount Value */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              {discountType === 'PERCENTAGE' && 'Discount Percentage (%)'}
              {discountType === 'FLAT' && 'Flat Amount (₹)'}
              {discountType === 'BONUS_DAYS' && 'Bonus Days Count'}
              {discountType === 'NONE' && 'Value'}
            </label>
            <input
              type="number"
              min={0}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              disabled={isSubmitting || discountType === 'NONE'}
              placeholder="20"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-40"
            />
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            BANNER STYLING & CTA
            ═════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Banner Style Selector */}
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-xs font-medium text-slate-300">Visual Theme</label>
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {BANNER_STYLES.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setBannerStyle(style.value)}
                  className={`w-8 h-8 rounded-full ${style.previewBg} border-2 transition-transform cursor-pointer flex items-center justify-center ${
                    bannerStyle === style.value ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  title={style.label}
                >
                  {bannerStyle === style.value && <Check className="w-4 h-4 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* CTA Label */}
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-xs font-medium text-slate-300">Call to Action Label</label>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Upgrade Now"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans"
            />
          </div>

          {/* CTA Route */}
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-xs font-medium text-slate-300">Target Route</label>
            <input
              type="text"
              value={ctaRoute}
              onChange={(e) => setCtaRoute(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. /subscription"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Row 3: Schedule Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Broadcast Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Broadcast Expiration Date</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Operational Reason & Audit Justification */}
        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
          <label className="block text-xs font-medium text-slate-300">
            Audit Reason & Justification <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            placeholder={`Provide a clear operational explanation for this campaign publication (min ${minReasonLength} chars)...`}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans min-h-[72px]"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Minimum {minReasonLength} characters required for compliance</span>
            <span
              className={
                reason.trim().length >= minReasonLength
                  ? 'text-emerald-400 font-mono'
                  : 'text-slate-400 font-mono'
              }
            >
              {reason.trim().length}/{minReasonLength}
            </span>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default CampaignModal;
