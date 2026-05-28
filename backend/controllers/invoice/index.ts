const invoiceController = require('./invoiceController');
const invoiceExportController = require('./invoiceExportController');

module.exports = {
  ...invoiceController,
  ...invoiceExportController
};
