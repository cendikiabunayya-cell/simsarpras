# SIMSARPRAS — PERBAIKAN REGRESI UI SCAN PUBLIK (FASE 2I.6)
## Public Scan UI Regression Fix & Safe Type Handling Verification Report

**Versi Dokumen:** 2.1.0-PUBLIC-SCAN-UI-REGRESSION-FIX  
**Tanggal Pelaksanaan:** 14 Oktober 2026  
**Status Evaluasi:** **READY FOR HUMAN REVIEW**  
**Database Staging Target:** Supabase Project `ajajdkhxosmbfyzzabgy` (`ap-northeast-1`, PostgreSQL 17.11)  
**Kondisi Lingkungan:** `APP_ENV=staging` | `ALLOW_STAGING_MIGRATION=false` (Strictly Preserved / Read-Only)  

---

## 1. Ringkasan Eksekutif

Pada Fase 2I.5 teridentifikasi temuan risiko minor pada antarmuka pengguna:
- [`src/pages/PublicScanLoan.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx) (sekitar baris 711) dan [`src/pages/QrScanner.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/QrScanner.tsx) (sekitar baris 634) memanggil `allAssets?.slice()` pada data hasil `useQuery` inventaris.
- Saat frontend terhubung ke backend Express tanpa login, `GET /api/v1/assets` merespon HTTP 401 `{ error: 'UNAUTHORIZED' }`. Karena objek error adalah truthy dan bukan array, evaluasi `allAssets?.slice()` memicu `TypeError: allAssets.slice is not a function`.
- Selain itu, pemanggilan `allLoans.find()` pada handler scan di kedua halaman juga berpotensi mengalami hal serupa saat `GET /api/v1/loans` mengembalikan respons error 401.

Fase 2I.6 berhasil menutup celah tersebut melalui **normalisasi tipe data aman (*safe array normalization*)**, penonaktifan *retry loop* pada query publik (`retry: false`), dan penambahan 4 pengujian regresi otomatis tanpa melonggarkan keamanan backend `GET /assets`.

---

## 2. Rincian Perubahan Kode (Working Tree Changes)

### 2.1. Normalisasi Aman pada [`src/pages/PublicScanLoan.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx)
1. **Penonaktifan Query Retry Loop (Baris 100–108):**
   ```typescript
   const { data: allAssets } = useQuery({
     queryKey: ['assets'],
     queryFn: () => api.getAssets(),
     retry: false,
   });

   const { data: allLoans } = useQuery({
     queryKey: ['loans'],
     queryFn: () => api.getLoans(),
     retry: false,
   });
   ```
2. **Definisi Safe Array Helper (Baris 110–114):**
   ```typescript
   const safeAssetsList: AssetUnit[] = Array.isArray(allAssets)
     ? allAssets
     : Array.isArray((allAssets as any)?.data)
     ? (allAssets as any).data
     : [];
   ```
3. **Pemeriksaan Aman pada Penelusuran Transaksi Pinjaman (Baris 122–139):**
   ```typescript
   const safeLoansList: LoanRequest[] = Array.isArray(allLoans)
     ? allLoans
     : Array.isArray((allLoans as any)?.data)
     ? (allLoans as any).data
     : [];

   if (safeLoansList.length > 0) {
     const foundLoan = safeLoansList.find(
       (l) =>
         l.unit?.id === asset.id &&
         (l.status === 'ACTIVE' ||
           l.status === 'READY_FOR_HANDOVER' ||
           l.status === 'RETURN_REQUESTED' ||
           l.status === 'RETURN_RECEIVED')
     );
     setAssociatedLoan(foundLoan || null);
   } else {
     setAssociatedLoan(null);
   }
   ```
4. **Rendering Kondisional Pil Pilihan Cepat (Baris 705–730):**
   Tombol pilihan cepat contoh barang hanya dirender bila `safeAssetsList.length > 0`. Jika data berupa objek error 401 atau array kosong, blok ini disembunyikan secara bersih tanpa error.

### 2.2. Normalisasi Aman pada [`src/pages/QrScanner.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/QrScanner.tsx)
1. Mengaplikasikan `retry: false` pada `useQuery(['assets'])` dan `useQuery(['loans'])` (Baris 110–118).
2. Mendefinisikan `safeAssetsList` yang mendukung data array langsung maupun amplop `{ data: [...] }` (Baris 120–124).
3. Mengamankan `safeLoansList.find()` pada `handleLookup` (Baris 132–148).
4. Melindungi pemanggilan `safeAssetsList.slice(0, 6)` dengan *guard* `{safeAssetsList.length > 0 && (...)}` (Baris 628–650).

### 2.3. Penyempurnaan Ekstraksi Respons pada [`src/services/api.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/services/api.ts)
1. `api.getAssets()` (Baris 131–141) dan `api.getLoans()` (Baris 217–227) kini memeriksa `!res.ok`. Jika menerima status HTTP non-2xx (seperti 401 UNAUTHORIZED), fungsi akan melempar `Error` alih-alih mengembalikan objek `{ error: ... }` sebagai pseudo-array.
2. Jika berstatus 200 OK, fungsi secara transparan mengekstrak `Array.isArray(json) ? json : json.data || []`, menjamin kompatibilitas baik dengan format array langsung (mock storage) maupun amplop standar backend Express `{ data: [...], total: ... }`.

