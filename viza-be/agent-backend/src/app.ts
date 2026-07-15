import express from 'express';
import cors from 'cors';
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

const allowedOrigins = (
  process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((o) => o.trim());

const app = express();

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Body limit raised from the 100kb default: the passport-scan OCR route
// (POST /api/passport-scan/extract) receives base64-encoded images that
// reach several MB. Without this, express.json() rejects the body before
// the route runs and the error handler returns a bare 500. 15mb comfortably
// covers the route's own 8mb-base64 cap (which still enforces the real limit
// with a clean 413).
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

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

// Passport scan / OCR extraction
app.use('/api/passport-scan', passportScanRouter);

// Error Handler Middleware
app.use(errorHandler);

export default app;

