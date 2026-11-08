# SIMSARPRAS — PERSIAPAN PENGUJIAN MIGRASI POSTGRESQL TERISOLASI (FASE 2J.4)
## Isolated Local PostgreSQL Migration Test Preparation & Feasibility Report

**Versi Dokumen:** 2.1.0-LOCAL-TEST-PREPARATION  
**Tanggal:** 14 Oktober 2026  
**Status Akhir:** **BLOCKED — LOCAL POSTGRESQL REQUIRED**  
**Host:** Mesin Lokal Windows (`localhost` / `127.0.0.1`)  
**Status Koneksi Staging:** **DISCONNECTED & UNTOUCHED (0 External Network Calls)**  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif & Status Akhir

Tujuan dari Fase 2J.4 adalah menyiapkan pengujian penuh berkas DDL [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) dan data seed [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql) pada lingkungan basis data PostgreSQL lokal yang terisolasi (*disposable*), guna memvalidasi sintaksis DDL pasca-perbaikan RLS Fase 2J.1 tanpa menyentuh atau menghubungkan jaringan ke Supabase staging.

### Status Evaluasi: **`BLOCKED — LOCAL POSTGRESQL REQUIRED`**

**Penyebab Pemblokiran:**
1. Pemeriksaan lingkungan lokal mendeteksi keberadaan binary client `psql.exe` versi 17.11 di `C:\Program Files\PostgreSQL\17\bin\psql.exe`.
2. Namun, **server engine PostgreSQL lokal tidak aktif dan tidak dapat dijalankan secara instan** karena instalasi yang ada pada workstation hanya mencakup *Command Line Tools* (tidak memiliki berkas katalog server `share/postgres.bki`).
3. Tidak ada Windows Service PostgreSQL yang terdaftar atau berjalan.
4. Container runtime (Docker maupun Podman) tidak terpasang pada workstation pengembang.
5. Sesuai batasan mandat keselamatan: *"Jika tidak tersedia PostgreSQL server yang dapat digunakan, BERHENTI setelah melaporkan kebutuhan instalasi PostgreSQL 17 lokal atau lingkungan disposable. Jangan menginstal perangkat lunak, mengubah sistem, atau mengunduh image secara otomatis tanpa persetujuan operator"*, maka Antigravity **menghentikan eksekusi secara fail-safe** tanpa memodifikasi sistem operasi pengembang.

---

## 2. Fase A — Hasil Pemeriksaan Lingkungan Lokal (Bukti Faktual)

Pemeriksaan dilakukan secara lokal tanpa mengakses jaringan luar atau membaca kredensial `.env`:

| Parameter Lingkungan | Metode Pemeriksaan Lokal | Hasil Aktual | Evaluasi |
|:---|:---|:---:|:---:|
| **Windows Service PostgreSQL** | `sc query state= all \| findstr /i postgres` | *Tidak ditemukan* (0 service) | **TIDAK TERPASANG** |
| **Port Lokal 5432** | `netstat -ano \| findstr :5432` | *Tidak ada proses listening* | **PORT TERSEDIA (FREE)** |
| **Biner Client `psql`** | `& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' --version` | `psql (PostgreSQL) 17.11` | **TERSEDIA** |
| **Biner Engine `postgres`** | `& 'C:\Program Files\PostgreSQL\17\bin\postgres.exe' --version` | `postgres (PostgreSQL) 17.11` | **TERSEDIA (BIN ONLY)** |
| **Katalog Server (`share/`)** | `Test-Path 'C:\Program Files\PostgreSQL\17\share'` | `False` | **TIDAK TERSEDIA** (Hanya Command Line Tools) |
| **Inisialisasi Klaster (`initdb`)** | `& 'C:\Program Files\PostgreSQL\17\bin\initdb.exe' -D %TEMP%` | Error: `file .../share/postgres.bki does not exist` | **TIDAK DAPAT DIINISIALISASI** |
| **Container Engine (Docker)** | `docker --version` | `docker is not recognized` | **TIDAK TERPASANG** |
| **Container Engine (Podman)** | `podman --version` | `podman is not recognized` | **TIDAK TERPASANG** |

---

## 3. Fase B — Desain Database Disposable (Rancangan Siap Pakai)

Jika operator manusia mengaktifkan server PostgreSQL 17 lokal atau menyediakan Docker container, rencana eksekusi telah dirancang secara terisolasi penuh:

### 3.1 Identitas Target & Isolasi Keras
1. **Nama Basis Data:** `simsarpras_migration_test` (dibuat murni di lokal, dilarang memakai nama produksi/staging).
2. **Koneksi:** `postgresql://postgres@127.0.0.1:5432/simsarpras_migration_test` (Strict Local Loopback).
3. **Verifikasi Pra-Eksekusi:** Wajib menjalankan probe loopback:
   ```sql
   SELECT inet_server_addr(), inet_client_addr(), current_database(), version();
   ```
   *Guardrail:* Jika `inet_server_addr()` bukan `127.0.0.1` atau `::1`, eksekusi dibatalkan seketika.

