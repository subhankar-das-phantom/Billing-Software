import { ExportDefinition } from './types';
import { formatValue } from './helpers';

/**
 * Builds a clean CSV string from an ExportDefinition.
 * Formats values based on column definitions and safely escapes commas, quotes, and newlines.
 */
export const buildCSV = <T = any>(definition: ExportDefinition<T>): string => {
  const headers = definition.columns.map(col => col.header);

  const escapeCell = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows = definition.dataRows.map(row => {
    return definition.columns.map(col => {
      const rawValue = row[col.key as keyof T];
      const formatted = col.format ? formatValue(rawValue, col.format) : formatValue(rawValue);
      return escapeCell(formatted);
    });
  });

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.join(','))
  ];

  return csvLines.join('\r\n');
};
