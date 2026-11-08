# SIMSARPRAS — LAPORAN AUDIT KESELAMATAN PRA-MIGRASI (FASE 2G)
## Pre-Migration Safety Audit & Database Security Evaluation

**Versi Dokumen:** 2.1.0-PRE-MIGRATE-AUDIT  
**Tanggal Pelaksanaan:** 13 Oktober 2026  
**Status Evaluasi:** AUDIT ONLY (Tanpa migrasi live, tanpa seed database, tanpa koneksi aplikasi aktif)  
**Rekomendasi Akhir:** **`NOT READY`** (Ditemukan 2 temuan berisiko tinggi pada RLS tabel `users` dan ketiadaan proteksi lingkungan produksi pada script migrasi sebelum eksekusi staging diizinkan)

---

## 1. Ringkasan Eksekutif & Matriks Status Audit

Audit keselamatan ini dilakukan secara mendalam terhadap 7 berkas inti arsitektur database dan skrip runner SIMSARPRAS:
1. [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts)
2. [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql)
3. [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql)
4. [`server/src/db.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts)
5. [`server/.env.example`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.example)
6. [`.gitignore`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/.gitignore)
7. [`docs/audit/phase-2f-staging-provisioning.md`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/docs/audit/phase-2f-staging-provisioning.md)

### Matriks Temuan Audit:

| No | Parameter Audit | Status | Kategori | Lokasi Kode / Bukti |
|:---|:---|:---:|:---:|:---|
| 1 | Mode Dry-Run Aman (Zero Connection & Zero DDL) | **PASS** | Aman | [`server/scripts/migrate.ts:44-55`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L44-L55) |
| 2 | Pemilihan `DIRECT_URL` (5432) vs `DATABASE_URL` (6543) | **PASS** | Advisory | [`server/scripts/migrate.ts:19`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L19), [`server/src/db.ts:9-17`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L9-L17) |
| 3 | Proteksi Eksekusi Tak Sengaja pada Database Produksi | **FAIL** | **Kritis / Blocker** | [`server/scripts/migrate.ts:18-65`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L18-L65) |
| 4 | Transaksionalitas (`BEGIN`, `COMMIT`, `ROLLBACK`) pada Satu Koneksi | **PASS** | Aman | [`server/scripts/migrate.ts:64-78, 116-123`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L64-L78) |
| 5 | Idempotensi Skema Database (Re-run Safety) | **PASS** | Aman | [`server/db/schema.sql:9-51, 131-137, 218-255`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L9-L51) |
| 6 | RLS, GRANT, dan Isolasi Hak Akses Role Publik (`anon`) | **FAIL** | **Kritis / Blocker** | [`server/db/schema.sql:218-255`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L218-L255) |
| 7 | Konfigurasi SSL (`rejectUnauthorized: false` vs Stronger Verification) | **PASS** | Risk Warning | [`server/src/db.ts:12`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L12), [`server/scripts/migrate.ts:61`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L61) |
| 8 | Perlindungan Kredensial & Secrets via `.gitignore` | **PASS** | Aman | [`.gitignore:11-20`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/.gitignore#L11-L20) |
| 9 | Keamanan Seed & Evaluasi Konflik Data Lama Non-`id` | **PASS** | Advisory | [`server/db/seed.sql:16-19, 179, 205`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L16-L19) |
| 10 | Verifikasi Pengujian Lokal (Test Suites, Build, Reconcile) | **PASS** | Aman | 65 Vitest lolos, 0 Build error, Rekonsiliasi PASSED |

---

## 2. Analisis Rinci 10 Parameter Audit

### 1. Mode Dry-Run Migrator
- **Status:** **PASS**
- **Bukti Kode:** [`server/scripts/migrate.ts:44-55`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L44-L55)
- **Evaluasi:**
  ```typescript
  if (!targetUrl) {
    console.log('\n⚠️  PERINGATAN: DATABASE_URL belum dikonfigurasi di environment.');
    console.log('    Menjalankan validasi DRY-RUN (uji sintaksis DDL & Seed)...');
    return { status: 'DRY_RUN_PASSED', preAudit };
  }
  ```
  Ketika variabel koneksi tidak tersedia atau string kosong, fungsi segera mengembalikan status `DRY_RUN_PASSED`. Instansiasi `new Pool()` dan `pool.connect()` **sama sekali tidak dieksekusi**. Tidak ada socket TCP jaringan yang dibuka, dan tidak ada statement DDL maupun seed yang dikirimkan.

---

### 2. Pemilihan `DIRECT_URL` dan `DATABASE_URL`
- **Status:** **PASS (dengan Catatan Advisory)**
- **Bukti Kode:** [`server/scripts/migrate.ts:19`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L19), [`server/src/db.ts:9-17`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L9-L17)
- **Evaluasi:**
  - Migrator memprioritaskan: argumen `databaseUrl` $\rightarrow$ `process.env.DIRECT_URL` (Port 5432, Session Mode) $\rightarrow$ `process.env.DATABASE_URL` (Port 6543, Transaction Mode).
  - Runtime Express API ([`server/src/db.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts)) hanya menggunakan `DATABASE_URL` (Port 6543) dengan pool size `max: 10`.
