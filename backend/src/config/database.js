/**
 * PostgreSQL connection pool
 * Provides database connectivity with error handling
 */

const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

// Create connection pool
const pool = new Pool(config.db);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

// Test connection on startup
async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('✅ Database connected successfully');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Graceful shutdown
async function closePool() {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool:', error);
  }
}

// Query helper with error handling
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries in development
    if (config.isDevelopment && duration > 1000) {
      logger.warn(`Slow query (${duration}ms):`, text);
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', {
      query: text,
      error: error.message,
      code: error.code
    });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection,
  closePool,
};