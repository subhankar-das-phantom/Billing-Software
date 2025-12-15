const ExcelJS = require('exceljs');

/**
 * Generate beautifully formatted Excel export for invoices
 * @param {Array} invoices - Array of invoice objects
 * @param {Object} options - Export options (title, filters, etc.)
 * @returns {Promise<Buffer>} Excel file buffer
 */
const generateInvoiceExcel = async (invoices, options = {}) => {
  const workbook = new ExcelJS.Workbook();
  
  // Set workbook properties
  workbook.creator = 'Bharat Enterprise Billing System';
  workbook.created = new Date();
  workbook.modified = new Date();
  
  // Create main sheet
  const sheet = workbook.addWorksheet('Invoices', {
    properties: { tabColor: { argb: 'FF10B981' } },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  });

  // Define columns with proper widths
  sheet.columns = [
    { header: 'Invoice #', key: 'invoiceNumber', width: 15 },
    { header: 'Date', key: 'invoiceDate', width: 12 },
    { header: 'Customer', key: 'customerName', width: 25 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'GSTIN', key: 'gstin', width: 18 },
    { header: 'Items', key: 'itemCount', width: 10 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'GST', key: 'gst', width: 12 },
    { header: 'Discount', key: 'discount', width: 12 },
    { header: 'Net Total', key: 'netTotal', width: 15 },
    { header: 'Payment', key: 'paymentType', width: 12 },
    { header: 'Status', key: 'status', width: 12 }
  ];

  // Style the header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF059669' } // Emerald-600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Add data rows
  invoices.forEach((invoice, index) => {
    const row = sheet.addRow({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: new Date(invoice.invoiceDate),
      customerName: invoice.customer?.customerName || 'N/A',
      phone: invoice.customer?.phone || '',
      gstin: invoice.customer?.gstin || '',
      itemCount: invoice.items?.length || 0,
      subtotal: invoice.totals?.totalTaxable || 0,
      gst: (invoice.totals?.totalCGST || 0) + (invoice.totals?.totalSGST || 0),
      discount: invoice.totals?.totalDiscount || 0,
      netTotal: invoice.totals?.netTotal || 0,
      paymentType: invoice.paymentType || 'Credit',
      status: invoice.status || 'Created'
    });

    // Alternate row colors
    if (index % 2 === 0) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' } // Gray-100
      };
    }

    // Format date
    row.getCell('invoiceDate').numFmt = 'dd mmm yyyy';

    // Format currency cells
    ['subtotal', 'gst', 'discount', 'netTotal'].forEach(key => {
      const cell = row.getCell(key);
      cell.numFmt = '₹#,##0.00';
      cell.alignment = { horizontal: 'right' };
    });

    // Center align some columns
    ['itemCount', 'paymentType', 'status'].forEach(key => {
      row.getCell(key).alignment = { horizontal: 'center' };
    });

    // Color code status
    const statusCell = row.getCell('status');
    switch (invoice.status) {
      case 'Created':
        statusCell.font = { color: { argb: 'FF2563EB' }, bold: true }; // Blue
        break;
      case 'Printed':
        statusCell.font = { color: { argb: 'FF059669' }, bold: true }; // Green
        break;
      case 'Cancelled':
        statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
        break;
    }

    // Color code payment type
    const paymentCell = row.getCell('paymentType');
    paymentCell.font = {
      color: { argb: invoice.paymentType === 'Cash' ? 'FF059669' : 'FF2563EB' },
      bold: true
    };
  });

  // Add borders to all cells
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
  });

  // Add summary sheet
  const summarySheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF3B82F6' } }
  });

  // Calculate totals
  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totals?.netTotal || 0), 0);
  const totalCash = invoices.filter(inv => inv.paymentType === 'Cash').length;
  const totalCredit = invoices.filter(inv => inv.paymentType === 'Credit').length;
  const totalGST = invoices.reduce((sum, inv) => 
    sum + (inv.totals?.totalCGST || 0) + (inv.totals?.totalSGST || 0), 0
  );

  // Add summary title
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = '📊 Invoice Summary';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  summarySheet.getRow(1).height = 30;

  // Add summary data
  const summaryData = [
    ['', ''], // Empty row
    ['Total Invoices', totalInvoices],
    ['Total Amount', totalAmount],
    ['Total GST Collected', totalGST],
    ['Cash Payments', totalCash],
    ['Credit Payments', totalCredit],
    ['', ''],
    ['Generated On', new Date()]
  ];

  summaryData.forEach(([label, value], index) => {
    const row = summarySheet.addRow([label, value]);
    
    if (label) {
      row.getCell(1).font = { bold: true, size: 11 };
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' }
      };
    }

    if (typeof value === 'number') {
      row.getCell(2).numFmt = label.includes('Amount') || label.includes('GST') 
        ? '₹#,##0.00' 
        : '#,##0';
      row.getCell(2).font = { bold: true, color: { argb: 'FF059669' }, size: 12 };
    }

    if (value instanceof Date) {
      row.getCell(2).numFmt = 'dd mmm yyyy hh:mm AM/PM';
    }
  });

  summarySheet.columns = [
    { width: 25 },
    { width: 20 }
  ];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

/**
 * Generate CSV export (simple format)
 * @param {Array} invoices - Array of invoice objects
 * @returns {String} CSV string
 */
const generateInvoiceCSV = (invoices) => {
  const headers = [
    'Invoice Number',
    'Date',
    'Customer',
    'Phone',
    'GSTIN',
    'Items',
    'Subtotal',
    'GST',
    'Discount',
    'Net Total',
    'Payment Type',
    'Status'
  ];

  const rows = invoices.map(inv => [
    inv.invoiceNumber,
    new Date(inv.invoiceDate).toLocaleDateString(),
    inv.customer?.customerName || 'N/A',
    inv.customer?.phone || '',
    inv.customer?.gstin || '',
    inv.items?.length || 0,
    inv.totals?.totalTaxable || 0,
    (inv.totals?.totalCGST || 0) + (inv.totals?.totalSGST || 0),
    inv.totals?.totalDiscount || 0,
    inv.totals?.netTotal || 0,
    inv.paymentType || 'Credit',
    inv.status || 'Created'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
};

module.exports = {
  generateInvoiceExcel,
  generateInvoiceCSV
};
