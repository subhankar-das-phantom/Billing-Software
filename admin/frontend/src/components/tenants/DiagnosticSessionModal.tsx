/**
 * Bharat Enterprise Billing System — Diagnostic Support Session Modal
 * Time-bounded, audited support session initiator pre-filled with tenant credentials.
 */

import React, { useState } from 'react';
import { Headphones, ShieldAlert, Clock, Info } from 'lucide-react';
import Modal from '../common/Modal';
import api from '../../services/api';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import type { ActiveSupportSession } from '../../types';

interface DiagnosticSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  firmName: string;
  onSuccess: (session: ActiveSupportSession) => void;
}

const DURATION_OPTIONS = [
  { label: '1 Hour', value: 1 },
  { label: '2 Hours (Recommended)', value: 2 },
  { label: '4 Hours', value: 4 },
  { label: '8 Hours (Full Shift)', value: 8 },
];

export const DiagnosticSessionModal: React.FC<DiagnosticSessionModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  firmName,
  onSuccess,
}) => {
  const { setActiveSupportSession } = usePlatformAuth();
  const [reason, setReason] = useState('');
  const [durationHours, setDurationHours] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const minReasonLength = 10;
  const isReasonValid = reason.trim().length >= minReasonLength;
  const canSubmit = isReasonValid && !isSubmitting && Boolean(tenantId);

  const handleClose = () => {
    if (isSubmitting) return;
    setReason('');
    setDurationHours(2);
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        data: ActiveSupportSession;
      }>('/support', {
        targetTenantId: tenantId,
        reason: reason.trim(),
        durationHours,
      });

      if (response.data.success && response.data.data) {
        const sessionWithFirmName: ActiveSupportSession = {
          ...response.data.data,
          targetTenantFirmName: firmName,
        };
        setActiveSupportSession(sessionWithFirmName);
        onSuccess(sessionWithFirmName);
        handleClose();
      } else {
        setErrorMessage('Failed to initiate diagnostic session.');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to start support session. Ensure your operator role has permission.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Initiate Diagnostic Support Session"
      description="Start an audited, time-capped diagnostic session for this enterprise tenant."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tenant Summary Banner */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Target Tenant Firm</span>
            <span className="font-semibold text-slate-100 text-sm">{firmName || 'Unknown Firm'}</span>
          </div>
          <div className="text-right font-mono text-[11px] text-slate-400">
            <span className="text-slate-500 block">Tenant ID</span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
              {tenantId}
            </span>
          </div>
        </div>

        {/* Read-Only Sandbox Guard Notice */}
        <div className="p-3 bg-amber-950/50 border border-amber-700/60 rounded-lg flex items-start gap-2.5 text-xs text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Support sessions enforce a strict <strong className="text-amber-100">Read-Only Guard</strong>.
            Financial write operations (invoices, payments, customer credits) are automatically blocked.
            All operator actions are hashed into the tamper-evident platform audit ledger.
          </p>
        </div>

        {/* Duration Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Session Duration Ceiling</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationHours(opt.value)}
                disabled={isSubmitting}
                className={`px-3 py-2 text-xs rounded-lg border text-left transition-all cursor-pointer ${
                  durationHours === opt.value
                    ? 'bg-amber-500/10 border-amber-500/60 text-amber-300 font-medium shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Operational Justification */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">
            Support Ticket / Diagnostic Reason <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            placeholder="e.g. Investigating GST reconciliation discrepancy reported in ticket #SUP-8821..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all font-sans"
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

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-lg text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Headphones className="w-3.5 h-3.5 text-slate-950" />
            <span>{isSubmitting ? 'Starting Session...' : 'Start Session'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default DiagnosticSessionModal;