### 2.4. Keamanan Backend `GET /assets` Tetap Dipertahankan
- Tidak ada relaksasi atau pembukaan kembali hak akses publik pada endpoint `GET /api/v1/assets`.
- Middleware `requireAuth` tetap terpasang secara ketat di [`server/src/routes/assets.ts:L205`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L205).
- Endpoint scan barcode mandiri `GET /api/v1/assets/scan` tetap terbuka untuk publik dengan proteksi allowlist respons dan rate limiting 60 req/min.

---

## 3. Hasil Pengujian Verifikasi & Regresi

### A. Eksekusi Pengujian Vitest (`npm test`)
```
> si-sarpras-web@1.2.0 test
> vitest run

 RUN  v2.1.9 C:/Users/Lenovo/Documents/SIMSARPRAS

 ✓ src/test/statemachine.test.ts (15 tests)
 ✓ src/test/databaseMigration.test.ts (17 tests)
 ✓ src/test/apiContract.test.ts (20 tests)
 ✓ src/test/components.test.tsx (11 tests)
 ✓ src/test/qrIdentityAndUrl.test.tsx (21 tests)

 Test Files  5 passed (5)
      Tests  84 passed (84)
   Duration  9.61s
```
- **Jumlah Tes yang Dijalankan:** **84 tes** (meningkat dari 80 tes pada Fase 2I.5).
- **Hasil:** **84 passed (100% LULUS)**, 0 failed, 0 skipped.

### B. Rincian Pengujian Regresi Baru (Seksi 9 pada `qrIdentityAndUrl.test.tsx`)
1. **Ketahanan Error 401 pada `/scan`:**
   Memverifikasi bahwa saat `api.getAssets()` melempar error 401, halaman `/scan` tidak crash, input manual tetap dapat diketik, dan pilihan cepat disembunyikan secara aman.
2. **Pencarian Kode Manual saat `allAssets` & `allLoans` Error 401:**
   Memverifikasi bahwa pencarian kode fisik (misal: `QR-TIK-ASUS-001`) via endpoint publik `api.getAssetByCodeOrQr` tetap berhasil memuat kartu aset dan tombol pinjam tanpa melempar `TypeError: allLoans.find is not a function`.
3. **Rendering Pil Pilihan Cepat pada Data Array Valid:**
   Memverifikasi bahwa ketika `getAssets()` mengembalikan array data yang sah, tombol pil pilihan cepat tetap tampil dan dapat diklik untuk pencarian instan.
4. **Ketahanan Format Non-Array / Null pada `/qr-scan`:**
   Memverifikasi bahwa saat `getAssets()` mengembalikan nilai `null` atau objek malformed, antarmuka `QrScanner` tetap merender komponen pencarian tanpa crash.

### C. Build & Rekonsiliasi
- **Frontend Build (`npm run build`):** `tsc && vite build` sukses dengan **0 error** (dist build selesai dalam 11.83 detik).
- **Server Build (`npm run build --prefix server`):** `tsc` sukses dengan **0 error**.
- **Rekonsiliasi Integritas Data (`npm run reconcile --prefix server`):** **PASSED** (11 token terverifikasi 100% utuh, 0 duplikat, 0 relasi yatim).

---

## 4. Matriks Risiko Tersisa (Remaining Risks)

| No | Risiko Tersisa | Tingkat Risiko | Status Penanganan |
|---|---|:---:|---|
| 1 | Runtime TypeError `.slice()` pada data 401 | **RESOLVED** | Ditutup sepenuhnya dengan normalisasi tipe aman `safeAssetsList` dan `retry: false`. |
| 2 | Runtime TypeError `.find()` pada `allLoans` 401 | **RESOLVED** | Ditutup sepenuhnya dengan `safeLoansList` guard pada kedua halaman scan. |
| 3 | In-Memory Rate Limiter di lingkungan Multi-Instance | **LOW** | Aman untuk staging single-instance; direkomendasikan Redis untuk production horizontal scaling. |
| 4 | Eksekusi Pengujian Konkurensi Database Live | **LOW** | Memerlukan PostgreSQL live; dijadwalkan diverifikasi pasca-migrasi Fase 2J. |

---

## 5. Pemeriksaan Flag Keselamatan Lingkungan

- `APP_ENV`: `staging` (**TERPENUHI**)
- `ALLOW_STAGING_MIGRATION`: `false` (**TERPENUHI & FAIL-CLOSED**)
- Tidak ada migrasi atau mutasi DDL/DML yang dijalankan ke database Supabase staging.
- Working tree pengguna terjaga utuh.

---

## 6. Status Akhir

```
STATUS: READY FOR HUMAN REVIEW
```

Seluruh temuan regresi UI scan publik telah diperbaiki dan diverifikasi dengan 84/84 pengujian otomatis yang lulus 100%. Antigravity berhenti di sini sesuai batas keselamatan dan menunggu instruksi persetujuan manusia sebelum melangkah ke **Fase 2J (Staging Migration Execution)**.
