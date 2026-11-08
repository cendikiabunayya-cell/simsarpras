/**
 * SIMSARPRAS Database Connection Pool (PostgreSQL / Supabase)
 */
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

export async function checkDatabaseConnection(): Promise<{ connected: boolean; message: string }> {
  if (!pool) {
    return {
      connected: false,
      message: 'DATABASE_URL belum dikonfigurasi. Backend berjalan dalam mode persiapan.',
    };
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT NOW() as current_time');
      return {
        connected: true,
        message: `Terhubung ke PostgreSQL pada ${res.rows[0].current_time}`,
      };
    } finally {
      client.release();
    }
  } catch (error: any) {
    return {
      connected: false,
      message: `Gagal terhubung ke database: ${error?.message || error}`,
    };
  }
}