### 3.2 Pembuatan Skrip SQL Gabungan di Luar Repositori
Skrip pengujian digabungkan ke direktori sementara `%TEMP%\simsarpras_test_migration.sql` (di luar working tree) dengan struktur:
```sql
-- %TEMP%\simsarpras_test_migration.sql
\set ON_ERROR_STOP on

BEGIN;

-- 1. Skema DDL Lengkap (schema.sql)
-- Termasuk ekstensi, enum, tabel, constraint, indeks, role guard, dan 8 policy RLS
<ISI_SCHEMA_SQL>

-- 2. Data Seed Idempoten (seed.sql)
-- Termasuk master data ON CONFLICT DO UPDATE dan aset ON CONFLICT DO NOTHING
<ISI_SEED_SQL>

COMMIT;
```

---

## 4. Fase C — Rencana Pengujian Komprehensif pada Database Disposable

Daftar 8 suite pengujian yang telah disiapkan untuk dijalankan segera setelah PostgreSQL lokal aktif:

| No | Kategori Pengujian | Parameter Verifikasi | Kriteria Keberhasilan |
|:---:|:---|:---|:---|
| 1 | **Struktur Objek DDL** | 5 tipe ENUM, 8 tabel sistem, 13 indeks, 10 foreign keys, 4 constraint unik | Seluruh objek terbentuk di skema `public` tanpa warning. |
| 2 | **Kebijakan Keamanan RLS** | 8 kebijakan `FOR ALL TO service_role`, `REVOKE ALL` dari `anon`, `authenticated`, `public` | Query tanpa role ditolak; query dengan `SET ROLE service_role` sukses 100%. |
| 3 | **Pemuatan Data Seed** | 4 kategori, 7 lokasi, 5 sumber dana, 4 pengguna, 11 aset, 2 pinjaman, 2 audit log | Jumlah baris tepat sesuai target; zero missing records. |
| 4 | **Uji Idempotensi** | Menjalankan ulang skrip `%TEMP%\simsarpras_test_migration.sql` pada database yang sudah terisi | Eksekusi kedua sukses 100% tanpa error duplikasi kunci atau penimpaan identitas token permanen. |
| 5 | **Uji Injeksi Kegagalan Transaksi** | Menyuntikkan sintaks rusak di tengah transaksi DDL | Script berhenti seketika karena `ON_ERROR_STOP on`. |
| 6 | **Pembuktian Rollback Bersih** | Memeriksa metadata `information_schema.tables` pasca-kegagalan terinjeksi | 0 tabel dan 0 enum tertinggal di skema `public` (kembali bersih murni). |
| 7 | **Integritas Relasional & QR** | Memverifikasi `qr_token`, `asset_code`, `permanent_id` pada seluruh 11 unit | 11/11 token valid dan unik, 0 orphan foreign key reference. |
| 8 | **Pemisahan Hak API vs Database** | Simulasi akses `anon` vs `service_role` | PostgREST role terblokir penuh; backend terotentikasi memiliki akses penuh. |

---

## 5. Fase D — Dependensi yang Diperlukan & Opsi Tindak Lanjut Operator

Untuk menjalankan pengujian lokal disposable ini, operator manusia dapat memilih salah satu dari 2 opsi berikut:

### Opsi 1: Menjalankan PostgreSQL 17 via Docker (Direkomendasikan & Paling Bersih)
Jika Docker Desktop dipasang/dijalankan oleh operator:
```bash
docker run --name simsarpras-pg-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:17
```

### Opsi 2: Memasang Komponen Server PostgreSQL 17 Lengkap
Menjalankan installer PostgreSQL 17 resmi pada Windows dan mencentang komponen **PostgreSQL Server** (bukan hanya Command Line Tools), lalu mengaktifkan Windows Service pada port 5432 lokal.

---

## 6. Konfirmasi Kepatuhan Batas Keselamatan (Hard Safety Rules)

1. **Kredensial & Secrets:** Tidak ada string `DIRECT_URL`, `DATABASE_URL`, password, atau token JWT yang dibaca, dimuat, atau dicetak ke log.
2. **Koneksi Jaringan:** Nol koneksi dibuka ke Supabase staging atau host internet eksternal.
3. **Status Flag:** `ALLOW_STAGING_MIGRATION=false` dipertahankan dan terverifikasi di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12).
4. **Integritas Berkas Proyek:** Berkas [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql), [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql), [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts), dan pengujian Vitest tidak diubah atau dimodifikasi selama Fase 2J.4.
5. **Perintah Git:** Tidak ada operasi Git destruktif (`reset`, `clean`, `checkout`, `stash`).

---

## 7. Kesimpulan & Rekomendasi

Sistem migrasi SIMSARPRAS telah siap 100% dari sisi kode, sintaksis RLS DDL yang diperbaiki, tes unit (87/87 pass), dan build. Namun, pengujian DDL penuh pada PostgreSQL engine lokal **tertahan oleh ketiadaan PostgreSQL Server engine lokal / Docker runtime** pada mesin pengembang.

Sesuai instruksi mandat, Antigravity **berhenti pada tahap ini** dengan status `BLOCKED — LOCAL POSTGRESQL REQUIRED` untuk menunggu keputusan operator manusia.
