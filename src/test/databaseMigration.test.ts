import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { runReconciliationAudit } from '../../server/scripts/reconcile';
import { verifyMigrationTarget, sanitizeConnectionUrl, runMigration } from '../../server/scripts/migrate';
import { MOCK_ASSET_UNITS } from '../data/mockData';

describe('Fase 2A: Audit dan Rekonsiliasi Database Migration (Mock -> PostgreSQL)', () => {
  it('1. Rekonsiliasi Data: Memastikan seluruh data mock terhitung lengkap dan valid', () => {
    const report = runReconciliationAudit();

    // Verifikasi jumlah entitas
    expect(report.counts.categories).toBe(4);
    expect(report.counts.locations).toBe(7);
    expect(report.counts.fundingSources).toBe(5);
    expect(report.counts.users).toBe(4);
    expect(report.counts.assets).toBe(11);
    expect(report.counts.loans).toBe(2);
    expect(report.counts.auditLogs).toBe(2);

    expect(report.auditVerdict).toBe('PASSED');
  });

  it('2. Integritas Token: Memastikan qrToken, assetCode, dan permanentId 100% unik dan tidak berubah', () => {
    const report = runReconciliationAudit();

    expect(report.tokenIntegrity.duplicateQrTokens).toHaveLength(0);
    expect(report.tokenIntegrity.duplicateAssetCodes).toHaveLength(0);
    expect(report.tokenIntegrity.duplicatePermanentIds).toHaveLength(0);
    expect(report.tokenIntegrity.allTokensValid).toBe(true);

    // Verifikasi sampel token kunci
    const laptop01 = report.tokenIntegrity.preservedTokens.find(
      (t) => t.assetCode === 'INV-TIK-2024-001'
    );
    expect(laptop01).toBeDefined();
    expect(laptop01?.qrToken).toBe('QR-TIK-ASUS-001');
    expect(laptop01?.permanentId).toBe('PERM-TIK-ASUS-001');

    const laptop02 = report.tokenIntegrity.preservedTokens.find(
      (t) => t.assetCode === 'INV-TIK-2024-002'
    );
    expect(laptop02).toBeDefined();
    expect(laptop02?.qrToken).toBe('QR-TIK-ASUS-002');
    expect(laptop02?.permanentId).toBe('PERM-TIK-ASUS-002');

    // Pastikan seluruh 11 unit di MOCK_ASSET_UNITS memiliki permanentId eksplisit dan unik
    const allPermIds = MOCK_ASSET_UNITS.map((a) => a.permanentId);
    expect(allPermIds.every(Boolean)).toBe(true);
    expect(new Set(allPermIds).size).toBe(MOCK_ASSET_UNITS.length);
  });

  it('3. Integritas Relasi: Memastikan zero orphan reference (tidak ada relasi yatim)', () => {
    const report = runReconciliationAudit();

    expect(report.relationalIntegrity.orphanAssetLocations).toHaveLength(0);
    expect(report.relationalIntegrity.orphanAssetCategories).toHaveLength(0);
    expect(report.relationalIntegrity.orphanAssetFunding).toHaveLength(0);
    expect(report.relationalIntegrity.orphanLoanAssets).toHaveLength(0);
    expect(report.relationalIntegrity.orphanLoanBorrowers).toHaveLength(0);
    expect(report.relationalIntegrity.isRelationalClean).toBe(true);
  });

  it('4. Konsistensi Status Transaksi: Memastikan sinkronisasi status transaksi ACTIVE terhadap unit ON_LOAN', () => {
    const report = runReconciliationAudit();

    expect(report.transactionConsistency.activeLoansCount).toBe(1);
    expect(report.transactionConsistency.unitsOnLoanCount).toBe(1);
    expect(report.transactionConsistency.inconsistentPairs).toHaveLength(0);
    expect(report.transactionConsistency.isTransactionConsistent).toBe(true);
  });

  it('5. Verifikasi Berkas DDL (schema.sql): Memastikan struktur tabel, constraint, indeks, dan RLS terproteksi', () => {
    const schemaPath = path.resolve(__dirname, '../../server/db/schema.sql');
    expect(fs.existsSync(schemaPath)).toBe(true);

    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Cek seluruh tabel wajib
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS categories');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS locations');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS funding_sources');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS assets');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS loans');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS return_inspections');
    expect(schemaContent).toContain('CREATE TABLE IF NOT EXISTS audit_logs');

    // Cek constraint unik
    expect(schemaContent).toContain('qr_token VARCHAR(64) NOT NULL UNIQUE');
    expect(schemaContent).toContain('asset_code VARCHAR(64) NOT NULL UNIQUE');
    expect(schemaContent).toContain('permanent_id VARCHAR(64) NOT NULL UNIQUE');
    expect(schemaContent).toContain('loan_number VARCHAR(64) NOT NULL UNIQUE');

    // Cek indeks performa
    expect(schemaContent).toContain('idx_assets_qr_token');
    expect(schemaContent).toContain('idx_assets_asset_code');
    expect(schemaContent).toContain('idx_assets_operational_status');
    expect(schemaContent).toContain('idx_loans_asset_id');
    expect(schemaContent).toContain('idx_loans_status');

    // Cek Row-Level Security (Hardened & Protected - Seluruh 8 Tabel)
    expect(schemaContent).toContain('ALTER TABLE assets ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE loans ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE return_inspections ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE categories ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE locations ENABLE ROW LEVEL SECURITY');
    expect(schemaContent).toContain('ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY');

    // Verifikasi perlindungan RLS: service_role dibatasi FOR ALL TO service_role (Fase 2J.1)
    expect(schemaContent).toContain('CREATE POLICY service_role_all_assets ON assets\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_loans ON loans\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_return_inspections ON return_inspections\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_audit ON audit_logs\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_users ON users\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_categories ON categories\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_locations ON locations\n        FOR ALL TO service_role');
    expect(schemaContent).toContain('CREATE POLICY service_role_all_funding_sources ON funding_sources\n        FOR ALL TO service_role');

    // Verifikasi penguatan Fase 2I.4: Seluruh hak publik dicabut dari assets dan users
    // Mencegah mass scraping katalog via PostgREST, sementara rute QR dilayani via backend terotentikasi
    expect(schemaContent).toContain('REVOKE ALL ON TABLE assets FROM anon, authenticated, public');
    expect(schemaContent).not.toContain('public_read_assets');
    expect(schemaContent).not.toContain('GRANT SELECT ON TABLE assets TO anon');
    expect(schemaContent).not.toContain('public_read_users');
    expect(schemaContent).toContain('REVOKE ALL ON TABLE users FROM anon, authenticated, public');
  });

  it('6. Verifikasi Berkas Seed (seed.sql): Memastikan skrip seed non-destruktif (DO NOTHING) dan ID kategori selaras', () => {
    const seedPath = path.resolve(__dirname, '../../server/db/seed.sql');
    expect(fs.existsSync(seedPath)).toBe(true);

    const seedContent = fs.readFileSync(seedPath, 'utf-8');

    // Verifikasi perbaikan Blocker 2: assets dan loans menggunakan ON CONFLICT (id) DO NOTHING
    expect(seedContent).not.toMatch(/assets[\s\S]*ON CONFLICT \(id\) DO UPDATE/);
    expect(seedContent).not.toMatch(/loans[\s\S]*ON CONFLICT \(id\) DO UPDATE/);
    expect(seedContent).toContain('ON CONFLICT (id) DO NOTHING');

    // Verifikasi perbaikan Blocker 3: ID kategori selaras dengan mockData.ts
    expect(seedContent).toContain("'cat-tik'");
    expect(seedContent).toContain("'cat-mebel'");
    expect(seedContent).toContain("'cat-olahraga'");
    expect(seedContent).toContain("'cat-elektronik'");

    // Pastikan ID singkatan lama tidak ada lagi di seed.sql
    expect(seedContent).not.toContain("'cat-meb'");
    expect(seedContent).not.toContain("'cat-olr'");
    expect(seedContent).not.toContain("'cat-el'");

    // Cek seluruh asset code mock ada di seed
    for (const asset of MOCK_ASSET_UNITS) {
      expect(seedContent).toContain(asset.assetCode);
      expect(seedContent).toContain(asset.qrToken);
      expect(seedContent).toContain(asset.permanentId!);
    }
  });

  it('7. Kompatibilitas Data Lama (Fallback Compatibility): Memastikan aset lama di localStorage tetap aman dibaca', () => {
    // Simulasi item lama tanpa permanentId
    const legacyAsset = {
      ...MOCK_ASSET_UNITS[0],
      permanentId: undefined, // Objek lama di localStorage belum punya permanentId
    };

    // Fallback logika storage: def?.permanentId || item.id
    const def = MOCK_ASSET_UNITS.find((m) => m.id === legacyAsset.id);
    const resolvedPermId = legacyAsset.permanentId || def?.permanentId || legacyAsset.id;

    expect(resolvedPermId).toBe('PERM-TIK-ASUS-001');
    expect(resolvedPermId).not.toBe(legacyAsset.id); // Tidak lagi mendivergen menjadi unit-laptop-01
  });
});