- **Catatan Advisory:**
  Jika pengguna hanya menyetel `DATABASE_URL` (Port 6543 PgBouncer) tanpa menyetel `DIRECT_URL` (Port 5432), eksekusi migrasi DDL berpotensi mengalami kendala keterbatasan connection pooler Supabase (misal penolakan session-level transactional lock atau prepared statements). Migrator sebaiknya selalu mengutamakan Port 5432 untuk DDL.

---

### 3. Proteksi Eksekusi Tak Sengaja pada Database Produksi
- **Status:** **FAIL (BLOCKER)**
- **Bukti Kode:** [`server/scripts/migrate.ts:18-65`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L18-L65)
- **Risiko & Dampak:**
  Saat ini `server/scripts/migrate.ts` **tidak memiliki pemeriksaan eksplisit** terhadap target lingkungan database. Jika pengembang atau sistem CI/CD secara tidak sengaja menaruh connection string produksi ke dalam file `server/.env`, perintah `npm run migrate` akan langsung menghubungkan, mengeksekusi DDL, dan menjalankan seed pada database produksi tanpa konfirmasi maupun blokade!
- **Perbaikan yang Direkomendasikan:**
  Tambahkan guardrail keselamatan pada `server/scripts/migrate.ts`:
  1. Validasi variabel penegasan lingkungan: wajibkan `APP_ENV === 'staging'` atau flag eksplisit `ALLOW_STAGING_MIGRATION === 'true'`.
  2. Cegah eksekusi jika `NODE_ENV === 'production'` tanpa flag override khusus `--force-production-migration`.
  3. Lakukan sanitasi logging: cetak host target yang tersensor (misal: `aws-0-ap-southeast-1.pooler.supabase.com:5432`) dengan password disamarkan sebelum eksekusi dimulai.

---

### 4. Transaksionalitas (`BEGIN`, `COMMIT`, `ROLLBACK`) pada Satu Koneksi
- **Status:** **PASS**
- **Bukti Kode:** [`server/scripts/migrate.ts:64-78, 116-123`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L64-L78)
- **Evaluasi:**
  - Seluruh statement SQL dieksekusi pada instans klien tunggal yang sama (`const client = await pool.connect();`).
  - DDL `schema.sql` dan seed `seed.sql` diapit blok transaksional `BEGIN` dan `COMMIT`.
  - Di PostgreSQL, statement DDL (`CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY`, `CREATE TYPE`, `CREATE EXTENSION`) bersifat **transactional DDL**, sehingga jika ada satu statement yang gagal, seluruh skema di-rollback secara atomik.
  - Skrip menggunakan `CREATE INDEX IF NOT EXISTS` standar, bukan `CREATE INDEX CONCURRENTLY` (yang dilarang di dalam blok transaksi PostgreSQL).
- **Rekomendasi Tambahan:**
  Pada blok `catch` (baris 117), bungkus `await client.query('ROLLBACK')` dalam blok try-catch sekunder untuk mengantisipasi jika koneksi jaringan terputus di tengah jalan (*severed connection*).

---

### 5. Idempotensi Skema Database (Re-run Safety)
- **Status:** **PASS**
- **Bukti Kode:** [`server/db/schema.sql:9-51, 56-128, 131-137, 218-255`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql)
- **Evaluasi Idempotensi:**
  - **Ekstensi:** Menggunakan `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` dan `"pgcrypto"`.
  - **ENUM Types:** Dilindungi blok `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '...') THEN CREATE TYPE ... END IF; END $$;`.
  - **Tabel:** Seluruh tabel menggunakan `CREATE TABLE IF NOT EXISTS`.
  - **Indeks:** Seluruh 11 indeks menggunakan `CREATE INDEX IF NOT EXISTS`.
  - **RLS Enable:** Perintah `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` bersifat no-op jika RLS sudah aktif.
  - **Policies:** Seluruh kebijakan RLS dibungkus dalam blok `IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = '...')`.
  - Menjalankan ulang `schema.sql` berulang kali terbukti menghasilkan 0 error sintaksis.

---

