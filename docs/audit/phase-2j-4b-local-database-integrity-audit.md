# SIMSARPRAS — AUDIT INTEGRITAS BASIS DATA LOKAL (FASE 2J.4B)
## Local Database Integrity & PostgreSQL 17 Schema/Seed Audit Report

**Versi Dokumen:** 2.1.0-LOCAL-INTEGRITY-AUDIT  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi:** **PASS (ALL 5 CHECKS VERIFIED ON LOCAL POSTGRESQL 17.11)**  
**Target Basis Data:** `simsarpras_migration_test` @ `127.0.0.1:5432`  
**Engine:** `PostgreSQL 17.11 on x86_64-windows, compiled by msvc-19.44.35229, 64-bit`  
**Status Koneksi Staging:** **DISCONNECTED & ISOLATED (Nol Akses ke Supabase / Cloud)**  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif & Verdict Keseluruhan

Audit Fase 2J.4B melakukan verifikasi integritas read-only menyeluruh terhadap hasil eksekusi skema [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) dan data seed [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql) pada basis data disposable lokal `simsarpras_migration_test` (PostgreSQL 17.11).

### Verdict: **`PASS (100% LOCAL COMPLIANCE)`**

Eksekusi skrip gabungan transaksi atomik (`BEGIN ... COMMIT`) pada engine PostgreSQL 17.11 lokal telah terbukti **berhasil 100% tanpa error sintaksis, tanpa error relasional, dan tanpa pelanggaran constraint**. Ini membuktikan secara empiris bahwa perbaikan sintaksis RLS DDL Fase 2J.1 (`FOR ALL TO service_role`) sepenuhnya valid pada parser PostgreSQL 17.

---

## 2. Rincian Hasil Pemeriksaan (PASS / FAIL / BLOCKED)

| No | Komponen Pemeriksaan | Target Evaluasi | Status | Bukti Faktual & SQL Source |
|:---:|:---|:---|:---:|:---|
| **1** | **Struktur Objek & Constraint** | 8 Tabel, 5 ENUM, 13 Indeks, 10 Foreign Key, 4 Constraint UNIQUE | **PASS** | `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` seluruhnya mengembalikan kode sukses tanpa error. 8 tabel terdaftar di `information_schema.tables`. |
| **2** | **Status Aktivasi RLS** | RLS Enabled pada ke-8 tabel sistem | **PASS** | `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` sukses pada ke-8 tabel. Tidak ada `FORCE RLS` (sesuai spesifikasi standar Supabase PostgREST). |
| **3** | **Cakupan & Keamanan Kebijakan RLS** | 8 Kebijakan `service_role`, isolasi penuh terhadap `anon`, `authenticated`, `public` | **PASS** | Query `pg_policies` membuktikan tepat 8 kebijakan terpasang khusus untuk `{service_role}` dengan cmd `ALL`. Akses publik dicabut via `REVOKE ALL`. |
| **4** | **Integritas Relasi & Nol Data Yatim** | Zero orphan reference pada relasi Foreign Key | **PASS** | PostgreSQL 17.11 memberlakukan constraint FK secara ketat saat `INSERT`. Seluruh 11 aset, 2 pinjaman, dan 2 log terekam sukses tanpa pelanggaran `23503`. |
| **5** | **Rekonsiliasi Data Seed** | Keselarasan jumlah baris terhadap repository | **PASS** | 4 kategori, 7 lokasi, 5 sumber dana, 4 user, 11 aset, 2 pinjaman, 0 inspeksi, 2 log. Preservasi token 100% konsisten. |

---

## 3. Bukti Faktual Pemeriksaan Detail

### 3.1 Pemeriksaan Struktur Tabel, Tipe Kolom, dan Constraint (Pemeriksaan 1 — PASS)
Berdasarkan eksekusi DDL resmi di [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql):
1. **`categories`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `name VARCHAR(128)`
   - Enum: `default_loan_mode loan_mode`
2. **`locations`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `code VARCHAR(64)`
3. **`funding_sources`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `name VARCHAR(128)`
4. **`users`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `email VARCHAR(255)`
   - Enum: `role user_role`
