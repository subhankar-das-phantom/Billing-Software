const { body, param, query, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// ==================== AUTH VALIDATORS ====================
const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('Password must contain both letters and numbers'),
  body('firmName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Firm name must be less than 100 characters'),
  body('firmAddress')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('firmPhone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Invalid phone format'),
  body('firmGSTIN')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]Z[0-9A-Z]$/i)
    .withMessage('Invalid GSTIN format (e.g., 19ABCDE1234F1Z5)'),
  validate
];

const updateProfileValidator = [
  body('firmName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Firm name must be less than 100 characters'),
  body('firmAddress')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('firmPhone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Invalid phone format'),
  body('firmGSTIN')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]Z[0-9A-Z]$/i)
    .withMessage('Invalid GSTIN format (e.g., 19ABCDE1234F1Z5)'),
  validate
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('New password must contain both letters and numbers'),
  validate
];

// ==================== PRODUCT VALIDATORS ====================
const createProductValidator = [
  body('productName')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 200 })
    .withMessage('Product name must be less than 200 characters'),
  body('hsnCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('HSN code must be less than 20 characters'),
  body('batchNo')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Batch number must be less than 50 characters'),
  body('expiryDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid expiry date format'),
  body('oldMRP')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Old MRP must be a positive number'),
  body('newMRP')
    .isFloat({ min: 0 })
    .withMessage('Current MRP must be a positive number'),
  body('rate')
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  body('gstPercentage')
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST percentage must be between 0 and 100'),
  body('openingStockQty')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Opening stock quantity must be a non-negative integer'),
  body('unit')
    .optional()
    .trim()
    .isIn(['Pieces', 'Strips', 'Bottles', 'Boxes', 'ML', 'GM'])
    .withMessage('Invalid unit'),
  validate
];

const updateProductValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('productName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Product name must be less than 200 characters'),
  body('rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  body('gstRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('GST rate must be between 0 and 100'),
  validate
];

const adjustStockValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('type')
    .isIn(['in', 'out'])
    .withMessage('Type must be either "in" or "out"'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must be less than 200 characters'),
  validate
];

// ==================== CUSTOMER VALIDATORS ====================
const createCustomerValidator = [
  body('customerName')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required')
    .isLength({ max: 200 })
    .withMessage('Customer name must be less than 200 characters'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Invalid phone format'),
  body('gstin')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]Z[0-9A-Z]$/i)
    .withMessage('Invalid GSTIN format (e.g., 19ABCDE1234F1Z5)'),
  body('dlNo')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('DL number must be less than 50 characters'),
  validate
];

const updateCustomerValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid customer ID'),
  body('customerName')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Customer name must be less than 200 characters'),
  validate
];

// ==================== INVOICE VALIDATORS ====================
const createInvoiceValidator = [
  body('customerId')
    .isMongoId()
    .withMessage('Invalid customer ID'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('Invalid product ID in items'),
  body('items.*.quantitySold')
    .isInt({ min: 1 })
    .withMessage('Quantity sold must be at least 1'),
  body('items.*.ratePerUnit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  body('items.*.freeQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Free quantity must be a non-negative integer'),
  body('items.*.schemeDiscount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
  validate
];

const updateInvoiceStatusValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid invoice ID'),
  body('status')
    .isIn(['Created', 'Printed', 'Cancelled', 'PAID', 'UNPAID', 'PARTIAL', 'CANCELLED'])
    .withMessage('Invalid status'),
  validate
];

// ==================== NOTE VALIDATORS ====================
const createNoteValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Content must be less than 5000 characters'),
  body('color')
    .optional()
    .trim()
    .matches(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    .withMessage('Invalid color format'),
  validate
];

const updateNoteValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid note ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Content must be less than 5000 characters'),
  body('color')
    .optional()
    .trim()
    .matches(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    .withMessage('Invalid color format'),
  validate
];

// ==================== PAYMENT VALIDATORS ====================
const createPaymentValidator = [
  body('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isMongoId()
    .withMessage('Invalid invoice ID format'),
  body('amount')
    .notEmpty()
    .withMessage('Payment amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  body('paymentMethod')
    .optional()
    .isIn(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'])
    .withMessage('Invalid payment method'),
  body('paymentDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid payment date format'),
  body('referenceNumber')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference number cannot exceed 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  validate
];

const updatePaymentValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid payment ID format'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  body('paymentMethod')
    .optional()
    .isIn(['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'NEFT/RTGS'])
    .withMessage('Invalid payment method'),
  body('paymentDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid payment date format'),
  body('referenceNumber')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference number cannot exceed 100 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  validate
];

// ==================== CREDIT NOTE VALIDATORS ====================
const createCreditNoteValidator = [
  body('invoiceId')
    .notEmpty()
    .withMessage('Invoice ID is required')
    .isMongoId()
    .withMessage('Invalid invoice ID format'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Credit note must include at least one item'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .isMongoId()
    .withMessage('Invalid product ID format'),
  body('items.*.quantityReturned')
    .notEmpty()
    .withMessage('Return quantity is required')
    .isFloat({ min: 0.001 })
    .withMessage('Return quantity must be greater than 0'),
  body('items.*.invoiceItemId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid invoice item ID format'),
  body('items.*.batchId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid batch ID format'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
  validate
];

// ==================== MANUAL ENTRY VALIDATORS ====================
const createManualEntryValidator = [
  body().custom((value) => {
    const customerId = value?.customerId || value?.customer;
    if (!customerId) {
      throw new Error('Customer ID is required');
    }
    if (!/^[0-9a-fA-F]{24}$/.test(customerId)) {
      throw new Error('Invalid customer ID format');
    }
    return true;
  }),
  body('entryType')
    .notEmpty()
    .withMessage('Entry type is required')
    .isIn(['opening_balance', 'manual_bill', 'payment_adjustment', 'credit_adjustment'])
    .withMessage('Invalid entry type'),
  body('paymentType')
    .notEmpty()
    .withMessage('Payment type is required')
    .isIn(['Cash', 'Credit'])
    .withMessage('Payment type must be Cash or Credit'),
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('entryDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid entry date format'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  validate
];

const updateManualEntryValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid manual entry ID format'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('paymentType')
    .optional()
    .isIn(['Cash', 'Credit'])
    .withMessage('Payment type must be Cash or Credit'),
  body('entryDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Invalid entry date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description must be between 1 and 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  validate
];

// ==================== COMMON VALIDATORS ====================
const mongoIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate
];

const validateMongoIdParam = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
  validate
];

const paginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
];

module.exports = {
  // Auth
  registerValidator,
  loginValidator,
  changePasswordValidator,
  updateProfileValidator,
  
  // Products
  createProductValidator,
  updateProductValidator,
  adjustStockValidator,
  
  // Customers
  createCustomerValidator,
  updateCustomerValidator,
  
  // Invoices
  createInvoiceValidator,
  updateInvoiceStatusValidator,
  
  // Payments
  createPaymentValidator,
  updatePaymentValidator,
  
  // Credit Notes
  createCreditNoteValidator,
  
  // Manual Entries
  createManualEntryValidator,
  updateManualEntryValidator,
  
  // Notes
  createNoteValidator,
  updateNoteValidator,
  
  // Common
  mongoIdParam,
  validateMongoIdParam,
  paginationQuery
};
