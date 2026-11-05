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
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-700/60',
    dotBg: 'bg-emerald-400',
  },
  amber: {
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-700/60',
    dotBg: 'bg-amber-400',
  },
  rose: {
    bg: 'bg-rose-950/70',
    text: 'text-rose-300',
    border: 'border-rose-700/60',
    dotBg: 'bg-rose-400',
  },
  sky: {
    bg: 'bg-sky-950/70',
    text: 'text-sky-300',
    border: 'border-sky-700/60',
    dotBg: 'bg-sky-400',
  },
  slate: {
    bg: 'bg-slate-800/80',
    text: 'text-slate-300',
    border: 'border-slate-700/80',
    dotBg: 'bg-slate-400',
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
