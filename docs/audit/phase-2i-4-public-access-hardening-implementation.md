# SIMSARPRAS — IMPLEMENTASI PENGUATAN AKSES ASET PUBLIK (FASE 2I.4)
## Public Asset Access Hardening Implementation & Test Verification

**Versi Dokumen:** 2.1.0-PUBLIC-ACCESS-HARDENING-IMPLEMENTATION  
**Tanggal Pelaksanaan:** 14 Oktober 2026  
**Status Evaluasi:** LOCAL SECURITY HARDENING IMPLEMENTED & VERIFIED (READ-ONLY STAGING)  
**Tujuan:** Menerapkan penguatan keamanan akses publik agar barcode fisik dan rute `/b/:tokenOrCode` tetap berfungsi 100% tanpa membuka katalog aset secara massal melalui Supabase PostgREST maupun Express API.

---

## 1. Ringkasan Perubahan yang Diterapkan

Sesuai rancangan pada [`docs/audit/phase-2i-3-public-asset-access-hardening.md`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/docs/audit/phase-2i-3-public-asset-access-hardening.md), perbaikan keamanan telah diterapkan secara lokal:

1. **Pencabutan Akses Publik Skema DDL ([`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql)):**
   - Menghapus `GRANT SELECT ON TABLE assets TO anon, authenticated;`.
   - Menghapus kebijakan RLS `CREATE POLICY public_read_assets ON assets ...`.
   - Menambahkan `REVOKE ALL ON TABLE assets FROM anon, authenticated, public;`.
   - Seluruh 8 tabel kini terlindungi penuh: 0 akses langsung melalui Supabase PostgREST bagi peran publik.
2. **Proteksi Autentikasi Listing Inventaris ([`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts)):**
   - Menambahkan middleware `requireAuth` pada `assetsRouter.get('/')`.
   - Permintaan anonim ke daftar seluruh inventaris langsung ditolak dengan HTTP 401 Unauthorized.
   - Staf terotentikasi (admin/guru) dengan token Bearer JWT yang sah tetap dapat mengakses daftar inventaris lengkap.
3. **Penerapan Rate Limiter Scan Publik ([`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts)):**
   - Menerapkan `publicScanLimiter` (`max: 60` permintaan per menit per alamat IP) pada rute publik: `GET /scan`, `GET /scan/:token`, `GET /token/:token`, dan `GET /:id`.
   - Melindungi sistem dari serangan *sequential enumeration* dan *automated scraping* tanpa menghalangi pemindaian normal oleh pengguna manusia.
4. **Allowlist Respons Publik & Sanitasi Data Aset ([`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts)):**
   - Membuat fungsi pemformat respons terpisah: `formatPublicAssetResponse(row)`.
   - **Field yang Dikecualikan (DILARANG hadir di respon scan publik):** `notes` (catatan internal staf), `funding_source` / `fundingSource`, dan `acquisition_year` / `acquisitionYear`.
   - **Field yang Diizinkan (Allowlist):** Hanya atribut fisik yang esensial untuk identifikasi dan pengajuan peminjaman barang.
