import './config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import applicationsRouter from './routes/applications';
import roomsRouter from './routes/rooms';
import allocationsRouter from './routes/allocations';
import feesRouter from './routes/fees';
import paymentsRouter from './routes/payments';
import visitorsRouter from './routes/visitors';
import curfewRouter from './routes/curfew';
import outpassesRouter from './routes/outpasses';
import noticesRouter from './routes/notices';
import notificationsRouter from './routes/notifications';
import adminRouter from './routes/admin';
import reportsRouter from './routes/reports';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Hostel Management System API', version: '1.0.0', time: new Date() });
});

// Modular Routes
app.use('/api/auth', authRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/fees', feesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/visitors', visitorsRouter);
app.use('/api/curfew', curfewRouter);
app.use('/api/outpasses', outpassesRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Hostel Management System API Server running on port ${PORT}`);
});
