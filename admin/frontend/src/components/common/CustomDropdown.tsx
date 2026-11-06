/**
 * Bharat Enterprise Billing System — Accessible Floating Custom Dropdown
 * High-density enterprise select menu matching 100% of the billing software frontend design:
 * - Rendered via createPortal(..., document.body) to eliminate modal clipping and overflow traps
 * - Opens cleanly below trigger (or flips if constrained) with fixed max height and internal scroll
 * - Optional inline search for long option lists (e.g. 25+ enterprise feature flags)
 * - Complete keyboard navigation (ArrowUp, ArrowDown, Enter, Escape)
 * - Zero CLS, GPU-accelerated opacity & subtle Y-glide
 */

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | DropdownOption)[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  id?: string;
  maxMenuHeight?: number;
  placement?: 'bottom' | 'top' | 'auto';
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search options...',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  id,
  maxMenuHeight = 260,
  placement = 'bottom',
}) => {
  const generatedId = useId();
  const dropdownId = id || generatedId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: maxMenuHeight,
    placement: 'bottom' as 'bottom' | 'top',
  });

  // Normalize options to DropdownOption objects
  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = useMemo(
    () => normalizedOptions.find((opt) => opt.value === value) || null,
    [normalizedOptions, value]
  );

  // Filtered options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.description?.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  // Position calculation with viewport boundary safety
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let computedPlacement: 'bottom' | 'top' = 'bottom';
    if (placement === 'top') {
      computedPlacement = 'top';
    } else if (placement === 'bottom') {
      computedPlacement = 'bottom';
    } else {
      // 'auto': Only open upward if space below is severely constrained (< 180) and space above is much larger
      const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
      computedPlacement = openUpward ? 'top' : 'bottom';
    }

    const availableWidth = window.innerWidth - 16;
    const width = Math.min(Math.max(rect.width, 220), availableWidth);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));

    const top = computedPlacement === 'top' ? rect.top - 6 : rect.bottom + 6;
    const calculatedMaxHeight =
      computedPlacement === 'top'
        ? Math.min(maxMenuHeight, Math.max(140, top - 16))
        : Math.min(maxMenuHeight, Math.max(140, window.innerHeight - top - 16));

    setMenuPosition({
      top,
      left,
      width,
      maxHeight: calculatedMaxHeight,
      placement: computedPlacement,
    });
  };

  // Sync highlighted index when filtered options change
  useEffect(() => {
    if (!isOpen) return;
    const selectedIdx = filteredOptions.findIndex((opt) => opt.value === value);
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [isOpen, filteredOptions, value]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    updatePosition();

    // Auto-focus search input if searchable
    if (searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev + 1 < filteredOptions.length ? prev + 1 : 0;
          return next;
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1;
          return next;
        });
        return;
      }

      if (e.key === 'Enter') {
        if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const targetOpt = filteredOptions[highlightedIndex];
          if (targetOpt && !targetOpt.disabled) {
            e.preventDefault();
            handleSelect(targetOpt.value);
          }
        }
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, searchable, filteredOptions, highlightedIndex]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      id={`${dropdownId}-listbox`}
      role="listbox"
      className={`fixed z-[120] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden no-print animate-in fade-in slide-in-from-top-1.5 duration-150 ease-out will-change-[transform,opacity] ${menuClassName}`}
      style={{
        transformOrigin: menuPosition.placement === 'top' ? 'bottom left' : 'top left',
        top: menuPosition.placement === 'top' ? undefined : `${menuPosition.top}px`,
        bottom: menuPosition.placement === 'top' ? `${window.innerHeight - menuPosition.top}px` : undefined,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`,
        maxHeight: `${menuPosition.maxHeight}px`,
      }}
    >
      {/* Optional Search Bar */}
      {searchable && (
        <div className="p-2 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-sans"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Options List */}
      <div ref={listRef} className="overflow-y-auto flex-1 overscroll-contain py-1">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-slate-400">
            No matching options found
          </div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300 font-medium'
                    : isHighlighted
                    ? 'bg-slate-800/90 text-white'
                    : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono">{opt.label}</span>
                    {opt.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                          opt.badgeColor || 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt.badge}
                      </span>
                    )}
                  </div>
                  {opt.description && (
                    <span className="block text-[11px] text-slate-400 truncate mt-0.5">
                      {opt.description}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  const defaultHeightClass = buttonClassName.includes('min-h-') ? '' : 'min-h-[44px]';

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={dropdownId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${dropdownId}-listbox`}
        onClick={() => {
          if (disabled) return;
          updatePosition();
          setIsOpen((prev) => !prev);
        }}
        className={`w-full px-3.5 py-2 bg-slate-950 border rounded-lg text-xs font-mono text-slate-100 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${defaultHeightClass} ${
          isOpen
            ? 'border-blue-500/80 ring-2 ring-blue-500/50 shadow-xs'
            : 'border-slate-800 hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
      >
        <div className="min-w-0 flex-1 flex items-center gap-2 truncate pointer-events-none">
          <span className={`truncate ${selectedOption ? 'text-slate-100' : 'text-slate-500'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold shrink-0 ${
                selectedOption.badgeColor || 'bg-slate-800 text-slate-400'
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 pointer-events-none ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
        />
      </button>

      {typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
};

export default CustomDropdown;
