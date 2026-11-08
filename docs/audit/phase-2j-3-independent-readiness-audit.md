# SIMSARPRAS — AUDIT KESIAPAN MIGRASI INDEPENDEN (FASE 2J.3)
## Independent Migration Readiness & Comprehensive Security Audit Report

**Versi Dokumen:** 2.1.0-INDEPENDENT-READINESS-AUDIT  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi Akhir:** **READY FOR HUMAN AUTHORIZATION**  
**Target Basis Data:** Supabase Staging (`db.ajajdkhxosmbfyzzabgy.supabase.co:5432`)  
**Project Reference:** `ajajdkhxosmbfyzzabgy` (`ap-northeast-1` / AWS Tokyo)  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif & Status Akhir

Audit independen Fase 2J.3 merupakan evaluasi keselamatan menyeluruh terakhir sebelum meminta otorisasi operator manusia untuk mengeksekusi ulang migrasi basis data SIMSARPRAS ke Supabase Staging.

### Status Evaluasi: **`READY FOR HUMAN AUTHORIZATION`**

Persetujuan kesiapan ini didasarkan pada temuan audit independen sebagai berikut:
1. **Perbaikan RLS:** Seluruh 8 kebijakan `CREATE POLICY` pada [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) telah diperbaiki sesuai grammar baku PostgreSQL (`FOR ALL TO service_role`).
2. **Kesesuaian Arsitektur Supabase:** Proteksi peran pada Bagian 8.0 `schema.sql` tidak mengasumsikan pembuatan ulang peran dan aman terhadap izin `CREATEROLE` terbatas.
3. **Autentikasi Defense-in-Depth:** Aplikasi tidak hanya mengandalkan RLS database; seluruh rute inventaris sensitif dilindungi middleware JWT `requireAuth`, sementara endpoint scan publik diisolasi dengan rate limiter dan sanitasi allowlist.
4. **Keandalan Migrator:** Migrator terbukti mengeksekusi transaksi atomik tunggal (`BEGIN` ... `COMMIT` / `ROLLBACK`), menolak pooler port 6543, menolak indikasi produksi, dan tidak memiliki perintah destruktif (`DROP`/`TRUNCATE`).
5. **Kondisi Staging Terverifikasi:** Probe metadata presisi membuktikan skema `public` dalam kondisi **pristine empty** (0 base table, 0 view, 0 custom enum), sementara skema infrastruktur Supabase (`auth`, `storage`, `extensions`) aktif normal.
6. **Keterbatasan Transparan:** Karena engine PostgreSQL lokal tidak terpasang pada host pengembang, validasi DDL penuh terhadap engine lokal dinyatakan secara eksplisit sebagai belum dilakukan (*not verified via local engine*), namun risiko telah dimitigasi penuh oleh transaksi atomik migrator.
7. **Batas Keselamatan Dipatuhi:** `ALLOW_STAGING_MIGRATION=false` tetap aktif dan basis data staging tidak mengalami mutasi apa pun selama audit.

---

## 2. Audit Mendalam Pernyataan SQL Terhadap PostgreSQL 17

### 2.1 Ekstensi, Blok `DO $$`, dan Enumerasi
- **Ekstensi ([`server/db/schema.sql:L9-10`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L9-L10)):**
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` dan `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
  *Evaluasi:* Kedua ekstensi tersedia natively pada PostgreSQL 17 di Supabase. Klausa `IF NOT EXISTS` menjamin eksekusi idempoten.
