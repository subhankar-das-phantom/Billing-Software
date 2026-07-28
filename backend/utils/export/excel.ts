import ExcelJS from 'exceljs';
import { ExportDefinition } from './types';
import { formatValue } from './helpers';

/**
 * Builds an Excel workbook buffer from an ExportDefinition.
 * Automatically generates a Data sheet and a Summary sheet.
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

  let headerRowsCount = 0;

  // Render Title / Firm Name
  if (definition.metadata.firmName) {
    dataSheet.mergeCells('A1:L1'); // Standard wide merge
    const firmCell = dataSheet.getCell('A1');
    firmCell.value = `${definition.metadata.firmName} - ${definition.title}`;
    firmCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
    firmCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dataSheet.getRow(1).height = 30;
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
  headerRow.height = 25;

  // Freeze pane below the column header row
  dataSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: columnHeaderRowNum }];

  // Render Data Rows
  definition.dataRows.forEach((rowData, index) => {
    const rowValues: Record<string, any> = {};
    
    definition.columns.forEach(col => {
      let val: any = rowData[col.key as keyof T];
      if (col.format === 'percentage' && typeof val === 'number') {
        val = val / 100;
      } else if (col.format === 'percentage' && typeof val === 'string') {
        const numVal = Number(val);
        if (!isNaN(numVal)) val = numVal / 100;
      }
      rowValues[String(col.key)] = val;
    });

    const row = dataSheet.addRow(rowValues);

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' } // Gray-100
      };
    }

    // Apply specific cell formatting based on definitions
    definition.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      
      // Formatting
      if (col.format === 'currency') cell.numFmt = '₹#,##0.00';
      if (col.format === 'number') cell.numFmt = '#,##0.00';
      if (col.format === 'percentage') cell.numFmt = '0.00%';
      if (col.format === 'date') cell.numFmt = 'dd mmm yyyy';
      if (col.format === 'datetime') cell.numFmt = 'dd mmm yyyy hh:mm AM/PM';

      // Alignment
      if (col.align) {
        cell.alignment = { horizontal: col.align, vertical: 'middle' };
      } else if (col.format === 'currency' || col.format === 'number' || col.format === 'percentage') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  });

  // Borders for Data Cells
  dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < columnHeaderRowNum) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
  });

  // 2. Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF3B82F6' } } // Blue
  });

  summarySheet.mergeCells('A1:B1');
  const sumTitleCell = summarySheet.getCell('A1');
  sumTitleCell.value = `📊 ${definition.title} - Summary`;
  sumTitleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  sumTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 30;

  let currentSumRow = 3;

  // Write Metadata block
  const writeSumRow = (label: string, value: string | number | Date, isHeader = false) => {
    const row = summarySheet.getRow(currentSumRow++);
    row.getCell(1).value = label;
    row.getCell(2).value = value;
    
    if (isHeader) {
      row.getCell(1).font = { bold: true, size: 11 };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    }
    return row;
  };

  writeSumRow('Export Information', '', true);
  writeSumRow('Generated By', definition.metadata.generatedBy);
  const dateRow = writeSumRow('Generated At', definition.metadata.generatedAt);
  dateRow.getCell(2).numFmt = 'dd mmm yyyy hh:mm AM/PM';

  if (Object.keys(definition.metadata.filters).length > 0) {
    currentSumRow++;
    writeSumRow('Applied Filters', '', true);
    Object.entries(definition.metadata.filters).forEach(([k, v]) => {
      writeSumRow(k, v);
    });
  }

  if (definition.summary.length > 0) {
    currentSumRow++;
    writeSumRow('Key Metrics', '', true);
    definition.summary.forEach(item => {
      let val = item.value;
      if (item.format === 'percentage') {
        const numVal = Number(val);
        if (!isNaN(numVal)) val = numVal / 100;
      }

      const row = writeSumRow(item.label, val);
      const valCell = row.getCell(2);
      
      if (item.format === 'currency') valCell.numFmt = '₹#,##0.00';
      if (item.format === 'number') valCell.numFmt = '#,##0.00';
      if (item.format === 'percentage') valCell.numFmt = '0.00%';
      
      valCell.font = { bold: true, color: { argb: 'FF059669' }, size: 12 };
    });
  }

  summarySheet.columns = [
    { width: 30 },
    { width: 40 }
  ];

  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
};
