export const CALCULATOR_OPERATORS = new Set(['+', '-', '×', '÷']);

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error('Invalid result');
  return String(Number(value.toPrecision(12)));
}

function tokenize(expression) {
  const tokens = [];
  let index = 0;
  let expectingNumber = true;

  while (index < expression.length) {
    const character = expression[index];

    if (character === ' ') {
      index += 1;
      continue;
    }

    if (expectingNumber) {
      let numberText = '';
      if (character === '-') {
        numberText = '-';
        index += 1;
      }

      let hasDigit = false;
      let hasDecimal = false;
      while (index < expression.length) {
        const next = expression[index];
        if (/\d/.test(next)) {
          numberText += next;
          hasDigit = true;
          index += 1;
        } else if (next === '.' && !hasDecimal) {
          numberText += next;
          hasDecimal = true;
          index += 1;
        } else {
          break;
        }
      }

      if (!hasDigit) throw new Error('Incomplete expression');

      let value = Number(numberText);
      if (expression[index] === '%') {
        value /= 100;
        index += 1;
      }

      tokens.push(value);
      expectingNumber = false;
      continue;
    }

    if (!CALCULATOR_OPERATORS.has(character)) throw new Error('Invalid expression');
    tokens.push(character);
    expectingNumber = true;
    index += 1;
  }

  if (expectingNumber || tokens.length === 0) throw new Error('Incomplete expression');
  return tokens;
}

export function evaluateExpression(expression) {
  const tokens = tokenize(expression);
  const values = [tokens[0]];
  const additiveOperators = [];

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const nextValue = tokens[index + 1];

    if (operator === '×' || operator === '÷') {
      const previousValue = values.pop();
      if (operator === '÷' && nextValue === 0) throw new Error('Cannot divide by zero');
      values.push(operator === '×' ? previousValue * nextValue : previousValue / nextValue);
    } else {
      additiveOperators.push(operator);
      values.push(nextValue);
    }
  }

  let result = values[0];
  additiveOperators.forEach((operator, index) => {
    result = operator === '+' ? result + values[index + 1] : result - values[index + 1];
  });

  return formatNumber(result);
}
