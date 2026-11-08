/**
 * SIMSARPRAS: Staging Database Read-Only Connectivity Probe (Fase 2H)
 * Deskripsi: Melakukan uji konektivitas read-only minimal tanpa menjalankan DDL,
 *            tanpa DML, tanpa seed, tanpa migrasi, dan tanpa mengubah database.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { sanitizeConnectionUrl } from './migrate.js';

dotenv.config();

const { Pool } = pg;

export interface ProbeResult {
  endpointType: 'DIRECT_SESSION_PORT_5432' | 'TRANSACTION_POOLER_PORT_6543';
  sanitizedHost: string;
  port: string;
  status: 'PASS' | 'BLOCKED' | 'FAIL';
  failureCategory?:
    | 'CONFIG_PLACEHOLDER'
    | 'INVALID_URI'
    | 'PRODUCTION_DETECTED'
    | 'ENDPOINT_MISMATCH'
    | 'DNS_RESOLUTION_FAILURE'
    | 'NETWORK_ACCESS_FAILURE'
    | 'TLS_HANDSHAKE_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'UNKNOWN_ERROR';
  sanitizedError?: string;
  serverTime?: string;
  databaseName?: string;
  postgresVersion?: string;
}

export interface StagingConnectivityReport {
  timestamp: string;
  configStatus: 'PASS' | 'BLOCKED';
  overallStatus: 'PASS' | 'BLOCKED' | 'FAIL';
  directProbe: ProbeResult;
  poolerProbe: ProbeResult;
  guardrailStatus: {
    appEnv: string;
    allowStagingMigration: string;
    stagingProjectRefConfigured: boolean;
    migrationBlockedByGuardrail: boolean;
  };
}

/**
 * Memvalidasi apakah string merupakan placeholder template
 */
export function isPlaceholder(val?: string): boolean {
  if (!val || val.trim() === '') return true;
  const s = val.trim();
  return (
    s.includes('CONNECTION_STRING') ||
    s.includes('PROJECT_REF_STAGING') ||
    s.includes('ganti_') ||
    s.includes('[PROJECT_REF') ||
    s === 'PROJECT_REF_STAGING'
  );
}

/**
 * Mengklasifikasikan error koneksi PostgreSQL ke dalam kategori penyebab yang dapat dibuktikan
 */
