/**
 * Bharat Enterprise Billing System — Platform SaaS Plan Editor Modal
 * Create or modify pricing tier definitions, feature matrices, and catalog orders.
 * Mobile-first touch ergonomics: 44px touch targets, pinned action footer with safe-area padding,
 * and double-click submission prevention.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layers,
  Check,
  Info,
  DollarSign,
  Hash,
  FileText,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Modal from '../common/Modal';
import CurrencyDisplay from '../common/CurrencyDisplay';
import api from '../../services/api';
import type { SaaSPlan } from '../../types';

export interface EditPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan?: SaaSPlan | null;
  onSuccess?: () => void;
}

interface FeatureItem {
  key: string;
  label: string;
  desc: string;
}

interface FeatureGroup {
  groupName: string;
  description: string;
  features: FeatureItem[];
}

export const CANONICAL_FEATURE_GROUPS: FeatureGroup[] = [
  {
    groupName: 'Core Billing & Point of Sale',
    description: 'Foundational transaction engine, catalog SKUs, and checkout flows.',
    features: [
      { key: 'DASHBOARD', label: 'Command Dashboard', desc: 'Real-time sales telemetry, charts, and metrics' },
      { key: 'CUSTOMERS', label: 'Customer Master', desc: 'Customer ledger accounts, contact cards, and debt' },
      { key: 'PRODUCTS', label: 'Product Catalog', desc: 'SKU database, pricing rules, and HSN tax codes' },
      { key: 'INVOICE_CREATE', label: 'Create Invoice', desc: 'Fast GST checkout, item billing, and tax computation' },
      { key: 'INVOICE_HISTORY', label: 'Invoice Archive', desc: 'Searchable historical transaction register' },
      { key: 'INVOICE_PRINT', label: 'Document Printing', desc: 'Thermal receipts, PDF downloads, and share sheets' },
    ],
  },
  {
    groupName: 'Commercial Operations & Receivables',
    description: 'Payment receipts, reconciliation, ledger aging, and manual adjustments.',
    features: [
      { key: 'PAYMENTS', label: 'Payment Receipts', desc: 'Record incoming UPI, Cash, Bank, and Cheque' },
      { key: 'COLLECTIONS', label: 'Daily Register Closeout', desc: 'End-of-day cash drawer balancing and audit' },
      { key: 'CREDIT_NOTES', label: 'Credit Notes & Returns', desc: 'Sales return credit and tax ledger reversals' },
      { key: 'NOTES', label: 'Customer Remarks', desc: 'Contextual customer notes and follow-up flags' },
      { key: 'MANUAL_ENTRIES', label: 'Manual Entries', desc: 'Audited manual ledger journal adjustments' },
      { key: 'LEDGER', label: 'Customer Ledger', desc: 'Detailed debit/credit transaction statements' },
      { key: 'OUTSTANDING_TRACKING', label: 'Aging Receivables', desc: 'Overdue tracking and WhatsApp payment reminders' },
    ],
  },
  {
    groupName: 'Team & Access Security',
    description: 'Operator accounts, biometric shift assignments, and audit trails.',
    features: [
      { key: 'EMPLOYEES', label: 'Staff Management', desc: 'Operator accounts, PINs, and role access' },
      { key: 'EMPLOYEE_ANALYTICS', label: 'Sales Attribution', desc: 'Staff checkout quotas and operator KPIs' },
      { key: 'ACTIVITY_LOGS', label: 'Security Audit Trail', desc: 'Immutable timeline of tenant actions and edits' },
    ],
  },
  {
    groupName: 'Inventory Intelligence & Procurement',
    description: 'Batch-level inventory tracking, vendor procurement, and reorder triggers.',
    features: [
      { key: 'SUPPLIERS', label: 'Vendor Directory', desc: 'Supplier database, credit terms, and balances' },
      { key: 'PURCHASES', label: 'Purchase Invoices (GRN)', desc: 'Goods inward logging and inventory increment' },
      { key: 'PURCHASE_REPORTS', label: 'Procurement Reports', desc: 'Supplier analytics, spending, and volume metrics' },
      { key: 'INVENTORY_LEDGER', label: 'Batch Stock Ledger', desc: 'FIFO lot tracking, expiry alerts, and movements' },
      { key: 'INVENTORY_INTELLIGENCE', label: 'Reorder Intelligence', desc: 'Smart depletion forecasting and minimum buffers' },
    ],
  },
  {
    groupName: 'Statutory Compliance & Analytics',
    description: 'Government tax filing readiness and executive performance analytics.',
    features: [
      { key: 'GST_REPORTS', label: 'GST GSTR-1 / 3B', desc: 'Government tax summaries and JSON/Excel exports' },
      { key: 'ADVANCED_REPORTING', label: 'Executive Analytics', desc: 'Margin breakdowns, profit analysis, and trends' },
      { key: 'REPORTS', label: 'Standard Reports', desc: 'Daily, monthly, and yearly sales exports' },
    ],
  },
];

const ALL_CANONICAL_KEYS = CANONICAL_FEATURE_GROUPS.flatMap((g) => g.features.map((f) => f.key));

export const EditPlanModal: React.FC<EditPlanModalProps> = ({
  isOpen,
  onClose,
  plan,
  onSuccess,
}) => {
  const isEditing = Boolean(plan?._id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [baseMonthlyPrice, setBaseMonthlyPrice] = useState<number | string>(0);
  const [displayOrder, setDisplayOrder] = useState<number | string>(0);
  const [active, setActive] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set(ALL_CANONICAL_KEYS));
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Anti-race click lock ref
  const isSubmittingRef = useRef(false);

  // Synchronize state when modal opens or plan prop changes
  useEffect(() => {
    if (isOpen) {
      if (plan) {
        setName(plan.name || '');
        setCode(plan.code || '');
        setDescription(plan.description || '');
        setBaseMonthlyPrice(plan.baseMonthlyPrice ?? 0);
        setDisplayOrder(plan.displayOrder ?? 0);
        setActive(plan.active !== false);
        setSelectedFeatures(new Set(Array.isArray(plan.features) ? plan.features : []));
      } else {
        setName('');
        setCode('');
        setDescription('');
        setBaseMonthlyPrice(1499);
        setDisplayOrder(1);
        setActive(true);
        setSelectedFeatures(new Set(ALL_CANONICAL_KEYS));
      }
      setReason('');
      setErrorMessage(null);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [isOpen, plan]);

  // Auto-slugify code when creating a new plan
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setCode(slug);
    }
  };

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFeatures = () => {
    setSelectedFeatures(new Set(ALL_CANONICAL_KEYS));
  };

  const clearAllFeatures = () => {
    setSelectedFeatures(new Set());
  };

  const toggleGroup = (group: FeatureGroup) => {
    const groupKeys = group.features.map((f) => f.key);
    const allSelected = groupKeys.every((k) => selectedFeatures.has(k));

    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        groupKeys.forEach((k) => next.delete(k));
      } else {
        groupKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const minReasonLength = 10;
  const isReasonValid = reason.trim().length >= minReasonLength;
  const isPriceValid = Number(baseMonthlyPrice) >= 0;
  const isNameValid = name.trim().length > 0;
  const isCodeValid = code.trim().length > 0;
  const canSubmit = isNameValid && isCodeValid && isPriceValid && isReasonValid && !isSubmitting;

  const handleClose = () => {
    if (isSubmittingRef.current || isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSubmit || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      code: code.trim().toLowerCase(),
      description: description.trim(),
      baseMonthlyPrice: Number(baseMonthlyPrice) || 0,
      displayOrder: Number(displayOrder) || 0,
      active,
      features: Array.from(selectedFeatures),
      reason: reason.trim(),
    };

    try {
      if (isEditing && plan?._id) {
        await api.put(`/plans/${plan._id}`, payload);
      } else {
        await api.post('/plans', payload);
      }

      onSuccess?.();
      handleClose();
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to save SaaS plan. Ensure minimum 10-character operational reason and unique plan code.';
      setErrorMessage(msg);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const numericPrice = useMemo(() => {
    const n = Number(baseMonthlyPrice);
    return isNaN(n) ? 0 : n;
  }, [baseMonthlyPrice]);

  const selectedCount = selectedFeatures.size;
  const totalCount = ALL_CANONICAL_KEYS.length;

  // Pinned Bottom Action Bar
  const footerContent = (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end w-full">
      <button
        type="button"
        onClick={handleClose}
        disabled={isSubmitting}
        className="min-h-[44px] w-full sm:w-auto px-4 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer flex items-center justify-center"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={() => handleSubmit()}
        disabled={!canSubmit}
        className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-3.5 h-3.5 text-white shrink-0" />
        <span>
          {isSubmitting
            ? isEditing
              ? 'Saving Changes...'
              : 'Creating Plan...'
            : isEditing
            ? 'Update Plan Tier'
            : 'Create Plan Tier'}
        </span>
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="font-bold text-slate-100 truncate text-sm sm:text-base">
            {isEditing ? `Edit Plan Tier: ${plan?.name || code}` : 'Create New SaaS Plan'}
          </span>
          {isEditing && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-blue-950/70 text-blue-300 border border-blue-800/70">
              {code}
            </span>
          )}
        </div>
      }
      description="Define subscription commercial parameters, catalog display order, and canonical feature access."
      maxWidth="2xl"
      footer={footerContent}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Plan Name, Code, and Active Switch */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Plan Name */}
          <div className="sm:col-span-5 space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Plan Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Business Pro"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans"
            />
          </div>

          {/* Plan Code */}
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-xs font-medium text-slate-300">
              Plan Code <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().trim())}
              disabled={isSubmitting || isEditing}
              placeholder="e.g. business-pro"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-blue-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Active Status Switch */}
          <div className="sm:col-span-3 space-y-1">
            <label className="block text-xs font-medium text-slate-300">Active Catalog</label>
            <button
              type="button"
              onClick={() => setActive(!active)}
              disabled={isSubmitting}
              className={`w-full min-h-[44px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {active ? (
                <>
                  <ToggleRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Inactive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2: Monthly Price & Display Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Base Monthly Price */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                <span>Base Monthly Price (₹)</span> <span className="text-rose-400">*</span>
              </label>
              <div className="text-[11px] font-mono text-blue-400 flex items-center gap-1">
                <span>Preview:</span>
                <CurrencyDisplay amount={numericPrice} size="sm" />
              </div>
            </div>
            <input
              type="number"
              min={0}
              step="0.01"
              value={baseMonthlyPrice}
              onChange={(e) => setBaseMonthlyPrice(e.target.value)}
              disabled={isSubmitting}
              placeholder="1499.00"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Display Order */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <span>Catalog Order Position</span>
            </label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              disabled={isSubmitting}
              placeholder="1"
              className="w-full min-h-[44px] px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-xs">
            <label className="text-slate-300 font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Marketing Description</span>
            </label>
            <span className="text-slate-500 text-[11px] font-mono">{description.length}/500</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            disabled={isSubmitting}
            rows={2}
            placeholder="Comprehensive commercial suite for growing wholesale and distribution businesses..."
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans min-h-[64px]"
          />
        </div>

        {/* Features Checklist Header & Quick Helpers */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Feature Entitlement Matrix</span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Tenants subscribed to this plan tier inherit these canonical access privileges.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-800/70">
                {selectedCount} / {totalCount} active
              </span>
              <button
                type="button"
                onClick={selectAllFeatures}
                className="px-2.5 py-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/70 rounded-md transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAllFeatures}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Grouped Feature Sections */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {CANONICAL_FEATURE_GROUPS.map((group) => {
              const groupKeys = group.features.map((f) => f.key);
              const allGroupSelected = groupKeys.every((k) => selectedFeatures.has(k));

              return (
                <div
                  key={group.groupName}
                  className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-semibold text-slate-300">{group.groupName}</h5>
                      <p className="text-[10px] text-slate-500">{group.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group)}
                      className="text-[11px] font-mono text-blue-400 hover:text-blue-300 transition-colors cursor-pointer shrink-0 ml-2"
                    >
                      {allGroupSelected ? 'Deselect Group' : 'Select Group'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {group.features.map((feat) => {
                      const isChecked = selectedFeatures.has(feat.key);
                      return (
                        <button
                          key={feat.key}
                          type="button"
                          onClick={() => toggleFeature(feat.key)}
                          disabled={isSubmitting}
                          className={`p-2.5 rounded-lg border text-left flex items-start gap-2.5 transition-all cursor-pointer min-h-[44px] ${
                            isChecked
                              ? 'bg-blue-950/40 border-blue-500/60 text-slate-100 shadow-xs'
                              : 'bg-slate-900/60 border-slate-800/70 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-blue-600 text-white'
                                : 'border border-slate-600 bg-slate-950'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-medium block truncate text-slate-200">
                                {feat.label}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 uppercase">
                                {feat.key}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {feat.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Reason & Audit Justification */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <label className="block text-xs font-medium text-slate-300">
            Audit Reason & Justification <span className="text-rose-400">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={2}
            placeholder={`Provide a clear operational explanation for the platform cryptographic audit trail (min ${minReasonLength} chars)...`}
            className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-sans min-h-[72px]"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Minimum {minReasonLength} characters required for compliance</span>
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
      </form>
    </Modal>
  );
};

export default EditPlanModal;
