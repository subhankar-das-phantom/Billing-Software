/**
 * Bharat Enterprise Billing System — Platform Tenants Directory
 * Searchable, keyset-paginated directory of all tenant accounts on the platform.
 * Complete enterprise implementation with inspect modal, audited suspension, support shortcuts,
 * and high-density dual desktop table / mobile collapsible card views with 2x2 action matrix.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  RefreshCw,
  Eye,
  Power,
  Headphones,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
  Mail,
  Phone,
  Calendar,
  CreditCard,
} from 'lucide-react';
import SearchInput from '../components/common/SearchInput';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Toast, { type ToastMessage } from '../components/common/Toast';
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import TenantDetailsModal from '../components/tenants/TenantDetailsModal';
import DiagnosticSessionModal from '../components/tenants/DiagnosticSessionModal';
import AnimatedCounter from '../components/common/AnimatedCounter';
import api from '../services/api';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import { useListFilterParams } from '../hooks/useListFilterParams';
import {
  PlatformPermission,
  type TenantListItemDTO,
  type IPaginatedResponse,
  type ActiveSupportSession,
} from '../types';

type StatusFilterType = 'all' | 'active' | 'inactive';

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

export const TenantsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePlatformAuth();

  // Permissions guards
  const canSuspend = hasPermission(PlatformPermission.TENANTS_SUSPEND);
  const canReactivate = hasPermission(PlatformPermission.TENANTS_REACTIVATE);
  const canStartSupport = hasPermission(PlatformPermission.SUPPORT_START);

  // URL-synchronized filter state
  const { params, setParam, resetParams } = useListFilterParams({
    search: '',
    status: 'all' as StatusFilterType,
  });

  const search = params.search;
  const statusFilter = (params.status || 'all') as StatusFilterType;

  // Keyset cursor pagination traversal state
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // Modals state
  const [inspectState, setInspectState] = useState<{
    isOpen: boolean;
    tenantId: string | null;
  }>({
    isOpen: false,
    tenantId: null,
  });

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    tenantId: string;
    firmName: string;
    action: 'suspend' | 'reactivate';
    isLoading: boolean;
  }>({
    isOpen: false,
    tenantId: '',
    firmName: '',
    action: 'suspend',
    isLoading: false,
  });

  const [diagnosticState, setDiagnosticState] = useState<{
    isOpen: boolean;
    tenantId: string;
    firmName: string;
  }>({
    isOpen: false,
    tenantId: '',
    firmName: '',
  });

  // Toast feedback state
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // ─── Query: Keyset Paginated Tenants ──────────────────────────────
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<IPaginatedResponse<TenantListItemDTO>>({
    queryKey: ['platform', 'tenants', { limit: 25, search, status: statusFilter, cursor }],
    queryFn: async () => {
      const queryParams: Record<string, string | number> = {
        limit: 25,
      };
      if (search.trim()) {
        queryParams.search = search.trim();
      }
      if (statusFilter !== 'all') {
        queryParams.status = statusFilter;
      }
      if (cursor) {
        queryParams.cursor = cursor;
      }

      const res = await api.get<IPaginatedResponse<TenantListItemDTO>>('/tenants', { params: queryParams });
      return res.data;
    },
    staleTime: 30000,
  });

  const tenants = data?.data ?? [];
  const pagination = data?.pagination;
  const totalCount = pagination?.totalCount;

  // ─── Filter Handlers ─────────────────────────────────────────────
  const handleSearchChange = (newSearch: string) => {
    setParam('search', newSearch);
    setCursor(null);
    setCursorStack([]);
  };

  const handleStatusFilterChange = (newStatus: StatusFilterType) => {
    setParam('status', newStatus);
    setCursor(null);
    setCursorStack([]);
  };

  const handleResetFilters = () => {
    resetParams();
    setCursor(null);
    setCursorStack([]);
  };

  // ─── Keyset Pagination Navigation Handlers ───────────────────────
  const handleNextPage = () => {
    if (pagination?.nextCursor) {
      setCursorStack((prev) => [...prev, cursor || '']);
      setCursor(pagination.nextCursor);
    }
  };

  const handlePrevPage = () => {
    if (cursorStack.length > 0) {
      const newStack = [...cursorStack];
      const prevCursor = newStack.pop() || null;
      setCursorStack(newStack);
      setCursor(prevCursor ? prevCursor : null);
    }
  };

  // ─── Action Handlers ─────────────────────────────────────────────
  const handleInspect = (tenantId: string) => {
    setInspectState({
      isOpen: true,
      tenantId,
    });
  };

  const handleInitiateStatusToggle = (
    tenantId: string,
    firmName: string,
    currentIsActive: boolean
  ) => {
    const action = currentIsActive ? 'suspend' : 'reactivate';
    setConfirmState({
      isOpen: true,
      tenantId,
      firmName,
      action,
      isLoading: false,
    });
  };

  const handleConfirmStatusToggle = async (reason: string) => {
    if (!confirmState.tenantId) return;

    setConfirmState((prev) => ({ ...prev, isLoading: true }));
    try {
      const endpoint =
        confirmState.action === 'suspend'
          ? `/tenants/${confirmState.tenantId}/suspend`
          : `/tenants/${confirmState.tenantId}/reactivate`;

      await api.post(endpoint, { reason });

      // Invalidate queries to refresh lists and dashboard counters
      await queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      await queryClient.invalidateQueries({ queryKey: ['platform', 'dashboard'] });

      setToast({
        id: String(Date.now()),
        type: 'success',
        title:
          confirmState.action === 'suspend'
            ? 'Tenant Account Suspended'
            : 'Tenant Account Reactivated',
        message: `${confirmState.firmName} has been successfully ${
          confirmState.action === 'suspend' ? 'suspended' : 'reactivated'
        }. All access policies have taken effect.`,
      });

      setConfirmState({
        isOpen: false,
        tenantId: '',
        firmName: '',
        action: 'suspend',
        isLoading: false,
      });
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `Failed to ${confirmState.action} tenant. Please verify permissions.`;
      setToast({
        id: String(Date.now()),
        type: 'error',
        title: 'Operation Failed',
        message: errorMsg,
      });
      setConfirmState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleStartDiagnostic = (tenantId: string, firmName: string) => {
    setDiagnosticState({
      isOpen: true,
      tenantId,
      firmName,
    });
  };

  const handleDiagnosticSuccess = (session: ActiveSupportSession) => {
    setToast({
      id: String(Date.now()),
      type: 'success',
      title: 'Diagnostic Support Session Active',
      message: `Support session #${session.sessionCode} initiated for ${
        session.targetTenantFirmName || 'target tenant'
      }. Read-only guard enabled.`,
    });
  };

  const handleAdjustTenant = (tenant: TenantListItemDTO) => {
    navigate(`/subscriptions?search=${encodeURIComponent(tenant.firmName || tenant.tenantId)}`);
  };

  const currentPageNumber = cursorStack.length + 1;

  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-100 tracking-tight">Tenants Directory</h1>
            {totalCount !== undefined ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-2xs">
                <AnimatedCounter target={totalCount} /> total
              </span>
            ) : tenants.length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 shadow-2xs">
                <AnimatedCounter target={tenants.length} /> loaded
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage enterprise firm accounts, inspect live tenant data, audit suspensions, and initiate diagnostics.
          </p>
        </div>

        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search firm, GSTIN, phone, email, ID..."
            className="w-full sm:w-72"
          />

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-100 transition-colors cursor-pointer shrink-0"
            title="Refresh tenants directory"
            aria-label="Refresh directory"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? 'animate-spin text-cyan-400' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* 2. Status Filter Capsule Strip & Fast Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800/80 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => handleStatusFilterChange('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>All Tenants</span>
          </button>

          <button
            type="button"
            onClick={() => handleStatusFilterChange('active')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-emerald-950/80 text-emerald-300 shadow-xs border border-emerald-700/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Active Only</span>
          </button>

          <button
            type="button"
            onClick={() => handleStatusFilterChange('inactive')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'inactive'
                ? 'bg-rose-950/80 text-rose-300 shadow-xs border border-rose-700/80'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Suspended</span>
          </button>
        </div>

        {/* Filter status indicator */}
        {(search || statusFilter !== 'all') && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              Active Filter: <strong className="text-slate-200">{statusFilter.toUpperCase()}</strong>
              {search && <> matching &quot;<span className="text-cyan-300">{search}</span>&quot;</>}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer font-medium"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* 3. Interactive Data Container: Desktop Table + Mobile Collapsible Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Table/Directory Head */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-300">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>Registered Enterprise Tenants</span>
            {pagination && (
              <span className="text-slate-500 font-mono text-[11px]">
                (Page {currentPageNumber})
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <StatusBadge variant="emerald" label="Active" dot />
              <StatusBadge variant="rose" label="Suspended" dot />
            </div>
          </div>
        </div>

        {/* ─── A. DESKTOP VIEW (Table: md and up) ─── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Firm Name & Identity</th>
                <th className="py-3 px-4">Admin Email</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Status & Plan</th>
                <th className="py-3 px-4">Registered Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {/* Loading Skeleton */}
              {isLoading && (
                <>
                  {[...Array(6)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse bg-slate-900/40">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 shrink-0" />
                          <div className="space-y-1.5">
                            <div className="h-3 bg-slate-800 rounded w-32" />
                            <div className="h-2.5 bg-slate-800/60 rounded w-20" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3 bg-slate-800 rounded w-28" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3 bg-slate-800 rounded w-20" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-800 rounded w-16" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-3 bg-slate-800 rounded w-24" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="h-7 bg-slate-800 rounded w-28 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Error State */}
              {isError && !isLoading && (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-2 text-xs">
                      <ShieldAlert className="w-7 h-7 text-rose-400 mx-auto" />
                      <p className="font-semibold text-rose-200">Failed to load platform tenants</p>
                      <p className="text-slate-400">
                        {(error as any)?.message ||
                          'The server encountered an error while resolving tenant accounts.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium cursor-pointer"
                      >
                        Try Again
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty State */}
              {!isLoading && !isError && tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3 text-xs">
                      <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-500">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-200 text-sm">No tenants found</p>
                        <p className="text-slate-400 text-xs leading-relaxed">
                          {search || statusFilter !== 'all'
                            ? 'No enterprise tenants match your active search terms or status filter.'
                            : 'There are currently no registered tenants on the platform control plane.'}
                        </p>
                      </div>

                      {(search || statusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reset Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {!isLoading &&
                !isError &&
                tenants.map((tenant) => {
                  const initial = (tenant.firmName || 'T').charAt(0).toUpperCase();

                  return (
                    <tr
                      key={tenant.tenantId}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* 1. Firm Name & Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0 select-none shadow-2xs">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleInspect(tenant.tenantId)}
                              className="font-semibold text-slate-100 hover:text-cyan-400 transition-colors text-left truncate block max-w-xs cursor-pointer"
                              title="Inspect tenant profile"
                            >
                              {tenant.firmName || 'Unnamed Firm'}
                            </button>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                              {tenant.firmGSTIN ? (
                                <span className="font-mono text-slate-400">
                                  GST: {tenant.firmGSTIN}
                                </span>
                              ) : (
                                <span className="font-mono text-slate-500">
                                  ID: {tenant.tenantId ? tenant.tenantId.slice(-8) : '—'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Admin Email */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-300 select-all truncate block max-w-[200px]">
                          {tenant.email}
                        </span>
                      </td>

                      {/* 3. Contact Phone */}
                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-300 select-all">
                          {tenant.phone || '—'}
                        </span>
                      </td>

                      {/* 4. Status & Plan */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge
                            variant={tenant.isActive ? 'emerald' : 'rose'}
                            label={tenant.isActive ? 'Active' : 'Suspended'}
                            dot
                          />

                          {tenant.subscription?.planName && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800/80 text-cyan-300 border border-slate-700/70">
                              {tenant.subscription.planName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 5. Registered Date */}
                      <td className="py-3 px-4 text-slate-300">
                        <span>{formatDate(tenant.createdAt)}</span>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect Tenant */}
                          <button
                            type="button"
                            onClick={() => handleInspect(tenant.tenantId)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                            title="Inspect Tenant Details"
                            aria-label={`Inspect ${tenant.firmName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Diagnostic Session */}
                          <button
                            type="button"
                            onClick={() => handleStartDiagnostic(tenant.tenantId, tenant.firmName)}
                            disabled={!canStartSupport}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-amber-600/60 bg-slate-950/60 hover:bg-amber-950/40 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              canStartSupport
                                ? 'Start Diagnostic Support Session'
                                : 'Permission required: platform.support.start'
                            }
                            aria-label={`Start Diagnostic Session for ${tenant.firmName}`}
                          >
                            <Headphones className="w-3.5 h-3.5" />
                          </button>

                          {/* Adjust Subscription */}
                          <button
                            type="button"
                            onClick={() => handleAdjustTenant(tenant)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-cyan-600/60 bg-slate-950/60 hover:bg-cyan-950/40 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Adjust Subscription Tenure"
                            aria-label={`Adjust Subscription for ${tenant.firmName}`}
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            type="button"
                            onClick={() =>
                              handleInitiateStatusToggle(
                                tenant.tenantId,
                                tenant.firmName,
                                tenant.isActive
                              )
                            }
                            disabled={tenant.isActive ? !canSuspend : !canReactivate}
                            className={`p-1.5 rounded-lg border bg-slate-950/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              tenant.isActive
                                ? 'border-slate-800 hover:border-rose-700/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400'
                                : 'border-slate-800 hover:border-emerald-700/80 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={
                              tenant.isActive
                                ? canSuspend
                                  ? 'Suspend Tenant Account'
                                  : 'Permission required: platform.tenants.suspend'
                                : canReactivate
                                ? 'Reactivate Tenant Account'
                                : 'Permission required: platform.tenants.reactivate'
                            }
                            aria-label={`${tenant.isActive ? 'Suspend' : 'Reactivate'} ${tenant.firmName}`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* ─── B. MOBILE VIEW (Collapsible Cards: < md) ─── */}
        <div className="md:hidden p-3 space-y-3">
          {/* Mobile Loading Skeleton */}
          {isLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, idx) => (
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

          {/* Mobile Error State */}
          {isError && !isLoading && (
            <div className="p-6 text-center text-xs space-y-2">
              <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="font-semibold text-rose-200">Failed to load platform tenants</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 text-slate-100 font-medium cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Mobile Empty State */}
          {!isLoading && !isError && tenants.length === 0 && (
            <div className="p-8 text-center text-xs space-y-3">
              <Building2 className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-slate-300">No tenants found</p>
              <p className="text-slate-500">
                {search || statusFilter !== 'all'
                  ? 'No enterprise tenants match your filters.'
                  : 'No registered tenants.'}
              </p>
              {(search || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 min-h-[44px] rounded-lg bg-cyan-600 text-white font-medium cursor-pointer inline-flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          )}

          {/* Mobile Cards List */}
          {!isLoading &&
            !isError &&
            tenants.map((tenant) => {
              const initial = (tenant.firmName || 'T').charAt(0).toUpperCase();

              // Summary component: 74-82px bounded height, single-line text truncation
              const cardSummary = (
                <div className="flex items-center gap-3 min-w-0 pr-1">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0 select-none shadow-2xs">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 truncate text-xs block">
                        {tenant.firmName || 'Unnamed Firm'}
                      </span>
                      <StatusBadge
                        variant={tenant.isActive ? 'emerald' : 'rose'}
                        label={tenant.isActive ? 'Active' : 'Suspended'}
                        dot
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                      <span className="truncate">
                        {tenant.firmGSTIN ? `GST: ${tenant.firmGSTIN}` : `ID: ${tenant.tenantId?.slice(-8)}`}
                      </span>
                      {tenant.subscription?.planName && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] uppercase bg-slate-800 text-cyan-300 border border-slate-700 shrink-0">
                          {tenant.subscription.planName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );

              return (
                <CollapsibleMobileCard
                  key={tenant.tenantId}
                  id={tenant.tenantId}
                  entityType="tenant"
                  statusVariant={tenant.isActive ? 'default' : 'danger'}
                  summary={cardSummary}
                >
                  {/* Expanded Content: Contact Meta & Structured 2x2 Action Grid */}
                  <div className="space-y-3 pt-2 text-xs">
                    {/* Compact Meta Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-slate-300 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate select-all">{tenant.email || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="select-all">{tenant.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Registered {formatDate(tenant.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>Plan: {tenant.subscription?.planName || 'Standard'}</span>
                      </div>
                    </div>

                    {/* Structured 2x2 Action Grid with min-h-[44px] touch targets */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                      {/* Action 1: Inspect */}
                      <button
                        type="button"
                        onClick={() => handleInspect(tenant.tenantId)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label={`Inspect ${tenant.firmName}`}
                      >
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span>Inspect</span>
                      </button>

                      {/* Action 2: Diagnostic */}
                      <button
                        type="button"
                        onClick={() => handleStartDiagnostic(tenant.tenantId, tenant.firmName)}
                        disabled={!canStartSupport}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-900/60 text-amber-300 border border-amber-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                        aria-label={`Start diagnostic session for ${tenant.firmName}`}
                      >
                        <Headphones className="w-4 h-4 text-amber-400" />
                        <span>Diagnostic</span>
                      </button>

                      {/* Action 3: Adjust */}
                      <button
                        type="button"
                        onClick={() => handleAdjustTenant(tenant)}
                        className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-cyan-300 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                        aria-label={`Adjust subscription for ${tenant.firmName}`}
                      >
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <span>Adjust</span>
                      </button>

                      {/* Action 4: Suspend / Reactivate */}
                      <button
                        type="button"
                        onClick={() =>
                          handleInitiateStatusToggle(
                            tenant.tenantId,
                            tenant.firmName,
                            tenant.isActive
                          )
                        }
                        disabled={tenant.isActive ? !canSuspend : !canReactivate}
                        className={`min-h-[44px] px-3 py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors ${
                          tenant.isActive
                            ? 'bg-rose-950/40 hover:bg-rose-900/50 active:bg-rose-900/60 text-rose-300 border-rose-800/60'
                            : 'bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                        }`}
                        aria-label={`${tenant.isActive ? 'Suspend' : 'Reactivate'} ${tenant.firmName}`}
                      >
                        <Power className="w-4 h-4" />
                        <span>{tenant.isActive ? 'Suspend' : 'Reactivate'}</span>
                      </button>
                    </div>
                  </div>
                </CollapsibleMobileCard>
              );
            })}
        </div>

        {/* 4. Keyset Pagination Controls Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-slate-200">{tenants.length}</strong> tenants on this page
            </span>
            {pagination?.nextCursor && (
              <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-slate-500">
                <span>Cursor:</span>
                <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-400">
                  {pagination.nextCursor.slice(0, 12)}...
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Previous Page */}
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={cursorStack.length === 0 || isLoading || isFetching}
              className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-slate-100 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer font-medium"
              title="Navigate to previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2.5 py-1 text-[11px] font-mono text-slate-400">
              Page {currentPageNumber}
            </span>

            {/* Next Page */}
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!pagination?.hasNextPage || isLoading || isFetching}
              className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-slate-100 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer font-medium"
              title="Navigate to next page using keyset cursor"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Modals & Dialogs */}
      {/* A. Inspect Tenant Modal */}
      <TenantDetailsModal
        isOpen={inspectState.isOpen}
        onClose={() => setInspectState({ isOpen: false, tenantId: null })}
        tenantId={inspectState.tenantId}
        onStartDiagnostic={(id, name) => handleStartDiagnostic(id, name)}
        onToggleStatus={(id, name, isActive) => handleInitiateStatusToggle(id, name, isActive)}
      />

      {/* B. Suspend / Reactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() =>
          setConfirmState({
            isOpen: false,
            tenantId: '',
            firmName: '',
            action: 'suspend',
            isLoading: false,
          })
        }
        onConfirm={handleConfirmStatusToggle}
        title={
          confirmState.action === 'suspend'
            ? `Suspend Tenant: ${confirmState.firmName}`
            : `Reactivate Tenant: ${confirmState.firmName}`
        }
        description={
          confirmState.action === 'suspend'
            ? 'This will immediately revoke system access for this enterprise firm and all associated employee users across all endpoints. Active client sessions will be rejected. This action is permanently logged to the platform security audit trail.'
            : 'This will restore active login privileges and transactional capability for this enterprise firm and its staff. Ensure billing or compliance terms have been satisfied.'
        }
        confirmLabel={confirmState.action === 'suspend' ? 'Suspend Tenant Account' : 'Reactivate Tenant'}
        severity={confirmState.action === 'suspend' ? 'danger' : 'warning'}
        minReasonLength={10}
        isLoading={confirmState.isLoading}
      />

      {/* C. Diagnostic Support Session Initiator */}
      <DiagnosticSessionModal
        isOpen={diagnosticState.isOpen}
        onClose={() =>
          setDiagnosticState({
            isOpen: false,
            tenantId: '',
            firmName: '',
          })
        }
        tenantId={diagnosticState.tenantId}
        firmName={diagnosticState.firmName}
        onSuccess={handleDiagnosticSuccess}
      />

      {/* D. Global Toast Notifications */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
};

export default TenantsPage;
