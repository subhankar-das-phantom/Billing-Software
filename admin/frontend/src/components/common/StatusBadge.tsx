/**
 * Bharat Enterprise Billing System — StatusBadge Component
 * High-density purposeful status indicators: Emerald, Amber, Rose, Sky, Slate.
 */

import React from 'react';

export type StatusVariant = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';

interface StatusBadgeProps {
  variant?: StatusVariant;
  status?: string;
  label?: string;
  dot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const VARIANT_STYLES: Record<
  StatusVariant,
  {
    bg: string;
    text: string;
    border: string;
    dotBg: string;
  }
> = {
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dotBg: 'bg-emerald-500',
  },
  amber: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dotBg: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dotBg: 'bg-rose-500',
  },
  sky: {
    bg: 'bg-sky-500/15',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    dotBg: 'bg-sky-500',
  },
  slate: {
    bg: 'bg-slate-500/15',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    dotBg: 'bg-slate-500',
  },
};

// Auto-infer semantic variant from status string if not explicitly given
function inferVariant(status: string): StatusVariant {
  const s = status.toUpperCase();
  if (['ACTIVE', 'HEALTHY', 'PAID', 'ALLOW', 'VERIFIED', 'COMPLETED', 'TRUE'].includes(s)) {
    return 'emerald';
  }
  if (['TRIAL', 'GRACE', 'WARNING', 'PENDING', 'DEGRADED', 'EXPIRING'].includes(s)) {
    return 'amber';
  }
  if (['SUSPENDED', 'EXPIRED', 'FAILED', 'DENY', 'CRITICAL', 'SECURITY_ALERT', 'REVOKED'].includes(s)) {
    return 'rose';
  }
  if (['INFO', 'OPERATING', 'IN_PROGRESS', 'READ_ONLY'].includes(s)) {
    return 'sky';
  }
  return 'slate';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  status,
  label,
  dot = true,
  pulse = false,
  size = 'sm',
  className = '',
}) => {
  const displayLabel = label || status || 'UNKNOWN';
  const resolvedVariant = variant || (status ? inferVariant(status) : 'slate');
  const style = VARIANT_STYLES[resolvedVariant];

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-mono font-medium uppercase tracking-wider border shadow-2xs select-none ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotBg} ${
            pulse ? 'animate-ping' : ''
          }`}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusBadge;
