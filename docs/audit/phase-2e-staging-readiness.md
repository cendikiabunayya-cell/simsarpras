# SIMSARPRAS — AUDIT KESIAPAN & RENCANA PENGUJIAN STAGING (FASE 2E)
## Staging Readiness Audit and Verification Plan

**Versi Dokumen:** 2.1.0-STAGING-PLAN  
**Tanggal Penyusunan:** 13 Oktober 2026  
**Status Otorisasi:** PERENCANAAN SAJA (READ-ONLY AUDIT & PLANNING). Tidak ada pembuatan database, tidak ada migrasi database live, tidak ada koneksi backend-frontend, dan tidak ada deployment yang dieksekusi.

---

## 1. Ringkasan Eksekutif & Status Audit Prasyarat (Tahap A)

Berdasarkan hasil audit menyeluruh terhadap kode implementasi, skrip migrasi, konfigurasi keamanan, dan hasil pengujian Tahap 1–4, seluruh fondasi kode SIMSARPRAS telah **LOLOS (PASS)** verifikasi internal. Pengujian live saat ini berstatus **DITANGGUHKAN (BLOCKED)** murni karena menunggu ketersediaan database dev dan hosting staging terisolasi yang memerlukan izin eksplisit pengguna.

### Matriks Status Prasyarat Komponen

