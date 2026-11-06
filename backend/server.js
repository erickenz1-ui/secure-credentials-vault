/**
 * Server entry point
 * Starts Express server and initializes database
 */

const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { testConnection, closePool } = require('./src/config/database');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  logger.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running in ${config.env} mode on port ${config.port}`);
      logger.info(`📍 API available at http://localhost:${config.port}/api`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION! 💥 Shutting down...');
      logger.error(err.name, err.message);
      
      server.close(async () => {
        await closePool();
        process.exit(1);
      });
    });

    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', async () => {
      logger.info('👋 SIGTERM received. Shutting down gracefully...');
      
      server.close(async () => {
        await closePool();
        logger.info('Process terminated');
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();