import { useCallback, useEffect, useRef, useState } from 'react';

const EDGE_GAP = 12;

function viewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function headerOffset(viewportWidth) {
  return viewportWidth >= 1024 ? 88 : 72;
}

function sizeBounds() {
  const viewport = viewportSize();
  const maxWidth = viewport.width * 0.8;
  const maxHeight = Math.min(
    viewport.height * 0.7,
    viewport.height - headerOffset(viewport.width) - EDGE_GAP,
  );

  return {
    minWidth: Math.min(220, Math.max(1, maxWidth)),
    minHeight: Math.min(320, Math.max(1, maxHeight)),
    maxWidth: Math.max(1, maxWidth),
    maxHeight: Math.max(1, maxHeight),
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function constrainGeometry(geometry) {
  const viewport = viewportSize();
  const bounds = sizeBounds();
  const width = clamp(geometry.width, bounds.minWidth, bounds.maxWidth);
  const height = clamp(geometry.height, bounds.minHeight, bounds.maxHeight);
  const minY = headerOffset(viewport.width);
  const maxX = Math.max(EDGE_GAP, viewport.width - width - EDGE_GAP);
  const maxY = Math.max(minY, viewport.height - height - EDGE_GAP);

  let x = clamp(geometry.x, EDGE_GAP, maxX);
  let y = clamp(geometry.y, minY, maxY);

  if (geometry.dockedSide === 'left') x = EDGE_GAP;
  if (geometry.dockedSide === 'right') x = maxX;
  if (geometry.dockedSide === 'bottom') y = maxY;

  return { ...geometry, x, y, width, height };
}

function nearestDock(geometry) {
  const viewport = viewportSize();
  const distances = {
    left: geometry.x,
    right: viewport.width - geometry.x - geometry.width,
    bottom: viewport.height - geometry.y - geometry.height,
  };
  const dockedSide = Object.entries(distances).sort(([, first], [, second]) => first - second)[0][0];

  return constrainGeometry({ ...geometry, dockedSide });
}

function applyElementGeometry(element, geometry) {
  if (!element) return;
  element.style.width = `${geometry.width}px`;
  element.style.height = `${geometry.height}px`;
  element.style.transform = `translate3d(${geometry.x}px, ${geometry.y}px, 0)`;
}

export function useDocking(widgetRef, geometry, setGeometry) {
  const interactionRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const handleViewportResize = () => {
      setGeometry((current) => constrainGeometry(current));
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [setGeometry]);

  const beginDrag = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: 'drag',
      startX: event.clientX,
      startY: event.clientY,
      geometry,
      latest: geometry,
    };
    setIsInteracting(true);
  }, [geometry]);

  const beginResize = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      geometry,
      latest: geometry,
      horizontalDirection: ['right', 'bottom'].includes(geometry.dockedSide) ? -1 : 1,
      verticalDirection: geometry.dockedSide === 'bottom' ? -1 : 1,
      anchorRight: geometry.dockedSide === 'bottom',
    };
    setIsInteracting(true);
  }, [geometry]);

  const moveInteraction = useCallback((event) => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    let next;

    if (interaction.type === 'drag') {
      next = constrainGeometry({
        ...interaction.geometry,
        x: interaction.geometry.x + deltaX,
        y: interaction.geometry.y + deltaY,
        dockedSide: null,
      });
    } else {
      const bounds = sizeBounds();
      const width = clamp(
        interaction.geometry.width + (deltaX * interaction.horizontalDirection),
        bounds.minWidth,
        bounds.maxWidth,
      );
      const height = clamp(
        interaction.geometry.height + (deltaY * interaction.verticalDirection),
        bounds.minHeight,
        bounds.maxHeight,
      );
      next = constrainGeometry({
        ...interaction.geometry,
        x: interaction.anchorRight
          ? interaction.geometry.x + interaction.geometry.width - width
          : interaction.geometry.x,
        width,
        height,
      });
    }

    interaction.latest = next;
    applyElementGeometry(widgetRef.current, next);
  }, [widgetRef]);

  const endInteraction = useCallback((event) => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const next = interaction.type === 'drag' ? nearestDock(interaction.latest) : interaction.latest;
    interactionRef.current = null;
    setGeometry(next);
    setIsInteracting(false);
  }, [setGeometry]);

  return {
    isInteracting,
    dragHandlers: {
      onPointerDown: beginDrag,
      onPointerMove: moveInteraction,
      onPointerUp: endInteraction,
      onPointerCancel: endInteraction,
    },
    resizeHandlers: {
      onPointerDown: beginResize,
      onPointerMove: moveInteraction,
      onPointerUp: endInteraction,
      onPointerCancel: endInteraction,
    },
  };
}
