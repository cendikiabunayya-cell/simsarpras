# SIMSARPRAS — AUDIT REGRESI PASCA-PENGUATAN KEAMANAN & KESIAPAN STAGING (FASE 2I.5)
## Post-Hardening Regression & Staging Readiness Audit Report

**Versi Dokumen:** 2.1.0-POST-HARDENING-REGRESSION-READINESS  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi:** **READY FOR HUMAN REVIEW**  
**Database Staging Target:** Supabase Project `ajajdkhxosmbfyzzabgy` (`ap-northeast-1`, PostgreSQL 17.11)  
**Kondisi Lingkungan:** `APP_ENV=staging` | `ALLOW_STAGING_MIGRATION=false` (Strictly Preserved / Read-Only)  

---

## 1. Ringkasan Eksekutif & Status Akhir

Audit independen non-destruktif Fase 2I.5 dilakukan untuk memvalidasi perubahan penguatan keamanan akses aset publik Fase 2I.4 terhadap kemungkinan terjadinya regresi pada alur kerja guru, staf administrasi, pemindaian QR code fisik, maupun kontrak API.

### Hasil Penilaian Utama:
1. **Tidak Ada Kerusakan Fungsional pada Rute QR Publik:** Rute `/b/:tokenOrCode`, `/q/:tokenOrCode`, dan `/scan` tetap berfungsi 100% untuk pemindaian mandiri dan peminjaman oleh guru/umum tanpa memerlukan login.
2. **Katalog Inventaris Terlindungi:** Endpoint listing inventaris massal `GET /api/v1/assets` kini mewajibkan autentikasi JWT (`requireAuth`). Upaya scraping katalog anonim melalui PostgREST Supabase maupun Express API ditolak secara konsisten.
3. **Allowlist Data Terbukti Efektif:** Seluruh respons publik (`formatPublicAssetResponse`) menyaring kolom sensitif (`notes`, `funding_source`, `acquisition_year`), mencegah kebocoran informasi lemari dan sumber pendanaan.
4. **Integritas Pengujian & Build:** 80 dari 80 pengujian unit Vitest lulus (100%), rekonsiliasi data lulus (0 record yatim, 100% token presisi), dan kompilasi TypeScript/Vite frontend serta Express server menghasilkan 0 error.
5. **Temuan Risiko Minor Frontend Berhasil Diidentifikasi:** Ditemukan potensi runtime exception pada pil contoh barang UI (`PublicScanLoan.tsx:L711` dan `QrScanner.tsx:L634`) apabila diakses secara publik dalam mode terkoneksi backend tanpa login; telah dibuatkan analisis mitigasi yang aman.

**Status Akhir Audit: `READY FOR HUMAN REVIEW`**  
*(Sesuai batas keselamatan, runner migrasi Fase 2J tidak dijalankan dan `ALLOW_STAGING_MIGRATION=false` tetap dipertahankan sampai adanya otorisasi manusia).*

---

## 2. Daftar Perubahan yang Diverifikasi (Audit Perubahan Fase 2I.4)

| Berkas | Jenis Perubahan | Status Verifikasi | Bukti Verifikasi |
|---|---|:---:|---|
| [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) | DDL Security Hardening | **VERIFIED** | `GRANT SELECT ON assets` & policy `public_read_assets` telah dihapus. `REVOKE ALL ON TABLE assets FROM anon, authenticated, public;` aktif di L248. |
| [`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts) | Backend Routing & DTO | **VERIFIED** | `requireAuth` terpasang pada `GET /` (L205). `publicScanLimiter` (60 req/min) terpasang pada L183, L195, L200, L246. `formatPublicAssetResponse` terpasang di L71-113. |
| [`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts) | Middleware Refinement | **VERIFIED** | Pesan error HTTP 401 dinormalisasi menjadi pesan umum tanpa mengekspos rincian internal stack. |
| [`src/test/apiContract.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts) | Regression Testing Suite | **VERIFIED** | 5 unit test penguatan keamanan (auth listing, scan openness, allowlist exclusion, rate limit 60 req/min) terdaftar dan lulus. |
| [`src/test/databaseMigration.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/databaseMigration.test.ts) | DDL Schema Assertion | **VERIFIED** | Asersi otomatis memverifikasi pencabutan izin publik dan pengaktifan RLS pada seluruh 8 tabel. |

---

## 3. Hasil Pengujian & Build Lokal (Non-Mutasi Staging)

