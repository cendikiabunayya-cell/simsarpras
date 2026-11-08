# SIMSARPRAS — VALIDASI SQL POSTGRESQL SEBELUM RETRY (FASE 2J.2)
## PostgreSQL SQL Pre-Retry Validation & Static Verification Audit Report

**Versi Dokumen:** 2.1.0-SQL-VALIDATION  
**Tanggal:** 14 Oktober 2026  
**Status Evaluasi:** **READY FOR HUMAN REVIEW (WITH EXPLICIT NOT VERIFIED ENGINE LIMITATION)**  
**Target Basis Data:** Supabase Staging (`db.ajajdkhxosmbfyzzabgy.supabase.co:5432`) — *Pristine Empty (0 Public Tables, 0 Enums)*  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif

Menindaklanjuti kegagalan migrasi Fase 2J akibat error sintaksis PostgreSQL `42601` dan perbaikan DDL kebijakan RLS pada Fase 2J.1, audit Fase 2J.2 ini melakukan validasi menyeluruh terhadap seluruh komponen SQL ([`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql), [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql)), implementasi migrator ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts)), status peran database (`service_role`, `anon`, `authenticated`), serta kondisi basis data staging.

### Ringkasan Status Kunci:
1. **Perbaikan RLS:** Seluruh 8 kebijakan `CREATE POLICY` telah divalidasi urutan klausulnya (`FOR ALL TO service_role`).
2. **Kompatibilitas Role Supabase:** Blok deklarasi peran pada Bagian 8.0 `schema.sql` aman bagi Supabase (menggunakan pengecekan `pg_roles` dan penanganan eksepsi `duplicate_object OR insufficient_privilege`).
3. **Migrator Lifecycle:** Terverifikasi menggunakan koneksi tunggal (`pool.connect()`), transaksi tunggal terisolasi (`BEGIN` ... `COMMIT` / `ROLLBACK`), dan menolak eksekusi jika `ALLOW_STAGING_MIGRATION !== 'true'`.
4. **Hasil Uji & Build:** 87/87 tes Vitest lulus (100%), build frontend lulus (0 error), build server lulus (0 error), dan audit rekonsiliasi data lulus.
5. **Kondisi Staging:** Pemeriksaan probe metadata live (read-only) mengonfirmasi **0 tabel dan 0 enum** di skema `public`. Staging tidak mengalami mutasi apa pun.
6. **Keterbatasan:** Karena pada host Windows pengembang tidak terpasang PostgreSQL engine lokal maupun container Docker, validasi eksekusi langsung engine penuh ditandai secara jujur dan transparan sebagai **`NOT VERIFIED VIA LOCAL POSTGRESQL ENGINE`**.

---

## 2. Temuan & Bukti File / Nomor Baris

### 2.1 Berkas Skema Database ([`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql))