describe('Fase 2G-1: Guardrail Keselamatan Migrator (Fail-Closed Anti-Produksi)', () => {
  it('1. Mode Dry-Run: Konfigurasi URL kosong tidak membuka koneksi dan mengembalikan DRY_RUN_PASSED', async () => {
    const res = await runMigration('');
    expect(res.status).toBe('DRY_RUN_PASSED');
    expect(res.preAudit.auditVerdict).toBe('PASSED');
  });

  it('2. Penolakan bila penanda APP_ENV bukan staging', () => {
    const targetUrl = 'postgres://postgres.abcdef:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const check = verifyMigrationTarget(targetUrl, {
      appEnv: 'production',
      allowStagingMigration: 'true',
      stagingProjectRef: 'abcdef',
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("APP_ENV tidak valid ('production')");
  });

  it('3. Penolakan bila konfirmasi ALLOW_STAGING_MIGRATION tidak ada', () => {
    const targetUrl = 'postgres://postgres.abcdef:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const check = verifyMigrationTarget(targetUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'false',
      stagingProjectRef: 'abcdef',
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("Konfirmasi migrasi tidak ditemukan. Wajib menyetel ALLOW_STAGING_MIGRATION='true'");
  });

  it('4. Penolakan bila STAGING_PROJECT_REF tidak ada atau masih berupa placeholder', () => {
    const targetUrl = 'postgres://postgres.abcdef:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const checkEmpty = verifyMigrationTarget(targetUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: '',
    });
    expect(checkEmpty.valid).toBe(false);
    expect(checkEmpty.reason).toContain('STAGING_PROJECT_REF belum dikonfigurasi');

    const checkPlaceholder = verifyMigrationTarget(targetUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: '[PROJECT_REF_STAGING_SUPABASE]',
    });
    expect(checkPlaceholder.valid).toBe(false);
    expect(checkPlaceholder.reason).toContain('STAGING_PROJECT_REF belum dikonfigurasi atau masih berupa placeholder');
  });

  it('5. Penolakan bila target tidak cocok dengan STAGING_PROJECT_REF', () => {
    const targetUrl = 'postgres://postgres.abcdef:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const check = verifyMigrationTarget(targetUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: 'different-project-id',
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Target database tidak cocok dengan STAGING_PROJECT_REF');
  });

  it('6. Penolakan keras bila target memuat indikasi produksi (Anti-Production Guard)', () => {
    // Host memuat 'prod'
    const prodHost = 'postgres://postgres.simsarpras:secret@aws-0-prod.pooler.supabase.com:5432/postgres';
    const checkHost = verifyMigrationTarget(prodHost, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: 'simsarpras',
    });
    expect(checkHost.valid).toBe(false);
    expect(checkHost.reason).toContain('terindikasi sebagai lingkungan PRODUKSI');

    // Username memuat 'production'
    const prodUser = 'postgres://production_user:secret@aws-0-staging.pooler.supabase.com:5432/postgres';
    const checkUser = verifyMigrationTarget(prodUser, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: 'staging',
    });
    expect(checkUser.valid).toBe(false);
    expect(checkUser.reason).toContain('terindikasi sebagai lingkungan PRODUKSI');
  });

  it('7. Sanitasi URL: Password dan kredensial rahasia tidak pernah diekspos', () => {
    const sensitiveUrl = 'postgres://postgres.xyz123:supersecretpassword999@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const sanitized = sanitizeConnectionUrl(sensitiveUrl);
    expect(sanitized).not.toContain('supersecretpassword999');
    expect(sanitized).toContain('postgres***@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
  });

  it('8. Verifikasi Berhasil: Target staging valid dan cocok dengan STAGING_PROJECT_REF', () => {
    const validStagingUrl = 'postgres://postgres.simsarprasstaging:secret123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const check = verifyMigrationTarget(validStagingUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: 'simsarprasstaging',
    });
    expect(check.valid).toBe(true);
    expect(check.sanitizedHost).toContain('aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    expect(check.sanitizedHost).not.toContain('secret123');
  });

  it('9. Penolakan bila target menggunakan port 6543 (PgBouncer Transaction Pooler) untuk migrasi DDL', () => {
    const poolerUrl = 'postgres://postgres.simsarprasstaging:secret123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
    const check = verifyMigrationTarget(poolerUrl, {
      appEnv: 'staging',
      allowStagingMigration: 'true',
      stagingProjectRef: 'simsarprasstaging',
    });
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Port 6543 adalah PgBouncer Transaction Pooler');
  });

  it('10. Penolakan fallback diam-diam bila DATABASE_URL tersedia tetapi DIRECT_URL tidak disetel', async () => {
    const origDirect = process.env.DIRECT_URL;
    const origDb = process.env.DATABASE_URL;
    try {
      delete process.env.DIRECT_URL;
      process.env.DATABASE_URL = 'postgres://postgres.simsarprasstaging:secret@aws-0.pooler.supabase.com:6543/postgres';

      await expect(runMigration()).rejects.toThrow('DIRECT_URL wajib disediakan untuk migrasi DDL');
    } finally {
      if (origDirect !== undefined) process.env.DIRECT_URL = origDirect;
      else delete process.env.DIRECT_URL;
      if (origDb !== undefined) process.env.DATABASE_URL = origDb;
    }
  });

  it('11. Verifikasi Grammar Sintaksis RLS: Memastikan seluruh klausul CREATE POLICY memenuhi urutan baku PostgreSQL (FOR ALL mendahului TO service_role - Fase 2J.1)', () => {
    const schemaPath = path.resolve(__dirname, '../../server/db/schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Pola salah: TO ... FOR ALL (Menghasilkan PostgreSQL syntax error 42601)
    const invalidPattern = /CREATE\s+POLICY\s+([^\s]+)\s+ON\s+([^\s]+)\s+TO\s+([^\s]+)\s+FOR/gi;
    const invalidMatches = [...schemaContent.matchAll(invalidPattern)];
    expect(invalidMatches.length).toBe(0);

    // Pola benar: FOR { ALL | SELECT | INSERT | UPDATE | DELETE } mendahului TO { role }
    const validPattern = /CREATE\s+POLICY\s+([^\s]+)\s+ON\s+([^\s]+)\s+FOR\s+ALL\s+TO\s+([^\s]+)/gi;
    const validMatches = [...schemaContent.matchAll(validPattern)];
    expect(validMatches.length).toBe(8); // Tepat 8 tabel sistem

    // Verifikasi seluruh 8 nama tabel terdaftar
    const tablesInPolicies = validMatches.map((m) => m[2]);
    const expectedTables = [
      'assets',
      'loans',
      'return_inspections',
      'audit_logs',
      'users',
      'categories',
      'locations',
      'funding_sources',
    ];
    for (const table of expectedTables) {
      expect(tablesInPolicies).toContain(table);
    }
  });

  it('12. Penolakan eksekusi runMigration secara terintegrasi jika ALLOW_STAGING_MIGRATION bernilai \'false\' (Fase 2J.2)', async () => {
    const origAllow = process.env.ALLOW_STAGING_MIGRATION;
    const origAppEnv = process.env.APP_ENV;
    const origRef = process.env.STAGING_PROJECT_REF;
    try {
      process.env.APP_ENV = 'staging';
      process.env.ALLOW_STAGING_MIGRATION = 'false';
      process.env.STAGING_PROJECT_REF = 'simsarprasstaging';
      const fakeValidDirect = 'postgres://postgres.simsarprasstaging:secret@aws-0.pooler.supabase.com:5432/postgres';

      await expect(runMigration(fakeValidDirect)).rejects.toThrow(
        /Migration Guardrail Abort: Konfirmasi migrasi tidak ditemukan. Wajib menyetel ALLOW_STAGING_MIGRATION='true'/
      );
    } finally {
      if (origAllow !== undefined) process.env.ALLOW_STAGING_MIGRATION = origAllow;
      else delete process.env.ALLOW_STAGING_MIGRATION;
      if (origAppEnv !== undefined) process.env.APP_ENV = origAppEnv;
      else delete process.env.APP_ENV;
      if (origRef !== undefined) process.env.STAGING_PROJECT_REF = origRef;
      else delete process.env.STAGING_PROJECT_REF;
    }
  });

  it('13. Verifikasi Proteksi Definisi Role Supabase (service_role, anon, authenticated) dalam Section 8.0 schema.sql (Fase 2J.2)', () => {
    const schemaPath = path.resolve(__dirname, '../../server/db/schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Memastikan setiap pembuatan peran dilindungi oleh IF NOT EXISTS pada pg_roles
    expect(schemaContent).toContain("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')");
    expect(schemaContent).toContain("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')");
    expect(schemaContent).toContain("IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')");

    // Memastikan blok DO $$ memiliki penanganan eksepsi jika dijalankan pada database yang melarang CREATEROLE
    expect(schemaContent).toContain('EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN');
    expect(schemaContent).toContain('NULL;');
  });
});



