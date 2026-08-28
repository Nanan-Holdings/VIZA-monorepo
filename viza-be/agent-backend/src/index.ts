// Load environment variables FIRST before any other imports
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { closeDatabase, verifyDatabaseRuntimeGuards } from './db/index.js';
import { testSupabaseConnection } from './db/supabase-client.js';
import { describeMissingSupabaseUserAuthEnv } from './routes/supabase-user-auth-config.js';
import { registerVisaNamespace } from './socket/visa-namespace.js';
import {
  initializeSocketScaling,
  resolveSocketScalingConfig,
} from './socket/socket-scaling.js';
import { Logger } from './utils/logger.js';
import { initSentry } from './observability/sentry-init.js';
import {
  startRuntimeCapacityMonitor,
  stopRuntimeCapacityMonitor,
} from './observability/runtime-capacity.js';
import { createBoundedServerShutdown } from './server-shutdown.js';
import { startPortalHealthProbeScheduler } from './services/portal-health.service.js';

await initSentry();

const logger = new Logger({ serviceName: 'ServerStartup' });
let stopStatusProbeScheduler: (() => void) | null = null;

const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;

function warnMissingUserAuthEnv(): void {
  const missing = describeMissingSupabaseUserAuthEnv();
  if (missing.length === 0) return;
  logger.warn('supabase_user_auth_env_missing', undefined, {
    missingVars: missing,
    note:
      'Applicant-authenticated routes such as /api/applications/:id/us-appointment/* require Supabase URL and anon key env vars to verify frontend Supabase access tokens.',
  });
}

const allowedOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((o) => o.trim());

const server = http.createServer(app);
const socketScalingConfig = resolveSocketScalingConfig();

// Socket.IO — attach to the same HTTP server
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: socketScalingConfig.transports,
});

const gracefulShutdownTimeoutMs = 5_000;
let shutdownExitStarted = false;
let closeSocketScaling = async (): Promise<void> => undefined;

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown shutdown error');
}

function shutdown(signal: 'SIGINT' | 'SIGTERM'): void {
  if (shutdownExitStarted) return;
  shutdownExitStarted = true;
  logger.warn(`${signal} signal received: shutting down`);

  void shutdownServer()
    .then(() => {
      logger.info('Socket.IO, HTTP server, and database pool closed');
      process.exit(0);
    })
    .catch((error: unknown) => {
      logger.error('Graceful shutdown failed', toError(error), {
        timeoutMs: gracefulShutdownTimeoutMs,
      });
      process.exit(1);
    });
}

const shutdownServer = createBoundedServerShutdown({
  io,
  closeDatabase,
  beforeClose: () => {
    stopStatusProbeScheduler?.();
    stopRuntimeCapacityMonitor();
  },
  afterSocketClose: () => closeSocketScaling(),
  timeoutMs: gracefulShutdownTimeoutMs,
});

// Disconnect upgraded transports before draining HTTP and the database pool.
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

try {
  const runtimeGuards = await verifyDatabaseRuntimeGuards();
  if (runtimeGuards) {
    logger.info('Database role timeout guards verified', runtimeGuards);
  }
  const socketScaling = await initializeSocketScaling(io, socketScalingConfig);
  closeSocketScaling = socketScaling.close;
  logger.info('Socket.IO topology initialized', {
    mode: socketScalingConfig.mode,
    multiReplicaEnabled: socketScalingConfig.multiReplicaEnabled,
    transports: socketScalingConfig.transports,
  });

  // Register only after the shared adapter is ready so a multi-replica process
  // never accepts a namespace connection with a partial in-memory topology.
  registerVisaNamespace(io.of('/visa'));
} catch (error) {
  logger.error('Backend startup guard failed', toError(error));
  await closeSocketScaling().catch(() => undefined);
  await closeDatabase().catch((closeError: unknown) => {
    logger.error('Database pool failed to close after backend startup failure', toError(closeError));
  });
  throw error;
}

startRuntimeCapacityMonitor();

server.listen(port)
  .once('listening', async () => {
    logger.info('Server started', { url: `http://localhost:${port}`, port });
    warnMissingUserAuthEnv();

    // Health check: Test Supabase connection
    logger.info('Checking Supabase connection');
    const healthCheck = await testSupabaseConnection();
    if (healthCheck.success) {
      logger.info('Supabase connection successful', { message: healthCheck.message });
      stopStatusProbeScheduler = startPortalHealthProbeScheduler();
    } else {
      logger.warn('Supabase connection failed', undefined, {
        message: healthCheck.message,
        note: 'Server will continue running, but database operations may fail',
      });
    }
  })
  .once('error', (err: NodeJS.ErrnoException) => {
    stopRuntimeCapacityMonitor();
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
