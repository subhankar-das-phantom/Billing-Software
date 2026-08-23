import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const normalizeGroups = (groups) => {
  if (!Array.isArray(groups) || groups.length === 0) return [];

  if (groups.some(group => Array.isArray(group?.options))) {
    return groups
      .map(group => ({
        label: group.label || '',
        options: Array.isArray(group.options) ? group.options : []
      }))
      .filter(group => group.options.length > 0);
  }

  return [{ label: '', options: groups }];
};

export default function CustomDropdown({
  value,
  onChange,
  groups = [],
  placeholder = 'Choose...',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  renderOption,
  renderValue,
  ariaLabel
}) {
  const dropdownId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeValue, setActiveValue] = useState(value || '');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 });

  const normalizedGroups = useMemo(() => normalizeGroups(groups), [groups]);
  const flatOptions = useMemo(
    () => normalizedGroups.flatMap(group => group.options),
    [normalizedGroups]
  );
  const selectedOption = flatOptions.find(option => option.value === value) || null;
  const enabledOptions = useMemo(
    () => flatOptions.filter(option => !option.disabled),
    [flatOptions]
  );

  const updateMenuPosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updateMenuPosition();
    setActiveValue(value || enabledOptions[0]?.value || '');

    const handlePointerDown = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, value, enabledOptions]);

  const selectOption = (option) => {
    if (!option || option.disabled) return;
    onChange?.(option.value, option);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction) => {
    if (enabledOptions.length === 0) return;

    const currentIndex = enabledOptions.findIndex(option => option.value === activeValue);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
    setActiveValue(enabledOptions[nextIndex].value);
  };

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const option = enabledOptions.find(item => item.value === activeValue);
      selectOption(option);
    }
  };

  const menu = isOpen ? (
    <div
      ref={menuRef}
      id={`${dropdownId}-listbox`}
      role="listbox"
      className={`fixed z-[120] max-h-72 overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-2xl shadow-black/30 py-1 ${menuClassName}`}
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        width: `${menuPosition.width}px`
      }}
    >
      {normalizedGroups.length === 0 ? (
        <div className="px-4 py-3 text-sm text-slate-400">No options</div>
      ) : (
        normalizedGroups.map((group, groupIndex) => (
          <div key={`${group.label || 'group'}-${groupIndex}`}>
            {group.label && (
              <div className="px-3 py-2 text-[11px] font-semibold uppercase text-slate-500 tracking-wide">
                {group.label}
              </div>
            )}
            {group.options.map(option => {
              const isSelected = option.value === value;
              const isActive = option.value === activeValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveValue(option.value)}
                  onClick={() => selectOption(option)}
                  className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center justify-between gap-3 ${
                    isActive ? 'bg-slate-700/80 text-white' : 'text-slate-200 hover:bg-slate-700/60'
                  } ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    {renderOption ? renderOption(option) : (
                      <span className="block truncate">{option.label}</span>
                    )}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${dropdownId}-listbox`}
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          updateMenuPosition();
          setIsOpen(prev => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 hover:border-slate-500 transition-colors flex items-center justify-between gap-3 text-left disabled:opacity-60 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <span className={`min-w-0 flex-1 ${selectedOption ? 'text-white' : 'text-slate-400'}`}>
          {selectedOption
            ? (renderValue ? renderValue(selectedOption) : <span className="block truncate">{selectedOption.label}</span>)
            : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {typeof document !== 'undefined' ? createPortal(menu, document.body) : null}
    </div>
  );
}
