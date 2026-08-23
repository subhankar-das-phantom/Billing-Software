// backend/src/modules/salesAnalytics/types/index.ts
import { Request } from 'express';

export interface DateRangeQuery {
  period?: 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'last3months' | 'last6months' | 'thisYear' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface OverviewResponse {
  totalRevenue: number;
  totalInvoices: number;
  avgInvoiceValue: number;
  totalCollections: number;
  totalOutstanding: number;
  totalCreditNotes: number;
  growth: {
    revenue: number | null;
    invoices: number | null;
    collections: number | null;
  };
}

export interface MonthlySalesResponse {
  month: number;
  year: number;
  revenue: number;
  invoiceCount: number;
}

export interface DailySalesResponse {
  date: string; // YYYY-MM-DD
  revenue: number;
  invoiceCount: number;
}

export interface YearlySalesResponse {
  year: number;
  revenue: number;
  invoiceCount: number;
}

export interface TopProductsResponse {
  _id: string;
  productName: string;
  revenue: number;
  quantitySold: number;
}

export interface TopCustomersResponse {
  _id: string;
  customerName: string;
  revenue: number;
  invoiceCount: number;
}

export interface PaymentTrendsResponse {
  method: string;
  amount: number;
}

export interface AuthenticatedRequest extends Request {
  user: any;
  userRole: string;
  query: any;
}
