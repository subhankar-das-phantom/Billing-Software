export const CALCULATOR_STORAGE_KEY = 'bharat-enterprise-calculator';

const DOCKED_SIDES = new Set(['left', 'right', 'bottom']);

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getResponsiveSize(viewportWidth) {
  if (viewportWidth < 640) return { width: 240, height: 320 };
  if (viewportWidth < 1024) return { width: 280, height: 380 };
  return { width: 320, height: 420 };
}

export function getDefaultCalculatorStorage() {
  const viewport = getViewport();
  const responsiveSize = getResponsiveSize(viewport.width);
  const width = Math.min(responsiveSize.width, viewport.width * 0.8);
  const height = Math.min(responsiveSize.height, viewport.height * 0.7);

  return {
    x: Math.max(12, viewport.width - width - 12),
    y: Math.max(80, (viewport.height - height) / 2),
    minimized: false,
    dockedSide: 'right',
    width,
    height,
    expression: '',
    history: [],
  };
}

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && typeof item.expression === 'string' && typeof item.result === 'string')
    .slice(0, 10)
    .map(({ expression, result }) => ({
      expression: expression.slice(0, 100),
      result: result.slice(0, 100),
    }));
}

export function loadCalculatorStorage() {
  const defaults = getDefaultCalculatorStorage();

  if (typeof window === 'undefined') return defaults;

  try {
    const stored = JSON.parse(window.localStorage.getItem(CALCULATOR_STORAGE_KEY));
    if (!stored || typeof stored !== 'object') return defaults;

    return {
      ...defaults,
      x: finiteNumber(stored.x, defaults.x),
      y: finiteNumber(stored.y, defaults.y),
      minimized: typeof stored.minimized === 'boolean' ? stored.minimized : defaults.minimized,
      dockedSide: DOCKED_SIDES.has(stored.dockedSide) ? stored.dockedSide : defaults.dockedSide,
      width: finiteNumber(stored.width, defaults.width),
      height: finiteNumber(stored.height, defaults.height),
      expression: typeof stored.expression === 'string' ? stored.expression.slice(0, 100) : '',
      history: sanitizeHistory(stored.history),
    };
  } catch {
    return defaults;
  }
}

export function saveCalculatorStorage(partialState) {
  if (typeof window === 'undefined') return;

  try {
    const current = loadCalculatorStorage();
    window.localStorage.setItem(
      CALCULATOR_STORAGE_KEY,
      JSON.stringify({ ...current, ...partialState }),
    );
  } catch {
    // localStorage may be unavailable in private or restricted browser contexts.
  }
}
