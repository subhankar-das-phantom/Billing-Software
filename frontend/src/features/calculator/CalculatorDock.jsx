import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';

const SIDE_PILL_WIDTH = 44;
const BOTTOM_PILL_WIDTH = 120;
const PILL_HEIGHT = 48;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function getHeaderOffset(viewportWidth) {
  return viewportWidth >= 1024 ? 88 : 72;
}

function getDockPosition(dockedSide, geometry, viewport) {
  const width = dockedSide === 'bottom' ? BOTTOM_PILL_WIDTH : SIDE_PILL_WIDTH;
  const minimumY = getHeaderOffset(viewport.width);
  const centerX = geometry.x + (geometry.width / 2);
  const centerY = geometry.y + (geometry.height / 2);

  if (dockedSide === 'left') {
    return {
      x: 0,
      y: clamp(centerY - (PILL_HEIGHT / 2), minimumY, viewport.height - PILL_HEIGHT),
      width,
    };
  }

  if (dockedSide === 'bottom') {
    return {
      x: clamp(centerX - (width / 2), 0, viewport.width - width),
      y: viewport.height - PILL_HEIGHT,
      width,
    };
  }

  return {
    x: viewport.width - width,
    y: clamp(centerY - (PILL_HEIGHT / 2), minimumY, viewport.height - PILL_HEIGHT),
    width,
  };
}

export default function CalculatorDock({ dockedSide, geometry, onDock, onRestore }) {
  const buttonRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [viewport, setViewport] = useState(getViewport);
  const [isDragging, setIsDragging] = useState(false);
  const position = useMemo(
    () => getDockPosition(dockedSide, geometry, viewport),
    [dockedSide, geometry, viewport],
  );

  useEffect(() => {
    const handleResize = () => setViewport(getViewport());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      position,
      latest: position,
      moved: false,
    };
    suppressClickRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 4) drag.moved = true;

    const minimumY = getHeaderOffset(viewport.width);
    const next = {
      ...drag.position,
      x: clamp(drag.position.x + deltaX, 0, viewport.width - drag.position.width),
      y: clamp(drag.position.y + deltaY, minimumY, viewport.height - PILL_HEIGHT),
    };
    drag.latest = next;

    if (buttonRef.current) {
      buttonRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    }
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      const distances = {
        left: drag.latest.x,
        right: viewport.width - drag.latest.x - drag.latest.width,
        bottom: viewport.height - drag.latest.y - PILL_HEIGHT,
      };
      const nextSide = Object.entries(distances).sort(([, first], [, second]) => first - second)[0][0];
      onDock({
        dockedSide: nextSide,
        centerX: drag.latest.x + (drag.latest.width / 2),
        centerY: drag.latest.y + (PILL_HEIGHT / 2),
      });
      suppressClickRef.current = true;
    }

    dragRef.current = null;
    setIsDragging(false);
  };

  const handleClick = (event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
      return;
    }
    onRestore();
  };

  const shapeClasses = {
    left: 'rounded-l-none',
    right: 'rounded-r-none',
    bottom: 'rounded-b-none',
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`no-print fixed left-0 top-0 z-[45] flex h-12 touch-none items-center justify-center gap-2 border border-blue-400/30 bg-slate-900/95 px-3 py-2 text-blue-200 shadow-2xl shadow-black/40 backdrop-blur-xl hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        isDragging ? 'cursor-grabbing select-none' : 'cursor-grab transition-[background-color,transform] duration-200'
      } ${
        shapeClasses[dockedSide] || shapeClasses.right
      }`}
      style={{
        width: position.width,
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      aria-label="Drag minimized calculator or activate to restore"
      title="Drag to move · Tap to restore"
    >
      <Calculator className="h-5 w-5" />
      {dockedSide === 'bottom' && <span className="text-sm font-medium">Calculator</span>}
    </button>
  );
}
