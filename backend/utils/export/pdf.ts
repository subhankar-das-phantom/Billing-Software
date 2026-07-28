import PDFDocument from 'pdfkit';
import { ExportDefinition } from './types';
import { formatValue } from './helpers';
import { Writable } from 'stream';

export const buildPDF = <T = any>(
  definition: ExportDefinition<T>,
  stream: Writable
): void => {
  // Use landscape since data exports usually have many columns
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, bufferPages: true });
  doc.pipe(stream);

  const pageLeft = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableWidth = contentWidth - 10; // little padding

  // Calculate proportional column widths
  let totalWidth = 0;
  definition.columns.forEach(c => { totalWidth += c.width || 15; });
  
  const columns = definition.columns.map(c => ({
    ...c,
    // distribute remaining width proportionally
    pdfWidth: ((c.width || 15) / totalWidth) * usableWidth
  }));

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(pageLeft, y, contentWidth, 22).fill('#0f766e');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    let x = pageLeft;
    columns.forEach((col) => {
      doc.text(col.header, x + 4, y + 7, { width: col.pdfWidth - 8, align: col.align || 'left' });
      x += col.pdfWidth;
    });
    doc.y = y + 22;
  };

  const drawCell = (text: string, x: number, y: number, width: number, height: number, options: PDFKit.Mixins.TextOptions = {}) => {
    doc.rect(x, y, width, height).stroke('#cbd5e1');
    doc.text(text, x + 4, y + 5, {
      width: width - 8,
      height: height - 8,
      ellipsis: true,
      ...options
    });
  };

  const ensureSpace = (neededHeight: number) => {
    if (doc.y + neededHeight <= doc.page.height - doc.page.margins.bottom) return;
    doc.addPage();
    drawHeader();
  };

  // Header Section
  if (definition.metadata.firmName) {
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f172a')
       .text(definition.metadata.firmName, { align: 'center' });
    doc.moveDown(0.3);
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e293b')
     .text(definition.title, { align: 'center' });
  doc.moveDown(0.5);

  const metaText = `Generated on ${formatValue(definition.metadata.generatedAt, 'datetime')} | By: ${definition.metadata.generatedBy}`;
  doc.font('Helvetica').fontSize(8).fillColor('#64748b')
     .text(metaText, { align: 'center' });
  
  doc.moveDown(1.5);

  // Table
  drawHeader();

  definition.dataRows.forEach((row, index) => {
    ensureSpace(24);
    const y = doc.y;
    
    if (index % 2 === 0) {
      doc.rect(pageLeft, y, contentWidth, 24).fill('#f8fafc');
    }

    doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
    let x = pageLeft;
    
    columns.forEach((col) => {
      const rawValue = row[col.key as keyof T];
      const formatted = col.format ? formatValue(rawValue, col.format) : formatValue(rawValue);
      drawCell(formatted, x, y, col.pdfWidth, 24, { align: col.align || 'left' });
      x += col.pdfWidth;
    });

    doc.y = y + 24;
  });

  // Footer with Page Numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
       .text(
         `Page ${i + 1} of ${pages.count}`,
         pageLeft,
         doc.page.height - 25,
         { align: 'center', width: contentWidth }
       );
  }

  doc.end();
};
