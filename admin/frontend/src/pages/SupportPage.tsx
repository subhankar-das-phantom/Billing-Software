/**
 * Bharat Enterprise Billing System — Platform Support Sessions & Diagnostics
 * Production-grade control HUD for launching, monitoring, and terminating audited support sessions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Headphones,
  ShieldAlert,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Building2,
  User,
  Info,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import {
  PlatformRole,
  SupportSessionStatus,
  type ActiveSupportSession,
} from '../types';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SearchInput from '../components/common/SearchInput';
import StatusBadge from '../components/common/StatusBadge';

// ─── Format Timestamp to IST Standard ──────────────────────────────
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

// ─── Live Countdown HUD Timer ──────────────────────────────────────
const LiveSessionTimer: React.FC<{ expiresAt: string; onExpire?: () => void }> = ({
  expiresAt,
  onExpire,
}) => {
  const calculateRemaining = useCallback(() => {
    const remainingMs = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      totalMs: remainingMs,
      formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      isUrgent: totalSeconds < 300, // < 5 mins
      isExpired: remainingMs <= 0,
    };
  }, [expiresAt]);

  const [time, setTime] = useState(calculateRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = calculateRemaining();
      setTime(updated);
      if (updated.isExpired) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, onExpire]);

  return (
    <div
      className={`font-mono text-base font-bold px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
        time.isUrgent
          ? 'bg-rose-950/80 text-rose-300 border-rose-700/80 animate-pulse'
          : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
      }`}
    >
      <Clock className="w-4 h-4 shrink-0" />
      <span>{time.formatted} remaining</span>
    </div>
  );
};

export const SupportPage: React.FC = () => {
  const { role, activeSupportSession, setActiveSupportSession } = usePlatformAuth();

  // Modal states
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [sessionToEnd, setSessionToEnd] = useState<string | null>(null);

  // Form states for starting session
  const [targetTenantId, setTargetTenantId] = useState('');
  const [durationHours, setDurationHours] = useState<number>(2.0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Historical sessions table states
  const [sessions, setSessions] = useState<ActiveSupportSession[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SupportSessionStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);

  // Copy indicator state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const isPlatformOwner = role === PlatformRole.PLATFORM_OWNER;
  const maxAllowedDuration = isPlatformOwner ? 4.0 : 2.0;

  // Auto-clamp duration if operator is not owner
  useEffect(() => {
    if (!isPlatformOwner && durationHours > 2.0) {
      setDurationHours(2.0);
    }
  }, [isPlatformOwner, durationHours]);

  // Copy to clipboard helper
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Fetch active session from server to guarantee sync
  const fetchActiveSession = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: ActiveSupportSession | null }>(
        '/support/active'
      );
      if (res.data?.success && res.data.data) {
        setActiveSupportSession(res.data.data);
      } else {
        setActiveSupportSession(null);
      }
    } catch {
      // Ignore background check failures
    }
  }, [setActiveSupportSession]);

  // Fetch historical sessions
  const fetchHistoricalSessions = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const params: Record<string, unknown> = {
        page: currentPage,
        limit: 10,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.targetTenantId = searchQuery.trim();
      }

      const res = await api.get<{
        success: boolean;
        data: ActiveSupportSession[];
        total: number;
        page: number;
        totalPages: number;
      }>('/support', { params });

      if (res.data?.success) {
        setSessions(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalSessions(res.data.total || 0);
      }
    } catch (err: any) {
      console.error('Failed to fetch historical support sessions', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  useEffect(() => {
    fetchHistoricalSessions();
  }, [fetchHistoricalSessions]);

  // Handle starting a session
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTenantId = targetTenantId.trim();
    const cleanReason = reason.trim();

    if (!cleanTenantId) {
      setFormError('Target Tenant ID is required.');
      return;
    }

    if (cleanReason.length < 10) {
      setFormError('Reason must be at least 10 characters detailing the diagnostic purpose.');
      return;
    }

    if (!isPlatformOwner && durationHours > 2.0) {
      setFormError('Non-owner operators cannot exceed a 2.0-hour session window.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{
        success: boolean;
        data: ActiveSupportSession;
        message?: string;
      }>('/support/start', {
        targetTenantId: cleanTenantId,
        reason: cleanReason,
        durationHours,
      });

      if (res.data?.success && res.data.data) {
        setActiveSupportSession(res.data.data);
        setIsStartModalOpen(false);
        setTargetTenantId('');
        setReason('');
        setDurationHours(2.0);
        setFeedbackMessage({
          type: 'success',
          text: `Diagnostic support session ${res.data.data.sessionCode} initiated successfully.`,
        });
        fetchHistoricalSessions();
      }
    } catch (err: any) {
      setFormError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          err.message ||
          'Failed to initiate support session.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle terminating a session
  const handleConfirmEndSession = async (endReason: string) => {
    const codeOrId = sessionToEnd || activeSupportSession?.sessionCode;
    if (!codeOrId) return;

    try {
      await api.post(`/support/${codeOrId}/end`, {
        reason: endReason || 'Operator terminated support session.',
      });

      if (activeSupportSession?.sessionCode === codeOrId || activeSupportSession?._id === codeOrId) {
        setActiveSupportSession(null);
      }

      setFeedbackMessage({
        type: 'success',
        text: `Support session ${codeOrId} terminated successfully.`,
      });
      fetchHistoricalSessions();
      fetchActiveSession();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text:
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Failed to terminate support session.',
      });
    } finally {
      setIsEndDialogOpen(false);
      setSessionToEnd(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Headphones className="w-5 h-5 text-amber-400" />
            Support Sessions & Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically audited diagnostic boundaries, time-capped tenant inspection, and live session termination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormError(null);
              setIsStartModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs transition shadow-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Diagnostic Session
          </button>
        </div>
      </div>

      {/* Global Inline Feedback Notification */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between transition ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Session HUD */}
      {activeSupportSession ? (
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/40 rounded-xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <div>
                <span className="text-[11px] font-mono tracking-wider text-amber-400 font-semibold uppercase">
                  Active Diagnostic Session HUD
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold font-mono text-slate-100 tracking-tight">
                    {activeSupportSession.sessionCode}
                  </span>
                  <button
                    onClick={() => handleCopy(activeSupportSession.sessionCode)}
                    title="Copy Session Code"
                    className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition"
                  >
                    {copiedCode === activeSupportSession.sessionCode ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LiveSessionTimer
                expiresAt={activeSupportSession.expiresAt}
                onExpire={() => {
                  fetchActiveSession();
                  fetchHistoricalSessions();
                }}
              />
              <button
                onClick={() => {
                  setSessionToEnd(activeSupportSession.sessionCode);
                  setIsEndDialogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-700/80 text-rose-200 text-xs font-medium transition"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Terminate Session
              </button>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                Target Tenant ID
              </div>
              <div className="font-mono text-slate-200 font-semibold truncate">
                {activeSupportSession.targetTenantId}
              </div>
              {activeSupportSession.targetTenantFirmName && (
                <div className="text-[11px] text-slate-400">
                  {activeSupportSession.targetTenantFirmName}
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Session Initiated
              </div>
              <div className="font-mono text-slate-200">
                {formatDateTime(activeSupportSession.startedAt)}
              </div>
              <div className="text-[11px] text-slate-400">
                Expires at {formatDateTime(activeSupportSession.expiresAt)}
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 space-y-1">
              <div className="text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                Audit Justification
              </div>
              <div className="text-slate-200 line-clamp-2 italic">
                "{activeSupportSession.reason}"
              </div>
            </div>
          </div>

          {/* Read-Only Status Warning */}
          <div className="mt-4 p-3 bg-amber-950/40 border border-amber-600/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold">Diagnostic Boundary Active: </span>
              Actions conducted under session code{' '}
              <span className="font-mono font-bold">{activeSupportSession.sessionCode}</span> are
              injected with platform operator headers and cryptographically chained to the platform
              audit trail. Mutating tenant data without formal authorization violates platform policy.
            </div>
          </div>
        </div>
      ) : (
        /* Standby HUD Card when no session is active */
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">
                No Active Diagnostic Support Session
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                Diagnostic access to tenant databases is strictly locked by default. Operators must
                initiate a time-bounded, justified support session to unlock diagnostic telemetry.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setFormError(null);
              setIsStartModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
            Launch Support Session
          </button>
        </div>
      )}

      {/* Historical Sessions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        {/* Table controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Diagnostic Session History
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-slate-700/60">
              {totalSessions} total
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter capsules */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['ALL', SupportSessionStatus.ACTIVE, SupportSessionStatus.ENDED, SupportSessionStatus.EXPIRED] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                      statusFilter === status
                        ? 'bg-slate-800 text-slate-100 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {status}
                  </button>
                )
              )}
            </div>

            {/* Search */}
            <div className="w-48 sm:w-60">
              <SearchInput
                value={searchQuery}
                onChange={(val) => {
                  setSearchQuery(val);
                  setCurrentPage(1);
                }}
                placeholder="Search tenant ID..."
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => {
                fetchHistoricalSessions();
                fetchActiveSession();
              }}
              title="Refresh sessions"
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-4">Session Code</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Tenant ID</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoadingList ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    Loading support sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No support sessions match the selected criteria.
                  </td>
                </tr>
              ) : (
                sessions.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono font-medium text-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span>{item.sessionCode}</span>
                        <button
                          onClick={() => handleCopy(item.sessionCode)}
                          title="Copy session code"
                          className="text-slate-500 hover:text-slate-300"
                        >
                          {copiedCode === item.sessionCode ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate max-w-[140px]" title={item.operatorId}>
                          {item.operatorId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      <div className="flex items-center gap-1 text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-sky-400/80 shrink-0" />
                        <span className="truncate max-w-[150px]" title={item.targetTenantId}>
                          {item.targetTenantId}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {formatDateTime(item.startedAt)}
                    </td>
                    <td className="py-3 px-4">
                      {item.status === SupportSessionStatus.ACTIVE ? (
                        <StatusBadge variant="emerald" label="ACTIVE" dot pulse />
                      ) : item.status === SupportSessionStatus.EXPIRED ? (
                        <StatusBadge variant="amber" label="EXPIRED" />
                      ) : (
                        <StatusBadge variant="slate" label="ENDED" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[220px]">
                      <div className="truncate" title={item.reason}>
                        {item.reason}
                      </div>
                      {item.endedBy && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          Ended by operator: {item.endedBy}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {item.status === SupportSessionStatus.ACTIVE && (
                        <button
                          onClick={() => {
                            setSessionToEnd(item.sessionCode);
                            setIsEndDialogOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-medium transition"
                        >
                          Terminate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Start Diagnostic Session Modal */}
      <Modal
        isOpen={isStartModalOpen}
        onClose={() => !isSubmitting && setIsStartModalOpen(false)}
        title="Start Diagnostic Support Session"
        description="Launch an audited, time-bounded support session to access tenant-scoped diagnostic telemetry."
        maxWidth="lg"
      >
        <form onSubmit={handleStartSession} className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700/80 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{formError}</div>
            </div>
          )}

          {/* Target Tenant ID */}
          <div>
            <label className="block font-medium text-slate-200 mb-1">
              Target Tenant ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              placeholder="e.g. 66a1b2c3d4e5f67890123456"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Provide the unique MongoDB ObjectId of the tenant enterprise firm.
            </p>
          </div>

          {/* Duration Slider */}
          <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Session Duration
              </label>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {durationHours.toFixed(1)} Hours ({Math.round(durationHours * 60)} mins)
              </span>
            </div>

            <input
              type="range"
              min="0.5"
              max={maxAllowedDuration}
              step="0.5"
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.5h</span>
              <span>1.0h</span>
              <span>2.0h</span>
              {isPlatformOwner && (
                <>
                  <span>3.0h</span>
                  <span>4.0h</span>
                </>
              )}
            </div>

            {!isPlatformOwner && (
              <div className="mt-2 p-2 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Standard operators are limited to a maximum 2.0-hour window. Platform Owner authority
                  is required for extended 4.0-hour sessions.
                </span>
              </div>
            )}
          </div>

          {/* Diagnostic Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-200">
                Audited Reason / Diagnostic Purpose <span className="text-rose-400">*</span>
              </label>
              <span
                className={`font-mono text-[10px] ${
                  reason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {reason.trim().length} / 10 chars minimum
              </span>
            </div>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Investigating GST tax reconciliation discrepancy on Invoice INV-2026-0891 requested by firm accountant."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This statement will be hashed into the append-only SHA-256 audit ledger.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsStartModalOpen(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 10 || !targetTenantId.trim()}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Initiating...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Initiate Session
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Terminate Session Dialog */}
      <ConfirmDialog
        isOpen={isEndDialogOpen}
        onClose={() => {
          setIsEndDialogOpen(false);
          setSessionToEnd(null);
        }}
        onConfirm={handleConfirmEndSession}
        title="Terminate Diagnostic Support Session"
        description={`Are you sure you want to conclude support session ${sessionToEnd || activeSupportSession?.sessionCode}? This action terminates diagnostic token authority immediately.`}
        confirmLabel="Terminate Session"
        cancelLabel="Keep Session Active"
        severity="danger"
        minReasonLength={10}
      />
    </div>
  );
};

export default SupportPage;
