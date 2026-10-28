const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  const statusCode = error.statusCode || err.statusCode || err.status || 500;
  error.statusCode = statusCode;

  // Log error: structured single-line in production, full stack trace in development
  if (process.env.NODE_ENV === 'production') {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      method: req?.method,
      url: req?.originalUrl,
      status: statusCode,
      message: err.message || 'Unknown error'
    }));
  } else {
    console.error('Error:', err);
  }

  // Request body payload too large
  if (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413) {
    error.statusCode = 413;
    error.message = 'Payload too large. Request body exceeds maximum allowed size of 1MB.';
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error.statusCode = 404;
    error.message = message;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyValue || {});
    let message = 'Duplicate field value. Please use another value';

    if (duplicateFields.includes('phone')) {
      message = 'Phone number already exists for another customer in this tenant';
    } else if (duplicateFields.includes('creditNoteNumber')) {
      message = 'Credit note number already exists in this tenant';
    } else if (duplicateFields.length > 0) {
      message = `Duplicate field value: ${duplicateFields.join(', ')}. Please use another value`;
    }

    error.statusCode = 400;
    error.message = message;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error.statusCode = 400;
    error.message = message;
  }

  // Sanitize 500 errors in production to prevent technical information leakage
  const finalStatusCode = error.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  const responseMessage = (isProd && finalStatusCode === 500)
    ? 'Internal Server Error'
    : (error.message || 'Server Error');

  res.status(finalStatusCode).json({
    success: false,
    message: responseMessage
  });
};

module.exports = errorHandler;
