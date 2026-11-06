/**
 * Bharat Enterprise Billing System — CurrencyDisplay Component
 * Strictly formats Indian Rupee values with 'en-IN' standard and explicit 2 decimal paise precision.
 * BANS paisa truncation (no Math.round or decimals={0} on financial metrics).
 */

import React from 'react';

interface CurrencyDisplayProps {
  amount: number | string | null | undefined;
  currencySymbol?: string;
  className?: string;
  colorCode?: boolean; // Green for positive, Rose for negative
  size?: 'sm' | 'md' | 'base' | 'lg' | 'xl' | '2xl';
  decimals?: number;
}

export function formatINR(value: number | string | null | undefined, decimals = 2): string {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safeNumber);
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  amount,
  currencySymbol = '₹',
  className = '',
  colorCode = false,
  size = 'base',
  decimals = 2,
}) => {
  const numeric = typeof amount === 'number' && Number.isFinite(amount) ? amount : Number(amount) || 0;
  const isNegative = numeric < 0;
  const absoluteValue = Math.abs(numeric);
  const formatted = formatINR(absoluteValue, decimals);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    base: 'text-sm',
    lg: 'text-base font-semibold',
    xl: 'text-lg font-bold',
    '2xl': 'text-2xl font-bold tracking-tight',
  }[size];

  let colorClass = 'text-slate-100';
  if (colorCode) {
    if (numeric > 0) colorClass = 'text-emerald-400';
    else if (numeric < 0) colorClass = 'text-rose-400';
    else colorClass = 'text-slate-400';
  }

  return (
    <span
      className={`font-mono inline-flex items-baseline gap-0.5 select-text ${sizeClasses} ${colorClass} ${className}`}
    >
      {isNegative && <span>-</span>}
      <span className="font-sans text-[0.85em] opacity-80">{currencySymbol}</span>
      <span>{formatted}</span>
    </span>
  );
};

export default CurrencyDisplay;
