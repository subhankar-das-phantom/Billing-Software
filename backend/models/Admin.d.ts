import { Model, Document, Types } from 'mongoose';

export interface IAdminPreferences {
  themeMode: 'dark' | 'light' | 'system';
  showCalculator: boolean;
  enableBatchTracking: boolean;
  mobileCardDensity: 'compact' | 'expanded';
  invoiceColumns: string[];
  allowPublicInvoicePrint: boolean;
  showA5CapacityWarning: boolean;
  documentPrintFormats?: Record<string, string>;
}

export interface IAdminPaymentInformation {
  enabled: boolean;
  upiId?: string;
  accountNumber?: string;
  ifscCode?: string;
}

export interface IAdminDocument extends Document {
  _id: Types.ObjectId;
  email: string;
  password?: string;
  firmName: string;
  normalizedFirmName: string;
  firmAddress: string;
  firmPhone: string;
  firmGSTIN: string;
  firmDL: string;
  lastLogin?: Date;
  isActive: boolean;
  preferences: IAdminPreferences;
  paymentInformation: IAdminPaymentInformation;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

declare const Admin: Model<IAdminDocument>;
export default Admin;