| Komponen SQL | Letak Baris | Uraian Konstruk SQL | Evaluasi Sintaksis & Keamanan |
|:---|:---:|:---|:---:|
| **Ekstensi** | L9-10 | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`<br>`CREATE EXTENSION IF NOT EXISTS "pgcrypto";` | **VALID** (Ekstensi bawaan Supabase) |
| **Tipe ENUM** | L15-51 | Blok `DO $$ BEGIN ... END $$;`<br>- `user_role`<br>- `loan_mode`<br>- `condition_status`<br>- `operational_status`<br>- `loan_status` | **VALID** (Dilindungi `IF NOT EXISTS` terhadap `pg_type`) |
| **Tabel Master** | L56-80 | `categories`, `locations`, `funding_sources`<br>- PK `VARCHAR(64)`<br>- Constraint `UNIQUE` pada `name` dan `code` | **VALID** (Idempoten via `IF NOT EXISTS`) |
| **Tabel Pengguna** | L85-97 | `users`<br>- Kolom `password_hash`, `role` (enum `user_role`)<br>- Nilai default aman | **VALID** (Idempoten via `IF NOT EXISTS`) |
| **Tabel Aset** | L102-128 | `assets`<br>- Identitas permanen: `permanent_id`, `qr_token`, `asset_code`<br>- Relasi FK: `categories(id)`, `locations(id)`, `funding_sources(name)`<br>- Kolom JSONB: `standard_accessories` | **VALID** (Idempoten via `IF NOT EXISTS`, constraint integritas terjaga) |
| **Indeks Aset** | L131-136 | 6 Indeks: `idx_assets_qr_token`, `idx_assets_asset_code`, `idx_assets_permanent_id`, `idx_assets_operational_status`, `idx_assets_location_id`, `idx_assets_category_id` | **VALID** (`IF NOT EXISTS`) |
| **Tabel Transaksi Pinjam** | L141-162 | `loans`<br>- FK ke `assets(id)` ON DELETE RESTRICT<br>- FK ke `users(id)` ON DELETE SET NULL<br>- Kolom `loan_status`, `loan_mode` | **VALID** (Mendukung guest/guru scan mandiri tanpa merusak integritas relasional) |
| **Indeks Pinjam** | L164-167 | 4 Indeks: `idx_loans_asset_id`, `idx_loans_borrower_id`, `idx_loans_status`, `idx_loans_loan_number` | **VALID** (`IF NOT EXISTS`) |
| **Tabel Inspeksi** | L172-191 | `return_inspections`<br>- FK `loan_id` UNIQUE ON DELETE CASCADE<br>- FK `received_by`, `inspected_by`, `approved_by` ke `users(id)` | **VALID** (Idempoten via `IF NOT EXISTS`) |
| **Tabel Audit Log** | L198-210 | `audit_logs`<br>- Jejak audit mutasi status dan aksi sistem | **VALID** (Idempoten via `IF NOT EXISTS`) |
| **Definisi Peran Supabase** | L220-232 | Blok `DO $$ BEGIN ... END $$;`<br>- `anon`, `authenticated`, `service_role`<br>- Handler `EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN NULL;` | **VALID & AMAN** (Tidak menimpa peran yang sudah ada di Supabase) |
| **Aktivasi RLS** | L235-242 | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` pada seluruh 8 tabel | **VALID** (Praktik baku PostgREST / Supabase) |
| **Revoke Hak Publik** | L247-254 | `REVOKE ALL ON TABLE ... FROM anon, authenticated, public;` pada seluruh 8 tabel | **VALID & HARDENED** (Mencegah scraping PostgREST langsung ke database) |
| **Grant service_role** | L257-264 | `GRANT ALL ON TABLE ... TO service_role;` pada seluruh 8 tabel | **VALID** (Memberikan otoritas penuh kepada backend Express resmi) |
| **Kebijakan RLS** | L268-317 | Blok `DO $$ BEGIN ... END $$;`<br>8 statemen `CREATE POLICY ... FOR ALL TO service_role USING (true) WITH CHECK (true);` | **VALID GRAMMAR** (Urutan `FOR` mendahului `TO` sesuai spesifikasi PostgreSQL) |

---

### 2.2 Berkas Data Seed ([`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql))

| Entitas Data | Letak Baris | Mekanisme Idempotensi | Evaluasi Integritas Data |
|:---|:---:|:---|:---:|
| **Kategori** (4 data) | L10-20 | `ON CONFLICT (id) DO UPDATE SET ...` | **VALID** (Menyelaraskan ID kategori mock: `cat-tik`, `cat-mebel`, `cat-olahraga`, `cat-elektronik`) |
| **Lokasi** (7 data) | L22-35 | `ON CONFLICT (id) DO UPDATE SET ...` | **VALID** (Preservasi kode ruangan dan deskripsi) |
| **Sumber Dana** (5 data) | L37-47 | `ON CONFLICT (id) DO UPDATE SET ...` | **VALID** (Preservasi nama sumber pendanaan) |
| **Pengguna** (4 akun) | L49-59 | `ON CONFLICT (id) DO UPDATE SET ...` | **VALID** (Preservasi bcrypt hash akun terdaftar) |
| **Aset** (11 unit) | L61-179 | `ON CONFLICT (id) DO NOTHING;` | **VALID & ZERO DATA LOSS** (11/11 `permanent_id`, `qr_token`, `asset_code` terlindungi 100% dari penimpaan) |
| **Peminjaman** (2 data) | L182-205 | `ON CONFLICT (id) DO NOTHING;` | **VALID** (Tidak menimpa transaksi aktif/selesai) |
| **Audit Logs** (2 data) | L208-224 | `ON CONFLICT (id) DO NOTHING;` | **VALID** (Immutable audit trail terjaga) |

