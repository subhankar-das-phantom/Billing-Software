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
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
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
    .optional()
    .trim()
    .matches(/^[0-9A-Z]{15}$|^$/)
    .withMessage('GSTIN must be 15 alphanumeric characters'),
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
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Batch number must be less than 50 characters'),
  body('expiryDate')
    .optional()
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
    .optional()
    .trim()
    .matches(/^[0-9A-Z]{15}$|^$/)
    .withMessage('GSTIN must be 15 alphanumeric characters'),
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

// ==================== COMMON VALIDATORS ====================
const mongoIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
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
  loginValidator,
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
  
  // Common
  mongoIdParam,
  paginationQuery
};
