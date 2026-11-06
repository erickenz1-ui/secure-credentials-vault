/**
 * Centralized configuration with validation
 * Loads and validates all environment variables
 */

require('dotenv').config();

const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'MASTER_ENCRYPTION_KEY',
  'JWT_SECRET'
];

// Validate required environment variables
function validateEnv() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nPlease check your .env file');
    process.exit(1);
  }

  // Validate master key format
  const masterKey = process.env.MASTER_ENCRYPTION_KEY;
  if (!/^[a-f0-9]{64}$/.test(masterKey)) {
    console.error('❌ MASTER_ENCRYPTION_KEY must be a 64-character hex string');
    console.error('   Generate one with: node scripts/generate-master-key.js');
    process.exit(1);
  }

  // Validate JWT secret length
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }
}

validateEnv();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Database
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20, // Max connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Security
  masterEncryptionKey: process.env.MASTER_ENCRYPTION_KEY,
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '7d',
  },

  // CORS
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },

  // Password Policy
  passwordPolicy: {
    minLength: parseInt(process.env.MIN_PASSWORD_LENGTH, 10) || 12,
    requireSpecialChar: process.env.REQUIRE_SPECIAL_CHAR === 'true',
  },
};

module.exports = config;