import { useState } from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

/**
 * A5CapacityWarningDialog
 * Informational dialog notifying users when an invoice exceeds the practical row capacity
 * of the A5 double-copy layout (~12 rows).
 *
 * Safeguards:
 * - Informational only: never blocks invoice creation or changes format automatically.
 * - Single 'OK' button.
 * - Optional 'Don't show this warning again' checkbox.
 */
export default function A5CapacityWarningDialog({
  isOpen,
  onClose,
  actualRowCount,
  capacity = 12
}) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

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
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <p className="leading-relaxed">
              This invoice requires <span className="font-semibold text-slate-100">{actualRowCount}</span> printed rows, while the A5 double-copy layout is designed to accommodate approximately <span className="font-semibold text-slate-100">{capacity}</span> rows.
            </p>
            <p className="leading-relaxed text-slate-400">
              Additional rows may cause the invoice to overflow its half-sheet layout.
            </p>
            <p className="leading-relaxed text-slate-400">
              For better readability and printability, we recommend using A4 format.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <label className="flex items-center gap-2.5 text-sm text-slate-400 hover:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500/20 focus:ring-offset-0 focus:ring-1 transition cursor-pointer"
            />
            <span>Don't show this warning again</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-blue-500/10 min-w-[80px] cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
}
