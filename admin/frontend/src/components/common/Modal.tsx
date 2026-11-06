/**
 * Bharat Enterprise Billing System — Accessible Dual-Mode Modal Component
 * Anti-back-trap modal with Escape key handling, backdrop dismissal, snappy GPU exit transitions,
 * dual-mode responsive layout (bottom sheet on mobile, centered dialog on desktop),
 * sticky mobile header with 44px ArrowLeft back button, and pinned action footer with iOS safe-area padding.
 */

import React, { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';

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
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
  full: 'sm:max-w-6xl',
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-6 overflow-hidden">
          {/* Backdrop (lightweight blur to prevent GPU stutter) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Container: Mobile Bottom Sheet / Desktop Centered Floating Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={typeof title === 'string' && title ? 'modal-title' : undefined}
            onClick={(e) => e.stopPropagation()}
            className={`fixed inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl sm:relative sm:inset-auto sm:max-h-[85vh] sm:rounded-2xl w-full ${
              MAX_WIDTH_CLASSES[maxWidth] || MAX_WIDTH_CLASSES.md
            } bg-slate-900 border-t sm:border border-slate-800 shadow-2xl shadow-black/80 z-10 flex flex-col overflow-hidden sm:my-auto ${className}`}
          >
            {/* Mobile Bottom-Sheet Pull Affordance Handle */}
            <div className="sm:hidden w-full pt-2.5 pb-1 flex justify-center shrink-0 bg-slate-900">
              <div className="w-10 h-1 bg-slate-700/80 rounded-full" />
            </div>

            {/* Sticky Mobile/Desktop Header */}
            {hasHeader && (
              <div className="sticky top-0 z-20 shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/95 backdrop-blur-xs min-h-[56px]">
                <div className="flex items-center min-w-0 pr-2 gap-2 flex-1">
                  {showCloseButton && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="sm:hidden -ml-1 p-2 rounded-lg text-slate-400 hover:text-slate-100 active:bg-slate-800 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      aria-label="Back / Close modal"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}

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
                    className="p-2 sm:p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center cursor-pointer shrink-0"
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

            {/* Pinned Bottom Action Bar with iOS Safe-Area Padding */}
            {footer && (
              <div className="sticky bottom-0 z-20 shrink-0 px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900/95 backdrop-blur-xs border-t border-slate-800/80 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