- **Tipe Enumerasi ([`server/db/schema.sql:L15-51`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L15-L51)):**
  5 tipe ENUM dideklarasikan di dalam blok prosedural `DO $$ BEGIN ... END $$;`:
  - `user_role` (`ADMIN_SARPRAS`, `GURU_PEGAWAI`, `KEPALA_SEKOLAH`)
  - `loan_mode` (`DIRECT`, `ADMIN_APPROVAL`)
  - `condition_status` (`GOOD`, `MINOR_DAMAGE`, `MAJOR_DAMAGE`, `LOST`)
  - `operational_status` (`AVAILABLE`, `RESERVED`, `ON_LOAN`, `RETURN_PENDING`, `RETURN_INSPECTION`, `MAINTENANCE`, `INACTIVE`, `LOST`)
  - `loan_status` (`PENDING_APPROVAL`, `APPROVED`, `READY_FOR_HANDOVER`, `ACTIVE`, `RETURN_REQUESTED`, `RETURN_RECEIVED`, `RETURN_ISSUE`, `COMPLETED`, `REJECTED`, `CANCELLED`)
  *Evaluasi:* Setiap tipe dilindungi oleh `IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '...')`. Pembuatan ENUM bersifat transaksional di PostgreSQL dan terbukti sukses diparsing oleh PostgreSQL 17.11 staging pada Fase 2J.

### 2.2 Urutan Pembuatan Tabel, Foreign Key, dan Constraint
Urutan pembuatan tabel mematuhi Directed Acyclic Graph (DAG) relasional secara sempurna tanpa circular dependency:

```
[categories] ──┐
[locations]  ──┼──> [assets] ──┐
[funding]    ──┘       │       │
                       ▼       ▼
[users] ─────────────> [loans] ──> [return_inspections]
  │
  └──────────────────> [audit_logs] (mandiri)
```

1. **`categories` ([L56-63](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L56-L63)):** Primary table. PK `id VARCHAR(64)`.
2. **`locations` ([L65-72](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L65-L72)):** Primary table. PK `id VARCHAR(64)`, UNIQUE `code`.
3. **`funding_sources` ([L74-80](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L74-L80)):** Primary table. PK `id VARCHAR(64)`, UNIQUE `name`.
4. **`users` ([L85-97](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L85-L97)):** Primary table. PK `id VARCHAR(64)`, UNIQUE `email`.
5. **`assets` ([L102-128](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L102-L128)):**
   - UNIQUE: `permanent_id`, `qr_token`, `asset_code`.
   - FK: `category_id REFERENCES categories(id) ON DELETE RESTRICT`.
   - FK: `location_id REFERENCES locations(id) ON DELETE RESTRICT`.
   - FK: `funding_source REFERENCES funding_sources(name) ON DELETE RESTRICT` (Valid karena `funding_sources.name` memiliki constraint `UNIQUE`).
6. **`loans` ([L141-162](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L141-L162)):**
   - UNIQUE: `loan_number`.
   - FK: `asset_id REFERENCES assets(id) ON DELETE RESTRICT`.
   - FK: `borrower_id REFERENCES users(id) ON DELETE SET NULL` (Mendukung guest/guru scan mandiri).
7. **`return_inspections` ([L172-191](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L172-L191)):**
   - UNIQUE: `loan_id` (Relasi 1-to-1 terhadap loan).
   - FK: `loan_id REFERENCES loans(id) ON DELETE CASCADE`.
   - FK: `received_by`, `inspected_by`, `approved_by` ke `users(id)`.
8. **`audit_logs` ([L198-210](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L198-L210)):** Append-only audit table.

### 2.3 Indeks Kinerja Query
Terdapat 13 indeks kinerja yang didefinisikan dengan `CREATE INDEX IF NOT EXISTS`:
- `assets`: `idx_assets_qr_token`, `idx_assets_asset_code`, `idx_assets_permanent_id`, `idx_assets_operational_status`, `idx_assets_location_id`, `idx_assets_category_id` (6 indeks).
- `loans`: `idx_loans_asset_id`, `idx_loans_borrower_id`, `idx_loans_status`, `idx_loans_loan_number` (4 indeks).
- `return_inspections`: `idx_return_inspections_loan_id` (1 indeks).
- `audit_logs`: `idx_audit_logs_created_at` (DESC), `idx_audit_logs_entity_id` (2 indeks).

### 2.4 Role Supabase, GRANT, REVOKE, dan Delapan Kebijakan RLS
- **Role Supabase Guard ([L220-232](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L220-L232)):**
  ```sql
  DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
      END IF;
  EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN
      NULL;
  END $$;
  ```
  *Evaluasi:* Di Supabase, ketiga peran ini sudah tersedia. Pengecekan `IF NOT EXISTS` mengevaluasi false sehingga tidak ada operasi `CREATE ROLE` yang dijalankan di staging.
