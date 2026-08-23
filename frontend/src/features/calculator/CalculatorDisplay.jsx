export default function CalculatorDisplay({ expression, preview, message }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 shadow-inner">
      <div
        className="min-h-5 overflow-x-auto whitespace-nowrap text-right text-[clamp(0.75rem,calc(2cqw+2cqh),1.5rem)] text-slate-400 no-scrollbar"
        aria-label="Current calculation"
      >
        {expression || 'Ready'}
      </div>
      <output
        className={`block min-h-8 overflow-x-auto whitespace-nowrap text-right text-[clamp(1.5rem,calc(4cqw+6cqh),3.5rem)] font-semibold tracking-tight no-scrollbar ${
          message ? 'text-red-400' : 'text-white'
        }`}
        aria-live="polite"
      >
        {message || preview || expression || '0'}
      </output>
    </div>
  );
}
