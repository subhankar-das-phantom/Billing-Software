/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * CollapsibleMobileCard
 *
 * Progressive disclosure card for mobile viewports (< 768px).
 * Enforces strict 74–82px compact summary height, min-44px touch targets,
 * interactive child pass-through, and zero-layout-thrashing expansion.
 */

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CollapsibleMobileCardProps {
  id?: string;
  summary: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
  statusVariant?: 'default' | 'active' | 'warning' | 'danger' | 'neutral';
  entityType?: string;
}

const STATUS_VARIANT_STYLES: Record<string, string> = {
  default: 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80',
  active: 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/40',
  warning: 'bg-amber-950/10 border-amber-800/30 hover:border-amber-700/50',
  danger: 'bg-rose-950/10 border-rose-800/30 hover:border-rose-700/50',
  neutral: 'bg-slate-900/40 border-slate-800/60',
};

export const CollapsibleMobileCard: React.FC<CollapsibleMobileCardProps> = ({
  id,
  summary,
  children,
  defaultExpanded = false,
  isExpanded: controlledExpanded,
  onToggle,
  className = '',
  statusVariant = 'default',
  entityType = 'record',
}) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  useEffect(() => {
    if (controlledExpanded === undefined) {
      setInternalExpanded(defaultExpanded);
    }
  }, [defaultExpanded, controlledExpanded]);

  const toggle = useCallback(() => {
    const next = !isExpanded;
    if (controlledExpanded === undefined) {
      setInternalExpanded(next);
    }
    onToggle?.(next);
  }, [isExpanded, controlledExpanded, onToggle]);

  // Pointer/touch safety: clicking neutral space on the summary toggles expansion,
  // but clicks inside buttons, links, or inputs are passed through cleanly.
  const handleHeaderClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('a, button, input, select, textarea, [role="button"], .interactive-child')) {
        return;
      }
      toggle();
    },
    [toggle]
  );

  const detailId = id ? `card-details-${id}` : undefined;

  return (
    <div
      className={`p-3.5 rounded-xl border transition-colors select-none ${
        STATUS_VARIANT_STYLES[statusVariant] || STATUS_VARIANT_STYLES.default
      } ${className}`}
    >
      {/* Summary Row: Strict 74-82px bounded baseline */}
      <div
        onClick={handleHeaderClick}
        className="flex items-center justify-between gap-3 min-h-[50px] cursor-pointer"
      >
        <div className="min-w-0 flex-1">{summary}</div>

        {/* Dedicated 44px Touch Target Chevron Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-expanded={isExpanded}
          aria-controls={detailId}
          aria-label={isExpanded ? `Collapse ${entityType} details` : `Expand ${entityType} details`}
          className="card-toggle-trigger p-2 -mr-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
        >
          <ChevronDown
            className={`w-4 h-4 pointer-events-none transition-transform duration-150 ease-[0.16,1,0.3,1] ${
              isExpanded ? 'rotate-180 text-cyan-400' : 'text-slate-400'
            }`}
          />
        </button>
      </div>

      {/* Expandable Body: Virtualization-Safe Instant Layout */}
      {isExpanded && (
        <div
          id={detailId}
          className="pt-3.5 mt-3 border-t border-slate-800/80 animate-in fade-in duration-150 select-text"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleMobileCard;

