/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * useKeyboardShortcuts Hook & Priority Escape Stack
 *
 * Centralized keyboard shortcut dispatcher with an isInputElement guard.
 * Listens for:
 *   - Ctrl+K / Cmd+K (Command Palette)
 *   - Ctrl+B / Cmd+B (Desktop Sidebar Collapse)
 *   - / (Quick Search, disarmed inside text inputs)
 *   - Escape (Coordinated priority stack: Search Input -> Modals -> Command Palette -> Menus -> Drawer)
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Checks whether an event target is an active editable input element.
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export type EscapeHandler = () => boolean | void;

interface EscapeEntry {
  id: string;
  priority: number;
  handler: EscapeHandler;
}

// Global ordered escape stack (higher priority runs first)
const escapeStack: EscapeEntry[] = [];

/**
 * Register a prioritized Escape key handler.
 * Returning `true` from the handler signals the event was handled and stops propagation.
 *
 * Suggested Priority Levels:
 *   50: Active Search Input Clear
 *   40: Active Modal / Alert Dialog
 *   30: Command Palette
 *   20: Dropdown Menus / Popovers
 *   10: Mobile Navigation Drawer
 */
export function registerEscapeHandler(priority: number, handler: EscapeHandler): () => void {
  const entry: EscapeEntry = {
    id: `esc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    priority,
    handler,
  };

  escapeStack.push(entry);
  // Sort descending by priority
  escapeStack.sort((a, b) => b.priority - a.priority);

  return () => {
    const idx = escapeStack.findIndex((e) => e.id === entry.id);
    if (idx !== -1) {
      escapeStack.splice(idx, 1);
    }
  };
}

export interface KeyboardShortcutHandlers {
  onOpenCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onQuickSearch?: () => void;
  onEscape?: () => boolean | void;
  escapePriority?: number;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onOpenCommandPalette,
  onToggleSidebar,
  onQuickSearch,
  onEscape,
  escapePriority = 0,
  enabled = true,
}: KeyboardShortcutHandlers): void {
  const handlersRef = useRef({
    onOpenCommandPalette,
    onToggleSidebar,
    onQuickSearch,
    onEscape,
  });

  useEffect(() => {
    handlersRef.current = {
      onOpenCommandPalette,
      onToggleSidebar,
      onQuickSearch,
      onEscape,
    };
  });

  // Register optional onEscape into the priority stack
  useEffect(() => {
    if (!enabled || !onEscape) return;

    const unregister = registerEscapeHandler(escapePriority, () => {
      return handlersRef.current.onEscape?.();
    });

    return unregister;
  }, [enabled, onEscape, escapePriority]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const isModifier = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const inInput = isInputElement(e.target);

      // 1. Ctrl+K / Cmd+K — Global Command Palette (accessible everywhere, including inputs)
      if (isModifier && key === 'k') {
        if (handlersRef.current.onOpenCommandPalette) {
          e.preventDefault();
          e.stopPropagation();
          handlersRef.current.onOpenCommandPalette();
          return;
        }
      }

      // 2. Ctrl+B / Cmd+B — Toggle Desktop Sidebar
      if (isModifier && key === 'b') {
        if (handlersRef.current.onToggleSidebar) {
          e.preventDefault();
          e.stopPropagation();
          handlersRef.current.onToggleSidebar();
          return;
        }
      }

      // 3. / (Quick Search) — MUST be guarded against typing in text inputs
      if (e.key === '/' && !isModifier && !inInput) {
        if (handlersRef.current.onQuickSearch) {
          e.preventDefault();
          e.stopPropagation();
          handlersRef.current.onQuickSearch();
          return;
        }
      }

      // 4. Escape Key — Dispatch through prioritized escape stack
      if (e.key === 'Escape') {
        for (const entry of escapeStack) {
          try {
            const handled = entry.handler();
            // If handler explicitly returned true, consider event consumed
            if (handled === true) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          } catch (err) {
            console.error('Error in Escape handler:', err);
          }
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useKeyboardShortcuts;
