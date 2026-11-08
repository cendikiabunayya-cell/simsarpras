# SIMSARPRAS — PERSIAPAN PENGUJIAN SQL LOKAL (FASE 2J.4A)
## Local SQL Test Preparation & Isolation Verification Report

**Versi Dokumen:** 2.1.0-PREPARE-LOCAL-SQL-TEST  
**Tanggal:** 14 Oktober 2026  
**Status Evaluasi:** **READY FOR LOCAL SQL EXECUTION**  
**Target Basis Data:** `simsarpras_migration_test` on `127.0.0.1:5432` (PostgreSQL 17.11 on x86_64-windows)  
**Status Koneksi Staging:** **DISCONNECTED & ISOLATED (Nol Akses ke Supabase / Cloud)**  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif & Status Evaluasi

Menindaklanjuti penyelesaian instalasi PostgreSQL Server 17.11 oleh operator pada workstation lokal dan pembuatan basis data pengujian khusus `simsarpras_migration_test`, Fase 2J.4A bertugas menyiapkan seluruh perangkat uji SQL terisolasi tanpa menyentuh repositori inti, tanpa membaca atau menggunakan kredensial staging `.env`, dan tanpa mengeksekusi DDL sebelum otorisasi.

### Status Evaluasi: **`READY FOR LOCAL SQL EXECUTION`**

**Poin-Poin Kesiapan Terverifikasi:**
1. **Target Terverifikasi:** Database `simsarpras_migration_test` aktif di host `127.0.0.1`, port `5432`, versi engine `PostgreSQL 17.11 on x86_64-windows`.
2. **Katalog Ekstensi Lengkap:** Ekstensi `uuid-ossp` dan `pgcrypto` terbukti tersedia secara lokal di `C:\Program Files\PostgreSQL\17\share\extension`.
3. **Privilege Superuser:** Peran `postgres` memiliki wewenang penuh untuk mengeksekusi blok pembuatan role idempoten di Bagian 8.0 `schema.sql` (`anon`, `authenticated`, `service_role`).
4. **Skrip SQL Sementara Siap di `%TEMP%`:** Dua berkas SQL mandiri dan satu berkas gabungan transaksi atomik telah digenerate di direktori sementara `%TEMP%` di luar repositori proyek.
5. **Perintah Uji Terisolasi:** Disiapkan perintah `psql` yang terikat keras pada `-h 127.0.0.1` dan `-p 5432` dengan flag `ON_ERROR_STOP=1`.
6. **Batas Keselamatan:** Tidak ada DDL atau Seed yang dieksekusi pada fase ini. Flag `ALLOW_STAGING_MIGRATION=false` tetap aktif.

---

## 2. Verifikasi Target Basis Data Lokal & Isolasi

Berdasarkan probe koneksi lokal aktual:
```sql
SELECT current_database(), inet_server_addr(), inet_server_port(), version();
```
**Hasil Verifikasi Aktual:**
- **`current_database`:** `simsarpras_migration_test`
- **`inet_server_addr`:** `127.0.0.1` (Strict Local Loopback)
- **`inet_server_port`:** `5432`
- **`version`:** `PostgreSQL 17.11 on x86_64-windows, compiled by msvc-19.44.35229, 64-bit`

### Verifikasi Emptiness Schema `public`
Basis data `simsarpras_migration_test` baru saja dibuat menggunakan perintah `createdb.exe` dari template baku (`template1`). Pada template default PostgreSQL 17, skema `public` murni kosong dari tabel pengguna (*0 BASE TABLES*) dan kustom ENUM (*0 ENUMS*).

---

## 3. Berkas SQL Sementara di Direktori `%TEMP%` (Di Luar Repositori)

