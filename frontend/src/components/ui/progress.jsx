import * as React from 'react';
import { cn } from '../../lib/utils';

export function Progress({ value = 0, max = 100, className, indicatorClassName, ...props }) {
  const percentage = Math.min(Math.max(0, (value / max) * 100), 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/50', className)}
      {...props}
    >
      <div
        className={cn('h-full w-full flex-1 bg-blue-500 transition-all duration-500 ease-out rounded-full', indicatorClassName)}
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  );
}
