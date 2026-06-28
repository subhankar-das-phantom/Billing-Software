import { useLayoutEffect, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

const DEFAULT_OVERSCAN = 8;

function useScrollMargin() {
  const ref = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      if (!ref.current) return;
      setScrollMargin(ref.current.getBoundingClientRect().top + window.scrollY);
    };

    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);

    const resizeObserver = new ResizeObserver(updateScrollMargin);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('resize', updateScrollMargin);
      resizeObserver.disconnect();
    };
  }, []);

  return { ref, scrollMargin };
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
  const { ref, scrollMargin } = useScrollMargin();
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize,
    getItemKey: (index) => getKey(items[index], index),
    overscan,
    gap,
    scrollMargin
  });

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
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
  const { ref, scrollMargin } = useScrollMargin();
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize,
    getItemKey: (index) => getKey(items[index], index),
    overscan,
    gap,
    lanes,
    scrollMargin
  });

  const itemWidth = `calc((100% - ${(lanes - 1) * gap}px) / ${lanes})`;

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
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
