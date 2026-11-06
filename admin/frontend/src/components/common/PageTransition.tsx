/**
 * Bharat Enterprise Billing System — Platform Control Plane Page Transition
 * GPU-accelerated page transition wrapper for router outlets and view switching.
 * Strictly uses snappy Y-glide and opacity transitions; forbids spring physics to prevent CLS.
 */

import React, { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

export interface PageTransitionProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: ReactNode;
  className?: string;
}

const PAGE_TRANSITION_VARIANTS = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.12,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
  style,
  ...rest
}) => {
  return (
    <motion.div
      variants={PAGE_TRANSITION_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        willChange: 'transform, opacity',
        ...style,
      }}
      className={`w-full min-w-0 ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
