import { useCallback, useEffect, useMemo, useState } from 'react';
import { saveCalculatorStorage } from './calculatorStorage';
import { CALCULATOR_OPERATORS, evaluateExpression } from './calculatorMath';

function currentNumber(expression) {
  const operatorIndex = Math.max(
    expression.lastIndexOf('+'),
    expression.lastIndexOf('-'),
    expression.lastIndexOf('×'),
    expression.lastIndexOf('÷'),
  );
  return expression.slice(operatorIndex + 1);
}

export function useCalculatorState(initialExpression, initialHistory) {
  const [expression, setExpression] = useState(initialExpression);
  const [history, setHistory] = useState(initialHistory);
  const [status, setStatus] = useState('editing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    saveCalculatorStorage({ expression, history });
  }, [expression, history]);

  const preview = useMemo(() => {
    if (!expression || status === 'error') return '';
    try {
      return evaluateExpression(expression);
    } catch {
      return '';
    }
  }, [expression, status]);

  const inputDigit = useCallback((digit) => {
    setMessage('');
    setExpression((currentExpression) => {
      const shouldReset = status === 'evaluated' || status === 'error';
      const base = shouldReset ? '' : currentExpression;
      const number = currentNumber(base);

      if (digit === '.') {
        if (number.includes('.') || number.includes('%')) return base;
        return `${base}${number ? '' : '0'}.`;
      }

      if (number === '0') return `${base.slice(0, -1)}${digit}`;
      return `${base}${digit}`.slice(0, 100);
    });
    setStatus('editing');
  }, [status]);

  const inputOperator = useCallback((operator) => {
    setMessage('');
    setExpression((currentExpression) => {
      if (!currentExpression) return operator === '-' ? '-' : '';
      if (status === 'error') return operator === '-' ? '-' : '';

      const lastCharacter = currentExpression.at(-1);
      if (CALCULATOR_OPERATORS.has(lastCharacter)) {
        return `${currentExpression.slice(0, -1)}${operator}`;
      }
      if (lastCharacter === '.') return currentExpression;
      return `${currentExpression}${operator}`.slice(0, 100);
    });
    setStatus('editing');
  }, [status]);

  const inputPercent = useCallback(() => {
    setMessage('');
    setStatus('editing');
    setExpression((currentExpression) => {
      if (!/\d$/.test(currentExpression)) return currentExpression;
      return `${currentExpression}%`;
    });
  }, []);

  const clear = useCallback(() => {
    setExpression('');
    setMessage('');
    setStatus('editing');
  }, []);

  const backspace = useCallback(() => {
    setExpression((currentExpression) => currentExpression.slice(0, -1));
    setMessage('');
    setStatus('editing');
  }, []);

  const calculate = useCallback(() => {
    try {
      const result = evaluateExpression(expression);
      setHistory((currentHistory) => [
        { expression, result },
        ...currentHistory,
      ].slice(0, 10));
      setExpression(result);
      setMessage('');
      setStatus('evaluated');
    } catch (error) {
      setMessage(error.message === 'Cannot divide by zero' ? error.message : 'Check the expression');
      setStatus('error');
    }
  }, [expression]);

  const clearHistory = useCallback(() => setHistory([]), []);

  const recallResult = useCallback((result) => {
    setExpression(result);
    setMessage('');
    setStatus('evaluated');
  }, []);

  return {
    expression,
    preview,
    message,
    history,
    inputDigit,
    inputOperator,
    inputPercent,
    clear,
    backspace,
    calculate,
    clearHistory,
    recallResult,
  };
}
