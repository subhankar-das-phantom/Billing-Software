/**
 * Bharat Enterprise Billing System — SearchInput Component
 * Universal 300ms debounced search bar with instant clear (X) affordance.
 * Decouples immediate local input state from debounced callback to prevent focus loss & cursor jumping.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value?: string;
  onChange: (debouncedValue: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value: controlledValue = '',
  onChange,
  placeholder = 'Search by name, email, phone, ID...',
  debounceMs = 300,
  className = '',
  autoFocus = false,
}) => {
  const [localValue, setLocalValue] = useState<string>(controlledValue);
  const lastSyncedValueRef = useRef<string>(controlledValue);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize from parent only if incoming controlledValue diverged externally
  useEffect(() => {
    if (controlledValue !== lastSyncedValueRef.current) {
      setLocalValue(controlledValue);
      lastSyncedValueRef.current = controlledValue;
    }
  }, [controlledValue]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerDebouncedChange = useCallback(
    (newValue: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        lastSyncedValueRef.current = newValue;
        onChange(newValue);
      }, debounceMs);
    },
    [debounceMs, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    triggerDebouncedChange(val);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setLocalValue('');
    lastSyncedValueRef.current = '';
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div className={`relative flex items-center w-full max-w-md ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={localValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/50 transition-all font-sans"
      />
      {localValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Clear search (Esc)"
          aria-label="Clear search input"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
