require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Rate limiting configuration (generous limits)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Slightly stricter for auth routes to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 auth attempts per 15 minutes (more lenient for development)
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Connect to database and initialize Change Stream
connectDB().then(() => {
  const stockChangeStream = require('./services/stockChangeStream');
  stockChangeStream.initialize();
});

const app = express();

// Razorpay webhooks must receive the raw body for signature validation.
app.post(
  '/api/saas/subscription/webhook',
  express.raw({ type: 'application/json' }),
  require('./saas/controllers/subscriptionController').handleRazorpayWebhook
);

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com", "https://lumberjack.razorpay.com"],
      frameSrc: ["'self'", "https://checkout.razorpay.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Allow loading Google Fonts cross-origin
  permittedCrossDomainPolicies: { permittedPolicies: 'none' }
}));

// Permissions-Policy header (not set by Helmet by default)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  next();
});

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routes with rate limiting
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/employees', generalLimiter, require('./routes/employees'));
app.use('/api/analytics', generalLimiter, require('./routes/analytics'));
app.use('/api/products', generalLimiter, require('./routes/products'));
app.use('/api/batches', generalLimiter, require('./routes/batches'));
app.use('/api/customers', generalLimiter, require('./routes/customers'));
app.use('/api/invoices', generalLimiter, require('./routes/invoices'));
app.use('/api/dashboard', generalLimiter, require('./routes/dashboard'));
app.use('/api/notes', generalLimiter, require('./routes/notes'));
app.use('/api/payments', generalLimiter, require('./routes/payments'));
app.use('/api/reports', generalLimiter, require('./routes/reports'));
app.use('/api/sales-analytics', generalLimiter, require('./src/modules/salesAnalytics/routes/index'));
app.use('/api/manual-entries', generalLimiter, require('./routes/manualEntries'));
app.use('/api/credit-notes', generalLimiter, require('./routes/creditNotes'));
app.use('/api/saas', generalLimiter, require('./saas/routes'));

// SSE route — no rate limiter (long-lived connection, protected by auth + per-user limit)
app.use('/api/stock-events', require('./routes/stockEvents'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Bharat Enterprise Billing API is running' });
});

// Error handler
app.use(errorHandler);

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
