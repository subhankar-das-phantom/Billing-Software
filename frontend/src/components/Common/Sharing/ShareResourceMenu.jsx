import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, FileDown, Link2, Clock } from 'lucide-react';
import { useShareResource } from '../../../hooks/useShareResource';

/**
 * ShareResourceMenu
 * Clean, minimal enterprise popover action menu offering:
 * 1. "Send a copy" (PDF file)
 * 2. "Send link" (Secure invoice link)
 */
export default function ShareResourceMenu({
  resourceType = 'invoice',
  resourceId,
  resourceTitle = 'Invoice',
  fileName,
  getPdfBlob,
  menuTitle = 'Share invoice',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const {
    shareCopy,
    shareLink,
    isSharingCopy,
    isSharingLink
  } = useShareResource({
    resourceType,
    resourceId,
    resourceTitle,
    fileName,
    getPdfBlob
  });

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escape key to dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCopyClick = async () => {
    await shareCopy();
    setIsOpen(false);
  };

  const handleLinkClick = async () => {
    await shareLink();
    setIsOpen(false);
  };

  const isBusy = isSharingCopy || isSharingLink;

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isBusy}
        className={`btn btn-secondary flex items-center gap-1.5 py-1.5 px-2.5 text-xs font-medium transition-colors ${
          isOpen
            ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-xs'
            : 'border-slate-700/70 text-slate-300 hover:text-slate-100'
        }`}
        aria-expanded={isOpen}
        title="Share options"
      >
        {isBusy ? (
          <Clock className="w-3.5 h-3.5 pointer-events-none text-slate-400 animate-spin" />
        ) : (
          <Share2 className="w-3.5 h-3.5 pointer-events-none text-slate-400" />
        )}
        <span className="pointer-events-none">Share</span>
      </button>

      {/* Action Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="share-resource-popover"
            className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/80 p-2 z-50 will-change-[transform,opacity]"
            style={{ transformOrigin: 'top right' }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Popover Header */}
            <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1">
              <p className="text-xs font-semibold text-slate-200">{menuTitle}</p>
            </div>

            {/* Option 1: Send a copy */}
            <button
              type="button"
              onClick={handleCopyClick}
              disabled={isBusy}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors group"
            >
              <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 mt-0.5 group-hover:border-blue-500/40">
                {isSharingCopy ? (
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 group-hover:text-slate-100">
                  {isSharingCopy ? 'Generating PDF...' : 'Send a copy'}
                </p>
                <p className="text-[11px] text-slate-400">PDF invoice</p>
              </div>
            </button>

            {/* Option 2: Send link */}
            <button
              type="button"
              onClick={handleLinkClick}
              disabled={isBusy}
              className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-slate-800/80 transition-colors group mt-0.5"
            >
              <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mt-0.5 group-hover:border-emerald-500/40">
                {isSharingLink ? (
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 group-hover:text-slate-100">
                  {isSharingLink ? 'Creating secure link...' : 'Send link'}
                </p>
                <p className="text-[11px] text-slate-400">Secure invoice link</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