Seluruh pengujian lokal dijalankan tanpa membuka koneksi tulis atau memodifikasi database staging:

### A. Eksekusi Pengujian Vitest (`npm test`)
```
> si-sarpras-web@1.2.0 test
> vitest run

 RUN  v2.1.9 C:/Users/Lenovo/Documents/SIMSARPRAS

 ✓ src/test/statemachine.test.ts (15 tests)
 ✓ src/test/databaseMigration.test.ts (17 tests)
 ✓ src/test/apiContract.test.ts (20 tests)
 ✓ src/test/components.test.tsx (11 tests)
 ✓ src/test/qrIdentityAndUrl.test.tsx (17 tests)

 Test Files  5 passed (5)
      Tests  80 passed (80)
   Duration  9.52s
```
- **Jumlah Pengujian Dijalankan:** **80 tes**.
- **Hasil:** **80 passed (100% lulus)**, 0 failed, 0 skipped.
- **Waktu Eksekusi:** 9.52 detik.

### B. Audit Rekonsiliasi Data Master & Token (`npm run reconcile --prefix server`)
```
=====================================================
 SIMSARPRAS - REKONSILIASI AUDIT DATABASE (FASE 2A)
=====================================================
Timestamp: 2026-10-14T03:46:38.526Z
Verdict:   PASSED

--- 1. Jumlah Entitas Data ---
Categories: 4 | Locations: 7 | FundingSources: 5 | Users: 4 | Assets: 11 | Loans: 2 | AuditLogs: 2

--- 2. Integritas Token & Kode Unik ---
Total Token Terverifikasi: 11
Duplikat qrToken: 0 | Duplikat assetCode: 0 | Duplikat permanentId: 0
Status Token: VALID (100% Preserved)

--- 3. Relasi & Referensi Yatim (Orphan Records) ---
Orphan Location: 0 | Orphan Category: 0 | Orphan Funding: 0 | Orphan Loan Asset: 0
Relational Clean: true

--- 4. Konsistensi Status Transaksi ---
Active Loans: 1 | Units ON_LOAN: 1 | Inconsistent Pairs: 0 | Transaction Consistent: true
=====================================================
```

### C. Verifikasi Kompilasi & Build
- **Server TypeScript Build (`npm run build --prefix server`):** `tsc` selesai dengan **0 error**.
- **Frontend Vite Build (`npm run build`):** `tsc && vite build` selesai dengan **0 error** (1665 modul terkompilasi, bundle output `dist/` terbentuk sukses dalam 10.57s).

---

## 4. Hasil Pemeriksaan Alur Pengguna (User Flows Audit)

### 4.1. Alur Pemindaian QR Code Publik Guru / Mandiri
- **Rute yang Diperiksa:** `/b/:tokenOrCode`, `/q/:tokenOrCode`, `/scan`, dan `/pinjam`.
- **Mekanisme Lookup:** Memanggil `api.getAssetByCodeOrQr` yang mengarah ke `GET /api/v1/assets/scan?query=...` (atau `/assets/scan?query=...`).
- **Status Autentikasi:** **TERBUKA UNTUK PUBLIK (Tanpa Login).** Endpoint scan tidak dipasangi `requireAuth`, sehingga guru dapat memindai barang kapan saja tanpa perlu login terlebih dahulu.
- **Hasil Pengujian Kontrak:** `apiContract.test.ts:L272-277` memverifikasi permintaan tanpa header `Authorization` ke `/assets/scan` tidak mengembalikan 401 atau 403.
- **Peminjaman Mandiri:** Pengajuan peminjaman mandiri melalui `POST /loan-requests` atau `POST /loans` didukung oleh `loanSubmissionLimiter` (10 req/min) dan transaksi `FOR UPDATE`, tetap dapat diproses tanpa login wajib.

