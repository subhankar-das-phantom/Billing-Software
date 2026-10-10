import { useState } from 'react';
import Modal from './Modal';
import { AlertTriangle, ChevronDown } from 'lucide-react';

/**
 * A5CapacityWarningDialog
 * Informational dialog notifying users when an invoice exceeds the practical row capacity
 * of the A5 double-copy layout (~12 rows).
 *
 * Design: High-density Enterprise SaaS aesthetics without superficial AI-slop or glowing bloat.
 * Features:
 * - Metric comparison card (actual rows vs capacity threshold).
 * - Collapsible bottom-facing chevron accordion for notification suppression preference.
 * - Single tactile "OK, Got It" button.
 */
export default function A5CapacityWarningDialog({
  isOpen,
  onClose,
  actualRowCount,
  capacity = 12
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  const overflowRows = Math.max(0, actualRowCount - capacity);

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="A5 Print Capacity Exceeded"
      size="sm"
      maxWidth="max-w-[340px] sm:max-w-md"
    >
      <div className="p-3.5 sm:p-5 space-y-3">
        {/* Header Notice */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-100">
              Half-Sheet Limit Exceeded
            </h4>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 leading-relaxed">
              This invoice has more items than recommended for A5 half-sheet prints.
            </p>
          </div>
        </div>

        {/* Row Metrics Contrast Strip */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <span className="text-[11px] font-sans font-medium text-slate-400">Printed Rows</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400">{actualRowCount} / ~{capacity}</span>
            {overflowRows > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                +{overflowRows} over
              </span>
            )}
          </div>
        </div>

        {/* Explanatory Guidance */}
        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
          Printing 13+ rows on A5 half-sheet may compress heights or overflow margins. Use <span className="text-slate-200 font-medium">A4 Full Page</span> for multi-page invoices.
        </p>

        {/* Expandable Notification Preferences (Chevron Accordion) */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowPreferences((prev) => !prev)}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-300 transition-colors cursor-pointer select-none group"
          >
            <span>Notification preferences</span>
            <ChevronDown
              className={`w-3 h-3 text-slate-500 group-hover:text-slate-400 transition-transform duration-150 ${
                showPreferences ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showPreferences && (
            <div className="mt-2 p-2 rounded-lg bg-slate-900/60 border border-slate-800 animate-in fade-in duration-150">
              <label className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                />
                <span>Don't show this warning again</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer min-h-[36px]"
          >
            OK, Got It
          </button>
        </div>
      </div>
    </Modal>
  );
}
