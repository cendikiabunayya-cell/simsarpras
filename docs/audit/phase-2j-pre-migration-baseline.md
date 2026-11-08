# SIMSARPRAS — BASELINE KONDISI AWAL & RENCANA PEMULIHAN PRA-MIGRASI (FASE 2J)
## Pre-Migration Baseline & Disaster Recovery Plan

**Versi Dokumen:** 2.1.0-PRE-MIGRATION-BASELINE  
**Waktu Pengambilan Data Baseline:** 14 Oktober 2026, 11:08:14 WIB (04:08:14 UTC)  
**Target Basis Data:** Supabase Staging (`db.ajajdkhxosmbfyzzabgy.supabase.co:5432`)  
**Project Reference:** `ajajdkhxosmbfyzzabgy` (Region: `ap-northeast-1` / AWS Tokyo)  
**Versi PostgreSQL Target:** PostgreSQL 17.11 on x86_64-pc-linux-gnu (Compiled by GCC 15.2.0, 64-bit)  
**Kondisi Lingkungan:** `APP_ENV=staging` | `ALLOW_STAGING_MIGRATION=false` (Pre-execution Safety State)  

---

## 1. Status Baseline Schema Target (Kondisi Awal Pra-Mutasi)

Berdasarkan probe metadata read-only langsung terhadap PostgreSQL staging via `server/scripts/audit_metadata.ts` pada 14 Oktober 2026 pukul 04:08:14 UTC:

| Komponen Metadata | Status Baseline Aktual | Keterangan |
|---|:---:|---|
| **Database Name** | `postgres` | Basis data utama Supabase |
| **Database Owner** | `postgres` | Pengguna dengan hak DDL |
| **Tabel Schema `public`** | **0 (KOSONG)** | Tidak ada tabel aplikasi eksisting |
| **ENUM Schema `public`** | **0 (KOSONG)** | Tidak ada tipe kustom eksisting |
| **Kebijakan RLS (Policies)** | **0 (KOSONG)** | Tidak ada kebijakan RLS eksisting |
| **Indeks Schema `public`** | **0 (KOSONG)** | Tidak ada indeks non-bawaan |
| **Constraints Schema `public`** | **0 (KOSONG)** | Tidak ada foreign key / unique constraint |
| **Ekstensi Terpasang** | `pg_stat_statements` (1.11)<br>`pgcrypto` (1.3)<br>`plpgsql` (1.0)<br>`supabase_vault` (0.3.1)<br>`uuid-ossp` (1.1) | Ekstensi sistem standar Supabase siap digunakan |

> [!NOTE]
> **Klarifikasi Batasan Baseline:**
> Laporan kondisi awal ini merupakan audit metadata struktural (*schema state audit*), bukan berkas arsip/dump data fisik.
> Karena target database terbukti 100% kosong (pristine empty state), tidak ada data pengguna historis yang berisiko tertimpa atau hilang pada tahap ini.

---

## 2. Rencana Pemulihan & Penanganan Kegagalan (Disaster Recovery Plan)

Sesuai batas keselamatan FASE 2J, jika terjadi kegagalan atau gangguan selama proses migrasi:

1. **Penghentian Segera (*Immediate Halt*):**
   Proses migrasi akan langsung dihentikan. Sistem **DILARANG** melakukan perulangan otomatis (*automated retry loop*).
2. **Penguncian Kembali Flag Keselamatan (*Immediate Re-locking*):**
   Flag `ALLOW_STAGING_MIGRATION` wajib segera dikembalikan menjadi `false` pada `server/.env`.
3. **Audit Status Transaksi ACID:**
   Skrip `server/scripts/migrate.ts` membungkus seluruh eksekusi DDL dan seed dalam blok transaksi tunggal:
   ```sql
   BEGIN;
   -- schema.sql (DDL + RLS + Grants)
   -- seed.sql (Master Data Idempoten)
   COMMIT;
   ```
   Jika terjadi kegagalan pada baris mana pun, driver PostgreSQL akan mengeksekusi `ROLLBACK` secara otomatis, mengembalikan basis data ke kondisi baseline kosong (0 tabel).
4. **Pemeriksaan Status Parsial (*Read-Only Post-Failure Inspection*):**
   Jika terjadi kegagalan koneksi saat `ROLLBACK`, administrator **DILARANG** menjalankan perintah `DROP DATABASE`, `DROP SCHEMA`, atau `TRUNCATE` otomatis. Administrator wajib menjalankan `npx tsx scripts/audit_metadata.ts` untuk memetakan objek apa saja yang sempat tercipta sebelum merumuskan tindakan pembersihan manual.
5. **Pencatatan Insiden Tanpa Rahasia:**
   Seluruh pesan error akan dicatat ke berkas laporan audit dengan kredensial yang disanitasi penuh.

---

## 3. Hasil Pengujian Preflight Terakhir (Tahap 1 Verification)

- **Vitest Unit Tests (`npm test`):** **84 passed (100% LULUS)**.
- **Audit Rekonsiliasi Data Master (`reconcile.ts`):** **PASSED** (11 aset, 4 kategori, 7 lokasi, 5 sumber dana, 4 user terverifikasi utuh).
- **Frontend Build (`npm run build`):** **PASSED** (0 error, bundle `dist/` terbentuk).
- **Server Build (`npm run build --prefix server`):** **PASSED** (0 error kompilasi TypeScript).
- **Staging Probe (`npm run probe --prefix server`):** **PASSED** (DIRECT_URL port 5432 & DATABASE_URL port 6543 terverifikasi).

---

## 4. Kesimpulan Kesiapan Tahap 2

Kondisi awal telah tercatat secara akurat, target terverifikasi bersih, dan rencana pemulihan fail-closed telah ditetapkan. Sistem siap untuk melangkah ke **Tahap 3 — Eksekusi Migrasi Tunggal**.
