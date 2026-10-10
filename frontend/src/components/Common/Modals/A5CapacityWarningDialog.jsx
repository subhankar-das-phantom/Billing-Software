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
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Header Notice */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-100">
              Half-Sheet Row Limit Exceeded
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              This invoice contains more items than recommended for A5 half-sheet printing.
            </p>
          </div>
        </div>

        {/* Row Metrics Contrast Card */}
        <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Required Rows
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-amber-400">
                {actualRowCount}
              </span>
              {overflowRows > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  +{overflowRows} over
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1 border-l border-slate-800 pl-3">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              A5 Capacity
            </span>
            <span className="text-lg font-bold font-mono text-slate-200">
              ~{capacity}
            </span>
          </div>
        </div>

        {/* Explanatory Context */}
        <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
          <p>
            Printing more than <span className="font-semibold text-slate-100">{capacity}</span> rows on A5 half-sheet may cause content to compress or spill past printable margins.
          </p>
          <p className="text-slate-400">
            For invoices with 13+ items, standard <span className="text-slate-300 font-medium">A4 Full Page</span> format is recommended for clean multi-page presentation.
          </p>
        </div>

        {/* Expandable Notification Preferences (Chevron Accordion) */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowPreferences((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors cursor-pointer select-none group"
          >
            <span>Notification preferences</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 group-hover:text-slate-400 transition-transform duration-150 ${
                showPreferences ? 'rotate-180' : ''
              }`}
            />
          </button>

          {showPreferences && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 animate-in fade-in duration-150">
              <label className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-200 cursor-pointer select-none">
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
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer min-h-[40px] sm:min-h-[auto]"
          >
            OK, Got It
          </button>
        </div>
      </div>
    </Modal>
  );
}
