/**
 * Bharat Enterprise Billing System — Platform Identity & Team Management
 * High-density operator directory, RBAC privilege ceilings, MFA enforcement, and credential suspension.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { usePlatformAuth } from '../contexts/PlatformAuthContext';
import {
  PlatformRole,
  PlatformPermission,
  ROLE_PERMISSIONS,
  canManageRole,
  type PlatformUser,
} from '../types';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import SearchInput from '../components/common/SearchInput';
import StatusBadge from '../components/common/StatusBadge';

// ─── Format Timestamp to IST ──────────────────────────────────────
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Never';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

// ─── Role Display Helpers ──────────────────────────────────────────
const ROLE_BADGE_STYLES: Record<PlatformRole, { label: string; badge: string }> = {
  [PlatformRole.PLATFORM_OWNER]: {
    label: 'Platform Owner',
    badge: 'bg-purple-950/80 text-purple-300 border-purple-700/80',
  },
  [PlatformRole.PLATFORM_ADMIN]: {
    label: 'Platform Admin',
    badge: 'bg-sky-950/80 text-sky-300 border-sky-700/80',
  },
  [PlatformRole.SUPPORT_ADMIN]: {
    label: 'Support Admin',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80',
  },
  [PlatformRole.SUPPORT_AGENT]: {
    label: 'Support Agent',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-700/80',
  },
  [PlatformRole.TELESUPPORT]: {
    label: 'Telesupport',
    badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80',
  },
  [PlatformRole.READ_ONLY]: {
    label: 'Read Only',
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
  },
};

// ─── Granular Permissions Categorization ───────────────────────────
const PERMISSION_GROUPS: { name: string; permissions: PlatformPermission[] }[] = [
  {
    name: 'Tenants & Firm Management',
    permissions: [
      PlatformPermission.TENANTS_VIEW,
      PlatformPermission.TENANTS_MANAGE,
      PlatformPermission.TENANTS_SUSPEND,
      PlatformPermission.TENANTS_REACTIVATE,
      PlatformPermission.TENANT_DATA_VIEW,
    ],
  },
  {
    name: 'Subscriptions & Commercials',
    permissions: [
      PlatformPermission.SUBSCRIPTIONS_VIEW,
      PlatformPermission.SUBSCRIPTIONS_MANAGE,
    ],
  },
  {
    name: 'Feature Overrides',
    permissions: [
      PlatformPermission.FEATURE_OVERRIDES_VIEW,
      PlatformPermission.FEATURE_OVERRIDES_MANAGE,
    ],
  },
  {
    name: 'Diagnostic Support Sessions',
    permissions: [
      PlatformPermission.SUPPORT_START,
      PlatformPermission.SUPPORT_OPERATE,
      PlatformPermission.SUPPORT_END,
    ],
  },
  {
    name: 'Platform Security & Operators',
    permissions: [
      PlatformPermission.DASHBOARD_VIEW,
      PlatformPermission.AUDIT_VIEW,
      PlatformPermission.USERS_VIEW,
      PlatformPermission.USERS_MANAGE,
      PlatformPermission.EMERGENCY_BYPASS_MANAGE,
    ],
  },
];

export const UsersPage: React.FC = () => {
  const { user: currentOperator, role: currentRole, hasPermission } = usePlatformAuth();

  // State: Directory list & pagination
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | PlatformRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusConfirmTarget, setStatusConfirmTarget] = useState<PlatformUser | null>(null);
  const [inspectedUser, setInspectedUser] = useState<PlatformUser | null>(null);

  // Form: Create Operator
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formRole, setFormRole] = useState<PlatformRole>(PlatformRole.SUPPORT_AGENT);
  const [formCustomPermissions, setFormCustomPermissions] = useState<PlatformPermission[]>([]);
  const [formReason, setFormReason] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copy email tracking
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const canManageUsers = hasPermission(PlatformPermission.USERS_MANAGE);

  // Copy to clipboard helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Fetch users directory
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        limit: 15,
      };

      if (search.trim()) {
        params.search = search.trim();
      }
      if (roleFilter !== 'ALL') {
        params.role = roleFilter;
      }
      if (statusFilter === 'ACTIVE') {
        params.isActive = true;
      } else if (statusFilter === 'DISABLED') {
        params.isActive = false;
      }

      const res = await api.get<{
        success: boolean;
        data: PlatformUser[];
        pagination: {
          page: number;
          limit: number;
          totalCount: number;
          totalPages: number;
        };
      }>('/users', { params });

      if (res.data?.success) {
        setUsers(res.data.data || []);
        setTotalCount(res.data.pagination?.totalCount || 0);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Failed to retrieve platform users', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Form Role Change (clears custom permissions that are redundant or invalid)
  const handleRoleChange = (newRole: PlatformRole) => {
    setFormRole(newRole);
    // Remove custom permissions that are already part of base role
    const basePerms = new Set(ROLE_PERMISSIONS[newRole] || []);
    setFormCustomPermissions((prev) => prev.filter((p) => !basePerms.has(p)));
  };

  // Toggle Custom Permission Checkbox
  const togglePermission = (perm: PlatformPermission) => {
    setFormCustomPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  // Handle Create Operator Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!formFullName.trim() || !formEmail.trim() || !formPassword) {
      setCreateError('Full name, email, and initial temporary password are required.');
      return;
    }

    if (formReason.trim().length < 10) {
      setCreateError('Audit reason must be at least 10 characters.');
      return;
    }

    // Privilege ceiling check on client before request
    if (currentRole && !canManageRole(currentRole, formRole)) {
      setCreateError(
        `Privilege ceiling: You cannot assign the role "${formRole}" which has equal or higher privileges than your own.`
      );
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await api.post<{ success: boolean; data: PlatformUser }>('/users', {
        fullName: formFullName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword,
        role: formRole,
        customPermissions: formCustomPermissions,
        reason: formReason.trim(),
      });

      if (res.data?.success) {
        setIsCreateModalOpen(false);
        setFormFullName('');
        setFormEmail('');
        setFormPassword('');
        setFormReason('');
        setFormCustomPermissions([]);
        setFeedback({
          type: 'success',
          text: `Operator "${res.data.data.fullName}" (${res.data.data.email}) onboarded successfully.`,
        });
        fetchUsers();
      }
    } catch (err: any) {
      setCreateError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          'Failed to onboard platform operator.'
      );
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Status Toggle (Suspend / Re-enable)
  const handleConfirmToggleStatus = async (reasonText: string) => {
    if (!statusConfirmTarget) return;

    const newStatus = !statusConfirmTarget.isActive;
    const actionLabel = newStatus ? 'Reactivated' : 'Suspended';

    try {
      await api.put(`/users/${statusConfirmTarget._id}`, {
        isActive: newStatus,
        reason: reasonText || `Operator credentials ${actionLabel.toLowerCase()}`,
      });

      setFeedback({
        type: 'success',
        text: `Operator ${statusConfirmTarget.email} credentials successfully ${actionLabel.toLowerCase()}.`,
      });
      fetchUsers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to update operator account status.',
      });
    } finally {
      setStatusConfirmTarget(null);
    }
  };

  // Compute Active Directory Metrics
  const activeCount = useMemo(() => users.filter((u) => u.isActive).length, [users]);
  const mfaEnrolledCount = useMemo(() => users.filter((u) => u.mfaEnabled).length, [users]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            Platform Team & Operators Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-based privilege boundaries, operator lifecycle, TOTP MFA compliance, and credential suspension.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCreateError(null);
              setIsCreateModalOpen(true);
            }}
            disabled={!canManageUsers}
            title={canManageUsers ? 'Onboard new operator' : 'Requires USERS_MANAGE permission'}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-sky-400 focus:outline-none"
          >
            <UserPlus className="w-4 h-4" />
            Create Platform Operator
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between transition ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-200 text-xs px-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between">
            <span>Total Registered Operators</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-100">{totalCount}</div>
          <div className="text-[11px] text-slate-400">
            <span className="text-emerald-400 font-mono font-medium">{activeCount}</span> currently active
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between">
            <span>MFA Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-100">
            {mfaEnrolledCount} / {users.length || 0}
          </div>
          <div className="text-[11px] text-slate-400">
            {users.length > 0 ? Math.round((mfaEnrolledCount / users.length) * 100) : 0}% enrolled in TOTP
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between">
            <span>Privilege Invariant</span>
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xs font-semibold text-slate-200 pt-1">
            Privilege Ceiling Active
          </div>
          <div className="text-[11px] text-slate-400 leading-tight">
            Strict hierarchy forbids lateral elevation or self-lockout
          </div>
        </div>
      </div>

      {/* Directory Filter Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Role Filter Pills */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
              Role:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['ALL', ...Object.values(PlatformRole)] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRoleFilter(r);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    roleFilter === r
                      ? 'bg-slate-800 text-slate-100 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : ROLE_BADGE_STYLES[r]?.label || r}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
              Status:
            </span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['ALL', 'ACTIVE', 'DISABLED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    statusFilter === s
                      ? 'bg-slate-800 text-slate-100 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60">
          <div className="flex-1">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search operator by full name or email address..."
            />
          </div>
          <button
            onClick={fetchUsers}
            title="Refresh operators"
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Operators Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Platform Role</th>
                <th className="py-3 px-4">MFA Enrollment</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    Loading platform operators...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No platform operators match the filter criteria.
                  </td>
                </tr>
              ) : (
                users.map((operator) => {
                  const isSelf = operator._id === currentOperator?._id;
                  const canManageTarget =
                    currentRole && canManageRole(currentRole, operator.role);
                  const roleStyle = ROLE_BADGE_STYLES[operator.role];

                  return (
                    <tr key={operator._id} className="hover:bg-slate-800/30 transition">
                      {/* Full Name & Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-200">
                            {operator.fullName
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{operator.fullName}</span>
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-950/80 border border-sky-700/80 text-[10px] text-sky-300 font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            {operator.customPermissions &&
                              operator.customPermissions.length > 0 && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  +{operator.customPermissions.length} custom privileges
                                </div>
                              )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{operator.email}</span>
                          <button
                            onClick={() => handleCopy(operator.email)}
                            title="Copy email"
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {copiedEmail === operator.email ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded border text-[11px] font-medium inline-flex items-center gap-1 ${
                            roleStyle?.badge || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {roleStyle?.label || operator.role}
                        </span>
                      </td>

                      {/* MFA Status Badge */}
                      <td className="py-3 px-4">
                        {operator.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Enrolled (TOTP)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-700/60 text-amber-300 text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Pending Setup
                          </span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="py-3 px-4">
                        {operator.isActive ? (
                          <StatusBadge variant="emerald" label="Active" dot pulse />
                        ) : (
                          <StatusBadge variant="rose" label="Disabled" />
                        )}
                      </td>

                      {/* Last Login */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDateTime(operator.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Inspect Details Button */}
                          <button
                            onClick={() => setInspectedUser(operator)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                          >
                            Details
                          </button>

                          {/* Suspend / Reactivate Action */}
                          {operator.isActive ? (
                            <button
                              disabled={isSelf || !canManageTarget || !canManageUsers}
                              onClick={() => setStatusConfirmTarget(operator)}
                              title={
                                isSelf
                                  ? 'Anti-self-lockout: Cannot suspend your own account'
                                  : !canManageTarget
                                  ? 'Privilege ceiling: Cannot suspend equal or higher roles'
                                  : 'Suspend operator credentials'
                              }
                              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              Suspend
                            </button>
                          ) : (
                            <button
                              disabled={isSelf || !canManageTarget || !canManageUsers}
                              onClick={() => setStatusConfirmTarget(operator)}
                              title={
                                !canManageTarget
                                  ? 'Privilege ceiling: Cannot activate equal or higher roles'
                                  : 'Re-activate operator credentials'
                              }
                              className="px-2 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-medium transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" />
                              Re-activate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} ({totalCount} total operators)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Create Platform Operator */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !isSubmittingCreate && setIsCreateModalOpen(false)}
        title="Create Platform Operator"
        description="Provision a new platform operator with RBAC role ceilings, granular permissions, and mandatory MFA."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-700/80 text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>{createError}</div>
            </div>
          )}

          {/* Privilege Ceiling Banner */}
          <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold">Privilege Ceiling Invariant: </span>
              You can only provision roles and custom permissions that are strictly lower than your
              own role authority. Platform Owner privileges are required to provision other
              administrators.
            </div>
          </div>

          {/* Full Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-200 mb-1">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="e.g. Subhashree Sharma"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-200 mb-1">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. subhashree@bharat.in"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Initial Password */}
          <div>
            <label className="block font-medium text-slate-200 mb-1">
              Initial Temporary Password <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Minimum 8 characters with letters, numbers & symbols"
                className="w-full px-3 py-2 pr-10 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 font-mono text-xs focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Operator must rotate password upon first authentication before platform access is granted.
            </p>
          </div>

          {/* Role Selection Dropdown */}
          <div>
            <label className="block font-medium text-slate-200 mb-1">
              Platform Role Assignment <span className="text-rose-400">*</span>
            </label>
            <select
              value={formRole}
              onChange={(e) => handleRoleChange(e.target.value as PlatformRole)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:border-sky-500 focus:outline-none"
            >
              {Object.values(PlatformRole).map((r) => {
                const isAllowed = currentRole && canManageRole(currentRole, r);
                return (
                  <option key={r} value={r} disabled={!isAllowed}>
                    {ROLE_BADGE_STYLES[r]?.label || r} {!isAllowed ? '(Privilege Ceiling: Locked)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Custom Permissions Checkboxes */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-200">
                Grant Additional Granular Permissions
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {formCustomPermissions.length} selected
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
              {PERMISSION_GROUPS.map((group) => {
                const basePermsForRole = new Set(ROLE_PERMISSIONS[formRole] || []);

                return (
                  <div key={group.name} className="space-y-1.5">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      {group.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {group.permissions.map((perm) => {
                        const isInherited = basePermsForRole.has(perm);
                        const operatorPossesses = hasPermission(perm);
                        const isChecked = isInherited || formCustomPermissions.includes(perm);
                        const isDisabled = isInherited || !operatorPossesses;

                        return (
                          <label
                            key={perm}
                            className={`flex items-center gap-2 p-1.5 rounded border text-[11px] transition cursor-pointer select-none ${
                              isChecked
                                ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900'
                            } ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={() => togglePermission(perm)}
                              className="rounded accent-sky-400 cursor-pointer"
                            />
                            <span className="font-mono truncate" title={perm}>
                              {perm.replace('platform.', '')}
                            </span>
                            {isInherited && (
                              <span className="ml-auto text-[9px] text-sky-400 font-sans">
                                (Role)
                              </span>
                            )}
                            {!operatorPossesses && !isInherited && (
                              <span className="ml-auto text-[9px] text-rose-400 font-sans">
                                (Locked)
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Reason */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium text-slate-200">
                Audited Reason for Provisioning <span className="text-rose-400">*</span>
              </label>
              <span
                className={`font-mono text-[10px] ${
                  formReason.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {formReason.trim().length} / 10 chars minimum
              </span>
            </div>
            <textarea
              required
              rows={2}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="e.g. Onboarding new support engineer for Tier 2 enterprise incident escalation."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 text-xs focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isSubmittingCreate}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmittingCreate ||
                formReason.trim().length < 10 ||
                !formFullName.trim() ||
                !formEmail.trim() ||
                formPassword.length < 8
              }
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmittingCreate ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Provisioning...
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Provision Operator
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Inspect Operator Details Modal */}
      {inspectedUser && (
        <Modal
          isOpen={Boolean(inspectedUser)}
          onClose={() => setInspectedUser(null)}
          title={`Operator Details: ${inspectedUser.fullName}`}
          description={`Comprehensive identity, RBAC entitlements, and security audits for ${inspectedUser.email}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 grid grid-cols-2 gap-3 text-slate-300">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Operator ID
                </div>
                <div className="font-mono text-slate-200 truncate">{inspectedUser._id}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Role Authority
                </div>
                <div className="font-semibold text-sky-400">{inspectedUser.role}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Account Created
                </div>
                <div className="font-mono text-slate-200">
                  {formatDateTime(inspectedUser.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Last Login
                </div>
                <div className="font-mono text-slate-200">
                  {formatDateTime(inspectedUser.lastLoginAt)}
                </div>
              </div>
            </div>

            {/* Custom Permissions List */}
            <div>
              <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                Custom Privileges Granted ({inspectedUser.customPermissions?.length || 0})
              </div>
              {inspectedUser.customPermissions && inspectedUser.customPermissions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  {inspectedUser.customPermissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-sky-300"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-500 text-[11px] italic">
                  No additional custom permissions granted. Role default permissions apply.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Suspend / Reactivate Confirmation Dialog */}
      {statusConfirmTarget && (
        <ConfirmDialog
          isOpen={Boolean(statusConfirmTarget)}
          onClose={() => setStatusConfirmTarget(null)}
          onConfirm={handleConfirmToggleStatus}
          title={
            statusConfirmTarget.isActive
              ? `Suspend Credentials for ${statusConfirmTarget.fullName}`
              : `Re-activate Account for ${statusConfirmTarget.fullName}`
          }
          description={
            statusConfirmTarget.isActive
              ? `Are you sure you want to suspend credentials for ${statusConfirmTarget.email}? Active sessions will be terminated and platform token issuance revoked.`
              : `Are you sure you want to re-activate ${statusConfirmTarget.email}? The operator will regain access to platform administration within their role ceiling.`
          }
          confirmLabel={statusConfirmTarget.isActive ? 'Suspend Credentials' : 'Re-activate Account'}
          cancelLabel="Keep Current Status"
          severity={statusConfirmTarget.isActive ? 'danger' : 'warning'}
          minReasonLength={10}
        />
      )}
    </div>
  );
};

export default UsersPage;
