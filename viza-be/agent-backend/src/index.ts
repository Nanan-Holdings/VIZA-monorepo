// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import http from 'http';
import app from './app.js';
import { testSupabaseConnection } from './db/supabase-client.js';
import { Logger } from './utils/logger.js';

const logger = new Logger({ serviceName: 'ServerStartup' });

const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

const server = http.createServer(app);

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.warn('SIGTERM signal received: shutting down');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 5s if connections don't close
  setTimeout(() => process.exit(0), 5000);
});

process.on('SIGINT', () => {
  logger.warn('SIGINT signal received: shutting down');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000);
});

server.listen(port)
  .once('listening', async () => {
    logger.info('Server started', { url: `http://localhost:${port}`, port });

    // Health check: Test Supabase connection
    logger.info('Checking Supabase connection');
    const healthCheck = await testSupabaseConnection();
    if (healthCheck.success) {
      logger.info('Supabase connection successful', { message: healthCheck.message });
    } else {
      logger.warn('Supabase connection failed', undefined, {
        message: healthCheck.message,
        note: 'Server will continue running, but database operations may fail',
      });
    }
  })
  .once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use. Each service needs a unique port:
  admin-website     → 3000
  lab-report-generator → 3001
  agent-backend     → 3002
  viza-chatbot      → 3003`, err);
    } else {
      logger.error('Server error', err);
    }
    process.exit(1);
  });
