/**
 * Format Selector Component for Document Printing
 * Bharat Enterprise Billing System
 */

import React from 'react';
import { PRINT_FORMATS, FORMAT_METADATA, DOCUMENT_CAPABILITY_MATRIX } from '../formats/documentPrintFormats';
import { FileText, Receipt, Printer, Copy } from 'lucide-react';

export default function PrintFormatSelector({
  documentType,
  selectedFormat,
  onSelectFormat,
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

      {/* Invoice Copy Mode (A4 / A5) */}
      {showCopyToggle && selectedFormat === PRINT_FORMATS.A4 && onToggleCopyMode && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Copy className="w-4 h-4 text-blue-400" />
            <span>A4 / A5 Sheet Layout:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700/60">
            <button
              type="button"
              onClick={() => { if (!isSingleCopy) onToggleCopyMode(); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                isSingleCopy
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1x Single
            </button>
            <button
              type="button"
              onClick={() => { if (isSingleCopy) onToggleCopyMode(); }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                !isSingleCopy
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2x Double (Cut Line)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
