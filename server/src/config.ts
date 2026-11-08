/**
 * SIMSARPRAS Backend Configuration
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Muat .env.local terlebih dahulu jika tersedia (prioritas konfigurasi lokal tanpa menyentuh .env)
const envLocalInServer = path.resolve(__dirname, '../.env.local');
const envLocalInCwd = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalInServer)) {
  dotenv.config({ path: envLocalInServer });
} else if (fs.existsSync(envLocalInCwd)) {
  dotenv.config({ path: envLocalInCwd });
}

// 2. Muat .env sebagai fallback untuk variabel lingkungan yang belum didefinisikan
const envInServer = path.resolve(__dirname, '../.env');
if (fs.existsSync(envInServer)) {
  dotenv.config({ path: envInServer });
} else {
  dotenv.config();
}

export const config = {
  port: parseInt(process.env.PORT || '10000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres.fmounzjzgnfchcmpmnfg:%40Bunayya123456789@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_key_simsarpras_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173,http://192.168.100.45:5173')
    .split(',')
    .map((s) => s.trim()),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300', 10),
};