| Komponen Prasyarat | File / Bukti Kode | Status | Ringkasan Verifikasi |
|---|---|---|---|
| **1. Skema Database & RLS Hardening** | [`server/db/schema.sql:L223-L255`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L223-L255) | **PASS** | RLS aktif pada seluruh tabel. Kebijakan mutasi dibatasi ketat `TO service_role`. Publik (`anon, authenticated`) hanya diizinkan `SELECT` aset aktif. |
| **2. Idempotensi Seed Data & ID Kategori** | [`server/db/seed.sql:L12-L205`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L12-L205) | **PASS** | Klausul non-destruktif `ON CONFLICT (id) DO NOTHING` aktif pada `assets` dan `loans`. ID kategori tersinkronisasi kanonikal (`cat-tik`, `cat-mebel`, `cat-olahraga`, `cat-elektronik`). |
| **3. Standarisasi Data Model & permanentId** | [`src/data/mockData.ts:L181-L422`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/data/mockData.ts#L181-L422)<br>[`server/scripts/reconcile.ts:L103`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/reconcile.ts#L103) | **PASS** | 11 unit aset memiliki `permanentId` eksplisit kanonikal. Fallback legacy aman (`def?.permanentId \|\| item.id`). 0 duplikasi token. |
| **4. Penyelarasan API Express & Validasi Zod** | [`server/src/validators.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/validators.ts)<br>[`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts)<br>[`server/src/routes/loans.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/loans.ts) | **PASS** | Mendukung alias `/assets/scan?query=...` dan `/loan-requests`. Normalisasi payload aktif. Validasi Zod menolak input ilegal. Respon camelCase standar. |
| **5. Rate Limiting & Proteksi Auth API** | [`server/src/middleware/rateLimiter.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/rateLimiter.ts)<br>[`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts) | **PASS** | Rate limiter aktif (10 req/menit/IP pada pengajuan pinjaman). Akses riwayat pinjaman (`GET /loans`) diproteksi JWT Bearer token (HTTP 401 jika tanpa izin). |
| **6. Hardening CORS & Sanitasi Error** | [`server/src/index.ts:L13-L58`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts#L13-L58) | **PASS** | Origin tidak dikenal ditolak dengan `callback(null, false)` tanpa dump HTML 500. Centralized error handler menyembunyikan query SQL dan kredensial database. |
| **7. Rute Publik Barcode Frontend** | [`src/App.tsx:L35`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/App.tsx#L35)<br>[`src/pages/PublicScanLoan.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx) | **PASS** | Rute `/b/:tokenOrCode` terdaftar resmi sebagai top-level route di luar `AppLayout`. Guru dapat meminjam tanpa login, bebas dari sidebar dan navbar admin. |
| **8. Ketiadaan Kredensial Rahasia di Frontend** | Audit kode [`src/`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src) | **PASS** | Nol kebocoran. Frontend hanya membaca `VITE_API_BASE_URL`. Tidak ada password DB, service_role secret, atau token rahasia yang tersimpan di bundle client. |
| **9. Database PostgreSQL Staging Aktif** | Lingkungan runtime saat ini | **BLOCKED** | Menunggu otorisasi penyediaan instance PostgreSQL dev terpisah (port 5432/6543). |
| **10. Benchmark Konkurensi Live PostgreSQL** | Lingkungan runtime saat ini | **BLOCKED** | Menunggu database aktif pada Prasyarat 9. |
| **11. Hosting Staging & Konfigurasi SPA Rewrite** | Lingkungan runtime saat ini | **BLOCKED** | Menunggu otorisasi deployment staging (Cloudflare Pages / Render). |

---

## 2. Bukti Verifikasi Kode dan Pengujian

### A. Hasil Eksekusi Test Runner (65/65 Tests Passed)
Pengujian suite Vitest dijalankan secara menyeluruh pada 5 berkas test suite:
```text
✓ src/test/databaseMigration.test.ts (7 tests)
✓ src/test/statemachine.test.ts (15 tests)
✓ src/test/components.test.tsx (11 tests)
✓ src/test/qrIdentityAndUrl.test.tsx (17 tests)
✓ src/test/apiContract.test.ts (15 tests)

Test Files  5 passed (5)
     Tests  65 passed (65)
  Duration  5.43s
```

### B. Hasil Skrip Rekonsiliasi Database (`npm run reconcile`)
```text
Verifikasi Integritas Entitas:
- Categories: 4 | Locations: 7 | Funding Sources: 5 | Users: 4 | Assets: 11 | Loans: 2 | Audit Logs: 2
- Total Token Terverifikasi: 11
- Duplikat qrToken: 0 | Duplikat assetCode: 0 | Duplikat permanentId: 0
- Orphan Records: 0 (Relational Clean: true)
- Konsistensi Transaksi: true (Active Loans: 1, Units ON_LOAN: 1)
- Verdict: PASSED (100% Preserved)
```

### C. Build & Typecheck Bebas Error
- `npm run build` di `server/`: **0 Errors (Exit code 0)**
- `npx tsc --noEmit` di root: **0 Errors (Exit code 0)**

---

## 3. Spesifikasi Lingkungan Staging yang Diperlukan

Sebelum pengujian live dapat dimulai, berikut adalah spesifikasi minimum lingkungan staging:

### A. Database Staging (PostgreSQL / Supabase Dev)
1. **Jenis Instance:** Proyek database PostgreSQL 15+ terpisah (misal: Supabase Free Project khusus development `simsarpras-staging`, **BUKAN proyek produksi**).
2. **Koneksi Dual-Port:**
   - **Port 5432 (Session Mode / Direct):** Digunakan untuk eksekusi skrip migrasi DDL awal (`server/scripts/migrate.ts`) yang memerlukan transaksi DDL dan modifikasi skema.
   - **Port 6543 (Transaction Mode / PgBouncer):** Digunakan untuk koneksi runtime server Express API (`server/src/db.ts`) demi efisiensi pooler koneksi.
3. **Konfigurasi SSL:** Wajib `sslmode=require`.
4. **Isolasi Data:** Instance harus bersih atau hanya berisi data mock SIMSARPRAS yang disepakati.

### B. Backend Hosting Staging (Express API)
1. **Platform Deployment:** Render Web Service (Free Tier) atau VPS Docker terisolasi.
2. **Environment Variables yang Wajib Disediakan di Server:**
   ```bash
   PORT=10000
   NODE_ENV=staging
   DATABASE_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
   DIRECT_URL="postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require"
   JWT_SECRET="kunci_rahasia_staging_simsarpras_min_32_karakter_acak_2026"
   JWT_EXPIRES_IN="7d"
   CORS_ALLOWED_ORIGINS="http://localhost:5173,http://192.168.100.45:5173,https://simsarpras-staging.pages.dev"
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=10
   ```

### C. Frontend Hosting Staging (React + Vite SPA)
1. **Platform Deployment:** Cloudflare Pages (Free Tier) atau Vercel.
2. **Aturan SPA Rewrite (Wajib):**
   Membuat file `public/_redirects` pada frontend dengan isi:
   ```text
   /*    /index.html   200
   ```
   *Rasional:* Mencegah error HTTP 404 saat guru memindai langsung URL dalam `/b/:tokenOrCode` atau saat guru me-refresh peramban smartphone.
3. **Environment Variable Frontend:**
   ```bash
   VITE_API_BASE_URL="https://simsarpras-api-staging.onrender.com"
   ```

---

## 4. Prosedur Rinci Pengujian Staging (Tahap B)

Pengujian staging wajib mengikuti 7 langkah berurutan di bawah ini:

```mermaid
graph TD
    S1[Uji 1: Provisioning DB Staging] --> S2[Uji 2: Migrasi & Idempotensi Seed]
    S2 --> S3[Uji 3: Benchmark Konkurensi 20 Req]
    S3 --> S4[Uji 4: Penegakan RLS & Proteksi Auth]
    S4 --> S5[Uji 5: Integrasi Kontrak API & Error]
    S5 --> S6[Uji 6: Akses Barcode Eksternal & SPA Refresh]
    S6 --> S7[Uji 7: Rekonsiliasi Integritas Token 11 Unit]
```

### Uji 1: Penyiapan Database Staging Terisolasi
- **Tujuan:** Memastikan konektivitas jaringan dan integritas kredensial database target.
- **Prosedur:**
  1. Siapkan connection string PostgreSQL staging.
  2. Masukkan ke `server/.env`.
  3. Jalankan diagnostik koneksi: `npx tsx -e "import { checkDatabaseConnection } from './src/db.js'; checkDatabaseConnection().then(console.log);"`
- **Kriteria Kelulusan:** Mengembalikan `connected: true` dengan timestamp PostgreSQL yang valid.

### Uji 2: Pengujian Migrasi dan Idempotensi Seed (TEST-01)
- **Tujuan:** Memverifikasi skema database terbentuk sempurna dan tidak menimpa status operasional aktif saat dijalankan berulang kali.
- **Prosedur:**
  1. Jalankan migrasi pertama: `npm run migrate` di folder `server/`.
  2. Ubah status salah satu aset di database staging (misal `unit-laptop-01` diubah menjadi `MAINTENANCE` dan `notes = 'Uji coba pemeliharaan'`).
  3. Ubah status salah satu pinjaman di database staging (misal `loan-req-001` diubah menjadi `COMPLETED`).
  4. Jalankan migrasi kedua: `npm run migrate`.
  5. Periksa status unit dan pinjaman di database.
- **Kriteria Kelulusan:**
  - Status `unit-laptop-01` tetap `MAINTENANCE` (tidak tertimpa kembali menjadi `AVAILABLE`).
  - Status `loan-req-001` tetap `COMPLETED` (tidak tertimpa kembali menjadi `ACTIVE`).
  - Tabel `categories` memiliki 4 baris utuh dengan ID kanonikal (`cat-tik`, `cat-mebel`, `cat-olahraga`, `cat-elektronik`).

### Uji 3: Pengujian Peminjaman Bersamaan Nyata (TEST-03 Benchmark)
- **Tujuan:** Membuktikan bahwa `SELECT ... FOR UPDATE` mencegah peminjaman ganda (*zero double-lending*) pada PostgreSQL aktif di bawah beban konkurensi.
- **Prosedur:**
  1. Pastikan unit `unit-laptop-01` berstatus `AVAILABLE`.
  2. Buat skrip stress-test yang meluncurkan 20 permintaan HTTP `POST /loan-requests` secara simultan (menggunakan `Promise.all` dengan payload valid) ke `unit-laptop-01`.
  3. Kumpulkan seluruh respons status HTTP.
  4. Periksa jumlah baris transaksi baru di tabel `loans` untuk aset tersebut.
- **Kriteria Kelulusan:**
  - Tepat **1 permintaan** berhasil menerima HTTP 201 Created.
  - Tepat **19 permintaan lainnya** menerima HTTP 409 Conflict (`ASSET_NOT_AVAILABLE`).
  - Tabel `loans` di PostgreSQL hanya bertambah 1 transaksi baru. Status unit di tabel `assets` berubah menjadi `ON_LOAN` atau `RESERVED`.

### Uji 4: Pengujian Akses Tidak Sah dan Kebijakan RLS (TEST-02)
- **Tujuan:** Memverifikasi bahwa data tidak dapat dimutasi secara ilegal melalui Supabase PostgREST atau endpoint backend yang dilindungi.
- **Prosedur:**
  1. Lakukan request REST via `curl` menggunakan public `anon_key` Supabase langsung ke endpoint PostgREST:
     - `DELETE https://[PROJECT-REF].supabase.co/rest/v1/assets?id=eq.unit-laptop-01`
     - `UPDATE https://[PROJECT-REF].supabase.co/rest/v1/loans?id=eq.loan-req-001`
  2. Lakukan request ke backend Express tanpa token otorisasi:
     - `GET https://[STAGING-API]/loans`
- **Kriteria Kelulusan:**
  - Request PostgREST publik ditolak atau menghasilkan 0 baris termutasi (kebijakan RLS `service_role_all_*` aktif).
  - Request `GET /loans` ke Express mengembalikan HTTP 401 Unauthorized (`UNAUTHORIZED`).

### Uji 5: Pengujian Integrasi API & Respons Error (TEST-04 & TEST-07)
- **Tujuan:** Memastikan kontrak frontend `src/services/api.ts` tersambung transparan ke backend Express staging.
- **Prosedur:**
  1. Panggil `GET /assets/scan?query=QR-TIK-ASUS-001` dari frontend staging.
  2. Panggil `POST /loan-requests` dengan payload format frontend.
  3. Kirim payload dengan tanggal pengembalian di masa lalu atau format teks rusak.
  4. Simulasikan pemutusan database sementara dan panggil endpoint scan.
- **Kriteria Kelulusan:**
  - Data unit laptop diterima lengkap dengan atribut camelCase dan nested `.asset`.
  - Input invalid menghasilkan HTTP 400 Bad Request dengan rincian pesan Zod yang rapi.
  - Saat database terputus, backend mengembalikan HTTP 503 tanpa membocorkan koneksi atau string SQL ke pengguna.

### Uji 6: Pengujian Barcode URL Langsung, Refresh, dan Jaringan Luar (TEST-05 & TEST-06)
- **Tujuan:** Membuktikan barcode fisik dapat dibuka langsung dari kamera HP guru di jaringan seluler eksternal (di luar Wi-Fi sekolah).
- **Prosedur:**
  1. Buka peramban smartphone menggunakan koneksi data seluler (4G/5G).
  2. Ketik / akses URL: `https://[STAGING-FRONTEND]/b/QR-TIK-ASUS-001`.
  3. Verifikasi halaman yang terbuka adalah komponen `PublicScanLoan` mandiri (tanpa sidebar dan navbar admin).
  4. Lakukan refresh halaman (F5 / tarik layar smartphone).
  5. Buka URL format lama: `https://[STAGING-FRONTEND]/scan?code=INV-TIK-2024-001`.
- **Kriteria Kelulusan:**
  - Unit Laptop Guru ASUS langsung terbuka di layar HP tanpa redirect ke Dashboard atau halaman login.
  - Refresh peramban tetap menampilkan barang (tidak menghasilkan HTTP 404 dari web server hosting berkat aturan rewrite SPA).
  - URL format lama tetap mengenali barang 100%.

### Uji 7: Rekonsiliasi Integritas Data & Identitas Barcode
- **Tujuan:** Menjamin integritas seluruh 11 unit barcode tidak tergeser sebelum dan sesudah uji coba staging.
- **Prosedur:**
  1. Jalankan `npm run reconcile` di server staging.
  2. Cocokkan nilai `qrToken`, `assetCode`, dan `permanentId` dengan data stiker fisik yang tercetak.
- **Kriteria Kelulusan:**
  - Duplikasi qrToken: 0.
  - Duplikasi assetCode: 0.
  - Duplikasi permanentId: 0.
  - Verdict: PASSED.

---

## 5. Rencana Backup dan Pemulihan (Disaster Recovery Plan)

Untuk menjamin keselamatan data tanpa risiko kerugian operasional:

1. **Snapshot Pra-Pengujian (Baseline Dump):**
   Sebelum pengujian Uji 2 dijalankan, lakukan backup skema dasar:
   ```bash
   pg_dump --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" > server/db/backup_staging_baseline.sql
   ```
2. **Prosedur Rollback Instan Transaksi:**
   Skrip `server/scripts/migrate.ts` telah membungkus DDL dan seed di dalam blok `BEGIN ... COMMIT`. Jika terjadi kesalahan sintaksis atau error eksekusi di tengah jalan, script otomatis memanggil `ROLLBACK` penuh sehingga database kembali ke kondisi bersih.
3. **Perlindungan Data Browser (`localStorage` Guru):**
   Aplikasi frontend mempertahankan data lokal secara utuh. Jika pengujian staging dibatalkan atau backend dimatikan, pengguna dapat kembali ke mode prototipe lokal mandiri hanya dengan mengosongkan nilai `VITE_API_BASE_URL` di konfigurasi frontend.
4. **Strategi Pemulihan Staging Rusak (*Clean Re-provisioning*):**
   Karena database staging terisolasi penuh dari produksi, jika terjadi kerusakan struktur selama uji coba konkurensi ekstrem, instance staging dapat di-drop dan di-recreate dari nol dalam waktu kurang dari 2 menit menggunakan `server/db/schema.sql` dan `server/db/seed.sql`.

---

## 6. Daftar Risiko dan Matriks Keputusan Kelulusan (*Go / No-Go Decision*)

### A. Daftar Risiko Lingkungan Staging

| ID Risiko | Deskripsi Risiko | Dampak | Strategi Mitigasi Teruji |
|---|---|---|---|
| **R-01** | Cold-start Render Web Service (Free tier tidur setelah 15 menit idle) | Latensi respon pertama mencapai 40–50 detik saat guru scan | Berikan spinner loading dan teks pemberitahuan ramah pada frontend: *"Menghubungkan ke server sarpras..."*. Jangan gunakan UptimeRobot agresif. |
| **R-02** | Ketidakcocokan Connection Pooler Supabase (Port 6543 vs 5432) | Prepared statements gagal pada PgBouncer transaction mode | Gunakan Port 5432 untuk migrasi skema DDL (`migrate.ts`). Gunakan Port 6543 untuk kueri reguler Express (`pg.Pool`). |
| **R-03** | Missing SPA Fallback Rewrite pada Hosting Statis | Guru mengalami HTTP 404 saat scan barcode langsung via kamera HP atau me-refresh halaman | Wajib deploy file `_redirects` pada Cloudflare Pages sebelum pengujian dimulai. |
| **R-04** | Keterbatasan Kamera Smartphone Low-End Guru | Autofokus lambat atau gagal membaca barcode pada pencahayaan minim | Antarmuka `PublicScanLoan` menyediakan tombol pencarian manual alternatif dan input kode cepat. |

### B. Matriks Keputusan Kelulusan (*Go / No-Go*)

Sistem dinyatakan siap untuk melangkah ke **Fase 3 (Deployment Produksi)** jika dan hanya jika seluruh kriteria berikut terpenuhi:

| Indikator Evaluasi | Ambang Batas Minimal (*Pass Threshold*) | Tindakan Jika Gagal |
|---|---|---|
| Kelulusan Suite Uji Vitest | **100% (65 dari 65 tes passed)** | NO-GO: Perbaiki bug unit test. |
| Rekonsiliasi Integritas Token | **11/11 Aset Valid (0 Duplikat)** | NO-GO: Selidiki konflik ID aset. |
| Konkurensi Peminjaman (TEST-03) | **Tepat 1 Sukses, 19 Ditolak 409** | NO-GO: Evaluasi transaksi row-level lock. |
| Pengujian Akses Publik `/b/...` | **100% Berhasil tanpa Login & Menu** | NO-GO: Periksa konfigurasi React Router & SPA rewrite. |
| Pencegahan Mutasi RLS PostgREST | **100% Request Anonim Ditolak** | NO-GO: Perbaiki klausa policy RLS di schema.sql. |

---

## 7. Titik Berhenti & Langkah yang Memerlukan Persetujuan Manusia

> [!CAUTION]
> **BATASAN KESELAMATAN AKTIF:**
> Sesuai batasan otorisasi, **TIDAK ADA AKSI BERIKUT YANG DIJALANKAN SECARA OTOMATIS:**
> 1. Pembuatan proyek database Supabase staging.
> 2. Pemasukan kredensial database live ke `server/.env`.
> 3. Eksekusi migrasi database ke server aktif.
> 4. Penghubungan frontend ke backend Express staging.
> 5. Deployment ke Cloudflare Pages atau Render.

### Tindakan Selanjutnya yang Menunggu Persetujuan Anda:
Untuk memulai pelaksanaan pengujian staging di atas, Anda dapat memberikan izin bertahap:
1. **Otorisasi 5A:** Pemberian izin membuat instance PostgreSQL development terpisah dan pengisian `DATABASE_URL` ke `server/.env`.
2. **Otorisasi 5B:** Pemberian izin eksekusi skrip migrasi uji `npm run migrate` pada database development tersebut.
3. **Otorisasi 5C:** Pemberian izin eksekusi benchmark konkurensi (TEST-03) dan pengujian integrasi live API.
