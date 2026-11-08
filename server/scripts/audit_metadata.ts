/**
 * SIMSARPRAS: Read-Only Staging Database Metadata Auditor (Fase 2I)
 * JAMINAN MUTLAK: Hanya menjalankan query metadata read-only (SELECT).
 * Tidak ada DDL, DML, seed, atau migrasi yang dieksekusi.
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;
const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  console.error('DIRECT_URL belum disetel di server/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: directUrl,
  ssl: directUrl.includes('supabase.com') || directUrl.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 10000,
});

async function runMetadataAudit() {
  const client = await pool.connect();
  try {
    // 1. Identitas Server & Konteks Database
    const idRes = await client.query(`
      SELECT 
        current_database() as database_name,
        current_user as database_user,
        version() as postgres_version
    `);

    // 2. Ekstensi yang terpasang
    const extRes = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      ORDER BY extname
    `);

    // 3. Tipe Kustom & ENUM pada schema public
    const enumRes = await client.query(`
      SELECT 
        t.typname, 
        array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `);

    // 4. Tabel pada schema public
    const tablesRes = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    // 5. Status RLS tabel schema public
    const rlsRes = await client.query(`
      SELECT 
        c.relname as table_name, 
        c.relrowsecurity as rls_enabled, 
        c.relforcerowsecurity as rls_enforced
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `);

    // 6. Kebijakan RLS (Policies) pada schema public
    const policiesRes = await client.query(`
      SELECT tablename, policyname, roles, cmd
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    // 7. Indeks pada schema public
    const idxRes = await client.query(`
      SELECT tablename, indexname
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // 8. Constraints pada schema public
    const constRes = await client.query(`
      SELECT 
        conname, 
        contype, 
        conrelid::regclass::text as table_name
      FROM pg_constraint con
      JOIN pg_namespace n ON n.oid = con.connamespace
      WHERE n.nspname = 'public'
      ORDER BY conname
    `);

    console.log(JSON.stringify({
      serverContext: idRes.rows[0],
      extensions: extRes.rows,
      enums: enumRes.rows,
      publicTables: tablesRes.rows,
      rlsStatus: rlsRes.rows,
      policies: policiesRes.rows,
      indexes: idxRes.rows,
      constraints: constRes.rows,
    }, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}

runMetadataAudit().catch((err) => {
  console.error('Metadata Audit Error:', err.message);
  process.exit(1);
});