5. **Pencegahan Kebocoran Pesan Error ([`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts)):**
   - Menyesuaikan pesan penolakan `requireAuth` agar berlaku umum untuk seluruh endpoint terlindungi tanpa membocorkan struktur internal.

---

## 2. Berkas yang Diubah (Working Tree Modifications)

| Berkas | Jenis Perubahan | Deskripsi Perubahan |
|---|---|---|
| [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) | DDL Security Hardening | Menghapus `GRANT SELECT ON assets`, menghapus policy `public_read_assets`, dan menambahkan `REVOKE ALL ON TABLE assets FROM anon, authenticated, public;`. |
| [`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts) | Backend Routing & DTO | Menambahkan `requireAuth` pada `GET /`, menambahkan `publicScanLimiter` (60 req/min), dan mengimplementasikan `formatPublicAssetResponse` (allowlist). |
| [`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts) | Middleware Refinement | Menstandarkan pesan penolakan HTTP 401. |
| [`src/test/apiContract.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts) | Unit Testing Suite | Menambahkan 5 pengujian baru: penolakan unauth pada `GET /assets`, izin auth pada `GET /assets`, keterbukaan `GET /assets/scan`, rate limiting scan 60 req/min, dan pengujian allowlist respons publik. |
| [`src/test/databaseMigration.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/databaseMigration.test.ts) | Unit Testing Suite | Menyesuaikan asersi RLS untuk memverifikasi `REVOKE ALL ON assets` dan ketiadaan `public_read_assets`. |

---

## 3. Matriks Field Allowlist Respons Publik vs Field Internal

| Nama Kolom Database | `formatPublicAssetResponse` (Scan Publik) | `formatAssetResponse` (Listing Internal Admin) | Keterangan Privasi |
|---|:---:|:---:|---|
| `id` | **HADIR** | **HADIR** | Diperlukan sebagai identifier mutasi peminjaman. |
| `permanent_id` | **HADIR** | **HADIR** | Identitas permanen independen barang. |
| `qr_token` | **HADIR** | **HADIR** | Token verifikasi barcode fisik. |
| `asset_code` | **HADIR** | **HADIR** | Nomor inventaris fisik barang. |
| `item_name` | **HADIR** | **HADIR** | Nama barang yang ditampilkan pada UI. |
| `institution` | **HADIR** | **HADIR** | Nama madrasah / instansi pemilik. |
| `category_id` & `category_name` | **HADIR** | **HADIR** | Kategori barang. |
| `location_id` & `location_name` | **HADIR** | **HADIR** | Ruang / penempatan fisik barang. |
| `item_brand` | **HADIR** | **HADIR** | Merek barang. |
| `technical_specs` | **HADIR** | **HADIR** | Spesifikasi teknis perangkat. |
| `effective_loan_mode` | **HADIR** | **HADIR** | Penentu alur persetujuan (DIRECT / ADMIN_APPROVAL). |
| `condition_status` | **HADIR** | **HADIR** | Status fisik (GOOD, MINOR_DAMAGE, dll.). |
| `operational_status` | **HADIR** | **HADIR** | Status ketersediaan (AVAILABLE, ON_LOAN, dll.). |
| `photo_url` | **HADIR** | **HADIR** | Foto fisik barang. |
| `standard_accessories` | **HADIR** | **HADIR** | Kelengkapan barang bawaan. |
| `is_decommissioned` | **HADIR** | **HADIR** | Status soft delete. |
| **`notes`** | **DIHILANGKAN (OMITTED)** | **HADIR** | **Disembunyikan demi privasi.** Mencegah kebocoran catatan lemari/staf. |
| **`funding_source`** | **DIHILANGKAN (OMITTED)** | **HADIR** | **Disembunyikan.** Asal dana tidak relevan untuk peminjam publik. |
| **`acquisition_year`** | **DIHILANGKAN (OMITTED)** | **HADIR** | **Disembunyikan.** Metadata pembukuan internal. |

---

## 4. Hasil Pengujian Verifikasi & Regresi

Seluruh pengujian lokal dijalankan secara otomatis tanpa memutasi basis data staging:

### A. Eksekusi Unit Test Vitest (`npm test`)
```
 RUN  v2.1.9 C:/Users/Lenovo/Documents/SIMSARPRAS

 ✓ src/test/statemachine.test.ts (15 tests)
 ✓ src/test/databaseMigration.test.ts (17 tests)
 ✓ src/test/components.test.tsx (11 tests)
 ✓ src/test/apiContract.test.ts (20 tests)
 ✓ src/test/qrIdentityAndUrl.test.tsx (17 tests)

 Test Files  5 passed (5)
      Tests  80 passed (80)
   Duration  5.60s
```
*Hasil:* Seluruh **80 pengujian unit** (termasuk 5 pengujian keamanan baru) **100% LULUS (PASS)** tanpa ada regresi.

### B. Hasil Pengujian Keamanan Spesifik
1. **Daftar Inventaris Anonim Ditolak:**
   - Permintaan `GET /assets` tanpa token otorisasi mengembalikan HTTP `401 UNAUTHORIZED`.
2. **Daftar Inventaris Terotentikasi Berfungsi:**
   - Permintaan `GET /assets` dengan Bearer JWT admin yang valid lolos otentikasi.
3. **Scan Barcode Publik Tetap Terbuka:**
   - Permintaan `GET /assets/scan?query=QR-TIK-ASUS-001` dapat diakses tanpa token otorisasi dan mengembalikan status non-401/403.
4. **Allowlist Respons Publik Terbukti:**
   - Respons `formatPublicAssetResponse` terbukti tidak memuat properti `notes`, `fundingSource`, atau `acquisitionYear`.
5. **Rate Limiting Scan Publik:**
   - Pengiriman 60 permintaan scan berturut-turut diizinkan (header `X-RateLimit-Limit: 60`).
   - Permintaan ke-61 langsung ditolak dengan HTTP `429 RATE_LIMIT_EXCEEDED` dan menyertakan header `Retry-After`.
6. **Regresi Rute Barcode Publik:**
   - Pengujian `src/test/qrIdentityAndUrl.test.tsx` (17 tests) membuktikan rute `/b/:tokenOrCode`, `/q/:tokenOrCode`, dan `/scan` tetap berfungsi 100% untuk pemindaian barcode mandiri.

### C. Kompilasi TypeScript & Build
- `npm run build --prefix server`: **0 error (Lolos kompilasi TypeScript strict)**.
- `npm run build`: **0 error (Vite production bundle berhasil dibuat dalam 11.26s)**.

---

## 5. SQL Remediasi untuk Basis Data Lama (Unexecuted Reference)

> [!CAUTION]
> **Pemberitahuan Keselamatan:**
> Mengubah berkas `server/db/schema.sql` hanya berlaku untuk pembuatan basis data baru (Fase 2J pada database kosong).
> Jika skema telah pernah dieksekusi sebelumnya pada database yang sudah berjalan, skrip SQL berikut wajib dijalankan secara terpisah oleh administrator untuk mencabut izin lama.
> **SKRIP INI TIDAK DIJALANKAN PADA FASE INI:**

```sql
-- =============================================================================
-- SQL Remediasi Keamanan Akses Publik (Hanya untuk Database yang Sudah Ada)
-- =============================================================================

-- 1. Cabut seluruh hak akses publik dari tabel assets
REVOKE ALL ON TABLE assets FROM anon, authenticated, public;

-- 2. Hapus kebijakan publik jika pernah dibuat
DROP POLICY IF EXISTS public_read_assets ON assets;

-- 3. Pastikan izin service_role dan RLS tetap aktif
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE assets TO service_role;

-- 4. Verifikasi kebijakan service_role
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_assets') THEN
        CREATE POLICY service_role_all_assets ON assets
        TO service_role
        FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
```

---

## 6. Risiko yang Belum Terselesaikan (Remaining Risks)

1. **Dependensi Database Baru vs Database Lama:**
   Perubahan pada `schema.sql` akan diterapkan secara otomatis saat migrasi Fase 2J dieksekusi pada database staging (karena skema saat ini terkonfirmasi bersih/0 tabel). Jika di kemudian hari dilakukan rollback atau migrasi ke database yang sudah memiliki tabel `assets` dengan `GRANT SELECT` lama, skrip SQL remediasi di atas harus dipastikan telah dijalankan.
2. **Keterbatasan In-Memory Rate Limiter:**
   Middleware `publicScanLimiter` saat ini menggunakan *in-memory store* (`Map`). Jika di lingkungan produksi backend di-scale menjadi multiple instance (*cluster/load balancer*), store rate limiter perlu ditingkatkan menggunakan Redis. Untuk lingkungan staging *single instance*, implementasi saat ini sudah sangat memadai dan aman.

---

## 7. Rekomendasi Menuju Fase 2J

Dengan diterapkannya penguatan akses publik pada skema DDL dan Express routing:
1. **Celah Mass Scraping Tertutup Total:** Baik Supabase PostgREST maupun Express API tidak lagi membuka katalog massal bagi publik.
2. **Barcode Fisik Tetap 100% Kompatibel:** Seluruh barcode dan rute `/b/:tokenOrCode` tetap berjalan normal.
3. **Kesiapan Teknis:** Repositori telah diperbarui, seluruh 80 pengujian unit lulus, dan build server/frontend siap.

---

> [!IMPORTANT]
> **Status Tindakan Saat Ini:**
> Antigravity **BERHENTI** di sini sesuai instruksi keselamatan Fase 2I.4.
> Nilai `ALLOW_STAGING_MIGRATION=false` dipertahankan aktif (*fail-closed*).
> Tidak ada migrasi atau mutasi basis data staging yang dijalankan.
> Menunggu peninjauan dan otorisasi manusia sebelum melangkah ke **Fase 2J (Staging Migration Execution)**.