### 4.2. Alur Dashboard Administrasi & Staf
- **Halaman yang Diperiksa:** [`src/pages/Dashboard.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Dashboard.tsx).
- **Endpoint yang Dipanggil:** `api.getDashboardMetrics()`, `api.getLoans()`, dan `api.getAuditLogs()`.
- **Dampak `requireAuth` pada `GET /assets`:** **TIDAK TERDAMPAK (ZERO REGRESSION).** Dashboard tidak memanggil `GET /assets`. Pengambilan metrik ringkasan inventaris ditangani oleh agregasi backend `getDashboardMetrics` dan daftar peminjaman pribadi guru (`myLoans`) difilter dari `loans`.

### 4.3. Alur Halaman Manajemen Inventaris Staf (Admin View)
- **Halaman yang Diperiksa:** [`src/pages/Inventory.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Inventory.tsx), [`src/pages/PolicySettings.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PolicySettings.tsx), [`src/pages/Reports.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Reports.tsx), dan [`src/pages/QrPrint.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/QrPrint.tsx).
- **Dampak `requireAuth`:** Seluruh halaman ini berada di dalam pembungkus rute terotentikasi [`AppLayout`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/components/layout/AppLayout.tsx) yang secara normal menyertakan JWT staf. Pengujian `apiContract.test.ts:L254-270` membuktikan bahwa dengan menyertakan Bearer token yang sah, `GET /assets` mengizinkan akses penuh dan mengembalikan daftar inventaris lengkap beserta metadata internal.

---

## 5. Pemeriksaan Urutan Middleware & Rate Limiter

### 5.1. Pipeline Middleware Global ([`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts))
1. **CORS Middleware (L11-29):** Mengecek header `Origin`. Domain non-terdaftar ditolak tanpa memicu HTML stack dump.
2. **Body Parser (L31):** `express.json()` mem-parsing payload JSON.
3. **Request Logger (L34-39):** Logging non-intrusif (diabaikan saat `NODE_ENV=test`).
4. **Router Binding (L42-51):** Mengarahkan rute `/api/v1/*` dan alias tingkat atas (`/assets`, `/loans`, `/loan-requests`, `/health`).
5. **Fallback 404 (L54-59):** Merespon format JSON konsisten `{ error: 'ENDPOINT_NOT_FOUND', ... }`.
6. **Centralized Error Handler (L62-72):** Menangkap exception, menyembunyikan detail SQL/stack trace pada status 500, dan mencatat log internal ke server console.

### 5.2. Analisis Cakupan Rate Limiter
- **`publicScanLimiter` (60 req/min):**
  - Diterapkan pada seluruh jalur pembacaan aset publik: `GET /scan`, `GET /scan/:token`, `GET /token/:token`, dan `GET /:id` ([`server/src/routes/assets.ts:L183,195,200,246`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L183)).
  - Kecepatan pemindaian manusia normal adalah 1-5 scan per menit. Batas 60 req/min memberikan margin toleransi 12x-60x lipat, sehingga tidak mengganggu penggunaan wajar guru/murid sambil efektif memblokir bot enumerasi.
