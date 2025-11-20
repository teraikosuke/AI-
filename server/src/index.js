import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/routes.js';
import metricsRoutes from './metrics/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:8000',
  'http://localhost:8001',
  'http://localhost:8002',
  'http://127.0.0.1:8080',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
const envOrigins = (process.env.APP_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));
const allowAll = process.env.ALLOW_ALL_ORIGINS === 'true';

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowAll || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`[cors] blocked origin ${origin}. Configure APP_ORIGINS or set ALLOW_ALL_ORIGINS=true`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
