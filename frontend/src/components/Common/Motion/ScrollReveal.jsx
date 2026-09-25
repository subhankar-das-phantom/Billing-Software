import { motion } from 'framer-motion';
import { useMotionConfig, useDeviceType } from '../../../hooks';

/**
 * Performance-optimized enterprise scroll reveal component.
 *
 * Architecture & Performance Rules:
 * 1. Mobile & Touch: Bypasses Framer Motion entirely, rendering a vanilla <div>
 *    with 0ms animation overhead to guarantee 60fps/120fps touch scrolling.
 * 2. Accessibility: If prefers-reduced-motion is true, renders static <div>.
 * 3. Low-End Hardware: If isLowPerformance is true, eliminates stagger delays
 *    and uses fast duration.
 * 4. Desktop: Smooth hardware-accelerated GPU translation (transform + opacity only).
 */
export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
  y = 20,
  duration,
  once = true,
  amount = 0.15,
}) {
  const { isMobile, isTouchDevice } = useDeviceType();
  const { shouldAnimate, isLowPerformance, duration: configDuration } = useMotionConfig();

  // Strict mobile/touch/reduced-motion bypass: static zero-overhead div
  if (isMobile || isTouchDevice || !shouldAnimate) {
    return <div className={className}>{children}</div>;
  }

  const animDuration = duration ?? (isLowPerformance ? configDuration.fast : 0.5);
  const animDelay = isLowPerformance ? 0 : delay;

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px', amount }}
      transition={{
        duration: animDuration,
        delay: animDelay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`will-change-[transform,opacity] ${className}`}
    >
      {children}
    </motion.div>
  );
}
