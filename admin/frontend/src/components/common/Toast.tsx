/**
 * Bharat Enterprise Billing System — Platform Toast Notification
 * Snappy, GPU-accelerated feedback toast for mutations and platform alerts.
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const duration = toast.durationMs || 4000;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const config = {
    success: {
      bg: 'bg-emerald-950/95',
      border: 'border-emerald-600/80',
      text: 'text-emerald-200',
      iconText: 'text-emerald-400',
      icon: CheckCircle2,
    },
    error: {
      bg: 'bg-rose-950/95',
      border: 'border-rose-600/80',
      text: 'text-rose-200',
      iconText: 'text-rose-400',
      icon: XCircle,
    },
    warning: {
      bg: 'bg-amber-950/95',
      border: 'border-amber-600/80',
      text: 'text-amber-200',
      iconText: 'text-amber-400',
      icon: AlertTriangle,
    },
    info: {
      bg: 'bg-slate-900/95',
      border: 'border-slate-700/80',
      text: 'text-slate-200',
      iconText: 'text-blue-400',
      icon: Info,
    },
  }[toast.type];

  const IconComponent = config.icon;

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full pointer-events-none">
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className={`pointer-events-auto p-3.5 rounded-xl border shadow-2xl shadow-black/80 flex items-start gap-3 select-none ${config.bg} ${config.border} ${config.text}`}
        >
          <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconText}`} />
          <div className="flex-1 min-w-0 text-xs">
            <span className="font-semibold block leading-tight">{toast.title}</span>
            {toast.message && (
              <p className="mt-1 text-slate-300 leading-relaxed break-words">{toast.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default Toast;
