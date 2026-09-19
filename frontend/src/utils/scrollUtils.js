/**
 * Bharat Enterprise Billing System — Scroll & Virtualization Utilities
 * Shared utilities for finding scroll parents, infinite scroll thresholds, and root margin constants.
 */

export const INFINITE_SCROLL_ROOT_MARGIN = '250px';
export const INFINITE_SCROLL_THRESHOLD = 0;

/**
 * Resolves the genuine vertical scroll container for virtualization and infinite scroll observers.
 * Bypasses explicit horizontal table wrappers that compute overflow-y: auto under CSS3 specs.
 * Guarantees that genuinely scrollable vertical modals always take precedence over <main>.
 *
 * @param {HTMLElement|null} node - The element whose vertical scroll parent needs to be resolved.
 * @returns {HTMLElement|null} The resolved vertical scroll container element or fallback.
 */
export function findScrollParent(node) {
  if (!node || typeof window === 'undefined') return null;

  let parent = node.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;

    // 1. Candidate check: vertical scroll intent ('auto' or 'scroll') AND actual vertical scrollability
    const hasScrollIntentY = overflowY === 'auto' || overflowY === 'scroll';
    const hasVerticalOverflow = parent.scrollHeight > parent.clientHeight;

    if (hasScrollIntentY && hasVerticalOverflow) {
      // 2. Semantic exclusion: Detect explicit horizontal table scroll containers.
      // Under CSS3 spec 11.1.1, overflow-x: auto forces overflow-y to compute as 'auto'.
      // Containers marked with [data-horizontal-table-scroll] are purely horizontal wrappers
      // and must be bypassed so traversal finds genuine vertical containers or <main>.
      // Genuinely scrollable vertical modals (even if they contain tables or min-w children)
      // do NOT have this attribute and are immediately returned as the scroll parent!
      const isHorizontalTableWrapper = parent.hasAttribute('data-horizontal-table-scroll');

      if (!isHorizontalTableWrapper) {
        // Genuine vertical container (e.g. nested modal, sheet, or custom vertical viewport)
        return parent;
      }
    }

    // 3. Direct recognition of <main> as the primary scroll container of the dashboard shell
    if (parent.tagName.toLowerCase() === 'main') {
      return parent;
    }

    parent = parent.parentElement;
  }

  // Fallback: Dashboard <main> element, or documentElement
  return document.querySelector('main') || (typeof document !== 'undefined' ? document.documentElement : null);
}
