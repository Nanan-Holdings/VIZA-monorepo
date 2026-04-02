import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import adminRemindersRouter from './routes/admin-reminders.routes.js';
import telegramWebhookRouter from './routes/telegram-webhook.js';
import validateApplicationRouter from './routes/validate-application.js';

const app = express();

// Middleware
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

// Error Handler Middleware
app.use(errorHandler);

export default app;
