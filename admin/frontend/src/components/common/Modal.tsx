/**
 * Bharat Enterprise Billing System — Accessible Centered Modal Component
 * Matches 100% of the billing software frontend modal architecture:
 * - Rendered at root level via createPortal to eliminate clipping & back-traps
 * - Perfectly centered horizontally & vertically in viewport on both desktop and mobile
 * - Contained max height (max-h-[85vh] sm:max-h-[88vh]) with comfortable outer margin (never touches top/bottom)
 * - Outer flex container has overflow-hidden to prevent Chromium scroll-into-view jumping on input/select focus
 * - Backdrop click & Escape key dismissal
 * - Smooth GPU-accelerated exit transitions with zero CLS
 */

import React, { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  className?: string;
  bodyClassName?: string;
}

const MAX_WIDTH_CLASSES: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-6xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  showCloseButton = true,
  className = '',
  bodyClassName = '',
}) => {
  // Listen to Escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const hasHeader = Boolean(title || showCloseButton);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden no-print select-none">
          {/* Backdrop (midnight navy blur matching billing software) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Container: Cleanly Centered Floating Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={typeof title === 'string' && title ? 'modal-title' : undefined}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full ${
              MAX_WIDTH_CLASSES[maxWidth] || MAX_WIDTH_CLASSES.md
            } max-h-[85vh] sm:max-h-[88vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden ${className}`}
          >
            {/* Sticky Header */}
            {hasHeader && (
              <div className="sticky top-0 z-20 shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur-xs min-h-[56px]">
                <div className="flex items-center min-w-0 pr-2 gap-2 flex-1">
                  <div className="min-w-0 flex-1">
                    {title && (
                      typeof title === 'string' ? (
                        <h3
                          id="modal-title"
                          className="text-sm sm:text-base font-semibold text-slate-100 tracking-tight truncate"
                        >
                          {title}
                        </h3>
                      ) : (
                        title
                      )
                    )}
                    {description && (
                      typeof description === 'string' ? (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed truncate sm:whitespace-normal">
                          {description}
                        </p>
                      ) : (
                        description
                      )
                    )}
                  </div>
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer shrink-0"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Modal Body */}
            <div className={`p-4 sm:p-5 overflow-y-auto flex-1 overscroll-contain ${bodyClassName}`}>
              {children}
            </div>

            {/* Pinned Bottom Action Bar */}
            {footer && (
              <div className="sticky bottom-0 z-20 shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900/95 backdrop-blur-xs border-t border-slate-800 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Modal;
