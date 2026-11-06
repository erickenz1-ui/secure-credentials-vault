/**
 * Express application setup
 * Configures middleware, routes, and error handling
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { AppError } = require('./utils/errors');

// Import routes (we'll create these in later steps)
const authRoutes = require('./routes/auth.routes');
const credentialRoutes = require('./routes/credential.routes');
const userRoutes = require('./routes/user.routes');
const teamRoutes = require('./routes/team.routes');
const auditRoutes = require('./routes/audit.routes');

// Create Express app
const app = express();

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet: Set security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // For styled-components
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS: Configure allowed origins
app.use(cors({
  origin: config.clientUrl,
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: {
    error: 'Too many login attempts, please try again after 15 minutes.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true,
});

app.use('/api/auth/login', authLimiter);

// ============================================
// BODY PARSING
// ============================================

app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ============================================
// REQUEST LOGGING (development only)
// ============================================

if (config.isDevelopment) {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    next();
  });
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============================================
// API ROUTES
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/audit', auditRoutes);

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res, next) => {
  const error = new AppError(`Not found: ${req.originalUrl}`, 404);
  next(error);
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Operational errors: send to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details && { details: err.details })
    });
  }

  // Programming errors: don't leak details in production
  if (config.isProduction) {
    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }

  // Development: send full error
  res.status(500).json({
    error: err.message,
    code: 'INTERNAL_ERROR',
    stack: err.stack
  });
});

module.exports = app;