### 6. RLS, GRANT, dan Isolasi Hak Akses Role Publik (`anon`)
- **Status:** **FAIL (BLOCKER)**
- **Bukti Kode:** [`server/db/schema.sql:218-255`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L218-L255)
- **Risiko & Dampak:**
  Pada [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql):
  1. **Tabel `users` sama sekali belum diaktifkan RLS-nya** (`ALTER TABLE users ENABLE ROW LEVEL SECURITY;` tidak ada).
  2. Tabel referensi `categories`, `locations`, `funding_sources` juga belum memiliki proteksi RLS.
  3. Supabase secara default mengekspos endpoint PostgREST publik (`/rest/v1/...`) menggunakan role `anon` (kunci publik frontend).
  4. **Potensi Kebocoran Data Kredensial:** Siapa pun yang memiliki anon key Supabase dapat langsung melakukan request HTTP GET ke endpoint `/rest/v1/users` dan membaca data seluruh pengguna, termasuk kolom sensitif: `password_hash`, `email`, `employee_number`, dan `role`.
- **Perbaikan yang Direkomendasikan:**
  Wajib menambahkan RLS dan kebijakan ketat pada `server/db/schema.sql` sebelum migrasi dijalankan:
  ```sql
  -- Aktifkan RLS pada seluruh tabel
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
  ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
  ALTER TABLE funding_sources ENABLE ROW LEVEL SECURITY;

  -- Tabel USERS: DILARANG DIBACA OLEH ANON / AUTHENTICATED (Hanya service_role / backend)
  DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_users') THEN
          CREATE POLICY service_role_all_users ON users
          TO service_role
          FOR ALL USING (true) WITH CHECK (true);
      END IF;
  END $$;

  -- Tabel Referensi: Publik hanya boleh membaca (SELECT), mutasi hanya service_role
  DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_categories') THEN
          CREATE POLICY public_read_categories ON categories FOR SELECT TO anon, authenticated USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_categories') THEN
          CREATE POLICY service_role_all_categories ON categories TO service_role FOR ALL USING (true) WITH CHECK (true);
      END IF;
      -- dan seterusnya untuk locations serta funding_sources
  END $$;
  ```

---

### 7. Konfigurasi SSL (`rejectUnauthorized: false` vs Stronger Verification)
- **Status:** **PASS (dengan Catatan Risiko Keamanan)**
- **Bukti Kode:** [`server/src/db.ts:12`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L12), [`server/scripts/migrate.ts:61`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L61)
- **Evaluasi Risiko:**
  - Opsi `rejectUnauthorized: false` menonaktifkan validasi rantai sertifikat TLS (Certificate Authority verification).
  - Meskipun paket data terenkripsi dalam perjalanan (*encryption in transit*), koneksi rentan terhadap serangan **Man-In-The-Middle (MITM)** apabila terjadi peracunan DNS (DNS spoofing) atau proxy perantara yang memalsukan sertifikat.
  - **Alternatif yang Lebih Kuat:**
    Supabase pooler menggunakan sertifikat publik yang valid. Verifikasi ketat dapat diterapkan dengan menyediakan sertifikat root CA Supabase (`prod-ca-2021.crt`) atau menggunakan `ssl: { rejectUnauthorized: true }` jika runtime Node.js memiliki sertifikat trust store sistem yang mutakhir.
  - Untuk keperluan staging saat ini konfigurasi ini dapat diterima sementara, namun dicatat sebagai *architectural security debt* sebelum menuju produksi.

---

