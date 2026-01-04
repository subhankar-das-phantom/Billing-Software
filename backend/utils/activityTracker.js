const Employee = require('../models/Employee');

/**
 * Activity types for tracking employee actions
 */
const ACTIVITY_TYPES = {
  INVOICE_CREATED: 'invoice_created',
  PAYMENT_RECORDED: 'payment_recorded',
  PRODUCT_ADDED: 'product_added',
  PRODUCT_UPDATED: 'product_updated',
  STOCK_ADJUSTED: 'stock_adjusted',
  CUSTOMER_ADDED: 'customer_added'
};

/**
 * Update employee metrics when they perform an action
 * This runs asynchronously to not block the main request
 * 
 * @param {string} employeeId - The employee's ObjectId
 * @param {string} action - One of ACTIVITY_TYPES
 * @param {number|object} value - Value to increment (amount for sales/payments)
 */
const updateEmployeeMetrics = async (employeeId, action, value = 1) => {
  if (!employeeId) return;

  try {
    let updateQuery = {
      $set: { 'metrics.lastActivityAt': new Date() }
    };

    // Build the increment query based on action type
    switch (action) {
      case ACTIVITY_TYPES.INVOICE_CREATED:
        updateQuery.$inc = {
          'metrics.invoicesCreatedCount': 1,
          'metrics.totalSalesGenerated': typeof value === 'object' ? (value.amount || 0) : value
        };
        break;

      case ACTIVITY_TYPES.PAYMENT_RECORDED:
        updateQuery.$inc = {
          'metrics.paymentsRecordedCount': 1,
          'metrics.paymentsAmountRecorded': typeof value === 'number' ? value : 0
        };
        break;

      case ACTIVITY_TYPES.PRODUCT_ADDED:
        updateQuery.$inc = { 'metrics.productsAddedCount': 1 };
        break;

      case ACTIVITY_TYPES.PRODUCT_UPDATED:
        updateQuery.$inc = { 'metrics.productsUpdatedCount': 1 };
        break;

      case ACTIVITY_TYPES.STOCK_ADJUSTED:
        updateQuery.$inc = { 'metrics.stockAdjustmentsCount': 1 };
        break;

      case ACTIVITY_TYPES.CUSTOMER_ADDED:
        updateQuery.$inc = { 'metrics.customersAddedCount': 1 };
        break;

      default:
        // Just update lastActivityAt
        break;
    }

    await Employee.findByIdAndUpdate(employeeId, updateQuery);
  } catch (error) {
    // Log error but don't throw - metrics update should not break main flow
    console.error(`Failed to update employee metrics: ${error.message}`);
  }
};

/**
 * Track activity for a user (only updates metrics if user is an employee)
 * 
 * @param {object} req - Express request object with user info
 * @param {string} action - One of ACTIVITY_TYPES
 * @param {number|object} value - Value to increment
 */
const trackActivity = (req, action, value = 1) => {
  // Only track metrics for employees
  if (req.userRole === 'employee' && req.user) {
    // Run async, don't await - fire and forget
    updateEmployeeMetrics(req.user._id, action, value).catch(() => {});
  }
};

/**
 * Helper to check if request is from an employee
 */
const isEmployee = (req) => {
  return req.userRole === 'employee';
};

/**
 * Helper to check if request is from an admin
 */
const isAdmin = (req) => {
  return req.userRole === 'admin';
};

module.exports = {
  ACTIVITY_TYPES,
  updateEmployeeMetrics,
  trackActivity,
  isEmployee,
  isAdmin
};