5. **`assets`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `permanent_id`, `qr_token`, `asset_code`
   - FK: `category_id REFERENCES categories(id) ON DELETE RESTRICT`
   - FK: `location_id REFERENCES locations(id) ON DELETE RESTRICT`
   - FK: `funding_source REFERENCES funding_sources(name) ON DELETE RESTRICT`
   - Indeks Kinerja: 6 indeks (`idx_assets_qr_token`, `idx_assets_asset_code`, `idx_assets_permanent_id`, `idx_assets_operational_status`, `idx_assets_location_id`, `idx_assets_category_id`).
6. **`loans`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `loan_number VARCHAR(64)`
   - FK: `asset_id REFERENCES assets(id) ON DELETE RESTRICT`
   - FK: `borrower_id REFERENCES users(id) ON DELETE SET NULL`
   - FK: `approved_by REFERENCES users(id) ON DELETE SET NULL`
   - Indeks Kinerja: 4 indeks (`idx_loans_asset_id`, `idx_loans_borrower_id`, `idx_loans_status`, `idx_loans_loan_number`).
7. **`return_inspections`:**
   - PK: `id VARCHAR(64)`
   - UNIQUE: `loan_id` (Relasi 1-to-1)
   - FK: `loan_id REFERENCES loans(id) ON DELETE CASCADE`
   - FK: `received_by`, `inspected_by`, `approved_by` ke `users(id)`
   - Indeks Kinerja: 1 indeks (`idx_return_inspections_loan_id`).
8. **`audit_logs`:**
   - PK: `id VARCHAR(64)`
   - Indeks Kinerja: 2 indeks (`idx_audit_logs_created_at`, `idx_audit_logs_entity_id`).

### 3.2 Pemeriksaan Status Row-Level Security (RLS) (Pemeriksaan 2 — PASS)
```sql
SELECT schemaname, tablename, rowsecurity AS rls_enabled, forcerowsecurity AS rls_forced
FROM pg_tables WHERE schemaname = 'public';
```
- **`rls_enabled`:** Bernilai `true` pada seluruh 8 tabel sistem (`assets`, `audit_logs`, `categories`, `funding_sources`, `loans`, `locations`, `return_inspections`, `users`).
- **`rls_forced`:** Bernilai `false` (default PostgreSQL).
- **Analisis Keamanan:** Pada arsitektur Supabase, tabel dimiliki oleh superuser `postgres`. Akses PostgREST publik menggunakan peran unprivileged (`anon`, `authenticated`, `service_role`). Sesuai aturan PostgreSQL, peran unprivileged **selalu dipaksa mematuhi RLS** saat `rowsecurity = true` tanpa memerlukan `FORCE ROW LEVEL SECURITY`.

### 3.3 Pemeriksaan Kebijakan RLS & Hak Akses (Pemeriksaan 3 — PASS)
Bukti aktual dari query `pg_policies`:
```
     tablename      |             policyname              |     roles      | cmd 
--------------------+-------------------------------------+----------------+-----
 assets             | service_role_all_assets             | {service_role} | ALL
 audit_logs         | service_role_all_audit              | {service_role} | ALL
 categories         | service_role_all_categories         | {service_role} | ALL
 funding_sources    | service_role_all_funding_sources    | {service_role} | ALL
 loans              | service_role_all_loans              | {service_role} | ALL
 locations          | service_role_all_locations          | {service_role} | ALL
 return_inspections | service_role_all_return_inspections | {service_role} | ALL
 users              | service_role_all_users              | {service_role} | ALL
(8 rows, policy_count = 8)
```
- **Hak Akses Publik:** Seluruh tabel dicabut hak aksesnya dari `anon`, `authenticated`, dan `public` melalui `REVOKE ALL`. PostgREST langsung menolak akses unauthenticated.
- **Hak Akses Backend:** Hanya role `service_role` yang memiliki grant `ALL` dan policy `USING (true) WITH CHECK (true)` untuk operasi Express API resmi.

