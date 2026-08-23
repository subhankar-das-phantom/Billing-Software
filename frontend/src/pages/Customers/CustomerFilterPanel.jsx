import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Check,
  FileText,
  Shield,
  Calendar,
  ArrowUpDown,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  BarChart3,
} from 'lucide-react';
import { DEFAULT_FILTERS } from '../../hooks/useCustomerFilters';

// ── Section component ───────────────────────────────────────────

function FilterSection({ icon: Icon, title, iconColor = 'text-blue-400', children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg bg-slate-700/60`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <h4 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
          {title}
        </h4>
      </div>
      <div className="pl-1">
        {children}
      </div>
    </div>
  );
}

// ── Radio Group ─────────────────────────────────────────────────

function RadioOption({ label, value, selected, onChange }) {
  const isSelected = selected === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 w-full text-left ${
        isSelected
          ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        isSelected ? 'border-blue-400' : 'border-slate-600'
      }`}>
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-2 h-2 rounded-full bg-blue-400"
          />
        )}
      </div>
      <span>{label}</span>
    </button>
  );
}

// ── Toggle Switch ───────────────────────────────────────────────

function ToggleFilter({ label, icon: Icon, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 w-full ${
        checked
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 ${checked ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>{label}</span>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors relative ${
        checked ? 'bg-emerald-500' : 'bg-slate-600'
      }`}>
        <motion.div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
          animate={{ left: checked ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
    </button>
  );
}

// ── Segmented Control ───────────────────────────────────────────

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex bg-slate-800/80 rounded-lg p-1 border border-slate-700/50">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150 ${
            value === opt.value
              ? 'bg-blue-500/20 text-blue-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Date Preset Buttons ─────────────────────────────────────────

function DatePresetButton({ label, value, selected, onChange }) {
  const isSelected = selected === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 ${
        isSelected
          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
          : 'text-slate-400 hover:text-slate-300 bg-slate-800/50 border border-slate-700/40 hover:border-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

// ── Main Panel Component ────────────────────────────────────────

const CustomerFilterPanel = memo(function CustomerFilterPanel({
  isOpen,
  onClose,
  onApply,
  onReset,
  currentFilters,
}) {
  // Local draft state — changes here do NOT trigger API calls
  const [draft, setDraft] = useState({ ...DEFAULT_FILTERS, ...currentFilters });

  // Sync draft when panel opens or currentFilters change
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...DEFAULT_FILTERS, ...currentFilters });
    }
  }, [isOpen, currentFilters]);

  const updateDraft = useCallback((key, value) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleApply = useCallback(() => {
    // Strip out search — it's managed separately by the search input
    const { search, ...filterParams } = draft;
    onApply(filterParams);
    onClose();
  }, [draft, onApply, onClose]);

  const handleReset = useCallback(() => {
    setDraft({ ...DEFAULT_FILTERS });
    onReset();
    onClose();
  }, [onReset, onClose]);

  const selectedSort = draft.sortBy || draft.sortOrder
    ? `${draft.sortBy}|${draft.sortOrder}`
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 flex flex-col bg-slate-900/95 backdrop-blur-2xl border-l border-slate-700/50 shadow-2xl shadow-black/40"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20">
                  <ArrowUpDown className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Filters</h3>
                  <p className="text-xs text-slate-500">Refine customer list</p>
                </div>
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7 no-scrollbar">

              {/* ── Business Information ────────────────── */}
              <FilterSection icon={FileText} title="Business Information" iconColor="text-blue-400">
                <div className="space-y-2">
                  {/* GSTIN */}
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500 font-medium pl-1 uppercase tracking-wider">GSTIN</p>
                    <RadioOption label="All Customers" value="" selected={draft.hasGstin} onChange={v => updateDraft('hasGstin', v)} />
                    <RadioOption label="Has GSTIN" value="yes" selected={draft.hasGstin} onChange={v => updateDraft('hasGstin', v)} />
                    <RadioOption label="No GSTIN" value="no" selected={draft.hasGstin} onChange={v => updateDraft('hasGstin', v)} />
                  </div>

                  {/* Drug License */}
                  <div className="space-y-1 pt-2">
                    <p className="text-xs text-slate-500 font-medium pl-1 uppercase tracking-wider">Drug License</p>
                    <RadioOption label="All Customers" value="" selected={draft.hasDlNo} onChange={v => updateDraft('hasDlNo', v)} />
                    <RadioOption label="Has Drug License" value="yes" selected={draft.hasDlNo} onChange={v => updateDraft('hasDlNo', v)} />
                    <RadioOption label="No Drug License" value="no" selected={draft.hasDlNo} onChange={v => updateDraft('hasDlNo', v)} />
                  </div>

                  {/* Contact toggles */}
                  <div className="space-y-1 pt-2">
                    <p className="text-xs text-slate-500 font-medium pl-1 uppercase tracking-wider">Contact Info</p>
                    <ToggleFilter
                      label="Has Phone"
                      icon={Phone}
                      checked={draft.hasPhone === 'yes'}
                      onChange={v => updateDraft('hasPhone', v ? 'yes' : '')}
                    />
                    <ToggleFilter
                      label="Has Email"
                      icon={Mail}
                      checked={draft.hasEmail === 'yes'}
                      onChange={v => updateDraft('hasEmail', v ? 'yes' : '')}
                    />
                    <ToggleFilter
                      label="Has Address"
                      icon={MapPin}
                      checked={draft.hasAddress === 'yes'}
                      onChange={v => updateDraft('hasAddress', v ? 'yes' : '')}
                    />
                  </div>
                </div>
              </FilterSection>

              <div className="border-t border-slate-700/40" />

              {/* ── Status ─────────────────────────────── */}
              <FilterSection icon={Shield} title="Status" iconColor="text-emerald-400">
                <SegmentedControl
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Active', value: '' },
                    { label: 'Inactive', value: 'inactive' },
                  ]}
                  value={draft.status}
                  onChange={v => updateDraft('status', v)}
                />
              </FilterSection>

              <div className="border-t border-slate-700/40" />

              {/* ── Dates ──────────────────────────────── */}
              <FilterSection icon={Calendar} title="Created Date" iconColor="text-violet-400">
                <div className="flex flex-wrap gap-2">
                  <DatePresetButton label="All Time" value="" selected={draft.dateRange} onChange={v => updateDraft('dateRange', v)} />
                  <DatePresetButton label="Today" value="today" selected={draft.dateRange} onChange={v => updateDraft('dateRange', v)} />
                  <DatePresetButton label="Last 7 Days" value="7d" selected={draft.dateRange} onChange={v => updateDraft('dateRange', v)} />
                  <DatePresetButton label="Last 30 Days" value="30d" selected={draft.dateRange} onChange={v => updateDraft('dateRange', v)} />
                  <DatePresetButton label="Custom Range" value="custom" selected={draft.dateRange} onChange={v => updateDraft('dateRange', v)} />
                </div>

                {/* Custom date inputs */}
                <AnimatePresence>
                  {draft.dateRange === 'custom' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div>
                          <label className="text-xs text-slate-500 block mb-1.5">From</label>
                          <input
                            type="date"
                            value={draft.dateFrom}
                            onChange={e => updateDraft('dateFrom', e.target.value)}
                            className="input text-sm !py-2"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 block mb-1.5">To</label>
                          <input
                            type="date"
                            value={draft.dateTo}
                            onChange={e => updateDraft('dateTo', e.target.value)}
                            className="input text-sm !py-2"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </FilterSection>

              <div className="border-t border-slate-700/40" />

              {/* ── Sorting ────────────────────────────── */}
              <FilterSection icon={ArrowUpDown} title="Sorting" iconColor="text-amber-400">
                <div className="space-y-1">
                  <RadioOption label="Newest First" value="" selected={selectedSort} onChange={() => { updateDraft('sortBy', ''); updateDraft('sortOrder', ''); }} />
                  <RadioOption label="Oldest First" value="createdAt|asc" selected={selectedSort} onChange={() => { updateDraft('sortBy', 'createdAt'); updateDraft('sortOrder', 'asc'); }} />
                  <RadioOption label="Customer Name (A–Z)" value="customerName|asc" selected={selectedSort} onChange={() => { updateDraft('sortBy', 'customerName'); updateDraft('sortOrder', 'asc'); }} />
                  <RadioOption label="Customer Name (Z–A)" value="customerName|desc" selected={selectedSort} onChange={() => { updateDraft('sortBy', 'customerName'); updateDraft('sortOrder', 'desc'); }} />
                  <RadioOption label="Last Updated" value="updatedAt|desc" selected={selectedSort} onChange={() => { updateDraft('sortBy', 'updatedAt'); updateDraft('sortOrder', 'desc'); }} />
                </div>
              </FilterSection>

              <div className="border-t border-slate-700/40" />

              {/* ── Financial (redirect callout) ────────── */}
              <FilterSection icon={BarChart3} title="Financial" iconColor="text-orange-400">
                <div className="rounded-xl bg-amber-500/8 border border-amber-500/15 px-4 py-3.5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-amber-200/90 font-medium">
                        Use Outstanding Report for financial filtering.
                      </p>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Outstanding, credit, and ageing filters are available in the dedicated financial reports where they run on aggregation-optimised pipelines.
                      </p>
                    </div>
                  </div>
                </div>
              </FilterSection>
            </div>

            {/* Footer — sticky */}
            <div className="px-6 py-4 border-t border-slate-700/50 flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl">
              <motion.button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </motion.button>
              <motion.button
                type="button"
                onClick={handleApply}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Check className="w-4 h-4" />
                Apply Filters
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default CustomerFilterPanel;
