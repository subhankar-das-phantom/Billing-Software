export default function CalculatorDisplay({ expression, preview, message }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 shadow-inner">
      <div
        className="min-h-5 overflow-x-auto whitespace-nowrap text-right text-xs text-slate-400 no-scrollbar"
        aria-label="Current calculation"
      >
        {expression || 'Ready'}
      </div>
      <output
        className={`block min-h-8 overflow-x-auto whitespace-nowrap text-right text-2xl font-semibold tracking-tight no-scrollbar ${
          message ? 'text-red-400' : 'text-white'
        }`}
        aria-live="polite"
      >
        {message || preview || expression || '0'}
      </output>
    </div>
  );
}
