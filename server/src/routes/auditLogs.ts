import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const auditLogsRouter = Router();

/**
 * GET /api/v1/audit-logs & GET /audit-logs
 * Mengambil log aktivitas audit dari basis data PostgreSQL lokal
 */
auditLogsRouter.get('/', requireAuth, async (_req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const result = await pool.query(`
      SELECT id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 200
    `);

    const data = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userRole: row.user_role,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name || undefined,
      details: row.details,
      timestamp: row.created_at,
    }));

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Audit Logs Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat log audit.',
    });
  }
});
