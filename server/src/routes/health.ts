import { Router } from 'express';
import { checkDatabaseConnection } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbStatus = await checkDatabaseConnection();

  res.status(dbStatus.connected ? 200 : 503).json({
    status: dbStatus.connected ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'SIMSARPRAS Express API',
    version: '2.1.0',
    database: dbStatus,
  });
});
