/**
 * Bharat Enterprise Billing System — Platform Identity & Team Management
 * High-density operator directory, RBAC privilege ceilings, MFA enforcement, credential suspension,
 * and high-density dual desktop table / mobile collapsible card views with 2x2 action matrix.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Power,
  Key,
  X,
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
import CollapsibleMobileCard from '../components/common/CollapsibleMobileCard';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { useListFilterParams } from '../hooks/useListFilterParams';

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
    badge: 'bg-blue-950/80 text-blue-300 border-blue-700/80',
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

  // URL-backed filter synchronization
  const { params, setParam, resetParams } = useListFilterParams({
    search: '',
    role: 'ALL',
    status: 'ALL',
    page: 1,
  });

  const search = params.search || '';
  const roleFilter = (params.role || 'ALL') as 'ALL' | PlatformRole;
  const statusFilter = (params.status || 'ALL') as 'ALL' | 'ACTIVE' | 'DISABLED';
  const page = Number(params.page) || 1;

  // Directory list & pagination
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [reset2faTarget, setReset2faTarget] = useState<PlatformUser | null>(null);
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
      const queryParams: Record<string, unknown> = {
        page,
        limit: 15,
      };

      if (search.trim()) {
        queryParams.search = search.trim();
      }
      if (roleFilter !== 'ALL') {
        queryParams.role = roleFilter;
      }
      if (statusFilter === 'ACTIVE') {
        queryParams.isActive = true;
      } else if (statusFilter === 'DISABLED') {
        queryParams.isActive = false;
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
      }>('/users', { params: queryParams });

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

  // Handle Form Role Change
  const handleRoleChange = (newRole: PlatformRole) => {
    setFormRole(newRole);
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

  // Handle Reset 2FA
  const handleConfirmReset2fa = async (reasonText: string) => {
    if (!reset2faTarget) return;

    try {
      await api.put(`/users/${reset2faTarget._id}`, {
        mfaEnabled: false,
        reason: reasonText || 'Administrator reset operator 2FA enrollment credentials',
      });

      setFeedback({
        type: 'success',
        text: `2FA security credentials for ${reset2faTarget.email} successfully reset. Operator must re-enroll TOTP on next sign in.`,
      });
      fetchUsers();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text:
          err.response?.data?.message ||
          err.response?.data?.error ||
          'Failed to reset operator 2FA security credentials.',
      });
    } finally {
      setReset2faTarget(null);
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
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-sky-400 focus:outline-none cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Platform Operator</span>
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
            className="text-slate-400 hover:text-slate-200 text-xs px-2 cursor-pointer"
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
          <div className="font-mono text-2xl font-bold text-slate-100">
            <AnimatedCounter target={totalCount} />
          </div>
          <div className="text-[11px] text-slate-400">
            <span className="text-emerald-400 font-mono font-medium">
              <AnimatedCounter target={activeCount} />
            </span>{' '}
            currently active
          </div>
        </div>

        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
          <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider flex items-center justify-between">
            <span>MFA Compliance</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-slate-100">
            <AnimatedCounter target={mfaEnrolledCount} /> / {users.length || 0}
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
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
              {(['ALL', ...Object.values(PlatformRole)] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setParam('role', r);
                    setParam('page', 1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer min-h-[30px] flex items-center ${
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
                  type="button"
                  onClick={() => {
                    setParam('status', s);
                    setParam('page', 1);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer min-h-[30px] flex items-center ${
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
                setParam('search', v);
                setParam('page', 1);
              }}
              placeholder="Search operator by full name or email address..."
            />
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            title="Refresh directory"
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── A. DESKTOP VIEW (Table: md and up) ─── */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">MFA Enrollment</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400 mb-2" />
                    Fetching platform operator directory...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No platform operators found matching active query filters.
                  </td>
                </tr>
              ) : (
                users.map((operator) => {
                  const roleStyle = ROLE_BADGE_STYLES[operator.role] || {
                    label: operator.role,
                    badge: 'bg-slate-800 text-slate-300 border-slate-700',
                  };
                  const isSelf = currentOperator?._id === operator._id;
                  const canActOn =
                    canManageUsers &&
                    !isSelf &&
                    currentRole &&
                    canManageRole(currentRole, operator.role);

                  return (
                    <tr
                      key={operator._id}
                      className="hover:bg-slate-800/40 transition select-none group"
                    >
                      {/* Operator Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0">
                            {operator.fullName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{operator.fullName}</span>
                              {isSelf && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                              <span>{operator.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(operator.email)}
                                title="Copy email address"
                                className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
                              >
                                {copiedEmail === operator.email ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border ${roleStyle.badge}`}
                        >
                          {roleStyle.label}
                        </span>
                        {operator.customPermissions && operator.customPermissions.length > 0 && (
                          <div className="text-[10px] font-mono text-blue-400 mt-0.5">
                            +{operator.customPermissions.length} granular perms
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge
                          variant={operator.isActive ? 'emerald' : 'rose'}
                          label={operator.isActive ? 'Active' : 'Suspended'}
                          dot
                        />
                      </td>

                      {/* MFA Status Badge */}
                      <td className="py-3 px-4">
                        {operator.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>TOTP Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Not Enrolled</span>
                          </span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDateTime(operator.createdAt)}
                      </td>

                      {/* Last Activity */}
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {formatDateTime(operator.lastLoginAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect / Details */}
                          <button
                            type="button"
                            onClick={() => setInspectedUser(operator)}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
                            title="Inspect Operator Profile"
                            aria-label={`Inspect ${operator.fullName}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Reset 2FA */}
                          <button
                            type="button"
                            onClick={() => setReset2faTarget(operator)}
                            disabled={!canActOn || !operator.mfaEnabled}
                            className="p-1.5 rounded-lg border border-slate-800 hover:border-amber-700/80 bg-slate-950/60 hover:bg-amber-950/40 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              !operator.mfaEnabled
                                ? 'MFA not currently enrolled'
                                : canActOn
                                ? 'Reset 2FA TOTP Enrollment'
                                : 'Privilege ceiling restriction'
                            }
                            aria-label={`Reset 2FA for ${operator.fullName}`}
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active / Suspend */}
                          <button
                            type="button"
                            onClick={() => setStatusConfirmTarget(operator)}
                            disabled={!canActOn}
                            className={`p-1.5 rounded-lg border bg-slate-950/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                              operator.isActive
                                ? 'border-slate-800 hover:border-rose-700/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400'
                                : 'border-slate-800 hover:border-emerald-700/80 hover:bg-emerald-950/40 text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={
                              isSelf
                                ? 'Cannot modify self status'
                                : !canActOn
                                ? 'Privilege ceiling restriction'
                                : operator.isActive
                                ? 'Suspend Operator Credentials'
                                : 'Restore Operator Credentials'
                            }
                            aria-label={`${operator.isActive ? 'Suspend' : 'Reactivate'} ${operator.fullName}`}
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
      </div>

      {/* ─── B. MOBILE VIEW (Collapsible Cards: < md) ─── */}
      <div className="md:hidden p-1 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 animate-pulse space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-800 rounded w-36" />
                    <div className="h-2.5 bg-slate-800/60 rounded w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && users.length === 0 && (
          <div className="p-8 text-center text-xs space-y-3 bg-slate-900 border border-slate-800 rounded-xl">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-semibold text-slate-300">No operators found</p>
            <p className="text-slate-500">
              No platform operators match active search or role filters.
            </p>
            <button
              type="button"
              onClick={() => resetParams()}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-sky-600 text-white font-medium cursor-pointer inline-flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {!isLoading &&
          users.map((operator) => {
            const roleStyle = ROLE_BADGE_STYLES[operator.role] || {
              label: operator.role,
              badge: 'bg-slate-800 text-slate-300 border-slate-700',
            };
            const isSelf = currentOperator?._id === operator._id;
            const canActOn =
              canManageUsers &&
              !isSelf &&
              currentRole &&
              canManageRole(currentRole, operator.role);

            // Summary: 74-82px bounded height, single-line text truncation
            const cardSummary = (
              <div className="flex items-center gap-3 min-w-0 pr-1">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0 select-none shadow-2xs">
                  {operator.fullName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 truncate text-xs block">
                      {operator.fullName}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium border truncate shrink-0 ${roleStyle.badge}`}
                    >
                      {roleStyle.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5 text-[11px] font-mono text-slate-400">
                    <span className="truncate">{operator.email}</span>
                    <span className="shrink-0 flex items-center gap-1">
                      {operator.mfaEnabled ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      <StatusBadge
                        variant={operator.isActive ? 'emerald' : 'rose'}
                        label={operator.isActive ? 'Active' : 'Off'}
                        size="sm"
                      />
                    </span>
                  </div>
                </div>
              </div>
            );

            return (
              <CollapsibleMobileCard
                key={operator._id}
                id={operator._id}
                entityType="operator"
                statusVariant={operator.isActive ? 'default' : 'danger'}
                summary={cardSummary}
              >
                <div className="space-y-3 pt-2 text-xs">
                  {/* Meta info grid */}
                  <div className="grid grid-cols-1 gap-2 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Email:</span>
                      <span className="text-slate-200 select-all">{operator.email}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">2FA Security:</span>
                      <span className={operator.mfaEnabled ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                        {operator.mfaEnabled ? 'Enrolled & Active' : 'Not Enrolled'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Created:</span>
                      <span className="text-slate-400">{formatDateTime(operator.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Last Login:</span>
                      <span className="text-slate-400">{formatDateTime(operator.lastLoginAt)}</span>
                    </div>
                    {operator.customPermissions && operator.customPermissions.length > 0 && (
                      <div className="pt-1 border-t border-slate-800 text-blue-400">
                        {operator.customPermissions.length} Granular Permissions Assigned
                      </div>
                    )}
                  </div>

                  {/* Structured 2x2 Action Grid with min-h-[44px] touch targets */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                    {/* Action 1: Details */}
                    <button
                      type="button"
                      onClick={() => setInspectedUser(operator)}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                      aria-label={`Inspect ${operator.fullName}`}
                    >
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span>Details</span>
                    </button>

                    {/* Action 2: Reset 2FA */}
                    <button
                      type="button"
                      onClick={() => setReset2faTarget(operator)}
                      disabled={!canActOn || !operator.mfaEnabled}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-900/60 text-amber-300 border border-amber-800/60 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors"
                      aria-label={`Reset 2FA for ${operator.fullName}`}
                    >
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>Reset 2FA</span>
                    </button>

                    {/* Action 3: Copy Email */}
                    <button
                      type="button"
                      onClick={() => handleCopy(operator.email)}
                      className="min-h-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                      aria-label="Copy operator email"
                    >
                      {copiedEmail === operator.email ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-mono">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-400" />
                          <span>Copy Email</span>
                        </>
                      )}
                    </button>

                    {/* Action 4: Toggle Status */}
                    <button
                      type="button"
                      onClick={() => setStatusConfirmTarget(operator)}
                      disabled={!canActOn}
                      className={`min-h-[44px] px-3 py-2 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium cursor-pointer disabled:opacity-40 transition-colors ${
                        operator.isActive
                          ? 'bg-rose-950/40 hover:bg-rose-900/50 active:bg-rose-900/60 text-rose-300 border-rose-800/60'
                          : 'bg-emerald-950/40 hover:bg-emerald-900/50 active:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                      }`}
                      aria-label={`${operator.isActive ? 'Suspend' : 'Reactivate'} ${operator.fullName}`}
                    >
                      <Power className="w-4 h-4" />
                      <span>{operator.isActive ? 'Suspend' : 'Reactivate'}</span>
                    </button>
                  </div>
                </div>
              </CollapsibleMobileCard>
            );
          })}
      </div>

      {/* Keyset / Page Navigation Bar */}
      <div className="flex items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
        <span className="font-mono">
          Page {page} of {totalPages || 1} • {totalCount} total operators
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setParam('page', Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={() => setParam('page', page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 min-h-[38px] sm:min-h-0 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Onboard Platform Operator
          ───────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Provision Platform Operator Account"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          {createError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300">
              <span className="font-semibold">Creation Error: </span>
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">
                Full Legal Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="e.g. Vikram Sharma"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">
                Corporate Email Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="vikram@bharatenterprise.com"
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">
                Temporary Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Min 12 chars, upper/lower/num/sym"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg pl-3 pr-10 py-2 text-slate-100 placeholder-slate-600 focus:outline-none min-h-[44px] font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">
                Base RBAC Role <span className="text-rose-400">*</span>
              </label>
              <select
                value={formRole}
                onChange={(e) => handleRoleChange(e.target.value as PlatformRole)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-100 focus:outline-none min-h-[44px]"
              >
                {Object.values(PlatformRole).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_BADGE_STYLES[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Granular Permissions Matrix */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-slate-300 font-medium block">
              Granular Custom Permissions (Additions beyond base role)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.name} className="space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
                    {group.name}
                  </span>
                  {group.permissions.map((perm) => {
                    const isBase = ROLE_PERMISSIONS[formRole]?.includes(perm);
                    const isCustom = formCustomPermissions.includes(perm);

                    return (
                      <label
                        key={perm}
                        className={`flex items-center gap-2 p-1 rounded transition text-[11px] ${
                          isBase
                            ? 'text-slate-500 cursor-not-allowed opacity-60'
                            : 'text-slate-300 hover:text-slate-100 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isBase || isCustom}
                          disabled={isBase}
                          onChange={() => togglePermission(perm)}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
                        />
                        <span className="font-mono truncate">{perm}</span>
                        {isBase && <span className="text-[9px] text-slate-500">(inherent)</span>}
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Mandatory Audit Reason */}
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-300 font-medium block">
                Mandatory Operational Audit Reason <span className="text-rose-400">*</span>
              </label>
              <span
                className={`text-[10px] font-mono ${
                  formReason.trim().length >= 10 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {formReason.trim().length}/10 chars min
              </span>
            </div>
            <textarea
              rows={2}
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="Business rationale for provisioning operator credentials..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate || formReason.trim().length < 10}
              className="px-5 py-2 min-h-[44px] rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-semibold cursor-pointer inline-flex items-center gap-2"
            >
              {isSubmittingCreate ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Provisioning Operator...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Onboard Operator</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: Inspect Operator Profile
          ───────────────────────────────────────────────────────────── */}
      {inspectedUser && (
        <Modal
          isOpen={!!inspectedUser}
          onClose={() => setInspectedUser(null)}
          title={`Operator Profile: ${inspectedUser.fullName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-slate-100">
                  {inspectedUser.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-slate-100 text-sm">
                    {inspectedUser.fullName}
                  </div>
                  <div className="font-mono text-slate-400 text-[11px]">
                    {inspectedUser.email}
                  </div>
                </div>
              </div>
              <StatusBadge
                variant={inspectedUser.isActive ? 'emerald' : 'rose'}
                label={inspectedUser.isActive ? 'Active' : 'Suspended'}
                dot
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 font-mono text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Role</span>
                <span className="text-slate-200 font-semibold">{inspectedUser.role}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">2FA TOTP</span>
                <span className={inspectedUser.mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}>
                  {inspectedUser.mfaEnabled ? 'Enrolled & Enforced' : 'Pending Enrollment'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Provisioned</span>
                <span className="text-slate-300">{formatDateTime(inspectedUser.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Last Activity</span>
                <span className="text-slate-300">{formatDateTime(inspectedUser.lastLoginAt)}</span>
              </div>
            </div>

            {inspectedUser.customPermissions && inspectedUser.customPermissions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-slate-400 font-mono text-[10px] uppercase block">
                  Granular Custom Permissions ({inspectedUser.customPermissions.length})
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px]">
                  {inspectedUser.customPermissions.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/70">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="px-4 py-2 min-h-[44px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CONFIRM DIALOG: Toggle Status
          ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!statusConfirmTarget}
        onClose={() => setStatusConfirmTarget(null)}
        onConfirm={handleConfirmToggleStatus}
        title={`${statusConfirmTarget?.isActive ? 'Suspend' : 'Reactivate'} Operator Account`}
        description={
          statusConfirmTarget?.isActive
            ? `This will immediately invalidate all active sessions and tokens for ${statusConfirmTarget?.email}. The operator will be blocked from accessing the platform control plane.`
            : `This will restore active login privileges and access rights for ${statusConfirmTarget?.email}. Ensure the security review has concluded.`
        }
        confirmLabel={statusConfirmTarget?.isActive ? 'Suspend Credentials' : 'Reactivate Account'}
        severity={statusConfirmTarget?.isActive ? 'danger' : 'warning'}
        minReasonLength={10}
      />

      {/* ─────────────────────────────────────────────────────────────
          CONFIRM DIALOG: Reset 2FA
          ───────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!reset2faTarget}
        onClose={() => setReset2faTarget(null)}
        onConfirm={handleConfirmReset2fa}
        title={`Reset 2FA Enrollment: ${reset2faTarget?.fullName}`}
        description={`This will clear the active TOTP secret for ${reset2faTarget?.email}. On their next sign-in, the operator will be forced through the initial 2FA enrollment wizard to scan a new QR code.`}
        confirmLabel="Reset 2FA Credentials"
        severity="warning"
        minReasonLength={10}
      />
    </div>
  );
};

export default UsersPage;
