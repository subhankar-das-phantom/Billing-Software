/**
 * Format Selector Component for Document Printing
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA, DOCUMENT_CAPABILITY_MATRIX, INVOICE_COPY_MODES } from '../formats/documentPrintFormats';
import { FileText, Receipt, Printer, Copy } from 'lucide-react';

export default function PrintFormatSelector({
  documentType,
  selectedFormat,
  onSelectFormat,
  copyMode = undefined,
  onSelectCopyMode = null,
  isSingleCopy = false,
  onToggleCopyMode = null,
  showCopyToggle = false
}) {
  const allowedFormats = DOCUMENT_CAPABILITY_MATRIX[documentType] || [PRINT_FORMATS.A4];

  const getFormatIcon = (fmt) => {
    switch (fmt) {
      case PRINT_FORMATS.THERMAL_80:
      case PRINT_FORMATS.THERMAL_58:
        return Receipt;
      case PRINT_FORMATS.A4:
      default:
        return Printer;
    }
  };

  const activeMode = copyMode || (isSingleCopy ? INVOICE_COPY_MODES.FULL : INVOICE_COPY_MODES.DOUBLE);

  const handleSelectMode = (mode) => {
    if (onSelectCopyMode) {
      onSelectCopyMode(mode);
    } else if (onToggleCopyMode) {
      onToggleCopyMode();
    }
  };

  return (
    <div className="space-y-3">
      {/* Format Options Grid */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        {allowedFormats.map((fmt) => {
          const meta = FORMAT_METADATA[fmt];
          const isSelected = selectedFormat === fmt;
          const Icon = getFormatIcon(fmt);

          return (
            <button
              key={fmt}
              type="button"
              onClick={() => onSelectFormat(fmt)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/40 ring-1 ring-blue-400/50'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-slate-100 border border-slate-700/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
              <div className="text-left leading-tight">
                <div className="font-semibold">{meta?.label || fmt}</div>
                <div className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  {meta?.badge || 'Sheet'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Invoice Sheet Layout Mode (A4 / A5) */}
      {showCopyToggle && selectedFormat === PRINT_FORMATS.A4 && (onSelectCopyMode || onToggleCopyMode) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Copy className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Sheet Layout:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700/60 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectMode(INVOICE_COPY_MODES.FULL)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all min-h-[32px] sm:min-h-0 ${
                activeMode === INVOICE_COPY_MODES.FULL
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Single full-page tax invoice"
            >
              1x Full Page (A4)
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode(INVOICE_COPY_MODES.DOUBLE)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all min-h-[32px] sm:min-h-0 ${
                activeMode === INVOICE_COPY_MODES.DOUBLE
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Two compact copies with Cut Here divider"
            >
              2x Half Sheet (A5 Cut)
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode(INVOICE_COPY_MODES.HALF)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all min-h-[32px] sm:min-h-0 ${
                activeMode === INVOICE_COPY_MODES.HALF
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Single compact half-sheet invoice"
            >
              1x Half Sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