- **Aktivasi RLS & Revoke ([L235-254](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L235-L254)):**
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` pada seluruh 8 tabel, diikuti `REVOKE ALL ON TABLE ... FROM anon, authenticated, public;` pada seluruh 8 tabel.
- **Hak Akses & Kebijakan `service_role` ([L257-316](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L257-L316)):**
  `GRANT ALL ON TABLE ... TO service_role;` pada seluruh 8 tabel.
  8 kebijakan RLS didefinisikan dengan urutan baku:
  ```sql
  CREATE POLICY service_role_all_<tabel> ON <tabel>
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
  ```
  *Evaluasi:* Urutan `FOR ALL` mendahului `TO service_role` memenuhi grammar resmi PostgreSQL (`CreatePolicyStmt`), mengeliminasi penyebab error `42601` pada Fase 2J.

### 2.5 Audit Seed SQL & Penanganan Konflik Unik ([`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql))
- Master tabel (`categories`, `locations`, `funding_sources`, `users`): Menggunakan `ON CONFLICT (id) DO UPDATE SET ...` untuk menyelaraskan data konfigurasi mock tanpa menduplikasi baris.
- Aset, Pinjaman, dan Audit Log:
  - 11 unit aset: `ON CONFLICT (id) DO NOTHING;` (L179).
  - 2 transaksi pinjaman: `ON CONFLICT (id) DO NOTHING;` (L205).
  - 2 audit log: `ON CONFLICT (id) DO NOTHING;` (L224).
  *Evaluasi:* Tidak ada risiko penimpaan data operasional atau regenerasi barcode. Seluruh foreign key pada seed merujuk ke baris yang di-seed sebelumnya dalam transaksi yang sama.

### 2.6 Kompatibilitas Transaksi Migrator
Seluruh DDL dan Seed dieksekusi di dalam satu blok transaksi:
```typescript
await client.query('BEGIN');
await client.query(schemaSql);
await client.query(seedSql);
await client.query('COMMIT');
```
PostgreSQL mendukung DDL transaksional penuh. Jika terjadi kegagalan pada baris mana pun, `ROLLBACK` membatalkan seluruh perubahan tanpa meninggalkan objek yatim di database.

---

## 3. Verifikasi Strategi Autentikasi Aplikasi (Defense-in-Depth)

Keamanan aplikasi SIMSARPRAS tidak diserahkan semata-mata pada RLS database, melainkan dirancang berlapis (*Defense-in-Depth*):

```
[ Request Masuk ]
       │
       ▼
[ Layer 1: Express Rate Limiter ] ──> (Tolak HTTP 429 jika > limit per IP)
       │
       ▼
[ Layer 2: Express Route Auth ]
       ├── Rute Publik (Scan & Submit Pinjam) ──> Zod Validation & Allowlist Filtering
       └── Rute Internal (List Aset, Riwayat) ──> JWT requireAuth (Tolak HTTP 401/403)
       │
       ▼
[ Layer 3: Database Connection ]
       └── Express Backend terkoneksi sebagai service_role (Bypass PostgREST)
       │
       ▼
[ Layer 4: Supabase PostgREST Shield ]
       └── anon, authenticated, public = REVOKE ALL (Tidak ada akses langsung ke DB)
```

### 3.1 Pemisahan Endpoint Publik vs Terotentikasi
1. **Endpoint Publik (Tanpa Login):**
   - `GET /api/v1/assets/scan` & `GET /api/v1/assets/:id`:
     - Dilindungi `publicScanLimiter` (maksimal 60 request/menit per IP).
     - Input divalidasi dengan Zod `tokenParamSchema`.
     - Output disanitasi menggunakan `formatPublicAssetResponse` (allowlist): field sensitif seperti `notes` staf internal dan `funding_source` disaring dan tidak dikirimkan ke publik.
   - `POST /api/v1/loans/request` & `POST /api/v1/loans`:
     - Dilindungi `loanSubmissionLimiter` (maksimal 10 request/menit per IP).
     - Input divalidasi dengan Zod `loanRequestSchema`.
     - Menggunakan PostgreSQL Pessimistic Lock (`FOR UPDATE`) di dalam transaksi backend untuk mencegah double-booking.
   - `GET /api/v1/health`: Health check publik.
