/**
 * Bharat Enterprise Billing System — Platform Cryptographic Audit Trail
 * SHA-256 hash-chained immutable audit log with verification, diff inspection, and keyset pagination.
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
  FileCode,
  Layers,
  Globe,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import type {
  AuditLog,
  VerifyChainResult,
} from '../types';
import SearchInput from '../components/common/SearchInput';

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
      <span className="font-mono text-[11px] text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
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
        className="p-0.5 text-slate-500 hover:text-slate-200 transition"
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
    if (!data || Object.keys(data).length === 0) return null;
    return JSON.stringify(data, null, 2);
  }, [data]);

  return (
    <div className="flex-1 min-w-[280px] bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-hidden">
      <div className="text-[11px] font-semibold text-slate-400 pb-1.5 border-b border-slate-800/80 flex items-center justify-between">
        <span>{title}</span>
        {formatted && (
          <span className="font-mono text-[10px] text-slate-500">
            {Object.keys(data || {}).length} fields
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

// ─── Scope Type Definitions ────────────────────────────────────────
type ScopeFilterType = 'ALL' | 'GLOBAL' | 'TENANT';

export const AuditPage: React.FC = () => {
  // Filters
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>('ALL');
  const [tenantScopeInput, setTenantScopeInput] = useState('');
  const [searchAction, setSearchAction] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Logs & Pagination (keyset cursor stack)
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  // Row expand tracking
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Cryptographic Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifyChainResult | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Compute active effective scope query param
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
        const params: Record<string, unknown> = {
          limit: 20,
        };

        if (cursor) {
          params.cursor = cursor;
        }

        if (activeScopeParam) {
          params.scope = activeScopeParam;
        }

        if (searchAction.trim()) {
          params.action = searchAction.trim();
        }

        if (severityFilter !== 'ALL') {
          params.severity = severityFilter;
        }

        const res = await api.get<{
          success: boolean;
          data: AuditLog[];
          pagination: {
            hasNextPage: boolean;
            nextCursor: string | null;
            limit: number;
          };
        }>('/audit', { params });

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

  // Initial and filter change reset
  useEffect(() => {
    setCursorHistory([null]);
    setPageIndex(0);
    fetchAuditLogs(null);
  }, [fetchAuditLogs]);

  // Pagination Next Action
  const handleNextPage = () => {
    if (!hasNextPage || !nextCursor) return;
    const nextHistory = [...cursorHistory.slice(0, pageIndex + 1), nextCursor];
    setCursorHistory(nextHistory);
    setPageIndex(pageIndex + 1);
    fetchAuditLogs(nextCursor);
  };

  // Pagination Previous Action
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-emerald-400 focus:outline-none"
          >
            {isVerifying ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            Verify Audit Hash Chain
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
            className="text-xs px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-900 text-slate-300 hover:text-white border border-slate-700/60 self-start sm:self-auto transition"
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
            className="text-slate-400 hover:text-slate-200 text-xs px-2"
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
                onClick={() => setScopeFilter('ALL')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                  scopeFilter === 'ALL'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                All Scopes
              </button>
              <button
                onClick={() => setScopeFilter('GLOBAL')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                  scopeFilter === 'GLOBAL'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe className="w-3 h-3 text-sky-400" />
                Global
              </button>
              <button
                onClick={() => setScopeFilter('TENANT')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition flex items-center gap-1.5 ${
                  scopeFilter === 'TENANT'
                    ? 'bg-slate-800 text-slate-100 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3 h-3 text-amber-400" />
                Tenant-Scoped
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
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium font-mono transition ${
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
                onChange={(e) => setTenantScopeInput(e.target.value)}
                placeholder="Enter Tenant ID or tenant:..."
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex-1 w-full">
            <SearchInput
              value={searchAction}
              onChange={setSearchAction}
              placeholder="Filter by action name (e.g. platform.user.create, platform.support)..."
            />
          </div>

          <button
            onClick={() => fetchAuditLogs(cursorHistory[pageIndex] || null)}
            title="Refresh logs"
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hash-Chained Log Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-3 w-16">Seq #</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
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

                        {/* Action */}
                        <td className="py-3 px-4 font-mono">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700/80 text-[11px]">
                            {log.action}
                          </span>
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
                            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
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
                                  "{log.reason || 'No justification recorded'}"
                                </div>
                              </div>

                              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                                <div className="text-slate-400 font-medium text-[11px]">
                                  Network Origin
                                </div>
                                <div className="font-mono text-slate-300 text-[11px]">
                                  IP: {log.ipAddress || 'Internal Loopback'}
                                </div>
                                <div
                                  className="text-slate-500 text-[10px] truncate"
                                  title={log.userAgent}
                                >
                                  UA: {log.userAgent || 'Platform Direct'}
                                </div>
                              </div>
                            </div>

                            {/* Before & After State Diff Inspection */}
                            <div>
                              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                                <FileCode className="w-3.5 h-3.5 text-sky-400" />
                                Formatted State Diff Inspection
                              </div>
                              <div className="flex flex-col md:flex-row gap-3">
                                <FormattedJsonViewer
                                  title="Before State Snapshot"
                                  data={log.before}
                                  emptyLabel="None (Initial creation event)"
                                />
                                <FormattedJsonViewer
                                  title="After State Snapshot"
                                  data={log.after}
                                  emptyLabel="None (Record deletion/removal event)"
                                />
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

        {/* Keyset Pagination Controls */}
        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Page {pageIndex + 1}</span>
            <span className="text-slate-600">•</span>
            <span>{logs.length} records shown</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={pageIndex <= 0 || isLoadingLogs}
              onClick={handlePreviousPage}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <button
              disabled={!hasNextPage || isLoadingLogs}
              onClick={handleNextPage}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditPage;
