import { pool } from '../db.js';

export interface AuditLogParams {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType: 'ASSET' | 'LOCATION' | 'CATEGORY' | 'FUNDING_SOURCE' | 'SCHOOL_SETTINGS' | 'LOAN' | 'USER' | 'SYSTEM' | 'POLICY';
  entityId: string;
  entityName?: string | null;
  details: string;
  ipAddress?: string | null;
}

/**
 * Mencatat peristiwa perubahan data ke tabel immutable audit_logs di PostgreSQL/Supabase.
 * Dirancang fail-safe agar kegagalan log tidak mengganggu jalannya operasi utama.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  if (!pool) return;
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        id,
        params.userId || 'system',
        params.userName || 'Sistem / Pengguna',
        params.userRole || 'USER',
        params.action,
        params.entityType,
        params.entityId,
        params.entityName || null,
        params.details,
        params.ipAddress || null,
      ]
    );
  } catch (error: any) {
    console.warn('[Audit Log Write Warning]:', error?.message || error);
  }
}