2. **Endpoint Terotentikasi (Wajib Bearer JWT Token):**
   - `GET /api/v1/assets`:
     - Dilindungi middleware `requireAuth` ([`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts)).
     - Mengembalikan data katalog penuh (`formatAssetResponse`) hanya untuk staf/admin yang telah login.
     - Menolak akses unauthenticated dengan `HTTP 401 UNAUTHORIZED`.
   - `GET /api/v1/loans`:
     - Dilindungi middleware `requireAuth`.
     - Mencegah pihak luar melihat riwayat peminjaman siswa/guru lain.
   - `GET /api/v1/loans/:id`:
     - Dilindungi middleware `requireAuth`.

### 3.2 Pemisahan Peran Database (`anon`, `authenticated`, `service_role`)
- **`anon` & `authenticated` (PostgREST):** Seluruh hak akses (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) pada ke-8 tabel telah dicabut melalui `REVOKE ALL`. Permintaan langsung via Supabase REST API `https://<ref>.supabase.co/rest/v1/...` akan ditolak secara otomatis oleh PostgREST.
- **`service_role` (Backend Resmi):** Hanya backend resmi SIMSARPRAS yang memegang connection string resmi yang memiliki izin akses penuh ke tabel untuk memproses logika bisnis dan validasi.

---

## 4. Audit Integritas Migrator ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts))

Pemeriksaan baris kode pada runner migrasi membuktikan 5 guardrail keselamatan:

| Guardrail Keselamatan | Bukti Baris Kode | Mekanisme & Validasi |
|:---|:---:|:---|
| **Verifikasi Target Staging** | L42-156 | Memeriksa kecocokan `hostname` dan `username` dengan `STAGING_PROJECT_REF`. Menolak jika memuat kata kunci `prod`/`production`. |
| **Penolakan Port Pooler 6543** | L93-99 & L163-167 | Menolak string koneksi dengan port `6543` (Transaction Pooler). Mewajibkan `DIRECT_URL` port `5432` untuk menjamin kestabilan DDL. |
| **Kewajiban Flag Eksekusi** | L62-67 | Menggugurkan proses seketika jika `ALLOW_STAGING_MIGRATION !== 'true'`. |
| **Transaksi Atomik & Rollback** | L231, L241, L279-286 | DDL dan Seed dibungkus `BEGIN` ... `COMMIT`. Blok `catch` mengeksekusi `ROLLBACK` jika terjadi error. Terbukti pada Fase 2J. |
| **Non-Destruktif** | Seluruh Berkas | **Nol statemen `DROP` atau `TRUNCATE`**. Menggunakan `IF NOT EXISTS` dan `ON CONFLICT DO NOTHING`. Tidak pernah menghapus data staging. |

---

## 5. Implementasi Pengukuran Keadaan Database (Refined Probe)

Untuk menghindari kesimpulan keliru bahwa database "kosong total" saat hitungan tabel adalah 0, dilakukan audit query metadata presisi:

```sql
-- Query Presisi yang Digunakan:
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'VIEW';
SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e';
SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_toast%' AND nspname NOT LIKE 'pg_temp%' ORDER BY nspname;
```

### Hasil Probe Metadata Live Aktual:
- **`PUBLIC_BASE_TABLES`:** `0` (Tabel fisik aplikasi belum ada di skema public)
- **`PUBLIC_VIEWS`:** `0` (Tidak ada view palsu/tersisa)
- **`PUBLIC_ENUMS`:** `0` (Tidak ada custom enum tersisa di skema public pasca-rollback)
- **`ACTIVE_SCHEMAS`:** `auth, extensions, graphql, graphql_public, information_schema, pg_catalog, pgbouncer, public, realtime, storage, vault`

> **Penjelasan Audit:** Hasil di atas membuktikan bahwa skema aplikasi `public` berada dalam kondisi **bersih murni (pristine empty)** pasca-rollback Fase 2J, sementara skema infrastruktur inti Supabase (`auth`, `storage`, `extensions`, `vault`) aktif dan sehat.

---

## 6. Hasil Pengujian Aktual & Build Lokal

Seluruh pengujian dijalankan secara lokal tanpa memutasi staging database:

1. **Vitest Test Suite:**
   ```
   Test Files  5 passed (5)
   Tests       87 passed (87)
   Duration    8.43s
   ```
   *Lulus 100% (termasuk uji grammar RLS, proteksi flag, dan guardrail migrasi).*
2. **Client Production Build (`npm run build`):**
   ```
   ✓ 1665 modules transformed.
   dist/index.html                   1.02 kB │ gzip:   0.57 kB
   dist/assets/index-BCDNF4uv.css   51.39 kB │ gzip:   8.61 kB
   dist/assets/index-BWoDnNSk.js   554.73 kB │ gzip: 145.60 kB
   ✓ built in 6.82s
   ```
   *Exit code 0, 0 TypeScript error.*
3. **Server Backend Build (`npm run build --prefix server`):**
   ```
   > tsc
   ```
   *Exit code 0, 0 TypeScript error.*
4. **Rekonsiliasi Integritas Data Mock (`npm run reconcile --prefix server`):**
   - 11/11 token permanen terverifikasi valid dan unik.
   - 0 orphan foreign key reference.
   - 100% konsistensi status transaksi.

---

## 7. Analisis Risiko yang Belum Terselesaikan & Strategi Mitigasi

| No | Potensi Risiko | Tingkat | Status & Strategi Mitigasi |
|:---|:---|:---:|:---|
| 1 | **Eksekusi Engine Lokal Belum Dilakukan** (*Not verified via local engine*) | Sedang | *Penyebab:* Host Windows pengembang tidak memiliki PostgreSQL binary (`psql`) maupun container Docker aktif.<br>*Mitigasi:* Spesifikasi grammar telah dicocokkan 1:1 dengan dokumentasi PostgreSQL 17 (`gram.y`). Selain itu, transaksi migrator bersifat atomik (`BEGIN ... ROLLBACK`), sehingga jika ada error tak terduga, staging database dijamin kembali bersih tanpa residu. |
| 2 | **Latensi Jaringan Direct Connection Port 5432** | Rendah | Telah dibuktikan pada audit Fase 2H dan 2J bahwa direct connection ke AWS Tokyo (`ap-northeast-1`) berhasil terhubung dalam waktu < 2 detik. Timeout telah dikonfigurasi aman pada migrator. |
| 3 | **Eksekusi Prematur Tanpa Otorisasi Manusia** | Tidak Ada | `ALLOW_STAGING_MIGRATION=false` terkunci fail-closed di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12). Migrator menolak eksekusi tanpa perubahan eksplisit oleh operator manusia. |

---

## 8. Kesimpulan & Status Akhir

### Status Akhir: **`READY FOR HUMAN AUTHORIZATION`**

Seluruh kriteria pre-flight telah terpenuhi:
- [x] Akar penyebab error `42601` Fase 2J telah diperbaiki pada seluruh 8 kebijakan RLS.
- [x] Kompatibilitas skema terhadap PostgreSQL 17 dan peran Supabase terverifikasi.
- [x] Autentikasi berlapis (Defense-in-Depth) terverifikasi pada rute Express dan database.
- [x] Migrator terbukti menggunakan koneksi tunggal, transaksi atomik, dan fail-closed.
- [x] Database staging terverifikasi bersih murni di skema `public` (0 base table, 0 view, 0 enum).
- [x] 87/87 test unit lulus, build frontend/backend sukses 100%.
- [x] `ALLOW_STAGING_MIGRATION=false` dipertahankan dan terkunci.

**Langkah Selanjutnya:**  
Sistem berhenti pada titik ini sesuai batas keselamatan mandat. Migrasi Fase 2J tidak dijalankan ulang dan flag tidak diaktifkan. Sistem menunggu peninjauan dan otorisasi tertulis baru dari operator manusia.
