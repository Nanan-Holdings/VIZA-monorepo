// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { testSupabaseConnection } from './db/supabase-client.js';
import { registerVisaNamespace } from './socket/visa-namespace.js';
import { Logger } from './utils/logger.js';
import { initSentry } from './observability/sentry-init.js';

await initSentry();

const logger = new Logger({ serviceName: 'ServerStartup' });

const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

function warnMissingUserAuthEnv(): void {
  const missing = [
    process.env.NEXT_PUBLIC_SUPABASE_URL ? null : 'NEXT_PUBLIC_SUPABASE_URL',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? null : 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter((value): value is string => Boolean(value));

  if (missing.length === 0) return;
  logger.warn('supabase_user_auth_env_missing', undefined, {
    missingVars: missing,
    note:
      'Applicant-authenticated routes such as /api/applications/:id/us-appointment/* require these env vars to verify frontend Supabase access tokens.',
  });
}

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

const server = http.createServer(app);

// Socket.IO — attach to the same HTTP server
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// Register the /visa namespace that the client connects to
const visaNsp = io.of('/visa');
registerVisaNamespace(visaNsp);

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
    warnMissingUserAuthEnv();

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
