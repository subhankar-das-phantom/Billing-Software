import { useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { findScrollParent } from '../../utils/scrollUtils';

const DEFAULT_OVERSCAN = 10;

function useScrollParentAndMargin() {
  const ref = useRef(null);
  const scrollParentRef = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const getScrollElement = useCallback(() => {
    if (scrollParentRef.current) return scrollParentRef.current;
    if (ref.current) {
      scrollParentRef.current = findScrollParent(ref.current);
      return scrollParentRef.current;
    }
    return typeof document !== 'undefined' ? document.querySelector('main') || document.documentElement : null;
  }, []);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const parent = findScrollParent(ref.current);
    scrollParentRef.current = parent;

    const updateScrollMargin = () => {
      if (!ref.current) return;
      const scrollEl = scrollParentRef.current || document.querySelector('main') || document.documentElement;
      let newMargin = 0;
      if (scrollEl && scrollEl !== document.documentElement && scrollEl !== document.body && scrollEl !== window) {
        const parentRect = scrollEl.getBoundingClientRect();
        const elemRect = ref.current.getBoundingClientRect();
        const margin = Math.round(elemRect.top - parentRect.top + scrollEl.scrollTop);
        newMargin = margin >= 0 ? margin : 0;
      } else {
        newMargin = Math.round(ref.current.getBoundingClientRect().top + window.scrollY);
      }
      setScrollMargin(prev => (Math.abs(prev - newMargin) >= 4 ? newMargin : prev));
    };

    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);

    const resizeObserver = new ResizeObserver(updateScrollMargin);
    if (parent && parent !== document.documentElement && parent !== document.body && parent !== window) {
      resizeObserver.observe(parent);
    } else if (document.body) {
      resizeObserver.observe(document.body);
    }

    return () => {
      window.removeEventListener('resize', updateScrollMargin);
      resizeObserver.disconnect();
    };
  }, []);

  return { ref, getScrollElement, scrollMargin };
}

export function VirtualizedList({
  items,
  estimateSize,
  renderItem,
  getKey = (item, index) => item?._id ?? index,
  overscan = DEFAULT_OVERSCAN,
  gap = 0,
  className = '',
  itemClassName = '',
  itemStyle
}) {
  const { ref, getScrollElement, scrollMargin } = useScrollParentAndMargin();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize,
    getItemKey: (index) => getKey(items[index], index),
    overscan,
    gap,
    scrollMargin
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [items.length]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];
        const resolvedClassName = typeof itemClassName === 'function'
          ? itemClassName(item, virtualItem.index)
          : itemClassName;

        return (
          <div
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            className={resolvedClassName}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
              ...itemStyle?.(item, virtualItem)
            }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
}

export function VirtualizedGrid({
  items,
  estimateSize,
  renderItem,
  lanes,
  getKey = (item, index) => item?._id ?? index,
  overscan = DEFAULT_OVERSCAN,
  gap = 16,
  className = '',
  itemClassName = ''
}) {
  const { ref, getScrollElement, scrollMargin } = useScrollParentAndMargin();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize,
    getItemKey: (index) => getKey(items[index], index),
    overscan,
    gap,
    lanes,
    scrollMargin
  });

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [items.length]);

  const itemWidth = `calc((100% - ${(lanes - 1) * gap}px) / ${lanes})`;

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const item = items[virtualItem.index];

        return (
          <div
            key={virtualItem.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            className={itemClassName}
            style={{
              position: 'absolute',
              top: 0,
              left: `calc(${(virtualItem.lane * 100) / lanes}% + ${(virtualItem.lane * gap) / lanes}px)`,
              width: itemWidth,
              transform: `translateY(${virtualItem.start - scrollMargin}px)`
            }}
          >
            {renderItem(item, virtualItem.index)}
          </div>
        );
      })}
    </div>
  );
}