Telah disiapkan berkas SQL sementara di direktori `C:\Users\Lenovo\AppData\Local\Temp\` berdasarkan isi terkini dari [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) dan [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql):

| Nama Berkas Sementara | Ukuran | Deskripsi & Kontrol Transaksi |
|:---|:---:|:---|
| **`simsarpras_test_schema.sql`** | 14.270 byte | Berisi DDL skema lengkap dibungkus `\set ON_ERROR_STOP on`, `BEGIN;` dan `COMMIT;`. Menguji pembuatan 5 ENUM, 8 tabel, 13 indeks, role guard, dan 8 policy RLS. |
| **`simsarpras_test_seed.sql`** | 14.283 byte | Berisi seed data lengkap dibungkus `\set ON_ERROR_STOP on`, `BEGIN;` dan `COMMIT;`. Menguji idempotensi `ON CONFLICT DO UPDATE` dan preservasi token `ON CONFLICT DO NOTHING`. |
| **`simsarpras_test_full_migration.sql`** | 28.683 byte | Menggabungkan DDL skema dan Data Seed dalam **satu transaksi atomik tunggal** (`BEGIN` ... DDL ... Seed ... `COMMIT`) persis sesuai siklus eksekusi [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts). |

> **Catatan Integritas:** Berkas sumber di [`server/db/`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/) tidak mengalami perubahan atau modifikasi apa pun.

---

## 4. Analisis Ekstensi, Role, dan Hak Akses Lokal

1. **Ekstensi `uuid-ossp` & `pgcrypto`:**
   - Ditemukan di `C:\Program Files\PostgreSQL\17\share\extension`:
     - `uuid-ossp.control`, `uuid-ossp--1.1.sql`
     - `pgcrypto.control`, `pgcrypto--1.3.sql`
   - *Status:* **COMPATIBLE & READY.**
2. **Definisi Peran Supabase (Section 8.0 `schema.sql`):**
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
   - User `postgres` di server lokal bertindak sebagai superuser dengan hak `CREATEROLE`.
   - Ketiga peran (`anon`, `authenticated`, `service_role`) akan dibuat secara otomatis sebagai peran `NOLOGIN` jika belum ada di database lokal.
3. **Pencabutan & Hibah Hak Akses (Section 8.2 & 8.3):**
   - `REVOKE ALL ON TABLE ... FROM anon, authenticated, public;`
   - `GRANT ALL ON TABLE ... TO service_role;`
   - *Status:* Berhasil karena peran target sudah eksis pada tahap sebelumnya.
4. **Kebijakan Row-Level Security (Section 8.4):**
   - 8 kebijakan `FOR ALL TO service_role USING (true) WITH CHECK (true);` mematuhi PostgreSQL 17 grammar.

---

## 5. Rangkaian Perintah Uji yang Telah Disiapkan (Strict 127.0.0.1)

Perintah-perintah berikut telah dirancang dengan parameter ketat `-h 127.0.0.1` dan `-p 5432` agar mustahil terhubung ke host eksternal:

### Tahap 1: Verifikasi Pra-Uji (Pemeriksaan Database Kosong)
```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  -h 127.0.0.1 -p 5432 -U postgres `
  -d simsarpras_migration_test `
  -c "SELECT count(*) AS public_base_tables FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'; SELECT count(*) AS public_enums FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e';"
```
*(Target: public_base_tables = 0, public_enums = 0).*

### Tahap 2: Eksekusi Migrasi Transaksional Penuh (Single Atomic Transaction)
```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  -h 127.0.0.1 -p 5432 -U postgres `
  -d simsarpras_migration_test `
  -v ON_ERROR_STOP=1 `
  -f "$env:TEMP\simsarpras_test_full_migration.sql"
```

### Tahap 3: Verifikasi Pasca-Eksekusi (Objek, Policy, & Record Counts)
```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  -h 127.0.0.1 -p 5432 -U postgres `
  -d simsarpras_migration_test `
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name; SELECT count(*) AS assets_count FROM assets; SELECT count(*) AS loans_count FROM loans; SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;"
```
*(Target: 8 tabel terbentuk, 8 policy terpasang pada service_role, 11 aset ter-seed, 2 pinjaman ter-seed).*

---

## 6. Konfirmasi Kepatuhan Batas Keselamatan

1. **Host Terisolasi:** Perintah pengujian secara eksplisit menggunakan `-h 127.0.0.1` dan `-p 5432`.
2. **Kredensial & Secrets:** Tidak ada pembacaan variabel `DIRECT_URL` atau `DATABASE_URL` dari `server/.env`. Nol password atau token dicetak ke log.
3. **Staging Database:** Nol koneksi dibuka ke Supabase Staging.
4. **Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` dipertahankan dan terverifikasi di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12).
5. **Integritas Proyek:** Berkas `schema.sql`, `seed.sql`, `migrate.ts`, dan seluruh kode aplikasi tetap utuh 100%. Tidak ada operasi DDL yang dijalankan pada fase ini.

---

## 7. Kesimpulan & Rekomendasi Langkah Selanjutnya

Persiapan telah selesai secara tuntas. Lingkungan PostgreSQL 17 lokal dan berkas SQL di `%TEMP%` telah siap diuji.

Sesuai mandat, Antigravity **berhenti pada tahap ini** dan menunggu otorisasi operator manusia untuk mengeksekusi pengujian SQL lokal di database `simsarpras_migration_test`.
