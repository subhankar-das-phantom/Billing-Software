import ExcelJS from 'exceljs';
import { ExportDefinition } from './types';

/**
 * Converts a 1-indexed column number to an Excel column letter (e.g., 1 -> A, 27 -> AA).
 */
function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter || 'A';
}

/**
 * Builds an Excel workbook buffer from an ExportDefinition.
 * Automatically generates a styled Data worksheet and a dedicated Summary worksheet.
 */
export const buildWorkbook = async <T = any>(
  definition: ExportDefinition<T>
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = definition.metadata.generatedBy;
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Data Sheet
  const dataSheet = workbook.addWorksheet('Data', {
    properties: { tabColor: { argb: 'FF10B981' } } // Emerald
  });

  const totalColumns = definition.columns.length;
  const lastColLetter = getColumnLetter(totalColumns);
  let headerRowsCount = 0;

  // Render Title / Firm Name Banner
  if (definition.metadata.firmName) {
    dataSheet.mergeCells(`A1:${lastColLetter}1`);
    const firmCell = dataSheet.getCell('A1');
    firmCell.value = `${definition.metadata.firmName} - ${definition.title}`;
    firmCell.font = { bold: true, size: 15, color: { argb: 'FF0F172A' } };
    firmCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dataSheet.getRow(1).height = 32;
    headerRowsCount = 1;
  }

  // Define Columns
  const columnHeaderRowNum = headerRowsCount + 2;
  
  dataSheet.columns = definition.columns.map(col => ({
    key: String(col.key),
    width: col.width || 15
  }));

  // Render Column Headers
  const headerRow = dataSheet.getRow(columnHeaderRowNum);
  definition.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
  });
  
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' } // Emerald-600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 26;

  // Freeze pane below the column header row
  dataSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: columnHeaderRowNum }];

  // Enable AutoFilter on column headers
  dataSheet.autoFilter = {
    from: `A${columnHeaderRowNum}`,
    to: `${lastColLetter}${columnHeaderRowNum}`
  };

  // Render Data Rows
  definition.dataRows.forEach((rowData, index) => {
    const rowValues: Record<string, any> = {};
    
    definition.columns.forEach(col => {
      let val: any = rowData[col.key as keyof T];
      if (col.format === 'percentage') {
        if (typeof val === 'number') {
          val = val / 100;
        } else if (typeof val === 'string') {
          const numVal = Number(val);
          if (!isNaN(numVal)) val = numVal / 100;
        }
      }
      rowValues[String(col.key)] = val ?? '';
    });

    const row = dataSheet.addRow(rowValues);

    // Alternate row zebra striping
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' } // Slate-50
      };
    }

    // Apply specific cell formatting based on column definitions
    definition.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      
      // Number / Currency / Date formatting
      if (col.format === 'currency') cell.numFmt = '₹#,##0.00';
      if (col.format === 'integer') cell.numFmt = '#,##0';
      if (col.format === 'number') {
        const rawVal = rowData[col.key as keyof T];
        const numVal = Number(rawVal);
        cell.numFmt = !isNaN(numVal) && Number.isInteger(numVal) ? '#,##0' : '#,##0.00';
      }
      if (col.format === 'percentage') cell.numFmt = '0.00%';
      if (col.format === 'date') cell.numFmt = 'dd mmm yyyy';
      if (col.format === 'datetime') cell.numFmt = 'dd mmm yyyy hh:mm AM/PM';

      // Alignment
      if (col.align) {
        cell.alignment = { horizontal: col.align, vertical: 'middle' };
      } else if (col.format === 'currency' || col.format === 'number' || col.format === 'integer' || col.format === 'percentage') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { vertical: 'middle' };
      }
    });

    row.height = 20;
  });

  // Cell borders for data grid
  dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < columnHeaderRowNum) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
  });

  // 2. Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF3B82F6' } } // Blue
  });

  summarySheet.mergeCells('A1:B1');
  const sumTitleCell = summarySheet.getCell('A1');
  sumTitleCell.value = `📊 ${definition.title} - Executive Summary`;
  sumTitleCell.font = { bold: true, size: 15, color: { argb: 'FF1F2937' } };
  sumTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 32;

  let currentSumRow = 3;

  const writeSumRow = (label: string, value: string | number | Date, isHeader = false) => {
    const row = summarySheet.getRow(currentSumRow++);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    
    if (isHeader) {
      row.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    } else {
      row.getCell(1).font = { color: { argb: 'FF475569' } };
      row.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
    }
    row.height = 22;
    return row;
  };

  writeSumRow('Export Information', '', true);
  writeSumRow('Firm Name', definition.metadata.firmName || 'Bharat Enterprise');
  writeSumRow('Generated By', definition.metadata.generatedBy);
  const dateRow = writeSumRow('Generated At', definition.metadata.generatedAt);
  dateRow.getCell(2).numFmt = 'dd mmm yyyy hh:mm AM/PM';

  if (definition.metadata.filters && Object.keys(definition.metadata.filters).length > 0) {
    currentSumRow++;
    writeSumRow('Applied Filters', '', true);
    Object.entries(definition.metadata.filters).forEach(([k, v]) => {
      writeSumRow(k, v);
    });
  }

  if (definition.summary && definition.summary.length > 0) {
    currentSumRow++;
    writeSumRow('Key Performance Indicators', '', true);
    definition.summary.forEach(item => {
      let val = item.value;
      if (item.format === 'percentage') {
        const numVal = Number(val);
        if (!isNaN(numVal)) val = numVal / 100;
      }

      const row = writeSumRow(item.label, val);
      const valCell = row.getCell(2);
      
      if (item.format === 'currency') valCell.numFmt = '₹#,##0.00';
      if (item.format === 'integer') valCell.numFmt = '#,##0';
      if (item.format === 'number') {
        const numVal = Number(val);
        valCell.numFmt = !isNaN(numVal) && Number.isInteger(numVal) ? '#,##0' : '#,##0.00';
      }
      if (item.format === 'percentage') valCell.numFmt = '0.00%';
      
      valCell.font = { bold: true, color: { argb: 'FF059669' }, size: 12 };
    });
  }

  summarySheet.columns = [
    { width: 32 },
    { width: 42 }
  ];

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
};
