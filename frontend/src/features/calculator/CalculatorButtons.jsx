import { Delete } from 'lucide-react';

const BUTTONS = [
  { label: 'C', value: 'clear', tone: 'danger', ariaLabel: 'Clear calculation' },
  { label: '%', value: 'percent', tone: 'utility', ariaLabel: 'Percent' },
  { label: <Delete className="h-4 w-4" />, value: 'backspace', tone: 'utility', ariaLabel: 'Delete last character' },
  { label: '÷', value: '÷', tone: 'operator', ariaLabel: 'Divide' },
  { label: '7', value: '7' },
  { label: '8', value: '8' },
  { label: '9', value: '9' },
  { label: '×', value: '×', tone: 'operator', ariaLabel: 'Multiply' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
  { label: '6', value: '6' },
  { label: '−', value: '-', tone: 'operator', ariaLabel: 'Subtract' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '+', value: '+', tone: 'operator', ariaLabel: 'Add' },
  { label: '0', value: '0', span: true },
  { label: '.', value: '.', ariaLabel: 'Decimal point' },
  { label: '=', value: 'equals', tone: 'equals', ariaLabel: 'Calculate result' },
];

const TONES = {
  number: 'border-slate-700/70 bg-slate-800/80 text-slate-100 hover:bg-slate-700',
  utility: 'border-slate-600/60 bg-slate-700/70 text-slate-200 hover:bg-slate-600',
  danger: 'border-red-500/30 bg-red-500/15 text-red-300 hover:bg-red-500/25',
  operator: 'border-blue-500/30 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25',
  equals: 'border-blue-400/40 bg-gradient-to-br from-blue-600 to-accent2-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-accent2-500',
};

export default function CalculatorButtons({ onInput }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-5 gap-1.5 overflow-hidden" role="group" aria-label="Calculator keypad">
      {BUTTONS.map((button) => (
        <button
          key={button.value}
          type="button"
          className={`flex min-h-0 items-center justify-center rounded-lg border px-1 py-0.5 text-[clamp(0.875rem,calc(3cqw+4cqh),2.25rem)] font-semibold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            TONES[button.tone || 'number']
          } ${button.span ? 'col-span-2' : ''}`}
          onClick={() => onInput(button.value)}
          aria-label={button.ariaLabel || button.label}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
