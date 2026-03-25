import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import adminRemindersRouter from './routes/admin-reminders.routes.js';

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

// Error Handler Middleware
app.use(errorHandler);

export default app;