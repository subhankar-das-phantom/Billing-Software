const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for dev
  console.error('Error:', err);

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
      message = 'Phone number already exists for another Customer';
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

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