---

### 2.3 Berkas Migrator ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts))

| Logika Kontrol | Letak Baris | Uraian Implementasi | Evaluasi Keselamatan |
|:---|:---:|:---|:---:|
| **Guardrail Mode Staging** | L51-60 | Wajib `APP_ENV === 'staging'` | Menolak keras lingkungan selain staging |
| **Guardrail Konfirmasi Flag** | L62-67 | Wajib `ALLOW_STAGING_MIGRATION === 'true'` | Fail-closed jika flag bernilai `false` atau tidak disetel |
| **Penolakan Port Pooler** | L93-99 | Menolak port `6543` (PgBouncer Transaction Mode) | Mencegah transaksi DDL gagal akibat batasan pooler |
| **Anti-Production Guard** | L103-117 | Menolak string hostname/username/path yang memuat `prod` atau `production` | Perlindungan ganda terhadap basis data produksi |
| **Verifikasi Project Reference** | L139-150 | Memeriksa string koneksi terhadap `STAGING_PROJECT_REF` | Menolak koneksi ke proyek Supabase lain yang tidak sah |
| **Sanitasi Kredensial URL** | L28-36 | Masking username/password sebelum dicetak ke log | Menjamin tidak ada secret bocor ke terminal/laporan |
| **Koneksi Tunggal** | L227 | `const client = await pool.connect();` | Menjamin DDL, Seed, dan verifikasi berjalan dalam 1 sesi database |
| **Transaksi Atomik** | L231, L241, L281 | `await client.query('BEGIN');`<br>`await client.query('COMMIT');`<br>`await client.query('ROLLBACK');` | Seluruh DDL dan Seed di-rollback secara bersih jika terjadi error di tengah jalan |
| **Pelepasan Resource** | L287-290 | `client.release(); await pool.end();` dalam blok `finally` | Mencegah *connection leak* pada database target |

---

## 3. Pemeriksaan Kompatibilitas Role `service_role` dengan Supabase

Pada basis data Supabase:
1. **Peran Natively Pre-Provisioned:**
   Peran `service_role`, `anon`, dan `authenticated` telah dibuat secara otomatis oleh Supabase saat proyek dibuat.
2. **Perilaku Bagian 8.0 `schema.sql`:**
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
3. **Analisis Keselamatan:**
   - Karena `service_role` sudah ada di `pg_roles` Supabase, kondisi `IF NOT EXISTS` bernilai false, sehingga statemen `CREATE ROLE` **tidak pernah dieksekusi** pada Supabase staging.
   - Adanya klausa penangkap eksepsi `EXCEPTION WHEN duplicate_object OR insufficient_privilege THEN NULL;` menjamin bahwa seandainya user koneksi migrasi (`postgres`) tidak memiliki wewenang `CREATEROLE` penuh di lingkungan tertentu, transaksi tidak akan abort.
   - Hal ini memastikan kompatibilitas ganda: berjalan mulus di Supabase cloud tanpa mereplikasi/menimpa objek, sekaligus aman jika dijalankan di PostgreSQL mandiri/lokal.

---

## 4. Hasil Pengujian Aktual

### 4.1 Vitest Unit & Guardrail Tests
```bash
npm test -- --run
```
**Hasil Aktual:**
```
 RUN  v2.1.9 C:/Users/Lenovo/Documents/SIMSARPRAS

 ✓ src/test/statemachine.test.ts (15 tests) 40ms
 ✓ src/test/databaseMigration.test.ts (20 tests) 26ms
 ✓ src/test/apiContract.test.ts (20 tests) 1089ms
 ✓ src/test/components.test.tsx (11 tests) 3021ms
 ✓ src/test/qrIdentityAndUrl.test.tsx (21 tests) 5267ms

 Test Files  5 passed (5)
      Tests  87 passed (87)
   Start at  11:27:02
   Duration  9.34s
```
*Status: 87 dari 87 pengujian lulus 100%.*  
Termasuk pengujian baru Fase 2J.2:
- **Test 11:** Verifikasi urutan token `FOR ALL TO service_role` pada seluruh 8 tabel.
- **Test 12:** Penolakan eksekusi `runMigration` secara integrasi jika `ALLOW_STAGING_MIGRATION='false'`.
- **Test 13:** Verifikasi proteksi definisi role Supabase pada Bagian 8.0 `schema.sql`.

