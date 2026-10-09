/**
 * Responsive Multi-Document Print Dialog with Live Shared Preview
 * Mobile bottom sheet & desktop modal adhering to Enterprise UI standards
 * Bharat Enterprise Billing System
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, ArrowLeft, ZoomIn, ZoomOut, Check, Sparkles } from 'lucide-react';
import { PRINT_FORMATS, FORMAT_METADATA } from '../formats/documentPrintFormats';
import { executeBrowserPrint } from '../transport/PrintTransport';
import PrintFormatSelector from './PrintFormatSelector';

export default function PrintDialog({
  isOpen,
  onClose,
  documentType,
  title = 'Print Document',
  initialFormat = PRINT_FORMATS.A4,
  copyMode = undefined,
  onSelectCopyMode = null,
  isSingleCopy = false,
  onToggleCopyMode = null,
  renderDocument // (activeFormat, copyMode, isSingleCopy) => ReactNode
}) {
  const [activeFormat, setActiveFormat] = useState(initialFormat);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 0.75 = 75%, etc.
  const [isPrinting, setIsPrinting] = useState(false);
  const printMountRef = useRef(null);

  // Synchronize initial format when dialog opens
  useEffect(() => {
    if (isOpen) {
      setActiveFormat(initialFormat || PRINT_FORMATS.A4);
      setZoomLevel(1);
      setIsPrinting(false);
    }
  }, [isOpen, initialFormat]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await executeBrowserPrint({
        format: activeFormat,
        containerElement: printMountRef.current
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const metadata = FORMAT_METADATA[activeFormat] || FORMAT_METADATA[PRINT_FORMATS.A4];
  const isThermal = activeFormat === PRINT_FORMATS.THERMAL_80 || activeFormat === PRINT_FORMATS.THERMAL_58;

  return createPortal(
    <>
      {/* ─── Screen Modal Window (Hidden on @media print) ────────────────────── */}
      <div
        className="no-print fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl max-h-[94vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -ml-1 sm:hidden rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Printer className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-100">{title}</h2>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Target Media: <span className="text-slate-200 font-semibold">{metadata.label}</span> ({metadata.sublabel})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Close dialog"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Controls Bar: Format Pills & Zoom */}
          <div className="px-4 sm:px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <PrintFormatSelector
              documentType={documentType}
              selectedFormat={activeFormat}
              onSelectFormat={(fmt) => setActiveFormat(fmt)}
              copyMode={copyMode}
              onSelectCopyMode={onSelectCopyMode}
              isSingleCopy={isSingleCopy}
              onToggleCopyMode={onToggleCopyMode}
              showCopyToggle={documentType === 'invoice'}
            />

            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center gap-1.5 self-end sm:self-auto bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-300">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Preview Canvas Container */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-950/80 flex items-start justify-center">
            <div
              className="shadow-2xl bg-white border border-slate-300 rounded-xs transition-transform duration-100 origin-top"
              style={{
                transform: `scale(${zoomLevel})`,
                maxWidth: isThermal ? (activeFormat === PRINT_FORMATS.THERMAL_58 ? '54mm' : '76mm') : '195mm',
                width: '100%'
              }}
            >
              {renderDocument(activeFormat, copyMode || (isSingleCopy ? 'single' : 'double'), isSingleCopy)}
            </div>
          </div>

          {/* Dialog Action Footer */}
          <div className="px-4 sm:px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-400 hidden sm:block">
              {isThermal ? (
                <span>Tip: Choose <strong>Roll Paper</strong> or paper size 80mm/58mm in browser print dialog.</span>
              ) : (
                <span>Paper: <strong>{metadata.label}</strong> · Margins: <strong>Default / Minimum</strong></span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary px-4 py-2 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="btn btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Preparing...' : 'Print Document'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Dedicated Printable Root (Strictly Visible in @media print) ─────── */}
      <div ref={printMountRef} className="hidden print:block invoice-print-portal w-full">
        {renderDocument(activeFormat, copyMode || (isSingleCopy ? 'single' : 'double'), isSingleCopy)}
      </div>
    </>,
    document.body
  );
}
