module.exports = {
  // GST Rates available
  GST_RATES: [0, 5, 12, 18, 28],
  
  // Low stock threshold
  LOW_STOCK_THRESHOLD: 10,
  
  // Pagination defaults
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  
  // Invoice status
  INVOICE_STATUS: {
    CREATED: 'Created',
    PRINTED: 'Printed',
    CANCELLED: 'Cancelled'
  },
  
  // Payment types
  PAYMENT_TYPES: {
    CASH: 'Cash',
    CREDIT: 'Credit'
  },
  
  // Units
  UNITS: ['Pieces', 'Strips', 'Bottles', 'Boxes', 'ML', 'GM', 'KG', 'Litres']
};
