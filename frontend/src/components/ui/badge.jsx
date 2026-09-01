import * as React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = {
  default: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  secondary: 'bg-slate-700/50 text-slate-300 border-slate-600/50',
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  info: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  outline: 'border-slate-700 text-slate-300 bg-transparent'
};

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors',
        badgeVariants[variant] || badgeVariants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