### 8. Perlindungan Kredensial & Secrets via `.gitignore`
- **Status:** **PASS**
- **Bukti Kode:** [`.gitignore:11-20`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/.gitignore#L11-L20)
- **Evaluasi:**
  - File `.gitignore` pada root memblokir: `.env`, `.env.local`, `server/.env`, `server/.env.local`, `server/.env.production`.
  - Berdasarkan pencarian filesystem, tidak ada file `.env` live yang saat ini tersimpan di repositori; hanya file contoh [`server/.env.example`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.example).
  - Tidak ada string kredensial, connection string, atau password yang terekspos di source code frontend maupun backend.

---

### 9. Keamanan Seed & Evaluasi Konflik Data Lama Non-`id`
- **Status:** **PASS (dengan Catatan Risiko Teridentifikasi)**
- **Bukti Kode:** [`server/db/seed.sql:16-19, 55-58, 179, 205`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L16-L19)
- **Evaluasi:**
  - Untuk database staging kosong, seed berjalan mulus dengan 11 aset dan 2 pinjaman (konsisten 100% dengan rekonsiliasi mock).
  - Pada tabel `assets`, klausa `ON CONFLICT (id) DO NOTHING` berhasil melindungi status barang operasional (`ON_LOAN`, `MAINTENANCE`) agar tidak tertimpa jika seed dijalankan ulang.
- **Potensi Konflik Data Lama yang Tidak Diselesaikan oleh `ON CONFLICT (id)`:**
  1. **Konflik Constraint Unik Sekunder:** Tabel `assets` memiliki 4 constraint unik: `id`, `permanent_id`, `qr_token`, dan `asset_code`. Jika pada database terdapat data lama dengan `id` berbeda namun memiliki `qr_token` atau `asset_code` yang sama dengan seed, klausul `ON CONFLICT (id)` **tidak akan menangkapnya**, sehingga PostgreSQL akan melempar error duplikasi unik dan membatalkan seluruh transaksi migrasi.
  2. **Penimpaan Master Data:** Pada tabel `categories`, `locations`, `funding_sources`, dan `users`, seed menggunakan `ON CONFLICT (id) DO UPDATE SET`. Jika di lingkungan staging pengguna telah memodifikasi nama kategori atau role staf, menjalankan ulang seed akan mengembalikan nilainya ke data bawaan seed.

---

### 10. Verifikasi Pengujian Lokal
- **Status:** **PASS**
- **Bukti Hasil Uji:**
  - **Vitest Suites:** 65 dari 65 unit test berhasil lulus (`npm test`) pada 5 berkas pengujian:
    - [`src/test/databaseMigration.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/databaseMigration.test.ts) (7 tests)
    - [`src/test/statemachine.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/statemachine.test.ts) (15 tests)
    - [`src/test/apiContract.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts) (15 tests)
    - [`src/test/components.test.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/components.test.tsx) (11 tests)
    - [`src/test/qrIdentityAndUrl.test.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/qrIdentityAndUrl.test.tsx) (17 tests)
  - **TypeScript Frontend:** `npx tsc --noEmit` lolos dengan 0 error.
  - **Build Frontend:** `npm run build` berhasil mengompilasi bundel produksi (`dist/`) tanpa error.
  - **Build Backend Server:** `npm run build --prefix server` berhasil mengompilasi TypeScript (`server/dist/`) tanpa error.
  - **Rekonsiliasi Mock:** `npm run reconcile --prefix server` menghasilkan verdict `PASSED` (11 aset, 0 duplicate tokens, 0 orphaned relations).
  - **Dry-Run Migrasi:** `npm run migrate --prefix server` menghasilkan verdict `DRY_RUN_PASSED`.

> [!IMPORTANT]
> **Peringatan Batasan Pengujian Lokal:**
> Keberhasilan seluruh tes lokal di atas membuktikan integritas logika aplikasi di memori/mock, namun **BUKAN merupakan bukti konektivitas database live, keandalan RLS runtime di server Supabase, atau keberhasilan migrasi jaringan staging**.

---

## 3. Checklist Prasyarat Sebelum Eksekusi Migrasi Staging

Sebelum izin eksekusi migrasi staging diberikan, prasyarat berikut wajib diselesaikan:

- [ ] **Resolusi Blocker 1:** Perbaiki [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) untuk mengaktifkan RLS pada tabel `users` dan membatasi akses baca/tulis hanya untuk `service_role`.
- [ ] **Resolusi Blocker 2:** Perbarui [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts) dengan validasi lingkungan ketat agar menolak eksekusi pada database produksi tanpa konfirmasi eksplisit.
- [ ] **Provisioning Manual Proyek Supabase:** Pembuatan proyek `simsarpras-staging` di dashboard Supabase (region `ap-southeast-1`).
- [ ] **Konfigurasi Lingkungan:** Pembuatan berkas `server/.env` berisi `DIRECT_URL` (Port 5432) dan `DATABASE_URL` (Port 6543).
- [ ] **Uji Konektivitas Jaringan (Ping/Select Now):** Menjalankan pemeriksaan konektivitas awal tanpa mutasi skema.
- [ ] **Izin Eksplisit dari Pengguna:** Persetujuan terpisah untuk menjalankan eksekusi `npm run migrate`.

---

## 4. Rekomendasi Akhir

### Status: **`NOT READY`**

### Alasan:
1. **Kerentanan Keamanan RLS (Blocker Kritis):** Skema [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) saat ini belum mengaktifkan Row-Level Security pada tabel `users`. Jika dimigrasikan ke Supabase dalam kondisi ini, data pengguna dan `password_hash` dapat diakses secara publik melalui REST API Supabase oleh siapa pun yang memegang `anon` key.
2. **Ketiadaan Proteksi Database Produksi pada Migrator (Blocker Kritis):** Skrip [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts) belum memiliki pemeriksaan verifikasi target staging.
3. **Kredensial Belum Disediakan:** Proyek `simsarpras-staging` belum diprovisikan di dashboard Supabase dan file `server/.env` belum diisi.

**Tindakan yang Disarankan Selanjutnya:**  
Lakukan perbaikan non-destruktif terhadap `server/db/schema.sql` (penambahan RLS tabel `users`) dan `server/scripts/migrate.ts` (penambahan guardrail lingkungan), kemudian lanjutkan ke penyiapan kredensial staging setelah mendapat persetujuan.
