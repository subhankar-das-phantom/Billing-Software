import React, { useRef, useEffect } from 'react';
import { useMotionValue, useSpring, useInView, animate } from 'framer-motion';

export const AnimatedCounter = ({ value, duration = 1.5, decimals = 0, prefix = '', suffix = '', isMobile = false }) => {
  const ref = useRef(null);
  const motionValue = useMotionValue(0);
  
  // Faster animation on mobile for snappier feel
  const actualDuration = isMobile ? Math.min(duration * 0.4, 0.8) : duration;
  const springConfig = isMobile 
    ? { damping: 60, stiffness: 150 }  // Stiffer, less bouncy on mobile
    : { damping: 50, stiffness: 100 };
    
  const springValue = useSpring(motionValue, springConfig);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  useEffect(() => {
    if (isInView) {
      animate(motionValue, value, { 
        duration: actualDuration,
        ease: 'easeOut'
      });
    }
  }, [isInView, value, motionValue, actualDuration]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        const displayValue = typeof value === 'number' && value % 1 !== 0 
          ? latest.toFixed(decimals)
          : Math.round(latest).toLocaleString();
        ref.current.textContent = `${prefix}${displayValue}${suffix}`;
      }
    });
    return unsubscribe;
  }, [springValue, prefix, suffix, decimals, value]);

  return <span ref={ref} dangerouslySetInnerHTML={{ __html: `${prefix}0${suffix}` }} />;
};
