import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * CollapsibleMobileCard
 *
 * Reusable progressive disclosure container for mobile cards (< 768px).
 * Eliminates visual maximalism by rendering a high-density 74–82px compact summary
 * by default, with an accessible expand/collapse arrow (^) to reveal secondary details.
 *
 * Virtualization-safe: Container height changes naturally in the DOM so
 * `@tanstack/react-virtual` measureElement recalculates true layout height
 * without layout-thrashing spring physics or coordinate drift.
 */
export default function CollapsibleMobileCard({
  id,
  summary,
  children,
  defaultExpanded = false,
  onToggle,
  className = '',
  isCancelled = false,
  entityType = 'record'
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Synchronize baseline state when default density preference changes
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const toggle = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  // Pointer/touch convenience: clicking neutral space on the header toggles expansion,
  // while embedded interactive elements (Links, buttons) execute their own handlers.
  const handleHeaderClick = useCallback((e) => {
    if (e.target.closest('a, button, input, select, textarea, [role="button"]')) {
      return;
    }
    toggle();
  }, [toggle]);

  const detailId = id ? `card-details-${id}` : undefined;

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-xl border transition-colors ${
        isCancelled
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/70'
      } ${className}`}
    >
      {/* Header Row: Neutral space triggers toggle; embedded links are siblings */}
      <div
        onClick={handleHeaderClick}
        className="flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="min-w-0 flex-1">
          {summary}
        </div>

        {/* Dedicated Accessible Toggle Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-expanded={isExpanded}
          aria-controls={detailId}
          aria-label={isExpanded ? `Collapse ${entityType} details` : `Expand ${entityType} details`}
          className="card-toggle-trigger p-2 -mr-1 text-slate-400 hover:text-slate-100 hover:bg-slate-700/40 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <ChevronDown
            className={`w-4 h-4 ${isExpanded ? 'rotate-180 text-emerald-400' : 'text-slate-400'}`}
          />
        </button>
      </div>

      {/* Expandable Details Container: instant, zero-jitter layout rendering */}
      {isExpanded && (
        <div
          id={detailId}
          className="pt-3 mt-3 border-t border-slate-700/50"
        >
          {children}
        </div>
      )}
    </div>
  );
}
