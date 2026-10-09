/**
 * Public Invoice Serializer (DTO)
 * Maps internal invoice records strictly to the customer-visible official invoice representation.
 * Zero internal IDs, profit margins, employee attribution, or tenant internals are exposed.
 */

const { numberToWords } = require('../numberToWords');

export interface IPublicBatchAllocationDTO {
  batchNo: string;
  quantity: number;
  expiryDate?: string | null;
}

export interface IPublicInvoiceItemDTO {
  productName: string;
  hsnCode?: string;
  pack?: string;
  batchNo?: string;
  expiryDate?: string | null;
  batchAllocations?: IPublicBatchAllocationDTO[];
  quantity: number;
  freeQuantity: number;
  mrp: number;
  rate: number;
  netRate: number;
  discountPercentage: number;
  gstPercentage: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

export interface IPublicDistributorDTO {
  firmName: string;
  firmAddress: string;
  firmPhone?: string;
  firmGSTIN?: string;
  firmDL?: string;
  paymentInformation?: {
    upiId?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
    accountHolderName?: string;
  };
}

export interface IPublicCustomerDTO {
  customerName: string;
  address?: string;
  phone?: string;
  gstin?: string;
  dlNo?: string;
}

export interface IPublicInvoiceTotalsDTO {
  baseAmount: number;
  totalDiscount: number;
  totalTaxable: number;
  totalCGST: number;
  totalSGST: number;
  roundOff: number;
  netTotal: number;
  finalTotal: number;
  amountInWords?: string;
}

export interface IPublicInvoiceDTO {
  invoiceNumber: string;
  invoiceDate: string | Date;
  paymentType: string;
  status: 'Created' | 'Printed' | 'Cancelled';
  distributor: IPublicDistributorDTO;
  customer: IPublicCustomerDTO;
  items: IPublicInvoiceItemDTO[];
  totals: IPublicInvoiceTotalsDTO;
  paidAmount: number;
  dueAmount: number;
  downloadPdfUrl: string;
  invoiceColumns: string[];
  allowPublicPrint: boolean;
}

export function serializePublicInvoice(
  invoice: any,
  distributorInfo: any,
  rawToken: string,
  invoiceColumns?: string[],
  allowPublicPrint: boolean = false
): IPublicInvoiceDTO {
  const isCancelled = invoice.status === 'Cancelled';
  const rawNetTotal = Math.round(((Number(invoice.totals?.netTotal) || 0) + Number.EPSILON) * 100) / 100;
  const paidAmount = Math.round(((Number(invoice.paidAmount) || 0) + Number.EPSILON) * 100) / 100;
  const finalTotal = Math.round(rawNetTotal);
  const roundOff = Math.round(((finalTotal - rawNetTotal) + Number.EPSILON) * 100) / 100;
  const dueAmount = isCancelled ? 0 : Math.max(0, finalTotal - paidAmount);
  const amountInWords = invoice.totals?.amountInWords || numberToWords(finalTotal);

  // Strictly prioritize the invoice's own distributor snapshot over external business details
  const hasInvoiceDist = invoice.distributor && typeof invoice.distributor === 'object' && Boolean(invoice.distributor.firmName);
  const distSource = hasInvoiceDist ? invoice.distributor : (distributorInfo || {});

  // Distributor payment info only exposed if explicitly enabled
  let paymentInfo: IPublicDistributorDTO['paymentInformation'] = undefined;
  const distPay = distSource.paymentInformation;
  if (distPay?.enabled) {
    paymentInfo = {
      upiId: distPay.upiId || undefined,
      accountNumber: distPay.accountNumber || undefined,
      ifscCode: distPay.ifscCode || undefined,
      bankName: distPay.bankName || undefined,
      accountHolderName: distPay.accountHolderName || undefined
    };
  }

  const distributor: IPublicDistributorDTO = {
    firmName: distSource.firmName || '',
    firmAddress: distSource.firmAddress || '',
    firmPhone: distSource.firmPhone || '',
    firmGSTIN: distSource.firmGSTIN || '',
    firmDL: distSource.firmDL || '',
    ...(paymentInfo ? { paymentInformation: paymentInfo } : {})
  };

  const customer: IPublicCustomerDTO = {
    customerName: invoice.customer?.customerName || invoice.customer?.name || 'Customer',
    address: invoice.customer?.address || '',
    phone: invoice.customer?.phone || '',
    gstin: invoice.customer?.gstin || '',
    dlNo: invoice.customer?.dlNo || ''
  };

  const items: IPublicInvoiceItemDTO[] = (invoice.items || []).map((item: any) => {
    const qty = Number(item.quantitySold ?? item.quantity) || 0;
    const rate = Number(item.ratePerUnit ?? item.rate) || 0;
    const mrp = Number(item.product?.newMRP ?? item.mrp) || 0;
    const discount = Number(item.schemeDiscount ?? item.discountPercentage) || 0;
    const gstRate = Number(item.product?.gstPercentage ?? item.gstPercentage ?? item.gstRate) || 0;
    const taxable = Number(item.taxableAmount ?? (qty * rate)) || 0;
    const cgst = Number(item.cgstAmount ?? (taxable * (gstRate / 200))) || 0;
    const sgst = Number(item.sgstAmount ?? (taxable * (gstRate / 200))) || 0;
    const total = Number(item.totalAmount ?? (taxable + cgst + sgst)) || 0;

    const expiryRaw = item.product?.expiryDate ?? item.expiryDate;
    const expiryStr = expiryRaw ? new Date(expiryRaw).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' }) : null;

    const batchAllocations: IPublicBatchAllocationDTO[] = Array.isArray(item.batchAllocations)
      ? item.batchAllocations.map((alloc: any) => {
          const rawExp = alloc.expiryDate;
          const expStr = rawExp
            ? new Date(rawExp).toLocaleDateString('en-IN', { month: '2-digit', year: '2-digit' })
            : '-';
          const bNo = alloc.batchNo && alloc.batchNo !== 'UNNAMED' ? alloc.batchNo : 'No Batch #';
          return {
            batchNo: bNo,
            quantity: Number(alloc.quantity) || 0,
            expiryDate: expStr
          };
        })
      : [];

    const netRate = Math.round((rate * (1 + gstRate / 100)) * 100) / 100;

    return {
      productName: item.product?.productName ?? item.productName ?? item.name ?? 'Item',
      hsnCode: item.product?.hsnCode ?? item.hsnCode ?? '',
      pack: item.product?.pack ?? item.pack ?? '',
      batchNo: item.product?.batchNo ?? item.batchNumber ?? item.batchNo ?? '',
      expiryDate: expiryStr,
      batchAllocations,
      quantity: qty,
      freeQuantity: Number(item.freeQuantity) || 0,
      mrp,
      rate,
      netRate,
      discountPercentage: discount,
      gstPercentage: gstRate,
      taxableAmount: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      totalAmount: total
    };
  });

  const totals: IPublicInvoiceTotalsDTO = {
    baseAmount: Number(invoice.totals?.baseAmount) || 0,
    totalDiscount: Number(invoice.totals?.totalDiscount) || 0,
    totalTaxable: Number(invoice.totals?.totalTaxable) || 0,
    totalCGST: Number(invoice.totals?.totalCGST) || 0,
    totalSGST: Number(invoice.totals?.totalSGST) || 0,
    roundOff,
    netTotal: rawNetTotal,
    finalTotal,
    amountInWords
  };

  return {
    invoiceNumber: invoice.invoiceNumber || 'INV-DRAFT',
    invoiceDate: invoice.invoiceDate || new Date(),
    paymentType: invoice.paymentType || 'Credit',
    status: (invoice.status as any) || 'Created',
    distributor,
    customer,
    items,
    totals,
    paidAmount,
    dueAmount,
    downloadPdfUrl: `/api/public/shares/${rawToken}/pdf`,
    invoiceColumns: Array.isArray(invoiceColumns) && invoiceColumns.length > 0
      ? invoiceColumns
      : ['qty', 'free', 'productName', 'hsn', 'batchNo', 'expiry', 'mrp', 'rate', 'net', 'disc', 'gst', 'amount'],
    allowPublicPrint: allowPublicPrint === true
  };
}

/**
 * Public PDF DTO Adapter
 * Converts the sanitized IPublicInvoiceDTO into the exact structural shape expected by drawSingleInvoicePDF.
 * This guarantees that:
 * 1. Zero internal fields (tenantId, _id, createdBy, internalCost, purchaseMargin, etc.) reach the PDF renderer.
 * 2. The visual output of drawSingleInvoicePDF remains 100% pixel-perfect and identical.
 */
export function adaptPublicDTOToPDFInvoice(publicData: IPublicInvoiceDTO): {
  invoice: any;
  distributor: any;
} {
  const distributor = {
    firmName: publicData.distributor.firmName,
    firmAddress: publicData.distributor.firmAddress,
    firmPhone: publicData.distributor.firmPhone,
    firmGSTIN: publicData.distributor.firmGSTIN,
    firmDL: publicData.distributor.firmDL,
    paymentInformation: publicData.distributor.paymentInformation
      ? {
          enabled: true,
          upiId: publicData.distributor.paymentInformation.upiId,
          accountNumber: publicData.distributor.paymentInformation.accountNumber,
          ifscCode: publicData.distributor.paymentInformation.ifscCode,
          bankName: publicData.distributor.paymentInformation.bankName,
          accountHolderName: publicData.distributor.paymentInformation.accountHolderName
        }
      : undefined
  };

  const invoice = {
    invoiceNumber: publicData.invoiceNumber,
    invoiceDate: publicData.invoiceDate,
    paymentType: publicData.paymentType,
    status: publicData.status,
    customer: {
      customerName: publicData.customer.customerName,
      address: publicData.customer.address,
      phone: publicData.customer.phone,
      gstin: publicData.customer.gstin,
      dlNo: publicData.customer.dlNo
    },
    items: publicData.items.map((item) => ({
      product: {
        productName: item.productName,
        hsnCode: item.hsnCode,
        pack: item.pack,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        newMRP: item.mrp,
        gstPercentage: item.gstPercentage
      },
      productName: item.productName,
      hsnCode: item.hsnCode,
      pack: item.pack,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      batchAllocations: (item.batchAllocations || []).map((alloc) => ({
        batchNo: alloc.batchNo,
        quantity: alloc.quantity,
        expiryDate: alloc.expiryDate
      })),
      quantitySold: item.quantity,
      freeQuantity: item.freeQuantity,
      ratePerUnit: item.rate,
      netRate: item.netRate,
      mrp: item.mrp,
      schemeDiscount: item.discountPercentage,
      taxableAmount: item.taxableAmount,
      cgstAmount: item.cgstAmount,
      sgstAmount: item.sgstAmount,
      totalAmount: item.totalAmount
    })),
    totals: {
      baseAmount: publicData.totals.baseAmount,
      totalDiscount: publicData.totals.totalDiscount,
      totalTaxable: publicData.totals.totalTaxable,
      totalCGST: publicData.totals.totalCGST,
      totalSGST: publicData.totals.totalSGST,
      roundOff: publicData.totals.roundOff,
      netTotal: publicData.totals.finalTotal ?? publicData.totals.netTotal,
      finalTotal: publicData.totals.finalTotal ?? publicData.totals.netTotal,
      amountInWords: publicData.totals.amountInWords
    },
    paidAmount: publicData.paidAmount
  };

  return { invoice, distributor };
}

