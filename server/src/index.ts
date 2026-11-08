import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { assetsRouter } from './routes/assets.js';
import { loansRouter } from './routes/loans.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { locationsRouter } from './routes/locations.js';
import { categoriesRouter } from './routes/categories.js';
import { fundingSourcesRouter } from './routes/fundingSources.js';
import { schoolSettingsRouter } from './routes/schoolSettings.js';
import { realtimeRouter } from './routes/realtime.js';
import { returnsRouter } from './routes/returns.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { backupRouter } from './routes/backup.js';

export const app = express();

// 1. Middleware Keamanan & Kebijakan CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Izinkan request tanpa origin (mobile scanner, Google Lens, curl) atau dari whitelist
      if (
        !origin ||
        config.corsAllowedOrigins.includes('*') ||
        config.corsAllowedOrigins.includes(origin) ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://192.168.')
      ) {
        callback(null, true);
      } else {
        // Tolak tanpa melempar exception yang memicu HTML error stack dump
        callback(null, false);
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// 2. Request Logging sederhana (non-test environment)
app.use((req, _res, next) => {
  if (config.nodeEnv !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// 3. Registrasi Rute API v1
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/assets', assetsRouter);
app.use('/api/v1/loans', loansRouter);
app.use('/api/v1/locations', locationsRouter);
app.use('/api/v1/categories', categoriesRouter);
app.use('/api/v1/funding-sources', fundingSourcesRouter);
app.use('/api/v1/school-settings', schoolSettingsRouter);
app.use('/api/v1/realtime', realtimeRouter);
app.use('/api/v1/returns', returnsRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/audit-logs', auditLogsRouter);
app.use('/api/v1/backup', backupRouter);

// 4. Alias Kompatibilitas untuk Kontrak Frontend (src/services/api.ts)
// Memastikan frontend yang memanggil path tanpa prefix /api/v1 tetap terlayani secara transparan
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/assets', assetsRouter);
app.use('/loans', loansRouter);
app.use('/loan-requests', loansRouter);
app.use('/locations', locationsRouter);
app.use('/categories', categoriesRouter);
app.use('/funding-sources', fundingSourcesRouter);
app.use('/school-settings', schoolSettingsRouter);
app.use('/realtime', realtimeRouter);
app.use('/returns', returnsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/audit-logs', auditLogsRouter);
app.use('/backup', backupRouter);


// 5. Fallback 404 Route
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'ENDPOINT_NOT_FOUND',
    message: 'Endpoint API tidak ditemukan.',
  });
});

// 6. Centralized Error Handler (Menjamin tidak ada detail SQL atau rahasia yang bocor)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Unhandled Error]:', err?.message || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.code || 'INTERNAL_SERVER_ERROR',
    message:
      status === 500
        ? 'Terjadi kesalahan sistem internal. Detail kesalahan disembunyikan demi keamanan.'
        : err.message || 'Permintaan gagal diproses.',
  });
});

// 7. Jalankan server jika dipanggil langsung
if (process.argv[1]?.includes('index') && process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`=====================================================`);
    console.log(` SIMSARPRAS Express API v2.1.0 Aktif`);
    console.log(` Port: ${config.port} | Mode: ${config.nodeEnv}`);
    console.log(` Health: http://localhost:${config.port}/api/v1/health`);
    console.log(`=====================================================`);
  });
}
