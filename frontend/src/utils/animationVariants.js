/**
 * Centralized animation variants for the application.
 * All variants use GPU-friendly properties (opacity, transform) only.
 */

// ============================================
// FADE VARIANTS
// ============================================

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

// ============================================
// SLIDE VARIANTS
// ============================================

export const slideInLeft = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// ============================================
// SCALE VARIANTS
// ============================================

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const scaleInBounce = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

// ============================================
// CONTAINER VARIANTS (for staggered children)
// ============================================

/**
 * Creates container variants with configurable stagger.
 * @param {number} stagger - Delay between children (0 for mobile)
 * @param {number} delayChildren - Initial delay before starting
 */
export const createContainerVariants = (stagger = 0.08, delayChildren = 0.1) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: stagger,
      delayChildren,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
});

// Pre-built container variants
export const containerVariantsDesktop = createContainerVariants(0.08, 0.1);
export const containerVariantsMobile = createContainerVariants(0, 0); // No stagger on mobile

// ============================================
// ITEM/CARD VARIANTS
// ============================================

export const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: { opacity: 0, y: -10 },
};

export const listItemVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

export const tableRowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

// ============================================
// PAGE TRANSITION VARIANTS
// ============================================

export const pageVariants = {
  fadeUp: {
    initial: { opacity: 0, y: 15 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -10 },
  },
  fade: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  slideRight: {
    initial: { opacity: 0, x: -30 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: 30 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.97 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.02 },
  },
};

// Mobile-specific page variants (simpler, faster)
export const pageVariantsMobile = {
  fadeUp: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  fade: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  slideRight: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  scale: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
};

// ============================================
// MODAL VARIANTS
// ============================================

export const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
};

// ============================================
// SIDEBAR/MENU VARIANTS
// ============================================

export const sidebarVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: '-100%', opacity: 0 },
};

export const menuItemVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -15, opacity: 0 },
};
