/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * LiveCalendarClock (Isolated Leaf Component)
 *
 * Runs a standalone 1,000ms interval for Indian Standard Time (IST).
 * Prevents the parent dashboard and navigation tree from re-rendering every second.
 */

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export interface LiveCalendarClockProps {
  className?: string;
  showIcon?: boolean;
  showDate?: boolean;
  showZone?: boolean;
  variant?: 'default' | 'badge' | 'minimal';
}

function getISTTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getISTDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const LiveCalendarClock: React.FC<LiveCalendarClockProps> = ({
  className = '',
  showIcon = true,
  showDate = false,
  showZone = true,
  variant = 'default',
}) => {
  const [time, setTime] = useState<string>(getISTTime);
  const [date, setDate] = useState<string>(getISTDate);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getISTTime());
      setDate(getISTDate());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300 shadow-xs ${className}`}
        title={`Indian Standard Time (IST): ${date}`}
      >
        {showIcon && <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
        <span className="text-blue-400 font-semibold tracking-tight">{time}</span>
        {showZone && <span className="text-[10px] text-slate-500 font-medium">IST</span>}
        {showDate && <span className="text-[11px] text-slate-400 ml-1">({date})</span>}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <span className={`font-mono text-xs ${className}`}>
        <span className="text-blue-400 font-semibold">{time}</span>
        {showZone && <span className="text-slate-500 text-[10px] ml-1">IST</span>}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 font-mono text-xs text-slate-300 ${className}`}
      title={`Indian Standard Time (IST): ${date}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      <span className="text-blue-400 font-semibold">{time}</span>
      {showZone && <span className="text-slate-500 text-[10px]">IST</span>}
      {showDate && <span className="text-slate-400 text-[11px]">({date})</span>}
    </div>
  );
};

export default LiveCalendarClock;
