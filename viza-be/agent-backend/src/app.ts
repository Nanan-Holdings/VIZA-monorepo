import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import adminRemindersRouter from './routes/admin-reminders.routes.js';
import telegramWebhookRouter from './routes/telegram-webhook.js';
import validateApplicationRouter from './routes/validate-application.js';
import userPackagesRouter from './routes/user-packages.routes.js';
import applicationAnswersRouter from './routes/application-answers.routes.js';
import profilePrefillRouter from './routes/profile-prefill.routes.js';

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

// User package routes
app.use('/api/user/package', userPackagesRouter);

// Application answers routes
app.use('/api/applications', applicationAnswersRouter);

// Profile prefill routes
app.use('/api/profile/prefill', profilePrefillRouter);

// Error Handler Middleware
app.use(errorHandler);

export default app;
