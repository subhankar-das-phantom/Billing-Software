/**
 * Bharat Enterprise Billing System — ConfirmDialog Component
 * High-privilege action confirmation dialog requiring an explicit typed justification/reason.
 * Prevents accidental or un-audited state mutations across the platform.
 * Mobile-first touch ergonomics: 44px touch targets, responsive button stacking on mobile
 * (grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end), and pinned action footer.
 */

import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'danger' | 'warning';
  minReasonLength?: number;
  requiredMatchKeyword?: string; // Optional exact string to type, e.g. "CONFIRM" or "SUSPEND"
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  severity = 'danger',
  minReasonLength = 10,
  requiredMatchKeyword,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const isReasonValid = reason.trim().length >= minReasonLength;
  const isKeywordValid = requiredMatchKeyword
    ? keywordInput.trim() === requiredMatchKeyword
    : true;

  const canSubmit = isReasonValid && isKeywordValid && !isLoading;

  const handleClose = () => {
    if (isLoading) return;
    setReason('');
    setKeywordInput('');
    onClose();
  };

  const handleConfirmAction = async () => {
    if (!canSubmit) return;
    await onConfirm(reason.trim());
    handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleConfirmAction();
  };

  const isDanger = severity === 'danger';

  const footerContent = (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end w-full">
      <button
        type="button"
        onClick={handleClose}
        disabled={isLoading}
        className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer flex items-center justify-center"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={handleConfirmAction}
        disabled={!canSubmit}
        className={`min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center ${
          isDanger
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
            : 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-900/30 font-bold'
        }`}
      >
        {isLoading ? 'Processing...' : confirmLabel}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="md"
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Warning Banner */}
        <div
          className={`p-3 rounded-lg border flex items-start gap-3 text-xs ${
            isDanger
              ? 'bg-rose-950/60 text-rose-200 border-rose-800/80'
              : 'bg-amber-950/60 text-amber-200 border-amber-800/80'
          }`}
        >
          {isDanger ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed">{description}</p>
        </div>

        {/* Optional Keyword Match Input */}
        {requiredMatchKeyword && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Type <span className="font-mono font-bold text-rose-400">{requiredMatchKeyword}</span> to confirm:
            </label>
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              disabled={isLoading}
              placeholder={requiredMatchKeyword}
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-rose-500"
            />
          </div>
        )}

        {/* Typed Reason Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Audit Reason & Justification <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
            rows={3}
            placeholder={`Provide a clear explanation for the platform audit log (min ${minReasonLength} characters)...`}
            className="w-full min-h-[85px] px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-sans"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Minimum {minReasonLength} characters required</span>
            <span
              className={
                reason.trim().length >= minReasonLength
                  ? 'text-emerald-400 font-mono'
                  : 'text-slate-400 font-mono'
              }
            >
              {reason.trim().length}/{minReasonLength}
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default ConfirmDialog;