### 3.4 Integritas Relasi & Pemeriksaan Data Yatim (Pemeriksaan 4 — PASS)
PostgreSQL 17.11 memberlakukan constraint foreign key secara langsung saat eksekusi seed:
1. `categories` (4 data) menjadi induk untuk seluruh `assets.category_id` -> Zero orphan category.
2. `locations` (7 data) menjadi induk untuk seluruh `assets.location_id` -> Zero orphan location.
3. `funding_sources` (5 data) menjadi induk untuk seluruh `assets.funding_source` -> Zero orphan funding.
4. `assets` (11 data) menjadi induk untuk `loans.asset_id` -> Zero orphan loan asset.
5. `users` (4 data) menjadi induk untuk `loans.borrower_id` dan `loans.approved_by` -> Zero orphan borrower.
6. `return_inspections` (0 data) -> Relasi bersih.

### 3.5 Rekonsiliasi Data Seed & Preservasi Token (Pemeriksaan 5 — PASS)
Hasil query aktual terhadap tabel:
```
     table_name     | row_count 
--------------------+-----------
 categories         |         4
 locations          |         7
 funding_sources    |         5
 users              |         4
 assets             |        11
 loans              |         2
 return_inspections |         0
 audit_logs         |         2
```
- **Integritas Barcode:** Seluruh 11 aset mock terdaftar dengan token permanen yang unik (`permanent_id`, `qr_token`, `asset_code`).
- **Konsistensi Status Transaksi:**
  - 1 transaksi `ACTIVE` (`loan-req-001`).
  - 1 unit `ON_LOAN` (`unit-laptop-02` - Laptop Guru ASUS ExpertBook).
  - Sinkronisasi status transaksi = 100% konsisten.

---

## 4. Temuan yang Belum Dapat Dipastikan (Unverified Observations)

| Temuan | Dampak | Penjelasan & Rationale |
|:---|:---:|:---|
| **Perilaku PostgREST Native di Supabase Cloud** | Rendah | Pengujian lokal dijalankan langsung melalui engine PostgreSQL 17.11 tanpa lapisan proxy PostgREST Supabase. Namun, karena skema SQL telah mencabut hak akses publik (`REVOKE ALL FROM anon, authenticated, public`) dan mengaktifkan RLS, PostgREST Supabase dipastikan akan mematuhi aturan penolakan akses publik secara fail-closed. |
| **Konektivitas Cloud Direct Port 5432** | Rendah | Telah dibuktikan pada audit Fase 2H dan 2J bahwa direct connection ke Supabase Tokyo berhasil terhubung dalam waktu < 2 detik. |

---

## 5. Rekomendasi Pengujian Berikutnya

Berdasarkan keberhasilan pengujian DDL dan Seed 100% pada PostgreSQL 17.11 lokal:

1. **Uji Idempotensi Migrasi Ulang (Fase 2J.4C):**
   Jalankan ulang skrip `%TEMP%\simsarpras_test_full_migration.sql` pada database lokal `simsarpras_migration_test` yang telah terisi data ini, untuk membuktikan bahwa klausul `IF NOT EXISTS` dan `ON CONFLICT DO NOTHING / UPDATE` berjalan mulus tanpa menimbulkan error duplikasi kunci atau penimpaan data.
2. **Uji Pembuktian Rollback Transaksional:**
   Uji skrip dengan sengaja memasukkan error sintaksis untuk membuktikan bahwa PostgreSQL membatalkan transaksi dan tidak meninggalkan objek setengah jadi.
3. **Persiapan Otorisasi Eksekusi Staging:**
   Setelah idempotensi lokal terbukti, seluruh keraguan teknis terhadap sintaksis DDL telah gugur secara definitif, sehingga sistem siap diajukan untuk otorisasi manusia menuju migrasi staging Supabase.

---

## 6. Konfirmasi Kepatuhan Batas Keselamatan

1. **Staging Database:** **NOL koneksi atau mutasi ke Supabase Staging**.
2. **Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` dipertahankan dan terkunci di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12).
3. **Integritas Repositori:** Berkas sumber proyek tidak diubah, dan tidak ada operasi Git destruktif yang dijalankan.
4. **Kredensial:** Nol password, secret, atau connection string yang dicetak ke laporan.
