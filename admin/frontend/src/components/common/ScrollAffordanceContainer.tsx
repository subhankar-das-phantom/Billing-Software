/**
 * Bharat Enterprise Billing System — Platform Control Plane
 * ScrollAffordanceContainer
 *
 * Horizontal scroll wrapper for filter capsules/pills.
 * Dynamically detects overflow with ResizeObserver, renders pointer-safe edge
 * gradient fades, and provides smooth scroll affordance with slide chevrons.
 */

import React, { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollAffordanceContainerProps {
  children: ReactNode;
  className?: string;
  scrollStep?: number;
}

export const ScrollAffordanceContainer: React.FC<ScrollAffordanceContainerProps> = ({
  children,
  className = '',
  scrollStep = 180,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScrollability();

    const resizeObserver = new ResizeObserver(() => {
      checkScrollability();
    });
    resizeObserver.observe(el);

    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);

    return () => {
      resizeObserver.disconnect();
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability]);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -scrollStep : scrollStep;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className={`relative flex items-center group ${className}`}>
      {/* Left Chevron Slide Button (Desktop / Hover) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className="hidden sm:flex absolute left-0 z-10 w-7 h-7 -ml-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white items-center justify-center shadow-lg shadow-black/60 transition-opacity cursor-pointer"
          aria-label="Scroll options left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Left Edge Gradient Fade Mask (strictly pointer-events-none) */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-[5]" />
      )}

      {/* Horizontal Scroll Track */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth w-full overscroll-x-contain py-1"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>

      {/* Right Edge Gradient Fade Mask (strictly pointer-events-none) */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-[5]" />
      )}

      {/* Right Chevron Slide Button (Desktop / Hover) */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className="hidden sm:flex absolute right-0 z-10 w-7 h-7 -mr-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white items-center justify-center shadow-lg shadow-black/60 transition-opacity cursor-pointer"
          aria-label="Scroll options right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default ScrollAffordanceContainer;

