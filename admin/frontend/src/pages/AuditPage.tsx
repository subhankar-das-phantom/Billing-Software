/**
 * Bharat Enterprise Billing System — Platform Cryptographic Audit Trail
 * SHA-256 hash-chained immutable audit log with verification, diff inspection, keyset pagination,
 * visual Merkle chain link indicators, and dual desktop table / mobile collapsible card views.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Lock,
  Fingerprint,
  Layers,
  Globe,
  Building2,
  AlertTriangle,
  FileCode,
} from 'lucide-react';
import api from '../services/api';
import type {
  AuditLog,
  VerifyChainResult,
} from '../types';
import SearchInput from '../components/common/SearchInput';
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import { useListFilterParams } from '../hooks/useListFilterParams';

// ─── Format Timestamp to IST ──────────────────────────────────────
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

// ─── Hash Snippet with Copy Affordance ─────────────────────────────
const HashSnippet: React.FC<{
  hash: string;
  label?: string;
  isGenesis?: boolean;
}> = ({ hash, isGenesis }) => {
  const [copied, setCopied] = useState(false);

  const display = useMemo(() => {
    if (!hash) return '—';
    if (hash.length <= 14) return hash;
    return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
  }, [hash]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isGenesis) {
    return (
      <span className="font-mono text-[11px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 inline-flex items-center gap-1">
        <Lock className="w-3 h-3 text-amber-400" />
        GENESIS_000
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
      <span className="select-all" title={hash}>
        {display}
      </span>
      <button
        onClick={handleCopy}
        title="Copy full SHA-256 hash"
        className="p-1 text-slate-500 hover:text-slate-200 transition min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
};

// ─── Formatted JSON State Diff Renderer ───────────────────────────
const FormattedJsonViewer: React.FC<{
  data?: Record<string, unknown> | null;
  title: string;
  emptyLabel?: string;
}> = ({ data, title, emptyLabel = 'No state recorded' }) => {
  const formatted = useMemo(() => {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null;
    return JSON.stringify(data, null, 2);
  }, [data]);

  const fieldCount = data && typeof data === 'object' ? Object.keys(data).length : 0;

  return (
    <div className="flex-1 min-w-[260px] bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-hidden">
      <div className="text-[11px] font-semibold text-slate-400 pb-1.5 border-b border-slate-800/80 flex items-center justify-between">
        <span>{title}</span>
        {formatted && (
          <span className="font-mono text-[10px] text-slate-500">
            {fieldCount} fields
          </span>
        )}
      </div>
      {formatted ? (
        <pre className="mt-2 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60 p-2 bg-slate-900/60 rounded border border-slate-800/60 leading-relaxed whitespace-pre-wrap break-all">
          {formatted}
        </pre>
      ) : (
        <div className="py-6 text-center text-slate-500 text-xs italic">{emptyLabel}</div>
      )}
    </div>
  );
};

type ScopeFilterType = 'ALL' | 'GLOBAL' | 'TENANT';

export const AuditPage: React.FC = () => {
  // URL-backed filter synchronization
  const { params, setParam } = useListFilterParams({
    scope: 'ALL',
    tenantId: '',
    action: '',
    severity: 'ALL',
  });

  const scopeFilter = (params.scope || 'ALL') as ScopeFilterType;
  const tenantScopeInput = params.tenantId || '';
  const searchAction = params.action || '';
  const severityFilter = params.severity || 'ALL';

  // Logs & Keyset Pagination
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  // Row expand tracking (Desktop)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Copy tracking
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Cryptographic Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyChainResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Active effective scope query param
  const activeScopeParam = useMemo(() => {
    if (scopeFilter === 'GLOBAL') return 'global';
    if (scopeFilter === 'TENANT') {
      const clean = tenantScopeInput.trim();
      return clean ? (clean.startsWith('tenant:') ? clean : `tenant:${clean}`) : undefined;
    }
    return undefined;
  }, [scopeFilter, tenantScopeInput]);

  // Fetch Audit Logs with Keyset Pagination
  const fetchAuditLogs = useCallback(
    async (cursor: string | null) => {
      setIsLoadingLogs(true);
      try {
        const queryParams: Record<string, unknown> = {
          limit: 20,
        };

        if (cursor) {
          queryParams.cursor = cursor;
        }
        if (activeScopeParam) {
          queryParams.scope = activeScopeParam;
        }
        if (searchAction.trim()) {
          queryParams.action = searchAction.trim();
        }
        if (severityFilter !== 'ALL') {
          queryParams.severity = severityFilter;
        }

        const res = await api.get<{
          success: boolean;
          data: AuditLog[];
          pagination: {
            hasNextPage: boolean;
            nextCursor: string | null;
            limit: number;
          };
        }>('/audit', { params: queryParams });

        if (res.data?.success) {
          setLogs(res.data.data || []);
          setHasNextPage(Boolean(res.data.pagination?.hasNextPage));
          setNextCursor(res.data.pagination?.nextCursor || null);
        }
      } catch (err: any) {
        console.error('Failed to retrieve audit trail logs', err);
      } finally {
        setIsLoadingLogs(false);
      }
    },
    [activeScopeParam, searchAction, severityFilter]
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCursorHistory([null]);
    setPageIndex(0);
    fetchAuditLogs(null);
  }, [fetchAuditLogs]);

  const handleNextPage = () => {
    if (!hasNextPage || !nextCursor) return;
    const nextHistory = [...cursorHistory.slice(0, pageIndex + 1), nextCursor];
    setCursorHistory(nextHistory);
    setPageIndex(pageIndex + 1);
    fetchAuditLogs(nextCursor);
  };

  const handlePreviousPage = () => {
    if (pageIndex <= 0) return;
    const prevIndex = pageIndex - 1;
    const prevCursor = cursorHistory[prevIndex] || null;
    setPageIndex(prevIndex);
    fetchAuditLogs(prevCursor);
  };

  // Trigger Cryptographic Chain Verification
  const handleVerifyChain = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);

    try {
      const scopeToVerify = activeScopeParam || 'global';
      const res = await api.get<{
        success: boolean;
        verification: VerifyChainResult;
      }>('/audit/verify', {
        params: { scope: scopeToVerify },
      });

      if (res.data?.success && res.data.verification) {
        setVerificationResult(res.data.verification);
      } else {
        setVerificationError('Verification response was malformed or missing verification payload.');
      }
    } catch (err: any) {
      setVerificationError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Cryptographic verification check failed.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-emerald-400" />
            Cryptographic Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            SHA-256 hash-chained immutable log of platform operator actions, session lifecycle, and sensitive tenant state mutations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-400 focus:outline-none cursor-pointer"
          >
            {isVerifying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>Verify Audit Hash Chain</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Chain Verification HUD Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
            verificationResult.valid
              ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700/80 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-semibold text-xs tracking-tight">
                {verificationResult.valid
                  ? 'Cryptographic Hash Continuity Verified: Zero Tamper Detected'
                  : 'Cryptographic Chain Verification Failed: Discrepancy Detected'}
              </div>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono">
                Scope: <span className="font-bold">{verificationResult.scope}</span> • Entries
                Verified: <span className="font-bold">{verificationResult.verifiedCount}</span>
                {verificationResult.startSequence !== undefined &&
                  verificationResult.endSequence !== undefined && (
                    <span>
                      {' '}
                      • Sequences #{verificationResult.startSequence} through #
                      {verificationResult.endSequence}
                    </span>
                  )}
              </p>
              {!verificationResult.valid && verificationResult.error && (
                <p className="text-[11px] text-rose-200 mt-1 font-mono font-medium">
                  Verification Error: {verificationResult.error}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => setVerificationResult(null)}
            className="text-xs px-3 py-1.5 min-h-[38px] rounded bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/60 self-start sm:self-auto transition cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Verification Error Notification */}
      {verificationError && (
        <div className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-700/80 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{verificationError}</span>
          </div>
          <button
            onClick={() => setVerificationError(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Scope selection buttons */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
              Scope:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setParam('scope', 'ALL')}
                className={`px-2.5 py-1 min-h-[30px] rounded text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  scopeFilter === 'ALL'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>All Scopes</span>
              </button>
              <button
                type="button"
                onClick={() => setParam('scope', 'GLOBAL')}
                className={`px-2.5 py-1 min-h-[30px] rounded text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  scopeFilter === 'GLOBAL'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span>Global</span>
              </button>
              <button
                type="button"
                onClick={() => setParam('scope', 'TENANT')}
                className={`px-2.5 py-1 min-h-[30px] rounded text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer ${
                  scopeFilter === 'TENANT'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3 h-3 text-amber-400" />
                <span>Tenant-Scoped</span>
              </button>
            </div>
          </div>

          {/* Severity filter pills */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
              Severity:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['ALL', 'INFO', 'WARNING', 'CRITICAL', 'SECURITY_ALERT'] as const).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setParam('severity', sev)}
                  className={`px-2 py-0.5 min-h-[30px] rounded text-[10px] font-medium font-mono transition cursor-pointer flex items-center ${
                    severityFilter === sev
                      ? 'bg-slate-800 text-slate-100 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Second row: Tenant ID input (if Tenant-Scoped) + Action Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-800/60">
          {scopeFilter === 'TENANT' && (
            <div className="w-full sm:w-64">
              <input
                type="text"
                value={tenantScopeInput}
                onChange={(e) => setParam('tenantId', e.target.value)}
                placeholder="Enter Tenant ID or tenant:..."
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-amber-500 focus:outline-none min-h-[38px]"
              />
            </div>
          )}

          <div className="flex-1 w-full">
            <SearchInput
              value={searchAction}
              onChange={(val) => setParam('action', val)}
              placeholder="Filter by action name (e.g. platform.user.create, platform.support)..."
            />
          </div>

          <button
            type="button"
            onClick={() => fetchAuditLogs(cursorHistory[pageIndex] || null)}
            title="Refresh logs"
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── A. DESKTOP VIEW (Table: lg and up) ─── */}
      <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-3 w-16">Seq #</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action & Chain Link</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-3">Scope</th>
                <th className="py-3 px-3">Previous Hash</th>
                <th className="py-3 px-3">SHA-256 Hash</th>
                <th className="py-3 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    Fetching cryptographic audit ledger...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No audit records located in the selected partition scope.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedRowId === log._id;
                  const isGenesis =
                    log.previousHash ===
                    '0000000000000000000000000000000000000000000000000000000000000000';

                  return (
                    <React.Fragment key={log._id}>
                      <tr
                        onClick={() => toggleRowExpansion(log._id)}
                        className={`hover:bg-slate-800/40 cursor-pointer transition select-none ${
                          isExpanded ? 'bg-slate-800/50' : ''
                        }`}
                      >
                        {/* Sequence */}
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">
                          #{String(log.sequence).padStart(5, '0')}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>

                        {/* Actor */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200 truncate max-w-[150px]">
                            {log.actorEmail}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {log.actorRole}
                          </div>
                        </td>

                        {/* Action with Visual Merkle Chain Link Indicator */}
                        <td className="py-3 px-4 font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700/80 text-[11px]">
                              {log.action}
                            </span>
                            {isGenesis ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60"
                                title="Genesis Block (Root of hash chain)"
                              >
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                <span>GENESIS</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                                title="Verified Cryptographic Hash Chain Link"
                              >
                                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                                <span>VERIFIED LINK</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Target */}
                        <td className="py-3 px-4 text-slate-300">
                          <div className="text-[11px] font-medium text-slate-200">
                            {log.targetType}
                          </div>
                          <div
                            className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]"
                            title={log.targetId}
                          >
                            {log.targetId}
                          </div>
                        </td>

                        {/* Scope */}
                        <td className="py-3 px-3">
                          <span className="px-1.5 py-0.5 rounded bg-slate-950 font-mono text-[10px] text-slate-400 border border-slate-800">
                            {log.scope}
                          </span>
                        </td>

                        {/* Previous Hash */}
                        <td className="py-3 px-3">
                          <HashSnippet hash={log.previousHash} isGenesis={isGenesis} />
                        </td>

                        {/* SHA-256 Hash */}
                        <td className="py-3 px-3">
                          <HashSnippet hash={log.hash} />
                        </td>

                        {/* Expand Toggle */}
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(log._id);
                            }}
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition min-w-[32px] min-h-[32px] inline-flex items-center justify-center cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Row Details */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800">
                          <td colSpan={9} className="p-4 space-y-4">
                            {/* Cryptographic Hash Verification Banner */}
                            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                                  Full Cryptographic Signatures (SHA-256)
                                </span>
                                <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-mono text-[10px]">
                                  [REDACTED] Mathematical Redaction Verified
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                    Current Record Hash
                                  </div>
                                  <div className="text-slate-200 break-all select-all text-[11px]">
                                    {log.hash}
                                  </div>
                                </div>
                                <div className="p-2 bg-slate-950 rounded border border-slate-800/80">
                                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                    Previous Chained Hash
                                  </div>
                                  <div className="text-slate-200 break-all select-all text-[11px]">
                                    {log.previousHash}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Operator Audit Reason & Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg md:col-span-2">
                                <div className="text-slate-400 font-medium text-[11px] mb-1">
                                  Operator Stated Reason
                                </div>
                                <div className="text-slate-200 italic">
                                  &quot;{log.reason || 'No justification recorded'}&quot;
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                                <div className="text-slate-400 font-medium text-[11px]">
                                  Network Origin
                                </div>
                                <div className="font-mono text-slate-300 text-[11px]">
                                  IP: {log.ipAddress || 'Internal Loopback'}
                                </div>
                                <div className="font-mono text-slate-400 text-[10px] truncate">
                                  UA: {log.userAgent || 'Platform Engine'}
                                </div>
                              </div>
                            </div>

                            {/* Formatted JSON Diff State Inspector */}
                            <div>
                              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                                <span>Entity Mutation Diff State Inspector</span>
                              </div>
                              <div className="flex flex-col md:flex-row gap-3">
                                <FormattedJsonViewer
                                  data={log.before || (log as any).beforeState}
                                  title="Previous State (before)"
                                  emptyLabel="No preceding state (initial creation)"
                                />
                                <FormattedJsonViewer
                                  data={log.after || (log as any).afterState}
                                  title="Updated State (after)"
                                  emptyLabel="No successor state (deletion or terminal state)"
                                />
                                {(log as any).metadata && Object.keys((log as any).metadata).length > 0 && (
                                  <FormattedJsonViewer
                                    data={(log as any).metadata}
                                    title="Audit Context Metadata"
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── B. MOBILE VIEW (Collapsible Cards: < lg) ─── */}
      <div className="lg:hidden p-1 space-y-3">
        {isLoadingLogs && (
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

        {!isLoadingLogs && logs.length === 0 && (
          <div className="p-8 text-center text-xs space-y-3 bg-slate-900 border border-slate-800 rounded-xl">
            <Fingerprint className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-300">No audit records found</p>
            <p className="text-slate-500">
              No cryptographic logs match active partition filters.
            </p>
          </div>
        )}

        {!isLoadingLogs &&
          logs.map((log) => {
            const isGenesis =
              log.previousHash ===
              '0000000000000000000000000000000000000000000000000000000000000000';

            // Summary: 74-82px bounded height, single-line text truncation
            const cardSummary = (
              <div className="flex items-center gap-3 min-w-0 pr-1">
                <div
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-xs shrink-0 select-none shadow-2xs ${
                    isGenesis
                      ? 'bg-amber-950/80 border-amber-700/80 text-amber-300'
                      : 'bg-emerald-950/80 border-emerald-700/80 text-emerald-300'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400 text-xs shrink-0">
                      #{String(log.sequence).padStart(5, '0')}
                    </span>
                    <span className="font-semibold text-slate-100 truncate text-xs block font-mono">
                      {log.action}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                    <span className="truncate">
                      {log.actorEmail.split('@')[0]} • {log.targetType}
                    </span>
                    <span className="shrink-0 text-slate-500">
                      {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            );

            return (
              <CollapsibleMobileCard
                key={log._id}
                id={log._id}
                entityType="audit log"
                statusVariant={isGenesis ? 'warning' : 'default'}
                summary={cardSummary}
              >
                <div className="space-y-3 pt-2 text-xs">
                  {/* Visual Merkle Chain Link Indicator Banner */}
                  <div
                    className={`p-2.5 rounded-lg border flex items-center gap-2 font-mono text-[11px] ${
                      isGenesis
                        ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                        : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    }`}
                  >
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      {isGenesis
                        ? 'Genesis Block • Root Origin of Ledger Partition'
                        : 'Cryptographically Verified Hash Chain Link (SHA-256)'}
                    </span>
                  </div>

                  {/* Meta details grid */}
                  <div className="grid grid-cols-1 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Timestamp:</span>
                      <span className="text-slate-300">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Actor:</span>
                      <span className="text-slate-200 select-all">{log.actorEmail} ({log.actorRole})</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Target ID:</span>
                      <span className="text-blue-400 truncate max-w-[180px] select-all">{log.targetId}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Scope:</span>
                      <span className="text-slate-300">{log.scope}</span>
                    </div>
                    {log.reason && (
                      <div className="pt-1 border-t border-slate-800 text-slate-300 font-sans italic">
                        &quot;{log.reason}&quot;
                      </div>
                    )}
                  </div>

                  {/* Hash Signatures */}
                  <div className="space-y-1.5 font-mono text-[10px]">
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-slate-500 block uppercase mb-0.5">SHA-256 Hash</span>
                      <span className="text-slate-200 break-all select-all">{log.hash}</span>
                    </div>
                    <div className="p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-slate-500 block uppercase mb-0.5">Previous Chained Hash</span>
                      <span className="text-slate-200 break-all select-all">{log.previousHash}</span>
                    </div>
                  </div>

                  {/* Formatted JSON Diff State Inspector */}
                  <div className="space-y-2 pt-1">
                    <span className="text-slate-400 font-semibold font-mono text-[10px] uppercase block">
                      Entity State Inspector
                    </span>
                    <FormattedJsonViewer
                      data={log.before || (log as any).beforeState}
                      title="Before State"
                      emptyLabel="No preceding state"
                    />
                    <FormattedJsonViewer
                      data={log.after || (log as any).afterState}
                      title="After State"
                      emptyLabel="No updated state"
                    />
                  </div>

                  {/* Mobile Copy Action Row (min-h-[44px] targets) */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleCopy(log.hash, `hash-${log._id}`)}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
                    >
                      {copiedId === `hash-${log._id}` ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-mono">Copied Hash!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy Hash</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopy(log.targetId, `target-${log._id}`)}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
                    >
                      {copiedId === `target-${log._id}` ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-mono">Copied Target!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy Target</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </CollapsibleMobileCard>
            );
          })}
      </div>

      {/* Keyset Pagination Controls */}
      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
        <span className="font-mono">
          Page {pageIndex + 1} • {logs.length} entries shown
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousPage}
            disabled={pageIndex <= 0 || isLoadingLogs}
            className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={handleNextPage}
            disabled={!hasNextPage || !nextCursor || isLoadingLogs}
            className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
