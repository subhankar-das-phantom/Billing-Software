import { ExportDefinition } from './types';
import { formatValue } from './helpers';

/**
 * Builds a CSV string from an ExportDefinition.
 * Strips out metadata/summary and strictly outputs the core columns and dataRows.
 */
export const buildCSV = <T = any>(definition: ExportDefinition<T>): string => {
  const headers = definition.columns.map(col => col.header);

  const rows = definition.dataRows.map(row => {
    return definition.columns.map(col => {
      // Use formatValue if format is provided, otherwise just get the raw string
      const rawValue = row[col.key as keyof T];
      const formatted = col.format ? formatValue(rawValue, col.format) : formatValue(rawValue);
      return formatted;
    });
  });

  // Simple CSV generation - wraps all fields in quotes and escapes internal quotes
  const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => row.map(escapeCell).join(','))
  ].join('\n');

  return csvContent;
};