### 4.2 Frontend Production Build
```bash
npm run build
```
**Hasil Aktual:**
```
> tsc && vite build
✓ 1665 modules transformed.
dist/index.html                   1.02 kB │ gzip:   0.57 kB
dist/assets/index-BCDNF4uv.css   51.39 kB │ gzip:   8.61 kB
dist/assets/index-BWoDnNSk.js   554.73 kB │ gzip: 145.60 kB
✓ built in 9.92s
```
*Status: Exit code 0, 0 TypeScript error.*

### 4.3 Server Backend Build
```bash
npm run build --prefix server
```
**Hasil Aktual:**
```
> simsarpras-server@2.1.0 build
> tsc
```
*Status: Exit code 0, 0 TypeScript error.*

### 4.4 Rekonsiliasi Integritas Data Mock
```bash
npm run reconcile --prefix server
```
**Hasil Aktual:**
- Verdict: **PASSED**
- 11/11 token permanen terverifikasi valid dan unik.
- 0 orphan reference across all foreign key relations.
- Status konsistensi peminjaman: 100% sinkron.

---

## 5. Pemeriksaan Status Basis Data Staging (Live Read-Only Probe)

Sesuai batas keselamatan ketat (tanpa melakukan mutasi dan tanpa menggunakan koneksi staging untuk validasi sintaks DDL), dilakukan probe metadata murni (*read-only metadata query*) ke target staging:
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e';
```
**Hasil Probe Aktual:**
```
Public tables count: 0
Public enums count: 0
```
**Konfirmasi Keselamatan:** Basis data staging Supabase tetap berada dalam kondisi **bersih murni (pristine empty)**, membuktikan transaksi rollback Fase 2J berfungsi sempurna dan tidak ada operasi mutasi liar yang terjadi sejak saat itu.

---

## 6. Keterbatasan yang Belum Terverifikasi (Explicit Limitations)

| Aspek Pengujian | Status Verifikasi | Keterangan & Rationale |
|:---|:---:|:---|
| **Eksekusi DDL Lengkap di PostgreSQL Engine Lokal** | **NOT VERIFIED** | Lingkungan Windows lokal pengembang tidak memiliki instalasi biner PostgreSQL (`psql`) maupun daemon Docker/container lokal. Menguji DDL secara aktif ke database staging dilarang keras oleh batas keselamatan fase. Validasi saat ini didasarkan pada spesifikasi grammar resmi PostgreSQL (`gram.y`), audit posisi karakter eksekusi Fase 2J (di mana karakter 0-12100 terbukti sukses diparsing oleh PostgreSQL 17.11 staging), dan pengujian otomatis Vitest. |
| **Konektivitas Live Session Port 5432 Supabase** | **VERIFIED** | Telah dibuktikan pada audit Fase 2H dan 2J (berhasil terhubung ke Direct Connection port 5432 `ap-northeast-1`). |
| **Integritas Transaksi Atomik Migrator** | **VERIFIED** | Terbukti dari rollback bersih pada eksekusi Fase 2J saat terjadi syntax error di karakter 12101, meninggalkan 0 tabel di staging. |
| **Guardrail Penolakan Flag False** | **VERIFIED** | Terbukti melalui unit test 12 dan konfigurasi `ALLOW_STAGING_MIGRATION=false` di `server/.env`. |

---

## 7. Keputusan & Rekomendasi (Verdict)

### Status: **READY FOR HUMAN REVIEW**

1. Perbaikan sintaksis RLS DDL pada seluruh 8 kebijakan di [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) telah diverifikasi secara teliti terhadap tata bahasa baku PostgreSQL.
2. Migrator telah terbukti memiliki mekanisme keselamatan fail-closed dan transaksi atomik yang andal.
3. Keterbatasan eksekusi engine lokal telah didokumentasikan secara transparan (`NOT VERIFIED`).
4. Flag keselamatan tetap terkunci rapat pada `ALLOW_STAGING_MIGRATION=false`.
5. **Tidak ada migrasi otomatis yang dijalankan.** Sistem berhenti pada fase ini untuk menunggu peninjauan dan otorisasi manusia sebelum eksekusi ulang migrasi staging Fase 2J.
