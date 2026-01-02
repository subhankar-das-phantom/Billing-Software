const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  // Authentication
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },

  // Profile
  name: {
    type: String,
    required: [true, 'Please add employee name'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Last login tracking
  lastLogin: {
    type: Date
  },

  // Performance Metrics (auto-updated, visible to Admin only)
  metrics: {
    invoicesCreatedCount: {
      type: Number,
      default: 0
    },
    totalSalesGenerated: {
      type: Number,
      default: 0
    },
    paymentsRecordedCount: {
      type: Number,
      default: 0
    },
    paymentsAmountRecorded: {
      type: Number,
      default: 0
    },
    productsAddedCount: {
      type: Number,
      default: 0
    },
    productsUpdatedCount: {
      type: Number,
      default: 0
    },
    stockAdjustmentsCount: {
      type: Number,
      default: 0
    },
    customersAddedCount: {
      type: Number,
      default: 0
    },
    lastActivityAt: {
      type: Date
    }
  },

  // Created by admin reference
  createdByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries (email and userId already indexed via unique: true)
employeeSchema.index({ isActive: 1 });
employeeSchema.index({ 'metrics.lastActivityAt': -1 });

// Encrypt password before save
employeeSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password for login
employeeSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to get public profile (excludes sensitive data)
employeeSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    phone: this.phone,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

// Method to get full profile with metrics (for admin only)
employeeSchema.methods.getFullProfile = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    phone: this.phone,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    metrics: this.metrics,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Employee', employeeSchema);