export function classifyError(error: any): {
  category: ProbeResult['failureCategory'];
  message: string;
} {
  const msg = (error?.message || String(error)).toLowerCase();
  const code = (error?.code || '').toUpperCase();

  if (msg.includes('enotfound') || msg.includes('eai_again') || code === 'ENOTFOUND') {
    return {
      category: 'DNS_RESOLUTION_FAILURE',
      message: 'Gagal menyelesaikan nama domain database (DNS resolution failed). Periksa apakah hostname Supabase benar.',
    };
  }

  if (msg.includes('etimedout') || msg.includes('econnrefused') || msg.includes('ehostunreach') || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
    return {
      category: 'NETWORK_ACCESS_FAILURE',
      message: 'Koneksi jaringan terputus atau timeout. Port mungkin diblokir oleh firewall atau ISP.',
    };
  }

  if (msg.includes('ssl') || msg.includes('tls') || msg.includes('certificate') || msg.includes('handshake')) {
    return {
      category: 'TLS_HANDSHAKE_FAILURE',
      message: 'Kegagalan negosiasi TLS/SSL handshake.',
    };
  }

  if (msg.includes('password authentication failed') || msg.includes('authentication') || code === '28P01') {
    return {
      category: 'AUTHENTICATION_FAILURE',
      message: 'Autentikasi gagal: password atau username database tidak cocok.',
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    message: error?.message || 'Terjadi kesalahan koneksi yang tidak terduga.',
  };
}

/**
 * Mengeksekusi probe read-only minimal terhadap satu target URL
 */
export async function probeEndpoint(
  targetUrl: string,
  endpointType: 'DIRECT_SESSION_PORT_5432' | 'TRANSACTION_POOLER_PORT_6543',
  expectedProjectRef: string
): Promise<ProbeResult> {
  // 1. Validasi Keberadaan & Bukan Placeholder
  if (isPlaceholder(targetUrl)) {
    return {
      endpointType,
      sanitizedHost: '[PLACEHOLDER_NOT_CONFIGURED]',
      port: endpointType === 'DIRECT_SESSION_PORT_5432' ? '5432' : '6543',
      status: 'BLOCKED',
      failureCategory: 'CONFIG_PLACEHOLDER',
      sanitizedError: 'Nilai URL masih berupa string placeholder template dan belum diisi kredensial riil.',
    };
  }

  // 2. Parsing URI
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      endpointType,
      sanitizedHost: '[INVALID_URI]',
      port: 'unknown',
      status: 'BLOCKED',
      failureCategory: 'INVALID_URI',
      sanitizedError: 'Format URL koneksi bukan merupakan URI standar yang valid.',
    };
  }

  const sanitizedHost = sanitizeConnectionUrl(targetUrl);
  const hostname = parsed.hostname.toLowerCase();
  const username = parsed.username.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const port = parsed.port || (endpointType === 'DIRECT_SESSION_PORT_5432' ? '5432' : '6543');

  // 3. Deteksi Kata Kunci Produksi
  const isProd =
    hostname.includes('prod') ||
    hostname.includes('production') ||
    username.includes('prod') ||
    username.includes('production') ||
    pathname.includes('prod');

  if (isProd) {
    return {
      endpointType,
      sanitizedHost,
      port,
      status: 'BLOCKED',
      failureCategory: 'PRODUCTION_DETECTED',
      sanitizedError: 'Target terindikasi sebagai lingkungan PRODUKSI (terdeteksi kata kunci prod/production). Probe dibatalkan demi keamanan.',
    };
  }

  // 4. Verifikasi Kesesuaian Project Reference
  if (expectedProjectRef && !isPlaceholder(expectedProjectRef)) {
    const cleanRef = expectedProjectRef.trim().toLowerCase();
    const hasRef =
      username.includes(cleanRef) ||
      hostname.includes(cleanRef) ||
      (cleanRef === 'local-staging' && (hostname === 'localhost' || hostname === '127.0.0.1'));

    if (!hasRef) {
      return {
        endpointType,
        sanitizedHost,
        port,
        status: 'BLOCKED',
        failureCategory: 'ENDPOINT_MISMATCH',
        sanitizedError: 'Hostname atau username tidak cocok dengan STAGING_PROJECT_REF yang diizinkan.',
      };
    }
  }

  // 5. Eksekusi Probe Read-Only (HANYA 'SELECT 1')
  // JAMINAN MUTLAK: Tidak ada DDL, DML, seed, atau migrasi yang dijalankan!
  const pool = new Pool({
    connectionString: targetUrl,
    ssl: targetUrl.includes('supabase.com') ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 5000,
    max: 1,
  });

  try {
    const client = await pool.connect();
    try {
      // Query read-only non-destruktif
      const res = await client.query('SELECT 1 as probe_check, NOW() as server_time, current_database() as db_name, version() as pg_version');
      const row = res.rows[0];

      return {
        endpointType,
        sanitizedHost,
        port,
        status: 'PASS',
        serverTime: row.server_time ? new Date(row.server_time).toISOString() : undefined,
        databaseName: row.db_name,
        postgresVersion: row.pg_version ? row.pg_version.split(',')[0] : undefined,
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    const classified = classifyError(err);
    return {
      endpointType,
      sanitizedHost,
      port,
      status: 'FAIL',
      failureCategory: classified.category,
      sanitizedError: classified.message,
    };
  } finally {
    await pool.end();
  }
}

/**
 * Menjalankan seluruh rangkaian probe pra-konektivitas staging
 */
export async function runStagingConnectivityProbe(): Promise<StagingConnectivityReport> {
  const appEnv = (process.env.APP_ENV || '').trim();
  const allowStaging = (process.env.ALLOW_STAGING_MIGRATION || '').trim();
  const stagingRef = (process.env.STAGING_PROJECT_REF || '').trim();
  const directUrl = (process.env.DIRECT_URL || '').trim();
  const dbUrl = (process.env.DATABASE_URL || '').trim();

  const isConfigPlaceholder =
    isPlaceholder(stagingRef) || isPlaceholder(directUrl) || isPlaceholder(dbUrl);

  const configStatus = isConfigPlaceholder ? 'BLOCKED' : 'PASS';

  // Probe Endpoint 1: DIRECT_URL (Port 5432, Session Mode untuk Migrasi)
  const directProbe = await probeEndpoint(directUrl, 'DIRECT_SESSION_PORT_5432', stagingRef);

  // Probe Endpoint 2: DATABASE_URL (Port 6543, Transaction Mode untuk Express API)
  const poolerProbe = await probeEndpoint(dbUrl, 'TRANSACTION_POOLER_PORT_6543', stagingRef);

  const overallStatus =
    configStatus === 'PASS' && directProbe.status === 'PASS' && poolerProbe.status === 'PASS'
      ? 'PASS'
      : 'BLOCKED';

  return {
    timestamp: new Date().toISOString(),
    configStatus,
    overallStatus,
    directProbe,
    poolerProbe,
    guardrailStatus: {
      appEnv,
      allowStagingMigration: allowStaging,
      stagingProjectRefConfigured: !isPlaceholder(stagingRef),
      migrationBlockedByGuardrail: allowStaging !== 'true',
    },
  };
}

// Eksekusi otomatis jika dipanggil langsung via CLI
if (process.argv[1]?.includes('probe')) {
  runStagingConnectivityProbe()
    .then((report) => {
      console.log('=====================================================');
      console.log(' SIMSARPRAS - STAGING CONNECTIVITY PROBE (FASE 2H)');
      console.log('=====================================================');
      console.log(`Timestamp:        ${report.timestamp}`);
      console.log(`Config Status:    ${report.configStatus}`);
      console.log(`Overall Status:   ${report.overallStatus}`);
      console.log('-----------------------------------------------------');
      console.log('[1] DIRECT_URL Probe (Port 5432 / DDL Session Mode):');
      console.log(`    Status:       ${report.directProbe.status}`);
      console.log(`    Target:       ${report.directProbe.sanitizedHost}`);
      if (report.directProbe.failureCategory) {
        console.log(`    Kategori:     ${report.directProbe.failureCategory}`);
        console.log(`    Detail:       ${report.directProbe.sanitizedError}`);
      }
      if (report.directProbe.serverTime) {
        console.log(`    Server Time:  ${report.directProbe.serverTime}`);
        console.log(`    DB Name:      ${report.directProbe.databaseName}`);
      }
      console.log('-----------------------------------------------------');
      console.log('[2] DATABASE_URL Probe (Port 6543 / API Pooler Mode):');
      console.log(`    Status:       ${report.poolerProbe.status}`);
      console.log(`    Target:       ${report.poolerProbe.sanitizedHost}`);
      if (report.poolerProbe.failureCategory) {
        console.log(`    Kategori:     ${report.poolerProbe.failureCategory}`);
        console.log(`    Detail:       ${report.poolerProbe.sanitizedError}`);
      }
      if (report.poolerProbe.serverTime) {
        console.log(`    Server Time:  ${report.poolerProbe.serverTime}`);
        console.log(`    DB Name:      ${report.poolerProbe.databaseName}`);
      }
      console.log('-----------------------------------------------------');
      console.log('[3] Guardrail Keselamatan Migrasi:');
      console.log(`    APP_ENV:                  ${report.guardrailStatus.appEnv}`);
      console.log(`    ALLOW_STAGING_MIGRATION:  ${report.guardrailStatus.allowStagingMigration}`);
      console.log(`    Migrasi Dicegah Guardrail: ${report.guardrailStatus.migrationBlockedByGuardrail ? 'YA (AMAN)' : 'TIDAK'}`);
      console.log('=====================================================');
    })
    .catch((err) => {
      console.error('Probe Error:', err);
      process.exit(1);
    });
}
