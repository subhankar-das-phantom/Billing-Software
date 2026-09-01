import React from 'react';

/**
 * Lightweight, zero-lag formatted counter.
 * Eliminates CPU-heavy Framer Motion spring loops and frame ticking.
 */
export const AnimatedCounter = ({ value, decimals = 0, prefix = '', suffix = '' }) => {
  const numValue = Number(value) || 0;
  const displayValue = numValue % 1 !== 0 
    ? numValue.toFixed(decimals) 
    : Math.round(numValue).toLocaleString('en-IN');

  return <span>{prefix}{displayValue}{suffix}</span>;
};

export default AnimatedCounter;
