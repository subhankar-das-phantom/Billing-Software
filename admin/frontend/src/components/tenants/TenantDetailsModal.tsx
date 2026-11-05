/**
 * Bharat Enterprise Billing System — Tenant Details Inspection Modal
 * High-density inspection modal displaying live entity metrics, financial totals,
 * subscription lifecycle state, and firm profile metadata.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Clock,
  Copy,
  Check,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  ShieldAlert,
  Users,
  Briefcase,
  Layers,
  Headphones,
  Power,
  RotateCw,
} from 'lucide-react';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import CurrencyDisplay from '../common/CurrencyDisplay';
import api from '../../services/api';
import type { TenantOverviewDTO, TenantUsageDTO } from '../../types';

interface TenantDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string | null;
  onStartDiagnostic: (tenantId: string, firmName: string) => void;
  onToggleStatus: (tenantId: string, firmName: string, currentIsActive: boolean) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Never';
  }
}

export const TenantDetailsModal: React.FC<TenantDetailsModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  onStartDiagnostic,
  onToggleStatus,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  // 1. Fetch Tenant Overview snapshot
  const {
    data: overview,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['platform', 'tenants', tenantId, 'overview'],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant ID provided');
      const res = await api.get<{ success: boolean; data: TenantOverviewDTO }>(
        `/tenants/${tenantId}`
      );
      return res.data.data;
    },
    enabled: isOpen && Boolean(tenantId),
    staleTime: 30000,
  });

  // 2. Fetch Tenant Live Usage & Financials
  const {
    data: usage,
    isLoading: isUsageLoading,
    isError: isUsageError,
    refetch: refetchUsage,
  } = useQuery({
    queryKey: ['platform', 'tenants', tenantId, 'usage'],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant ID provided');
      const res = await api.get<{ success: boolean; data: TenantUsageDTO }>(
        `/tenants/${tenantId}/usage`
      );
      return res.data.data;
    },
    enabled: isOpen && Boolean(tenantId),
    staleTime: 30000,
  });

  const isLoading = isOverviewLoading || isUsageLoading;
  const isError = isOverviewError || isUsageError;

  const handleCopyId = () => {
    if (!tenantId) return;
    navigator.clipboard.writeText(tenantId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleRefresh = () => {
    refetchOverview();
    refetchUsage();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Modal Custom Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-100 tracking-tight truncate">
                {overview?.firmName || 'Tenant Inspection'}
              </h2>
              {overview && (
                <StatusBadge
                  variant={overview.isActive ? 'emerald' : 'rose'}
                  label={overview.isActive ? 'Active Firm' : 'Suspended'}
                  dot
                />
              )}
              {overview?.subscription && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-cyan-300 border border-slate-700">
                  {overview.subscription.planName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
              <span className="font-mono text-[11px] text-slate-400">ID: {tenantId}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Copy tenant ID"
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <span className="text-slate-600">•</span>
              <span>Joined {formatDate(overview?.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh tenant data"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Loading State Skeleton */}
        {isLoading && (
          <div className="space-y-4 py-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg animate-pulse space-y-2">
                  <div className="h-3 bg-slate-800 rounded w-16" />
                  <div className="h-6 bg-slate-800 rounded w-24" />
                </div>
              ))}
            </div>
            <div className="h-28 bg-slate-950/60 border border-slate-800 rounded-lg animate-pulse" />
            <div className="h-36 bg-slate-950/60 border border-slate-800 rounded-lg animate-pulse" />
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="p-4 bg-rose-950/60 border border-rose-800/80 rounded-xl text-center space-y-2">
            <ShieldAlert className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs font-semibold text-rose-200">Failed to load tenant details</p>
            <p className="text-[11px] text-rose-300/80">
              Check your network connection and platform authorization.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-2 px-3 py-1 bg-rose-800/60 hover:bg-rose-700/60 text-rose-100 rounded text-xs font-medium cursor-pointer"
            >
              Retry Inspection
            </button>
          </div>
        )}

        {/* Main Content Pane */}
        {!isLoading && !isError && overview && (
          <div className="space-y-4">
            {/* 1. Live Entity & Financial Stats Grid */}
            <div>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Tenant Activity & Volume</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {/* Total Sales Volume */}
                <div className="col-span-2 sm:col-span-1 p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Total Sales Volume</span>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="mt-2">
                    <CurrencyDisplay
                      amount={usage?.financials?.totalSalesVolume ?? 0}
                      size="lg"
                      colorCode
                    />
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {usage?.financials?.totalInvoicesCount ?? 0} total invoices
                    </div>
                  </div>
                </div>

                {/* Invoices Count */}
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Invoices Issued</span>
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-mono font-bold text-slate-100">
                      {(usage?.counts?.invoices ?? 0).toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">Active billed transactions</div>
                  </div>
                </div>

                {/* Customers Count */}
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Customers</span>
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-mono font-bold text-slate-100">
                      {(usage?.counts?.customers ?? 0).toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">Direct buyer profiles</div>
                  </div>
                </div>

                {/* Products Count */}
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Products in Catalog</span>
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-mono font-bold text-slate-100">
                      {(usage?.counts?.products ?? 0).toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {(usage?.counts?.batches ?? 0).toLocaleString('en-IN')} inventory batches
                    </div>
                  </div>
                </div>

                {/* Employees Count */}
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Team Members</span>
                    <Briefcase className="w-3.5 h-3.5 text-teal-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-mono font-bold text-slate-100">
                      {(usage?.counts?.employees ?? 0).toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">Staff & operator seats</div>
                  </div>
                </div>

                {/* Suppliers Count */}
                <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Suppliers</span>
                    <Building2 className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-mono font-bold text-slate-100">
                      {(usage?.counts?.suppliers ?? 0).toLocaleString('en-IN')}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-0.5">Registered vendors</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Subscription Snapshot */}
            <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-lg space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    SaaS Subscription State
                  </span>
                </div>
                {overview.subscription ? (
                  <StatusBadge
                    status={overview.subscription.status}
                    dot
                  />
                ) : (
                  <StatusBadge variant="slate" label="NO ACTIVE SUBSCRIPTION" dot />
                )}
              </div>

              {overview.subscription ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-slate-800/60">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Active Plan</span>
                    <span className="font-semibold text-slate-100">
                      {overview.subscription.planName}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {overview.subscription.planCode}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Expires On</span>
                    <span className="font-semibold text-slate-100">
                      {formatDate(overview.subscription.expiresAt)}
                    </span>
                    <span className="text-[10px] text-amber-400 block font-mono">
                      {overview.subscription.daysRemaining} days remaining
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Monthly Price</span>
                    <CurrencyDisplay
                      amount={overview.subscription.finalAmount || overview.subscription.baseMonthlyPrice}
                      size="sm"
                    />
                    <span className="text-[10px] text-slate-400 block capitalize">
                      {overview.subscription.billingMode} billing
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block text-[11px]">Auto Renew</span>
                    <span
                      className={`font-semibold ${
                        overview.subscription.autoRenew ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {overview.subscription.autoRenew ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  This firm is operating without an active subscription document.
                </p>
              )}
            </div>

            {/* 3. Firm Profile & Metadata */}
            <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-lg space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Firm Profile & Contact Records</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Admin Email:</span>
                    <span className="font-mono text-slate-200 select-all truncate">{overview.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Firm Phone:</span>
                    <span className="font-mono text-slate-200 select-all">{overview.firmPhone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Address:</span>
                    <span className="text-slate-200 truncate">{overview.firmAddress || 'Not registered'}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-slate-400">GSTIN:</span>
                    <span className="font-mono text-slate-200 select-all font-semibold">
                      {overview.firmGSTIN || 'Unregistered'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-slate-400">Drug License (DL):</span>
                    <span className="font-mono text-slate-200 select-all">
                      {overview.firmDL || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-400">Last Login:</span>
                    <span className="text-slate-200">{formatDateTime(overview.lastLogin)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Entitlements & Write Status */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">Platform Write Access:</span>
                <span
                  className={`font-semibold ${
                    overview.effectiveAccess?.canWrite ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {overview.effectiveAccess?.canWrite ? 'Granted (Read/Write)' : 'Restricted (Read-Only)'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                <span>Batch Tracking: {overview.preferences?.enableBatchTracking ? 'ON' : 'OFF'}</span>
                <span>Theme: {overview.preferences?.themeMode || 'dark'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {overview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onToggleStatus(overview.tenantId, overview.firmName, overview.isActive);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  overview.isActive
                    ? 'border-rose-800/80 text-rose-300 hover:bg-rose-950/60'
                    : 'border-emerald-800/80 text-emerald-300 hover:bg-emerald-950/60'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{overview.isActive ? 'Suspend Firm' : 'Reactivate Firm'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {overview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartDiagnostic(overview.tenantId, overview.firmName);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Headphones className="w-3.5 h-3.5 text-slate-950" />
                <span>Diagnostic Session</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TenantDetailsModal;
