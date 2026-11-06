/**
 * Bharat Enterprise Billing System — Platform Campaigns & Notification Offers Console
 * Management console for creating, scheduling, activating, and broadcasting
 * promotional discounts, upgrade vouchers, and broadcast notifications to tenant accounts.
 * Features dual desktop table / mobile collapsible card views with 2x2 action matrix.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  Plus,
  RefreshCw,
  Sliders,
  Send,
  Power,
  Copy,
  Check,
  Tag,
  Radio,
  Clock,
  X,
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast, { type ToastMessage } from '../components/common/Toast';
import SearchInput from '../components/common/SearchInput';
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import AnimatedCounter from '../components/common/AnimatedCounter';
import CampaignModal from '../components/campaigns/CampaignModal';
import { useListFilterParams } from '../hooks/useListFilterParams';
import {
  CampaignType,
  TargetAudience,
  DiscountType,
  type PlatformOfferCampaign,
} from '../types';

function formatISTDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export const CampaignsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Copy-to-clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // URL-backed filter synchronization
  const { params, setParam, resetParams, searchParams } = useListFilterParams({
    search: '',
    type: 'ALL',
    audience: 'ALL',
    status: 'ALL',
    create: '',
  });

  const searchQuery = params.search || '';
  const typeFilter = params.type || 'ALL';
  const audienceFilter = params.audience || 'ALL';
  const statusFilter = params.status || 'ALL';

  // Modal States
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<PlatformOfferCampaign | null>(null);

  // Auto-open create modal if create=true is present in query parameters
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setSelectedCampaign(null);
      setIsCampaignModalOpen(true);
      setParam('create', undefined);
    }
  }, [searchParams, setParam]);

  // Confirm Dialog States
  const [broadcastTarget, setBroadcastTarget] = useState<PlatformOfferCampaign | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<PlatformOfferCampaign | null>(null);

  // 1. Fetch campaigns from API
  const {
    data: campaignsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['platform-campaigns', searchQuery, typeFilter, audienceFilter, statusFilter],
    queryFn: async () => {
      const qParams = new URLSearchParams();
      if (searchQuery.trim()) qParams.append('search', searchQuery.trim());
      if (typeFilter !== 'ALL') qParams.append('type', typeFilter);
      if (audienceFilter !== 'ALL') qParams.append('targetAudience', audienceFilter);
      if (statusFilter !== 'ALL') qParams.append('status', statusFilter);

      const res = await api.get<{
        success: boolean;
        data: PlatformOfferCampaign[];
      }>(`/campaigns?${qParams.toString()}`);
      return res.data.data || [];
    },
    staleTime: 30000,
  });

  const campaigns = campaignsData || [];

  // Filter client-side defensively if needed
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;
      if (audienceFilter !== 'ALL' && c.targetAudience !== audienceFilter) return false;
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'INACTIVE' && c.isActive) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchCode = (c.promoCode || '').toLowerCase().includes(q);
        const matchMsg = c.message.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchMsg) return false;
      }
      return true;
    });
  }, [campaigns, typeFilter, audienceFilter, statusFilter, searchQuery]);

  // Compute Metrics for Top Strip
  const metrics = useMemo(() => {
    const now = Date.now();
    let activeCount = 0;
    let scheduledCount = 0;
    let totalBroadcasts = 0;
    let activePromoCodes = 0;

    campaigns.forEach((c) => {
      const startMs = new Date(c.startsAt).getTime();
      const endMs = new Date(c.expiresAt).getTime();

      if (c.isActive && now >= startMs && now <= endMs) {
        activeCount++;
      }
      if (c.isActive && now < startMs) {
        scheduledCount++;
      }
      totalBroadcasts += c.broadcastCount || 0;
      if (c.isActive && c.promoCode) {
        activePromoCodes++;
      }
    });

    return {
      activeCount,
      scheduledCount,
      totalBroadcasts,
      activePromoCodes,
    };
  }, [campaigns]);

  // Broadcast Mutation
  const broadcastMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await api.post<{ success: boolean; message: string; broadcastCount: number }>(
        `/campaigns/${campaignId}/broadcast`
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-campaigns'] });
      setBroadcastTarget(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Campaign Broadcast Initiated',
        message:
          data.message ||
          `Broadcast push dispatched to matching tenant notification feeds.`,
      });
    },
    onError: (err: any) => {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Broadcast Failed',
        message:
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to dispatch campaign broadcast.',
      });
    },
  });

  // Toggle Active Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, nextActive }: { id: string; nextActive: boolean }) => {
      const res = await api.put<{ success: boolean; data: PlatformOfferCampaign }>(
        `/campaigns/${id}`,
        { isActive: nextActive }
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform-campaigns'] });
      setStatusToggleTarget(null);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Campaign Status Updated',
        message: `Campaign is now ${data.data?.isActive ? 'ACTIVE' : 'PAUSED'}.`,
      });
    },
    onError: (err: any) => {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Status Update Failed',
        message: err.response?.data?.message || 'Failed to update campaign status.',
      });
    },
  });

  const handleOpenCreateModal = () => {
    setSelectedCampaign(null);
    setIsCampaignModalOpen(true);
  };

  const handleOpenEditModal = (c: PlatformOfferCampaign) => {
    setSelectedCampaign(c);
    setIsCampaignModalOpen(true);
  };

  return (
    <div className="space-y-6 select-text">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">
              Campaigns & Promotional Offers
            </h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-semibold">
              Broadcast Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Targeted upgrade incentives, discount promo codes, and broadcast alerts across enterprise tenant accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-0 rounded-lg text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh campaigns feed"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-cyan-400 ${isFetching ? 'animate-spin' : ''}`}
            />
            <span className="font-mono">Sync</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TOP METRIC STRIP (AnimatedCounter)
          ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Active Campaigns */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Active Broadcasting</span>
            <Radio className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-100 font-mono tracking-tight flex items-baseline gap-1">
            <AnimatedCounter
              target={metrics.activeCount}
              className="text-emerald-400"
            />
            <span className="text-xs text-slate-400 font-sans font-normal">
              / {campaigns.length} total
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Currently visible on tenant banners
          </p>
        </div>

        {/* Card 2: Upcoming / Scheduled */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Scheduled Campaigns</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-amber-300 font-mono tracking-tight">
            <AnimatedCounter target={metrics.scheduledCount} />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Upcoming starts in future window
          </p>
        </div>

        {/* Card 3: Total Broadcasts */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Broadcast Pushes</span>
            <Send className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-sky-300 font-mono tracking-tight">
            <AnimatedCounter target={metrics.totalBroadcasts} />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Tenant inbox notifications delivered
          </p>
        </div>

        {/* Card 4: Active Promo Codes */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Active Promo Codes</span>
            <Tag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg sm:text-xl font-bold text-purple-300 font-mono tracking-tight">
            <AnimatedCounter target={metrics.activePromoCodes} />
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Valid voucher codes in circulation
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          DIRECTORY TOOLBAR & DUAL VIEW (TABLE + MOBILE CARDS)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden shadow-xs space-y-0">
        {/* Filter & Search Bar */}
        <div className="p-4 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200 tracking-tight">
              Promotional Catalog & Broadcast Registry
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({filteredCampaigns.length} shown)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'INACTIVE', label: 'Paused' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setParam('status', st.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer min-h-[30px] flex items-center ${
                    statusFilter === st.id
                      ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Type Filter Dropdown */}
            <select
              value={typeFilter}
              onChange={(e) => setParam('type', e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono min-h-[36px]"
            >
              <option value="ALL">All Types</option>
              <option value={CampaignType.PROMOTIONAL_OFFER}>Promotional Offer</option>
              <option value={CampaignType.BROADCAST_ANNOUNCEMENT}>Broadcast Announcement</option>
              <option value={CampaignType.SYSTEM_ALERT}>System Alert</option>
              <option value={CampaignType.DISCOUNT_COUPON}>Discount Coupon</option>
              <option value={CampaignType.FEATURE_RELEASE}>Feature Release</option>
            </select>

            {/* Audience Filter Dropdown */}
            <select
              value={audienceFilter}
              onChange={(e) => setParam('audience', e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono min-h-[36px]"
            >
              <option value="ALL">All Audiences</option>
              <option value={TargetAudience.ALL_TENANTS}>All Tenants</option>
              <option value={TargetAudience.BY_PLAN}>By Plan Tier</option>
              <option value={TargetAudience.BY_STATUS}>By Subscription Status</option>
              <option value={TargetAudience.SPECIFIC_TENANTS}>Specific Tenants</option>
            </select>

            {/* Debounced Search Input */}
            <SearchInput
              value={searchQuery}
              onChange={(val) => setParam('search', val)}
              placeholder="Search title, promo code..."
              className="w-full sm:w-56"
            />
          </div>
        </div>

        {/* ─── A. DESKTOP VIEW (Table: md and up) ─── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Campaign Headline</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Target Audience</th>
                <th className="py-3 px-4">Promo / Discount</th>
                <th className="py-3 px-4">Active Schedule</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Pushes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-mono text-xs">
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                    Fetching promotional campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    No campaigns match your applied search and segmentation filters.
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((c) => {
                  const now = Date.now();
                  const startMs = new Date(c.startsAt).getTime();
                  const endMs = new Date(c.expiresAt).getTime();
                  const isRunning = c.isActive && now >= startMs && now <= endMs;
                  const isScheduled = c.isActive && now < startMs;

                  return (
                    <tr key={c._id} className="hover:bg-slate-800/40 transition-colors group">
                      {/* Title */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            className="font-semibold text-slate-100 hover:text-cyan-400 text-left block truncate max-w-[220px] cursor-pointer"
                            title="Edit campaign offer"
                          >
                            {c.title}
                          </button>
                          <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {c.message}
                          </p>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-cyan-300 border border-slate-700/80">
                          {c.type.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Audience */}
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-slate-300 block">
                          {c.targetAudience.replace(/_/g, ' ')}
                        </span>
                        {c.targetPlanCodes && c.targetPlanCodes.length > 0 && (
                          <span className="text-[10px] text-slate-500 uppercase">
                            Plans: {c.targetPlanCodes.join(', ')}
                          </span>
                        )}
                        {c.targetStatuses && c.targetStatuses.length > 0 && (
                          <span className="text-[10px] text-slate-500 uppercase">
                            Statuses: {c.targetStatuses.join(', ')}
                          </span>
                        )}
                      </td>

                      {/* Promo Code & Discount */}
                      <td className="py-3 px-4 font-mono">
                        {c.promoCode ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60 text-[11px]">
                              {c.promoCode}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(c.promoCode!, `desk-${c._id}`)}
                              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                              title="Copy Promo Code"
                            >
                              {copiedId === `desk-${c._id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            {c.discountType === DiscountType.PERCENTAGE && (
                              <span className="text-slate-400 text-[10px]">({c.discountValue}% off)</span>
                            )}
                            {c.discountType === DiscountType.FLAT && (
                              <span className="text-slate-400 text-[10px]">(₹{c.discountValue} off)</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Date Range */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                        <span>{formatISTDate(c.startsAt)}</span>
                        <span className="text-slate-500 mx-1">→</span>
                        <span>{formatISTDate(c.expiresAt)}</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={
                            isRunning
                              ? 'emerald'
                              : isScheduled
                              ? 'amber'
                              : c.isActive
                              ? 'slate'
                              : 'rose'
                          }
                          label={
                            isRunning
                              ? 'BROADCASTING'
                              : isScheduled
                              ? 'SCHEDULED'
                              : c.isActive
                              ? 'EXPIRED'
                              : 'PAUSED'
                          }
                          dot={isRunning}
                          pulse={isRunning}
                        />
                      </td>

                      {/* Broadcast Count */}
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {c.broadcastCount || 0}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                            title="Edit campaign parameters"
                          >
                            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          </button>

                          {/* Broadcast Push */}
                          <button
                            type="button"
                            onClick={() => setBroadcastTarget(c)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-sky-600/60 bg-slate-950/60 hover:bg-sky-950/40 text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
                            title="Dispatch broadcast notification push to tenants"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => setStatusToggleTarget(c)}
                            className={`p-1.5 rounded-lg border bg-slate-950/60 transition-colors cursor-pointer ${
                              c.isActive
                                ? 'border-slate-800 hover:border-rose-700/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400'
                                : 'border-slate-800 hover:border-emerald-700/80 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={c.isActive ? 'Pause Campaign' : 'Activate Campaign'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── B. MOBILE VIEW (Collapsible Cards: < md) ─── */}
        <div className="md:hidden p-3 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 animate-pulse space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 bg-slate-800 rounded w-36" />
                      <div className="h-2.5 bg-slate-800/60 rounded w-24" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && filteredCampaigns.length === 0 && (
            <div className="p-8 text-center text-xs space-y-3">
              <Megaphone className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No campaigns found</p>
              <p className="text-slate-500">
                No promotional campaigns match your active filters.
              </p>
              <button
                type="button"
                onClick={() => resetParams()}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-600 text-white font-medium cursor-pointer inline-flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}

          {!isLoading &&
            filteredCampaigns.map((c) => {
              const now = Date.now();
              const startMs = new Date(c.startsAt).getTime();
              const endMs = new Date(c.expiresAt).getTime();
              const isRunning = c.isActive && now >= startMs && now <= endMs;
              const isScheduled = c.isActive && now < startMs;

              // Summary: 74-82px bounded height, single line text truncation
              const cardSummary = (
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-cyan-300 shrink-0 select-none shadow-2xs">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate text-xs block">
                        {c.title}
                      </span>
                      <StatusBadge
                        variant={
                          isRunning
                            ? 'emerald'
                            : isScheduled
                            ? 'amber'
                            : c.isActive
                            ? 'slate'
                            : 'rose'
                        }
                        label={
                          isRunning
                            ? 'LIVE'
                            : isScheduled
                            ? 'SOON'
                            : c.isActive
                            ? 'ENDED'
                            : 'OFF'
                        }
                        size="sm"
                        dot={isRunning}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                      <span className="truncate">
                        {c.promoCode ? `CODE: ${c.promoCode}` : c.type.replace(/_/g, ' ')}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {formatISTDate(c.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );

              return (
                <CollapsibleMobileCard
                  key={c._id}
                  id={c._id}
                  entityType="campaign"
                  statusVariant={isRunning ? 'active' : 'default'}
                  summary={cardSummary}
                >
                  <div className="space-y-3 pt-2 text-xs">
                    {/* Meta info grid */}
                    <div className="grid grid-cols-1 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Audience:</span>
                        <span className="text-slate-200">{c.targetAudience.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Discount:</span>
                        <span className="text-amber-300 font-bold">
                          {c.discountType === DiscountType.PERCENTAGE
                            ? `${c.discountValue}% OFF`
                            : c.discountType === DiscountType.FLAT
                            ? `₹${c.discountValue} FLAT OFF`
                            : c.discountType === DiscountType.BONUS_DAYS
                            ? `+${c.discountValue} BONUS DAYS`
                            : 'None'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Schedule:</span>
                        <span className="text-slate-400">
                          {formatISTDate(c.startsAt)} → {formatISTDate(c.expiresAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">Broadcast Pushes:</span>
                        <span className="text-cyan-400">{c.broadcastCount || 0} Delivered</span>
                      </div>
                      <div className="pt-1 border-t border-slate-800 text-slate-300 font-sans leading-relaxed">
                        {c.message}
                      </div>
                    </div>

                    {/* Structured 2x2 Action Matrix (min-h-[44px] targets) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      {/* Action 1: Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(c)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
                        aria-label={`Edit ${c.title}`}
                      >
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <span>Edit</span>
                      </button>

                      {/* Action 2: Broadcast */}
                      <button
                        type="button"
                        onClick={() => setBroadcastTarget(c)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 text-sky-300 border border-sky-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
                        aria-label={`Broadcast ${c.title}`}
                      >
                        <Send className="w-4 h-4 text-sky-400" />
                        <span>Broadcast</span>
                      </button>

                      {/* Action 3: Toggle Status */}
                      <button
                        type="button"
                        onClick={() => setStatusToggleTarget(c)}
                        className={`min-h-[44px] px-3 py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium cursor-pointer ${
                          c.isActive
                            ? 'bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border-rose-800/60'
                            : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-emerald-800/60'
                        }`}
                        aria-label={c.isActive ? 'Pause Campaign' : 'Activate Campaign'}
                      >
                        <Power className="w-4 h-4" />
                        <span>{c.isActive ? 'Pause' : 'Activate'}</span>
                      </button>

                      {/* Action 4: Copy Code */}
                      <button
                        type="button"
                        onClick={() => handleCopy(c.promoCode || c._id, `mob-${c._id}`)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
                        aria-label="Copy promo code"
                      >
                        {copiedId === `mob-${c._id}` ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400 font-mono">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 text-slate-400" />
                            <span>{c.promoCode ? 'Copy Code' : 'Copy ID'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </CollapsibleMobileCard>
              );
            })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Campaign Authoring Dialog
          ───────────────────────────────────────────────────────────── */}
      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        campaign={selectedCampaign}
        onSuccess={() => refetch()}
      />

      {/* ─────────────────────────────────────────────────────────────
          CONFIRM DIALOG: Broadcast Dispatch
          ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!broadcastTarget}
        onClose={() => setBroadcastTarget(null)}
        onConfirm={async () => {
          if (broadcastTarget) {
            await broadcastMutation.mutateAsync(broadcastTarget._id);
          }
        }}
        title={`Broadcast Campaign: ${broadcastTarget?.title}`}
        description={`This will push real-time broadcast notification records to all tenant user accounts matching segmentation "${broadcastTarget?.targetAudience}". Tenants will see this promotional announcement in their top banner and notification bell feed.`}
        confirmLabel="Dispatch Broadcast Now"
        severity="warning"
        minReasonLength={0}
      />

      {/* ─────────────────────────────────────────────────────────────
          CONFIRM DIALOG: Toggle Active Status
          ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!statusToggleTarget}
        onClose={() => setStatusToggleTarget(null)}
        onConfirm={async () => {
          if (statusToggleTarget) {
            await toggleStatusMutation.mutateAsync({
              id: statusToggleTarget._id,
              nextActive: !statusToggleTarget.isActive,
            });
          }
        }}
        title={`${statusToggleTarget?.isActive ? 'Pause' : 'Activate'} Campaign Offer`}
        description={
          statusToggleTarget?.isActive
            ? `Pausing "${statusToggleTarget?.title}" will immediately remove it from all tenant banners. Tenants holding active vouchers can still claim promo codes until expiration.`
            : `Activating "${statusToggleTarget?.title}" will re-engage banner rendering for all matching target audiences.`
        }
        confirmLabel={statusToggleTarget?.isActive ? 'Pause Campaign' : 'Activate Campaign'}
        severity="warning"
        minReasonLength={0}
      />
    </div>
  );
};

export default CampaignsPage;
