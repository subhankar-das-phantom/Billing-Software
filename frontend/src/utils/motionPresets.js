/**
 * Motion presets for desktop and mobile devices.
 * Provides consistent animation configurations throughout the app.
 */

// ============================================
// TRANSITION PRESETS
// ============================================

export const transitions = {
  // Desktop transitions (richer, longer)
  desktop: {
    default: { type: 'spring', stiffness: 300, damping: 24 },
    fast: { type: 'spring', stiffness: 400, damping: 30 },
    slow: { type: 'tween', duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] },
    page: { type: 'tween', duration: 0.5, ease: [0.43, 0.13, 0.23, 0.96] },
    spring: { type: 'spring', stiffness: 300, damping: 24 },
    bouncy: { type: 'spring', stiffness: 200, damping: 15 },
  },
  
  // Mobile transitions (snappier, efficient)
  mobile: {
    default: { type: 'tween', duration: 0.25, ease: 'easeOut' },
    fast: { type: 'tween', duration: 0.15, ease: 'easeOut' },
    slow: { type: 'tween', duration: 0.35, ease: 'easeOut' },
    page: { type: 'tween', duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
    spring: { type: 'spring', stiffness: 400, damping: 35 },
    bouncy: { type: 'spring', stiffness: 350, damping: 28 },
  },
  
  // Reduced motion (minimal animations)
  reduced: {
    default: { duration: 0.1 },
    fast: { duration: 0.05 },
    slow: { duration: 0.15 },
    page: { duration: 0.1 },
    spring: { duration: 0.1 },
    bouncy: { duration: 0.1 },
  },
};

// ============================================
// HOVER PRESETS (Desktop only)
// ============================================

export const hoverPresets = {
  // Card lift effect
  lift: {
    y: -6,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  
  // Subtle scale
  scale: {
    scale: 1.02,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  
  // Button press
  button: {
    scale: 1.05,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
  
  // Icon highlight
  icon: {
    scale: 1.1,
    transition: { duration: 0.2 },
  },
  
  // Card with glow (uses opacity instead of box-shadow for GPU)
  glow: {
    y: -4,
    scale: 1.01,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  
  // None (for mobile/touch)
  none: undefined,
};

// ============================================
// TAP PRESETS
// ============================================

export const tapPresets = {
  // Standard button tap
  button: {
    scale: 0.97,
    transition: { duration: 0.1 },
  },
  
  // Card tap
  card: {
    scale: 0.99,
    transition: { duration: 0.1 },
  },
  
  // Icon tap
  icon: {
    scale: 0.9,
    transition: { duration: 0.1 },
  },
  
  // None
  none: undefined,
};

// ============================================
// COUNTER ANIMATION PRESETS
// ============================================

export const counterPresets = {
  desktop: {
    duration: 2,
    spring: { damping: 50, stiffness: 100 },
  },
  mobile: {
    duration: 0.8,
    spring: { damping: 60, stiffness: 150 },
  },
  reduced: {
    duration: 0,
    spring: { damping: 100, stiffness: 200 },
  },
};

// ============================================
// STAGGER PRESETS
// ============================================

export const staggerPresets = {
  desktop: {
    list: 0.08,
    cards: 0.1,
    table: 0.03,
    form: 0.05,
  },
  mobile: {
    list: 0,
    cards: 0,
    table: 0,
    form: 0,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get transition preset based on device type
 * @param {boolean} isMobile - Is mobile device
 * @param {boolean} reducedMotion - Prefers reduced motion
 * @returns {object} Transition preset object
 */
export const getTransitionPreset = (isMobile, reducedMotion = false) => {
  if (reducedMotion) return transitions.reduced;
  return isMobile ? transitions.mobile : transitions.desktop;
};

/**
 * Get hover preset (returns undefined for mobile/touch)
 * @param {string} type - Preset type: 'lift', 'scale', 'button', 'icon', 'glow'
 * @param {boolean} shouldHover - Should enable hover (false for mobile)
 */
export const getHoverPreset = (type = 'lift', shouldHover = true) => {
  if (!shouldHover) return undefined;
  return hoverPresets[type] || hoverPresets.lift;
};

/**
 * Get tap preset
 * @param {string} type - Preset type: 'button', 'card', 'icon'
 */
export const getTapPreset = (type = 'button') => {
  return tapPresets[type] || tapPresets.button;
};

/**
 * Get stagger value based on device
 * @param {string} type - Stagger type: 'list', 'cards', 'table', 'form'
 * @param {boolean} shouldStagger - Should enable stagger (false for mobile)
 */
export const getStagger = (type = 'list', shouldStagger = true) => {
  if (!shouldStagger) return 0;
  return staggerPresets.desktop[type] || 0.08;
};
