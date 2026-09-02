import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ISupplier extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  state: string;
  paymentTerms: string;
  openingBalance: number;
  notes: string;
  isActive: boolean;
  createdBy: {
    user: mongoose.Types.ObjectId;
    userModel: 'Admin' | 'Employee';
  };
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    contactPerson: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    address: {
      type: String,
      trim: true,
      default: ''
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    state: {
      type: String,
      trim: true,
      default: ''
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: ''
    },
    openingBalance: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      user: {
        type: Schema.Types.ObjectId,
        refPath: 'createdBy.userModel'
      },
      userModel: {
        type: String,
        enum: ['Admin', 'Employee']
      }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, phone: 1 });
supplierSchema.index({ tenantId: 1, gstin: 1 });
supplierSchema.index({ tenantId: 1, isActive: 1 });
supplierSchema.index({ name: 'text', phone: 'text', gstin: 'text' });

const Supplier: Model<ISupplier> = mongoose.model<ISupplier>('Supplier', supplierSchema);
export default Supplier;
