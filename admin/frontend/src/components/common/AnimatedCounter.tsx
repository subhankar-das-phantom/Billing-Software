/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * Lightweight, zero-lag formatted counter with Indian numbering ('en-IN') and exact paise precision.
 * Eliminates CPU-heavy Framer Motion spring loops and frame ticking while preserving decimal integrity.
 */

import React, { useMemo } from 'react';

export interface AnimatedCounterProps {
  value?: number | string | null;
  target?: number | string | null;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  isCurrency?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  target,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  isCurrency = false,
}) => {
  const raw = value !== undefined && value !== null ? value : target ?? 0;
  const num = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  const safeNum = Number.isFinite(num) ? num : 0;
  const dec = isCurrency && decimals === 0 ? 2 : decimals;

  const formatted = useMemo(() => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    }).format(safeNum);
  }, [safeNum, dec]);

  return (
    <span className={`font-mono select-text ${className}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
};

export default AnimatedCounter;

