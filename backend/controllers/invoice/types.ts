import type { Request } from 'express';
import type { Types } from 'mongoose';

export interface IInvoiceItem {
  product?: {
    _id?: Types.ObjectId | string;
    productName?: string;
    hsnCode?: string;
    pack?: string;
    newMRP?: number;
    gstPercentage?: number;
  };
  quantitySold: number;
  freeQuantity?: number;
  ratePerUnit: number;
  schemeDiscount?: number;
  baseAmount: number;
  discountAmount?: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalAmount: number;
}

export interface IInvoiceTotals {
  baseAmount: number;
  totalDiscount?: number;
  totalTaxable: number;
  totalGST: number;
  totalCGST: number;
  totalSGST: number;
  netTotal: number;
  amountInWords?: string;
}

export interface ICustomerSnapshot {
  _id?: Types.ObjectId | string;
  customerName?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  dlNo?: string;
}

export interface IDistributorSnapshot {
  firmName?: string;
  firmAddress?: string;
  firmPhone?: string;
  firmGSTIN?: string;
  firmDL?: string;
  paymentInformation?: {
    enabled?: boolean;
    upiId?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
}

export interface IInvoice {
  _id: Types.ObjectId | string;
  tenantId: Types.ObjectId | string;
  invoiceNumber: string;
  invoiceDate: Date | string;
  customer?: ICustomerSnapshot;
  distributor?: IDistributorSnapshot;
  items: IInvoiceItem[];
  totals: IInvoiceTotals;
  paymentType?: 'Cash' | 'Credit';
  status?: 'Created' | 'Printed' | 'Cancelled';
  notes?: string;
  paidAmount?: number;
  paymentStatus?: 'Unpaid' | 'Partial' | 'Paid';
  dueDate?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    _id?: Types.ObjectId | string;
    createdByAdmin?: Types.ObjectId | string;
    [key: string]: unknown;
  };
  userRole?: 'admin' | 'employee' | string;
  userModel?: string;
  cookies: Record<string, string>;
}
