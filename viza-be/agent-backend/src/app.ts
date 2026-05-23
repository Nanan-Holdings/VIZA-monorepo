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

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

const app = express();

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Submission result + per-application artifact endpoints
app.use('/api/applications', submissionResultRouter);

// UK account credential registration (for forceResume + post-auth walk)
app.use('/api/applications', ukAccountRouter);

// Passport scan / OCR extraction
app.use('/api/passport-scan', passportScanRouter);

// Error Handler Middleware
app.use(errorHandler);

export default app;

