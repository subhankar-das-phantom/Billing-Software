import { useCallback, useEffect, useRef, useState } from 'react';
import { Calculator, GripHorizontal, History, Minus, MoveDiagonal2, Trash2 } from 'lucide-react';
import CalculatorButtons from './CalculatorButtons';
import CalculatorDisplay from './CalculatorDisplay';
import CalculatorDock from './CalculatorDock';
import { constrainGeometry, useDocking } from './useDocking';
import { useCalculatorState } from './useCalculatorState';
import { loadCalculatorStorage, saveCalculatorStorage } from './calculatorStorage';

const initialStorage = loadCalculatorStorage();

function isEditableTarget(target) {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

function readableExpression(expression) {
  return expression.replace(/([+×÷])/g, ' $1 ').replace(/-/g, ' − ').replace(/\s+/g, ' ').trim();
}

export default function CalculatorWidget() {
  const widgetRef = useRef(null);
  const [geometry, setGeometry] = useState(() => constrainGeometry(initialStorage));
  const [showHistory, setShowHistory] = useState(false);
  const calculator = useCalculatorState(initialStorage.expression, initialStorage.history);
  const { isInteracting, dragHandlers, resizeHandlers } = useDocking(widgetRef, geometry, setGeometry);

  useEffect(() => {
    saveCalculatorStorage({
      x: geometry.x,
      y: geometry.y,
      minimized: geometry.minimized,
      dockedSide: geometry.dockedSide,
      width: geometry.width,
      height: geometry.height,
    });
  }, [geometry]);

  const handleInput = useCallback((value) => {
    if (/^\d$/.test(value) || value === '.') calculator.inputDigit(value);
    else if (['+', '-', '×', '÷'].includes(value)) calculator.inputOperator(value);
    else if (value === 'percent') calculator.inputPercent();
    else if (value === 'clear') calculator.clear();
    else if (value === 'backspace') calculator.backspace();
    else if (value === 'equals') calculator.calculate();
  }, [calculator]);

  useEffect(() => {
    if (geometry.minimized) return undefined;

    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;

      const keyMap = { '*': '×', x: '×', X: '×', '/': '÷' };
      const mappedKey = keyMap[event.key] || event.key;

      if (/^\d$/.test(mappedKey) || ['.', '+', '-', '×', '÷'].includes(mappedKey)) {
        event.preventDefault();
        handleInput(mappedKey);
      } else if (mappedKey === '%') {
        event.preventDefault();
        handleInput('percent');
      } else if (mappedKey === 'Enter' || mappedKey === '=') {
        event.preventDefault();
        handleInput('equals');
      } else if (mappedKey === 'Backspace') {
        event.preventDefault();
        handleInput('backspace');
      } else if (mappedKey === 'Escape') {
        event.preventDefault();
        handleInput('clear');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [geometry.minimized, handleInput]);

  const setMinimized = (minimized) => {
    setGeometry((current) => ({ ...current, minimized }));
  };

  const handleMinimizedDock = ({ dockedSide, centerX, centerY }) => {
    setGeometry((current) => constrainGeometry({
      ...current,
      dockedSide,
      x: dockedSide === 'bottom' ? centerX - (current.width / 2) : current.x,
      y: dockedSide === 'bottom' ? current.y : centerY - (current.height / 2),
    }));
  };

  const resizeHandlePosition = {
    left: 'bottom-0 right-0 cursor-nwse-resize items-end justify-end rounded-tl-lg border-l border-t',
    right: 'bottom-0 left-0 cursor-nesw-resize items-end justify-start rounded-tr-lg border-r border-t',
    bottom: 'top-0 left-0 cursor-nwse-resize items-start justify-start rounded-br-lg border-b border-r',
  };

  if (geometry.minimized) {
    return (
      <CalculatorDock
        dockedSide={geometry.dockedSide}
        geometry={geometry}
        onDock={handleMinimizedDock}
        onRestore={() => setMinimized(false)}
      />
    );
  }

  return (
    <section
      ref={widgetRef}
      className={`[container-type:size] no-print fixed left-0 top-0 z-[45] flex max-h-[70vh] max-w-[80vw] flex-col overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900/95 shadow-2xl shadow-black/50 backdrop-blur-xl will-change-transform ${
        isInteracting ? 'select-none' : 'transition-transform duration-200 ease-out'
      }`}
      style={{
        width: geometry.width,
        height: geometry.height,
        transform: `translate3d(${geometry.x}px, ${geometry.y}px, 0)`,
      }}
      aria-label="Floating calculator"
    >
      <header
        className={`flex touch-none items-center gap-2 border-b border-slate-700/70 bg-gradient-to-r from-slate-800/95 to-slate-900/95 py-2 pr-3 cursor-grab active:cursor-grabbing ${
          geometry.dockedSide === 'bottom' ? 'pl-10' : 'pl-3'
        }`}
        {...dragHandlers}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
          <Calculator className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-white">Calculator</h2>
          <p className="truncate text-[10px] text-slate-400">Drag to move · releases dock</p>
        </div>
        <button
          type="button"
          className={`hidden rounded-md p-1.5 transition-colors sm:block ${
            showHistory ? 'text-blue-300 hover:bg-slate-700' : 'cursor-default text-slate-500'
          }`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setShowHistory(false)}
          aria-label={showHistory ? 'Return to calculator keypad' : 'Calculator keypad is open'}
          title={showHistory ? 'Return to calculator' : 'Calculator keypad'}
        >
          <GripHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`rounded-md p-1.5 transition-colors hover:bg-slate-700 ${showHistory ? 'text-blue-300' : 'text-slate-400 hover:text-white'}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setShowHistory((current) => !current)}
          aria-label={showHistory ? 'Show calculator keypad' : 'Show calculation history'}
          aria-pressed={showHistory}
        >
          <History className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setMinimized(true)}
          aria-label="Minimize calculator"
        >
          <Minus className="h-4 w-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2.5 sm:p-3">
        <CalculatorDisplay
          expression={calculator.expression}
          preview={calculator.preview}
          message={calculator.message}
        />

        {showHistory ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950/50">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent calculations</span>
              {calculator.history.length > 0 && (
                <button
                  type="button"
                  className="rounded-md p-1 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  onClick={calculator.clearHistory}
                  aria-label="Clear calculation history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {calculator.history.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-500">Your last 10 calculations will appear here.</p>
              ) : calculator.history.map((item, index) => (
                <button
                  key={`${item.expression}-${item.result}-${index}`}
                  type="button"
                  className="w-full rounded-lg border border-transparent px-2.5 py-2 text-right transition-colors hover:border-slate-700 hover:bg-slate-800/70"
                  onClick={() => {
                    calculator.recallResult(item.result);
                    setShowHistory(false);
                  }}
                  aria-label={`Use result ${item.result}`}
                >
                  <span className="block truncate text-[11px] text-slate-500">{readableExpression(item.expression)}</span>
                  <span className="block truncate text-sm font-semibold text-slate-200">= {item.result}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <CalculatorButtons onInput={handleInput} />
        )}
      </div>

      <button
        type="button"
        className={`absolute z-10 flex h-8 w-8 touch-none border-slate-600/60 bg-slate-800/90 p-1.5 text-slate-400 shadow-lg transition-colors hover:bg-blue-500/20 hover:text-blue-300 ${
          resizeHandlePosition[geometry.dockedSide] || resizeHandlePosition.left
        }`}
        aria-label="Resize calculator"
        title="Drag to resize calculator"
        {...resizeHandlers}
      >
        <MoveDiagonal2 className="h-4 w-4" />
      </button>
    </section>
  );
}
