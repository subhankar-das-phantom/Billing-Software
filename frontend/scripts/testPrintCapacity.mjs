/**
 * Format Capacity & Print Simulation Experiment Script
 * Uses Puppeteer to test empirical capacities of A4, A5, Thermal 80, Thermal 58
 * across 1, 5, 10, 15, 25, 50, 100 item synthetic datasets.
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Synthetic invoice generator
function generateSyntheticInvoice(itemCount) {
  const items = [];
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;

  for (let i = 1; i <= itemCount; i++) {
    const isLongName = i % 3 === 0;
    const name = isLongName
      ? `Product ${i} Extra Extended Formulation Tablet IP 500mg with Sustained Release Granules & Zinc Supplement`
      : `Product Item ${i} 100ml Syrup`;
    
    const qty = (i % 10) + 1;
    const free = i % 5 === 0 ? 1 : 0;
    const rate = 120.50 + (i * 2.5);
    const taxable = qty * rate;
    const gstRate = 18;
    const cgst = taxable * 0.09;
    const sgst = taxable * 0.09;
    const total = taxable + cgst + sgst;

    totalTaxable += taxable;
    totalCGST += cgst;
    totalSGST += sgst;

    items.push({
      productName: name,
      quantitySold: qty,
      freeQuantity: free,
      rate: rate,
      gstPercent: gstRate,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      totalAmount: total,
      batchAllocations: i % 2 === 0 ? [{ batchNo: `B-${1000 + i}`, expiryDate: '2028-06-30' }] : []
    });
  }

  const netTotal = totalTaxable + totalCGST + totalSGST;

  return {
    invoiceNumber: `INV-CAP-${itemCount}`,
    invoiceDate: new Date().toISOString(),
    paymentType: 'CREDIT',
    status: 'Created',
    customer: {
      customerName: 'Shree Krishna Medical & Healthcare Distributors Private Limited',
      address: 'Shop No 14 & 15, Ground Floor, Central Wholesale Pharmaceutical Market Complex, Ring Road, Industrial Area, Sector 5, Kolkata, West Bengal - 700091',
      phone: '+91 98765 43210',
      gstin: '19AAACB1234F1Z5',
      dlNo: 'WB-KOL-2024-DL-987654'
    },
    distributor: {
      firmName: 'BHARAT ENTERPRISE PHARMACEUTICALS',
      firmAddress: 'Corporate Office: 42 Commercial Complex, Central Avenue, Park Street, Kolkata - 700016',
      firmPhone: '+91 33 2222 5555',
      firmGSTIN: '19AAAAA0000A1Z5',
      firmDL: 'WB-CAL-2023-DL-112233'
    },
    notes: 'Goods once sold will not be returned unless damaged in transit. Interest @ 18% per annum will be charged if bill is not settled within 30 days of invoice date. All disputes subject to Kolkata jurisdiction.',
    items,
    totals: {
      totalTaxable,
      totalDiscount: itemCount > 5 ? 250.00 : 0,
      totalCGST,
      totalSGST,
      roundOff: Math.round(netTotal) - netTotal,
      netTotal: Math.round(netTotal),
      amountInWords: 'Indian Rupees Only'
    }
  };
}

function generateHtml(invoice, format, isDoubleCopy = false) {
  const isA4 = format === 'A4';
  const isA5 = format === 'A5';
  const isThermal80 = format === 'THERMAL_80';
  const isThermal58 = format === 'THERMAL_58';

  const pageSizeRule = isA4
    ? '@page { size: A4 portrait; margin: 6mm; }'
    : isA5
    ? '@page { size: A5 portrait; margin: 5mm; }'
    : isThermal80
    ? '@page { size: 80mm auto; margin: 2mm; }'
    : '@page { size: 58mm auto; margin: 2mm; }';

  const containerWidth = isA4 ? '190mm' : isA5 ? '138mm' : isThermal80 ? '74mm' : '52mm';
  const fontSize = isA4 ? '10px' : isA5 ? '8.5px' : isThermal80 ? '9px' : '8px';

  let itemsHtml = '';
  if (isThermal58) {
    itemsHtml = invoice.items.map(item => `
      <div style="border-bottom: 1px dotted #ccc; padding: 2px 0;">
        <div style="font-weight: bold; word-break: break-word;">${item.productName}</div>
        <div style="display: flex; justify-content: space-between;">
          <span>${item.quantitySold} × ₹${item.rate.toFixed(0)}</span>
          <span style="font-weight: bold;">₹${item.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    `).join('');
  } else if (isThermal80) {
    itemsHtml = invoice.items.map(item => `
      <div style="border-bottom: 1px dotted #ccc; padding: 2px 0;">
        <div style="font-weight: bold; word-break: break-word;">${item.productName}</div>
        <div style="display: flex; justify-content: space-between; font-size: 8px;">
          <span>Qty: ${item.quantitySold}</span>
          <span>Rate: ₹${item.rate.toFixed(2)}</span>
          <span style="font-weight: bold;">₹${item.totalAmount.toFixed(2)}</span>
        </div>
      </div>
    `).join('');
  } else {
    itemsHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: ${isA5 ? '8px' : '9px'}; border: 0.5px solid black;">
        <thead>
          <tr style="background: #f0f0f0; border-bottom: 0.5px solid black;">
            <th style="border-right: 0.5px solid black; padding: 2px; width: 5%;">SN</th>
            <th style="border-right: 0.5px solid black; padding: 2px; text-align: left; width: 45%;">Description</th>
            <th style="border-right: 0.5px solid black; padding: 2px; width: 8%;">Qty</th>
            <th style="border-right: 0.5px solid black; padding: 2px; text-align: right; width: 12%;">Rate</th>
            <th style="border-right: 0.5px solid black; padding: 2px; text-align: right; width: 15%;">Taxable</th>
            <th style="padding: 2px; text-align: right; width: 15%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoice.items.map((item, idx) => `
            <tr style="border-bottom: 0.5px solid #ddd;">
              <td style="border-right: 0.5px solid black; padding: 2px; text-align: center;">${idx + 1}</td>
              <td style="border-right: 0.5px solid black; padding: 2px; word-break: break-word;">
                <strong>${item.productName}</strong>
                ${item.batchAllocations.length > 0 ? `<div style="font-size: 7.5px; color: #555;">Batch: ${item.batchAllocations[0].batchNo}</div>` : ''}
              </td>
              <td style="border-right: 0.5px solid black; padding: 2px; text-align: center;">${item.quantitySold}</td>
              <td style="border-right: 0.5px solid black; padding: 2px; text-align: right;">${item.rate.toFixed(2)}</td>
              <td style="border-right: 0.5px solid black; padding: 2px; text-align: right;">${item.taxableAmount.toFixed(2)}</td>
              <td style="padding: 2px; text-align: right; font-weight: bold;">${item.totalAmount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        ${pageSizeRule}
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: ${fontSize};
          color: black;
          background: white;
        }
        .container {
          width: ${containerWidth};
          margin: 0 auto;
          box-sizing: border-box;
        }
        .summary-box {
          margin-top: 8px;
          border-top: 1px solid black;
          padding-top: 4px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .notes-box {
          margin-top: 6px;
          border-top: 1px dashed #666;
          padding-top: 4px;
          font-size: 8.5px;
          word-break: break-word;
          page-break-inside: avoid;
          break-inside: avoid;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 4px; margin-bottom: 6px;">
          <h2 style="margin: 0; font-size: ${isThermal58 ? '11px' : isThermal80 ? '13px' : '16px'};">${invoice.distributor.firmName}</h2>
          <div style="font-size: 8px;">${invoice.distributor.firmAddress}</div>
          <div style="font-size: 8px;">GSTIN: ${invoice.distributor.firmGSTIN} · Phone: ${invoice.distributor.firmPhone}</div>
          <div style="margin-top: 4px; font-weight: bold; text-transform: uppercase;">TAX INVOICE - ${invoice.invoiceNumber}</div>
        </div>

        <div style="border-bottom: 1px solid black; padding-bottom: 4px; margin-bottom: 6px; font-size: 8.5px;">
          <div><strong>Billed To:</strong> ${invoice.customer.customerName}</div>
          <div>${invoice.customer.address}</div>
          <div>GSTIN: ${invoice.customer.gstin} · Ph: ${invoice.customer.phone}</div>
        </div>

        <div class="items-section">
          ${itemsHtml}
        </div>

        <div class="notes-box">
          <strong>Notes:</strong> ${invoice.notes}
        </div>

        <div class="summary-box">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: ${isThermal58 ? '9px' : '11px'};">
            <span>NET AMOUNT:</span>
            <span>₹${invoice.totals.netTotal.toLocaleString('en-IN')}</span>
          </div>
          <div style="margin-top: 12px; text-align: right; font-size: 8.5px;">
            Authorized Signatory
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function runExperiments() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔬 EXECUTING FORMAT CAPACITY EXPERIMENT MATRIX (PUPPETEER CHROMIUM)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const counts = [1, 5, 10, 15, 25, 50, 100];
  const formats = ['A4', 'A5', 'THERMAL_80', 'THERMAL_58'];
  const results = [];

  const outDir = path.join(__dirname, '../../artifacts/capacity_pdfs');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const fmt of formats) {
    console.log(`\n📄 Testing Format: ${fmt}`);
    for (const count of counts) {
      const page = await browser.newPage();
      const invoice = generateSyntheticInvoice(count);
      const html = generateHtml(invoice, fmt);

      await page.setContent(html, { waitUntil: 'load' });

      const pdfPath = path.join(outDir, `capacity_${fmt}_${count}_items.pdf`);

      let pdfOptions = { path: pdfPath };
      if (fmt === 'A4') {
        pdfOptions = { ...pdfOptions, format: 'A4', printBackground: true };
      } else if (fmt === 'A5') {
        pdfOptions = { ...pdfOptions, format: 'A5', printBackground: true };
      } else if (fmt === 'THERMAL_80') {
        pdfOptions = { ...pdfOptions, width: '80mm', printBackground: true };
      } else if (fmt === 'THERMAL_58') {
        pdfOptions = { ...pdfOptions, width: '58mm', printBackground: true };
      }

      const pdfBuffer = await page.pdf(pdfOptions);

      // Estimate page count by counting "/Type /Page" tokens in PDF binary stream
      const pdfText = pdfBuffer.toString('binary');
      const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
      const pageCount = pageMatches ? pageMatches.length : 1;

      console.log(`   • ${count.toString().padStart(3, ' ')} items -> Rendered ${pageCount} page(s) (PDF: ${path.basename(pdfPath)})`);

      results.push({
        format: fmt,
        itemCount: count,
        pageCount,
        hasLongNames: true,
        hasNotes: true
      });

      await page.close();
    }
  }

  await browser.close();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 EMPIRICAL CAPACITY EXPERIMENT SUMMARY TABLE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.table(results);
}

runExperiments().catch(err => {
  console.error('Experiment error:', err);
  process.exit(1);
});