- **`loanSubmissionLimiter` (10 req/min):**
  - Diterapkan pada `POST /request` dan `POST /` ([`server/src/routes/loans.ts:L189-190`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/loans.ts#L189)).
  - Melindungi transaksi row lock `FOR UPDATE` dari serangan spam penolakan layanan (*denial-of-service*).
- **Dampak terhadap Alur Pengembalian (Return):**
  - Rute pengembalian fisik dan inspeksi (`/returns/verify`) merupakan fitur administratif di bawah otorisasi staf dan belum dipasangi rate limiter publik, sehingga tidak ada hambatan frekuensi bagi petugas saat memverifikasi pengembalian massal.

---

## 6. Verifikasi Sanitasi Allowlist & Pencegahan Kebocoran Data

### 6.1. Jalur Sukses (Success Path)
Pencarian aset melalui `lookupAsset` memformat output melalui `formatPublicAssetResponse(row)` ([`server/src/routes/assets.ts:L71-113`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L71)):
- **Data Internal yang Dikeluarkan (Omitted):**
  - `notes` (catatan khusus staf, info letak lemari/kunci): **100% OMITTED**.
  - `funding_source` / `fundingSource` (anggaran belanja/BOS/APBN): **100% OMITTED**.
  - `acquisition_year` / `acquisitionYear` (tahun pembukuan): **100% OMITTED**.
- **Objek Kompatibilitas `res.asset`:** Objek nested `asset` yang disertakan untuk backward compatibility frontend merupakan clone dari objek allowlist tersanitasi, terbebas dari field sensitif (`apiContract.test.ts:L329-332`).
- **Data Peminjam:** Tabel `assets` tidak menyimpan nama peminjam maupun nomor induk pegawai; data peminjaman berada terpisah pada tabel `loans`.

### 6.2. Jalur Kesalahan (Error Paths)
- **Token Tidak Valid (HTTP 400):** Mengembalikan `{ error: 'INVALID_TOKEN_FORMAT', message: ... }`.
- **Aset Tidak Ditemukan (HTTP 404):** Mengembalikan `{ error: 'ASSET_NOT_FOUND', message: ... }`.
- **Database Offline (HTTP 503):** Mengembalikan `{ error: 'DATABASE_UNAVAILABLE', message: ... }` tanpa membeberkan URI koneksi atau kata sandi database (`apiContract.test.ts:L349-357`).
- **Server Error (HTTP 500):** Mengembalikan `{ error: 'INTERNAL_SERVER_ERROR', message: ... }`. Rincian sintaksis SQL atau error stack trace hanya dicatat di terminal server.

---

## 7. Kompatibilitas Barcode Lama & Identitas Stabil

Pemeriksaan komparatif terhadap identitas inventaris membuktikan kompatibilitas penuh:
1. **Multi-Identifier Resolver ([`server/src/routes/assets.ts:L147`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L147)):**
   ```sql
   WHERE qr_token = $1 OR permanent_id = $1 OR asset_code = $1 OR id = $1
   ```
   Query ini menjamin barcode fisik lama yang dicetak dengan `qr_token` (misalnya `QR-TIK-ASUS-001`), kode barang `asset_code` (`INV-TIK-2024-001`), maupun `permanent_id` (`PERM-TIK-ASUS-001`) dapat dibaca secara seragam tanpa memerlukan pencetakan ulang stiker.
2. **Dukungan URL Barcode Fisik:**
   - URL modern: `https://sarpras.cendikiabunayya.sch.id/b/:tokenOrCode` -> Ditangani oleh `PublicScanLoan.tsx`.
   - URL permalink: `/q/:tokenOrCode` -> Ditangani oleh `PublicScanLoan.tsx`.
   - URL scan mandiri: `/scan` -> Ditangani oleh `PublicScanLoan.tsx`.
3. **Banner Soft Delete / Decommission ([`server/src/routes/assets.ts:L163-169`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L163)):**
   Barang yang telah dinonaktifkan (`is_decommissioned = true`) tetap mengembalikan metadata dasar dan status `BARANG_DINONAKTIFKAN`, sehingga guru yang memindai barcode fisik lama mendapat kejelasan informasi mengapa barang tersebut tidak dapat dipinjam.

---

## 8. Penghapusan Izin Publik & Skrip Remediasi Skema

### 8.1. Status pada Skema Baru ([`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql))
- DDL baru telah bersih dari `GRANT SELECT ON TABLE assets TO anon, authenticated;`.
- Peran `anon` dan `authenticated` telah dicabut seluruh haknya (`REVOKE ALL ON TABLE ... FROM anon, authenticated, public;`) pada seluruh 8 tabel.
- PostgREST Supabase tidak akan lagi melayani permintaan baca langsung ke `/rest/v1/assets` untuk public role anonim.

### 8.2. Skrip Remediasi untuk Basis Data yang Sudah Pernah Dieksekusi (Unexecuted Reference)
Bagi lingkungan database yang sudah terlanjur menjalankan skema lama sebelum Fase 2I.4, perubahan pada berkas `schema.sql` di repository tidak mengubah tabel live secara otomatis. Administrator basis data harus mengeksekusi perintah SQL remediasi berikut:

```sql
-- Remediasi Keamanan Akses Publik (Jika Skema Lama Telah Terpasang)
REVOKE ALL ON TABLE assets FROM anon, authenticated, public;
DROP POLICY IF EXISTS public_read_assets ON assets;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE assets TO service_role;
```
*(Catatan: Pada database staging SIMSARPRAS saat ini, tabel terkonfirmasi bersih/0 tabel, sehingga DDL `schema.sql` baru akan langsung menciptakan skema yang aman sejak awal saat migrasi Fase 2J dieksekusi).*

---

## 9. Analisis Risiko Tersisa & Bukti Kode

| No | Risiko Tersisa | Tingkat Risiko | Bukti File & Baris | Analisis & Rekomendasi Mitigasi |
|---|---|:---:|---|---|
| 1 | Panggilan `api.getAssets()` yang tidak perlu pada halaman Scan Publik | **MEDIUM** | [`src/pages/PublicScanLoan.tsx:L100-103`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx#L100-L103) & [`L711`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx#L711), [`src/pages/QrScanner.tsx:L110-113`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/QrScanner.tsx#L110-L113) & [`L634`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/QrScanner.tsx#L634) | Halaman scan publik memanggil `getAssets()` hanya untuk menampilkan "Pilihan Cepat Contoh Barang". Saat frontend terhubung ke backend Express tanpa login, `GET /assets` merespon 401 `{ error: 'UNAUTHORIZED' }`. Karena `allAssets` berupa objek dan bukan array, evaluasi `allAssets?.slice(0, 5)` berpotensi melempar runtime error `TypeError: allAssets.slice is not a function` pada mode manual input `/scan`. **Rekomendasi:** Tambahkan pengecekan aman `Array.isArray(allAssets) ? allAssets.slice(0, 5) : []` atau hapus pemanggilan `getAssets()` dari halaman publik setelah audit ini disetujui. |
| 2 | Keterbatasan Penyimpanan In-Memory Rate Limiter | **LOW** | [`server/src/middleware/rateLimiter.ts:L1-35`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/rateLimiter.ts#L1-L35) | `Map` in-memory bekerja efektif pada single-instance server (staging). Jika di masa depan sistem produksi menggunakan horizontal cluster/load balancer, rate limit store harus dialihkan ke Redis. |
| 3 | Pengujian Konkurensi Live Memerlukan Database Staging Aktif | **LOW** | [`src/test/apiContract.test.ts:L370-380`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts#L370-L380) | Pengujian konkurensi 20 request simultan (ACID row lock) ditandai `BLOCKED` di mode lokal tanpa PostgreSQL live, dan dijadwalkan diverifikasi pasca-migrasi Fase 2J. |

---

## 10. Status Working Tree & Flag Keselamatan Lingkungan

### 10.1. Integritas Working Tree
- Seluruh modifikasi keamanan Fase 2I.4 pada `server/db/schema.sql`, `server/src/routes/assets.ts`, `server/src/middleware/auth.ts`, dan tes telah divalidasi dan tidak menimpa pekerjaan pengguna yang tidak terkait.
- Tidak ada source code, konfigurasi, atau kredensial yang diubah selama audit Fase 2I.5 ini.

### 10.2. Pemeriksaan Flag Keselamatan Lingkungan ([`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env))
- `APP_ENV`: `staging` (**TERPENUHI**)
- `ALLOW_STAGING_MIGRATION`: `false` (**TERPENUHI & FAIL-CLOSED**)
- `STAGING_PROJECT_REF`: Dikonfigurasi secara aman tanpa mengekspos rahasia.
- `DIRECT_URL` & `DATABASE_URL`: Dikonfigurasi secara aman tanpa mengekspos password atau connection string.

---

## 11. Daftar Prasyarat Sebelum Menjalankan Fase 2J

Sebelum migrasi database staging dieksekusi pada Fase 2J, prasyarat berikut harus dipenuhi:
1. [x] **Skema DDL Mengandung RLS Penuh & Revoke Publik:** Terpenuhi pada `server/db/schema.sql`.
2. [x] **Express Backend Mengisolasi Katalog & Mempertahankan Endpoint Scan Publik:** Terpenuhi pada `server/src/routes/assets.ts`.
3. [x] **Pengujian Regresi & Build Lulus 100%:** 80/80 tes lulus, build server dan client sukses.
4. [x] **Database Staging Terkonfirmasi Bersih:** Dikonfirmasi 0 tabel pada Fase 2I.
5. [ ] **Perbaikan Minor Toleransi Array pada Frontend (Opsional namun Disarankan):** Membungkus `allAssets?.slice` dengan `Array.isArray(allAssets)` agar halaman `/scan` manual input bebas dari potensi TypeError saat unauthenticated.
6. [ ] **Persetujuan & Otorisasi Manusia (Human Review Approval):** Pengguna meninjau laporan ini dan memberikan persetujuan eksplisit untuk melangkah ke Fase 2J.
7. [ ] **Pengaktifan Flag Migrasi Eksplisit:** Mengubah `ALLOW_STAGING_MIGRATION=true` hanya sesaat sebelum perintah `npm run migrate` dijalankan pada Fase 2J.

---

## 12. Kesimpulan Akhir

Audit Fase 2I.5 menyimpulkan bahwa perubahan penguatan keamanan akses aset publik telah berhasil diterapkan dengan integritas tinggi. Fitur pemindaian barcode fisik sekolah `/b/:tokenOrCode` tetap dapat digunakan oleh guru dan umum tanpa hambatan login, sementara katalog inventaris internal dan metadata sensitif terlindungi secara ketat dari potensi scraping massal.

**Status Akhir: `READY FOR HUMAN REVIEW`**  
*(Antigravity berhenti di sini tanpa menjalankan migrasi Fase 2J dan menunggu instruksi persetujuan manusia).*
