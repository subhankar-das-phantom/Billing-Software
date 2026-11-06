/**
 * Bharat Enterprise Billing System — Active Support Banner
 * Zero-CLS Layout: Fixed 44px height, GPU-accelerated opacity & subtle Y-glide.
 * Contains an isolated timer component to eliminate whole-tree re-renders on every tick.
 */

import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, ShieldAlert, XSquare, Clock } from 'lucide-react';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import api from '../../services/api';

// ─── Isolated Tick Component ───────────────────────────────────────
// Ticks every 1,000ms locally without triggering re-renders on the banner or parent layout!
export const SupportCountdownTimer = memo(function SupportCountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const calculateRemaining = () => {
    const expiryTime = expiresAt ? new Date(expiresAt).getTime() : NaN;
    if (isNaN(expiryTime)) {
      return {
        totalMs: 0,
        formatted: '00:00',
        isUrgent: true,
      };
    }
    const remainingMs = Math.max(0, expiryTime - Date.now());
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
      totalMs: remainingMs,
      formatted: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      isUrgent: minutes < 5,
    };
  };

  const [time, setTime] = useState(calculateRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const updated = calculateRemaining();
      setTime(updated);
      if (updated.totalMs <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  return (
    <span
      className={`font-mono font-medium text-xs px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${
        time.isUrgent
          ? 'bg-rose-950/80 text-rose-300 border-rose-700/80 animate-pulse'
          : 'bg-amber-950/80 text-amber-300 border-amber-700/80'
      }`}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>{time.formatted} remaining</span>
    </span>
  );
});

// ─── Zero-CLS Active Support Banner ──────────────────────────────
export const ActiveSupportBanner: React.FC = () => {
  const { activeSupportSession, setActiveSupportSession } = usePlatformAuth();
  const [isEnding, setIsEnding] = useState(false);

  const handleEndSession = async () => {
    if (!activeSupportSession || isEnding) return;
    setIsEnding(true);
    try {
      await api.post(`/support/sessions/${activeSupportSession.sessionCode}/end`, {
        reason: 'Operator ended support session via platform top banner.',
      });
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      setActiveSupportSession(null);
      setIsEnding(false);
    }
  };

  const isReadOnly = activeSupportSession?.isReadOnly ?? true;

  return (
    <AnimatePresence mode="wait">
      {activeSupportSession && (
        <motion.div
          key="support-banner"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          style={{ willChange: 'transform, opacity' }}
          className="h-11 min-h-[44px] max-h-[44px] w-full bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-b border-amber-500/30 px-4 flex items-center justify-between text-xs z-30 select-none shadow-xs"
        >
        {/* Left: Session identification */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-medium shrink-0">
            <Headphones className="w-3.5 h-3.5" />
            <span>SUPPORT SESSION #{activeSupportSession.sessionCode}</span>
          </div>

          <div className="flex items-center gap-2 truncate text-slate-300">
            <span className="hidden sm:inline text-slate-400">Target Tenant:</span>
            <span className="font-semibold text-slate-100 truncate">
              {activeSupportSession.targetTenantFirmName || activeSupportSession.targetTenantId}
            </span>
          </div>

          <span
            className={`hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium uppercase tracking-wider border ${
              isReadOnly
                ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            {isReadOnly ? 'Read-Only Mode' : 'Diagnostic Operations'}
          </span>
        </div>

        {/* Right: Isolated countdown & End Session action */}
        <div className="flex items-center gap-3 shrink-0">
          <SupportCountdownTimer
            expiresAt={activeSupportSession.expiresAt}
            onExpire={() => setActiveSupportSession(null)}
          />

          <button
            type="button"
            onClick={handleEndSession}
            disabled={isEnding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 active:bg-rose-600/40 text-rose-200 border border-rose-500/40 hover:border-rose-500/60 transition-colors font-medium cursor-pointer disabled:opacity-50"
            title="Terminate active support session immediately"
          >
            <XSquare className="w-3.5 h-3.5" />
            <span>{isEnding ? 'Ending...' : 'End Session'}</span>
          </button>
        </div>
      </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActiveSupportBanner;
