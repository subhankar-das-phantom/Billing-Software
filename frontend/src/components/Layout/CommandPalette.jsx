import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getFilteredNavigation,
  QUICK_ACTIONS,
} from './navigationConfig';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = useAuth();

  // Filter accessible navigation items
  const accessibleNavigation = useMemo(() => {
    return getFilteredNavigation({ isAdmin, hasPermission });
  }, [isAdmin, hasPermission]);

  // Filter accessible quick actions
  const accessibleQuickActions = useMemo(() => {
    return QUICK_ACTIONS.filter((action) => {
      if (action.adminOnly && !isAdmin) return false;
      if (action.permission) {
        const { module, action: act } = action.permission;
        if (!isAdmin && (!hasPermission || !hasPermission(module, act))) return false;
      }
      return true;
    });
  }, [isAdmin, hasPermission]);

  // Flatten searchable items
  const allSearchableItems = useMemo(() => {
    const items = [];

    // Add quick actions first
    accessibleQuickActions.forEach((action) => {
      items.push({
        id: action.id,
        label: action.label,
        path: action.path,
        icon: action.icon,
        category: 'Quick Actions',
        keywords: action.keywords || [],
      });
    });

    // Add navigation items from each section
    accessibleNavigation.forEach((section) => {
      section.items.forEach((item) => {
        items.push({
          id: `nav-${item.id}`,
          label: item.label,
          path: item.path,
          icon: item.icon,
          category: section.title,
          badge: item.badge,
          keywords: [item.label.toLowerCase(), section.title.toLowerCase()],
        });
      });
    });

    return items;
  }, [accessibleQuickActions, accessibleNavigation]);

  // Filter items matching query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allSearchableItems;
    }

    const cleanQuery = query.toLowerCase().trim();
    return allSearchableItems.filter((item) => {
      const matchLabel = item.label.toLowerCase().includes(cleanQuery);
      const matchCategory = item.category.toLowerCase().includes(cleanQuery);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(cleanQuery));
      return matchLabel || matchCategory || matchKeywords;
    });
  }, [allSearchableItems, query]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleNavigate = useCallback((path) => {
    onClose();
    navigate(path);
  }, [navigate, onClose]);

  // Keyboard navigation inside palette
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredItems.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredItems.length - 1)));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleNavigate(filteredItems[selectedIndex].path);
        }
      }
    },
    [filteredItems, selectedIndex, handleNavigate, onClose]
  );

  // Auto-scroll to selected element
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 no-print">
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Dialog Card */}
          <motion.div
            className="relative w-full max-w-2xl bg-slate-900/95 border border-slate-700/70 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden z-10 flex flex-col max-h-[75vh]"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-700/60 gap-3 bg-slate-900/90">
              <Search className="w-5 h-5 text-blue-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command, page, or search query... (e.g., Invoices, Products)"
                className="w-full bg-transparent text-white placeholder-slate-400 text-base focus:outline-none"
                aria-label="Search navigation and commands"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded font-mono">
                  ESC
                </kbd>
              )}
            </div>

            {/* Results List */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[160px] max-h-[420px]"
            >
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-slate-500 mt-1">Try searching for pages like Invoices, Customers, or Products</p>
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      data-active={isSelected}
                      onClick={() => handleNavigate(item.path)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="truncate">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-xs text-slate-400 ml-2 font-normal">
                            in {item.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${item.badge.color || 'bg-blue-500/20 text-blue-300'}`}
                          >
                            {item.badge.text}
                          </span>
                        )}
                        {isSelected && (
                          <div className="flex items-center gap-1 text-xs text-blue-400">
                            <span className="hidden sm:inline">Go</span>
                            <CornerDownLeft size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Guide */}
            <div className="px-4 py-2.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono text-slate-300">↑</kbd>
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono text-slate-300">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono text-slate-300">↵</kbd>
                  to select
                </span>
              </div>
              <span className="text-slate-400">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-800 border border-slate-700 rounded font-mono text-slate-300">Esc</kbd> to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
