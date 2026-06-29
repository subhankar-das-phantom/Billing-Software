import { query } from 'express-validator';

export const validateDateRange = [
  query('period')
    .optional({ checkFalsy: true })
    .isIn(['today', 'last7days', 'last30days', 'thisMonth', 'lastMonth', 'last3months', 'last6months', 'thisYear', 'custom', 'all'])
    .withMessage('Invalid period'),
  query('startDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Start date must be a valid ISO8601 date'),
  query('endDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('End date must be a valid ISO8601 date'),
];

export const validateYear = [
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Invalid year'),
];

export const validateLimit = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
