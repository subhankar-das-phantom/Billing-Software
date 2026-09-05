export const sanitizeFilename = (name: string, maxLength: number = 200): string => {
  // Replace illegal characters with hyphens
  let sanitized = name.replace(/[\/\\:*?"<>|]/g, '-');
  
  // Collapse multiple hyphens or spaces
  sanitized = sanitized.replace(/[-\s]+/g, '-');
  
  // Trim leading/trailing hyphens and spaces
  sanitized = sanitized.replace(/^[-]+|[-]+$/g, '').trim();

  // Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized || 'export';
};

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const integerFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const datetimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export const formatValue = (value: unknown, format?: string): string => {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency':
      return `₹ ${currencyFormatter.format(Number(value) || 0)}`;
    case 'integer':
      return integerFormatter.format(Math.round(Number(value) || 0));
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) return '0';
      if (Number.isInteger(num)) return integerFormatter.format(num);
      return currencyFormatter.format(num);
    }
    case 'percentage':
      return `${Number(value) || 0}%`;
    case 'date': {
      const date = new Date(value as string | number | Date);
      return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
    }
    case 'datetime': {
      const date = new Date(value as string | number | Date);
      return Number.isNaN(date.getTime()) ? '' : datetimeFormatter.format(date);
    }
    case 'boolean':
      return Boolean(value) ? 'Yes' : 'No';
    case 'text':
    default:
      return String(value);
  }
};
