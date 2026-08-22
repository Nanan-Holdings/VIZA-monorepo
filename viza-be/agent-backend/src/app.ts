import express from 'express';
import cors from 'cors';
import type { ErrorRequestHandler } from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import adminRemindersRouter from './routes/admin-reminders.routes.js';
import telegramWebhookRouter from './routes/telegram-webhook.js';
import validateApplicationRouter from './routes/validate-application.js';
import userPackagesRouter from './routes/user-packages.routes.js';
import applicationAnswersRouter from './routes/application-answers.routes.js';
import profilePrefillRouter from './routes/profile-prefill.routes.js';
import translationRouter from './routes/translation.routes.js';
import fieldGuidanceRouter from './routes/field-guidance.routes.js';
import chatSaveBlockRouter from './routes/chat-save-block.routes.js';
import internalAutomationRouter from './routes/internal-automation/index.js';
import submissionResultRouter from './routes/submission-result.routes.js';
import passportScanRouter from './routes/passport-scan.routes.js';
import ukAccountRouter from './routes/uk-account.routes.js';
import {
  officialFeeApplicationRouter,
  officialFeeOperationsRouter,
} from './routes/official-fee.routes.js';
import {
  usAppointmentApplicationRouter,
  usAppointmentOperationsRouter,
} from './routes/us-appointment.routes.js';
import {
  franceAppointmentApplicationRouter,
  franceAppointmentOperationsRouter,
} from './routes/france-appointment.routes.js';
import {
  japanAppointmentApplicationRouter,
  japanAppointmentOperationsRouter,
} from './routes/japan-appointment.routes.js';
import {
  publicStatusRouter,
  statusOperationsRouter,
} from './routes/public-status.routes.js';
import {
  testActiveKnowledgeRelease,
  testSupabaseConnection,
} from './db/supabase-client.js';

const allowedOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((o) => o.trim());

const app = express();

const MIN_READINESS_TIMEOUT_MS = 2_000;
const MAX_READINESS_TIMEOUT_MS = 3_000;

function getReadinessTimeoutMs(): number {
  const configured = Number(
    process.env.READINESS_DB_TIMEOUT_MS ?? process.env.READINESS_TIMEOUT_MS ?? MAX_READINESS_TIMEOUT_MS,
  );
  if (!Number.isFinite(configured)) return MAX_READINESS_TIMEOUT_MS;
  return Math.min(
    MAX_READINESS_TIMEOUT_MS,
    Math.max(MIN_READINESS_TIMEOUT_MS, Math.floor(configured)),
  );
}

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Passport scan / OCR receives a base64 image and therefore needs a larger
// parser than ordinary API requests. Mount this before the 1 MB global parser
// and retain the route's own ~8 MB base64 validation cap.
app.use(
  '/api/passport-scan',
  express.json({ limit: '15mb' }),
  express.urlencoded({ extended: true, limit: '15mb' }),
  passportScanRouter,
);

// Keep normal API payloads small. The passport OCR endpoint is mounted with
// its own parser below, before this global parser can reject its larger image.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Process-only liveness probe. This must not touch Supabase or any other
// dependency so an outage cannot make the process look dead.
app.get('/live', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Dependency readiness probe. A failed or timed-out Supabase check is a real
// readiness failure, while the bounded timeout prevents health infrastructure
// from waiting on a stalled network connection.
app.get('/ready', async (_req, res) => {
  const check = await testSupabaseConnection(getReadinessTimeoutMs());
  res.status(check.success ? 200 : 503).json({
    status: check.success ? 'ready' : 'not_ready',
    dependency: 'supabase',
    dependencyStatus: check.success ? 'ok' : 'unavailable',
    error: check.success ? null : check.error ?? check.message,
    latencyMs: check.latencyMs,
  });
});

// Legacy health endpoint. Keep the 200 response contract used by existing
// Render probes, but report dependency degradation truthfully in the body.
app.get('/health', async (_req, res) => {
  const check = await testActiveKnowledgeRelease(getReadinessTimeoutMs());
  res.status(200).json({
    status: check.success ? 'ok' : 'degraded',
    dependency: 'supabase',
    dependencyStatus: check.success ? 'ok' : 'unavailable',
    error: check.success ? null : check.error ?? check.message,
    latencyMs: check.latencyMs,
    gitSha:
      process.env.RENDER_GIT_COMMIT ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GIT_COMMIT_SHA ??
      'unknown',
    memorySchemaVersion: 1,
    knowledgeReleaseId: check.releaseId,
    knowledgeReleaseKey: check.releaseKey,
  });
});

// Public, redacted service-status snapshot and secret-protected probe trigger.
app.use('/api/public/status', publicStatusRouter);
app.use('/api/internal/status', statusOperationsRouter);

// Admin routes
app.use('/api/admin/reminders', adminRemindersRouter);

// Telegram webhook (for news-monitor approval flow)
app.use('/webhook/telegram', telegramWebhookRouter);

// AI validation endpoint
app.use('/api/validate-application', validateApplicationRouter);

// Field-level form guidance endpoint
app.use('/api/field-guidance', fieldGuidanceRouter);

// Chat block save endpoint
app.use('/api/chat/save-block', chatSaveBlockRouter);

// User package routes
app.use('/api/user/package', userPackagesRouter);

// Internal website automation routes
app.use('/api/internal-automation', internalAutomationRouter);

// Application answers routes
app.use('/api/applications', applicationAnswersRouter);

// Profile prefill routes
app.use('/api/profile/prefill', profilePrefillRouter);

// Application translation routes
app.use('/api/applications', translationRouter);

// Official visa fee quote/consent/payment dry-run framework
app.use('/api/applications', officialFeeApplicationRouter);
app.use('/api/official-fee', officialFeeOperationsRouter);

// U.S. appointment assistance dry-run/manual checkpoint framework
app.use('/api/applications', usAppointmentApplicationRouter);
app.use('/api/us-appointment', usAppointmentOperationsRouter);

// France Schengen TLScontact appointment assistance framework
app.use('/api/applications', franceAppointmentApplicationRouter);
app.use('/api/france-appointment', franceAppointmentOperationsRouter);

// Japan temporary-visitor VFS/JVAC Singapore appointment preparation
app.use('/api/applications', japanAppointmentApplicationRouter);
app.use('/api/japan-appointment', japanAppointmentOperationsRouter);

// Submission result + per-application artifact endpoints
app.use('/api/applications', submissionResultRouter);

// UK account credential registration (for forceResume + post-auth walk)
app.use('/api/applications', ukAccountRouter);

const bodyParserErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({ success: false, error: 'Request body too large' });
    return;
  }
  next(error);
};

app.use(bodyParserErrorHandler);

// Error Handler Middleware
app.use(errorHandler);

export default app;
