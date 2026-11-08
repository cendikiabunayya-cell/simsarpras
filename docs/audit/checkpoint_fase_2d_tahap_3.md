# CHECKPOINT RESMI — FASE 2D TAHAP 3
## Penyelarasan Backend API Layer (Express)

**Waktu Eksekusi:** 2026-10-13  
**Status Otorisasi:** Tahap 3 Selesai (Menunggu otorisasi Tahap 4)  
**Dokumen Referensi:** `docs/audit/phase-2d-resolution-plan.md`  
**Prinsip Batasan:** Tidak menghubungkan frontend ke backend, tidak melakukan migrasi database Supabase, dan tidak mengubah token barcode atau data localStorage.

---

### 1. Berkas yang Diubah dan Dibuat

| No | File | Tipe Perubahan | Deskripsi Perubahan |
|---|---|---|---|
| 1 | [`server/src/validators.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/validators.ts) | **File Baru** | Skema validasi Zod (`tokenParamSchema`, `loanRequestSchema`) dan normalizer payload (`normalizeLoanPayload`). |
| 2 | [`server/src/middleware/rateLimiter.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/rateLimiter.ts) | **File Baru** | Middleware rate limiting in-memory (10 req/menit/IP) dengan header standar RFC 6585 (`Retry-After`, `X-RateLimit-*`). |
| 3 | [`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts) | **File Baru** | Middleware otentikasi JWT (`requireAuth`) untuk memproteksi data riwayat transaksi dan helper uji `generateTestToken`. |
| 4 | [`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts) | **Diperbarui** | Penambahan handler `GET /scan?query=...`, `GET /scan/:token`, `GET /:id`, validasi format token, format output camelCase, dan pencegahan kebocoran error DB. |
| 5 | [`server/src/routes/loans.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/loans.ts) | **Diperbarui** | Normalisasi payload (`assetUnitId` & `borrower.fullName`), validasi Zod, proteksi `requireAuth` pada riwayat pinjaman, dan preservasi `SELECT ... FOR UPDATE`. |
| 6 | [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts) | **Diperbarui** | Registrasi alias endpoint top-level (`/assets`, `/loans`, `/loan-requests`), hardening penolakan CORS tanpa dump HTML stack trace, dan centralized error handler. |
| 7 | [`src/test/apiContract.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts) | **File Baru** | Suite pengujian API Layer (15 tes) mencakup validasi payload, rate limit, proteksi auth, CORS, dan kompatibilitas endpoint. |

---

### 2. Pemetaan Endpoint (API Mapping Matrix)

Berikut adalah matriks keselarasan antara pemanggilan frontend (`src/services/api.ts`) dan rute Express backend:

| Fungsi Frontend (`api.ts`) | URL yang Dipanggil Frontend | Endpoint Backend v1 | Alias Kompatibilitas Baru | Status Keselarasan |
|---|---|---|---|---|
| `getAssetByCodeOrQr(codeOrQr)` | `GET /assets/scan?query=...` | `GET /api/v1/assets/token/:token` | `GET /assets/scan?query=...`<br>`GET /assets/scan/:token` | **Terselaras 100%** |
| `getAssetById(id)` | `GET /assets/:id` | `GET /api/v1/assets/token/:id` | `GET /assets/:id`<br>`GET /api/v1/assets/:id` | **Terselaras 100%** |
| `getAssets()` | `GET /assets` | `GET /api/v1/assets` | `GET /assets` | **Terselaras 100%** |
| `createLoanRequest(payload)` | `POST /loan-requests` | `POST /api/v1/loans/request` | `POST /loan-requests`<br>`POST /loans` | **Terselaras 100%** |
| `getLoans()` | `GET /loan-requests` | `GET /api/v1/loans` | `GET /loan-requests`<br>`GET /loans` | **Terselaras 100% (Protected)** |
| `getLoanById(id)` | `GET /loan-requests/:id` | - | `GET /loan-requests/:id`<br>`GET /loans/:id` | **Terselaras 100% (Protected)** |
| Pindai Langsung / Worker | `GET /b/:token` $\rightarrow$ scan | `GET /api/v1/assets/token/:token` | `GET /assets/token/:token`<br>`GET /assets/scan/:token` | **Terselaras 100%** |

#### Normalisasi Payload Pengajuan Pinjaman:
- **Input Frontend (`api.ts`):** `{ assetUnitId, borrower: { fullName, employeeNumber, role }, purpose, expectedReturnAt }`
- **Input Legacy Backend:** `{ assetId, borrowerName, borrowerEmployeeNumber, borrowerRole, purpose, expectedReturnAt }`
- **Hasil Normalisasi:** Router backend kini menerima kedua bentuk payload tanpa error, menormalisasi nilainya, dan memvalidasinya menggunakan Zod.

---

### 3. Ringkasan Perubahan Keamanan

1. **Validasi Input & Token Barcode (Zod Schema):**
   - Format token diwajibkan memenuhi regex `^[A-Za-z0-9_\-\.]+$` dengan panjang 2–100 karakter.
   - Token dengan karakter khusus/berbahaya (seperti `<script>`, spasi, atau kutip SQL) langsung ditolak pada layer HTTP dengan status `400 Bad Request (INVALID_TOKEN_FORMAT)` sebelum mencapai database.
2. **Rate Limiting pada Pengajuan Pinjaman Publik:**
   - Diterapkan middleware pembatas laju (10 request per menit per alamat IP).
   - Melebihi ambang batas menghasilkan status `429 Too Many Requests` disertai header `Retry-After` dan `X-RateLimit-*`.
3. **Audit & Proteksi Akses Riwayat Pinjaman:**
   - Endpoint riwayat transaksi (`GET /loans` dan `GET /loan-requests`) kini diproteksi oleh middleware `requireAuth`.
   - Permintaan tanpa Bearer JWT yang sah ditolak dengan status `401 Unauthorized` atau `403 Forbidden`, sehingga informasi guru dan riwayat peminjaman tidak terekspos ke publik internet.
4. **Pencegahan Peminjaman Ganda (ACID Pessimistic Row Lock):**
   - Transaksi database dipertahankan menggunakan `BEGIN ... SELECT id, operational_status ... FOR UPDATE ... UPDATE ... INSERT ... COMMIT`.
   - Menjamin bahwa request simultan terhadap aset yang sama tidak dapat menghasilkan peminjaman ganda (zero double-lending).
5. **Hardening CORS & Penanganan Error:**
   - CORS middleware dikonfigurasi untuk menolak origin yang tidak terdaftar dengan `callback(null, false)`, mencegah browser membocorkan data dan menghindari HTML error stack trace.
   - Centralized error handler menyaring seluruh kegagalan internal database agar tidak membocorkan query SQL, kredensial, atau string koneksi (merespon dengan pesan generic JSON terstruktur).

---

### 4. Hasil Pengujian dan Bukti Eksekusi

#### A. Vitest Test Suite (Total 60 Tests Passed)
Eksekusi pengujian otomatis Vitest pada seluruh 5 berkas test:
```text
✓ src/test/databaseMigration.test.ts (7 tests)
✓ src/test/statemachine.test.ts (15 tests)
✓ src/test/components.test.tsx (11 tests)
✓ src/test/qrIdentityAndUrl.test.tsx (12 tests)
✓ src/test/apiContract.test.ts (15 tests)

Test Files  5 passed (5)
     Tests  60 passed (60)
  Duration  4.80s
```

#### B. Rincian Uji 15 Skenario API Layer (`apiContract.test.ts`):
1. Mendukung endpoint scan query (`?query=...`) pada `/assets/scan` dan `/api/v1/assets/scan` $\rightarrow$ **Lulus**
2. Mendukung alias rute `/loan-requests` untuk kompatibilitas frontend $\rightarrow$ **Lulus**
3. Respon 404 terstandar pada endpoint tidak dikenal $\rightarrow$ **Lulus**
4. Penolakan token barcode dengan format berbahaya/ilegal (HTTP 400 `INVALID_TOKEN_FORMAT`) $\rightarrow$ **Lulus**
5. Penolakan pengajuan pinjaman dengan missing fields (HTTP 400 `VALIDATION_ERROR`) $\rightarrow$ **Lulus**
6. Penolakan format tanggal tidak valid pada payload (HTTP 400) $\rightarrow$ **Lulus**
7. Penolakan nama peminjam melebihi batas 200 karakter (HTTP 400) $\rightarrow$ **Lulus**
8. Penegakan Rate Limiting (10 request sukses, request ke-11 ditolak HTTP 429 `RATE_LIMIT_EXCEEDED`) $\rightarrow$ **Lulus**
9. Penolakan akses riwayat pinjaman tanpa header Authorization (HTTP 401 `UNAUTHORIZED`) $\rightarrow$ **Lulus**
10. Penolakan akses riwayat pinjaman dengan token palsu/kadaluarsa (HTTP 403 `FORBIDDEN`) $\rightarrow$ **Lulus**
11. Akses riwayat pinjaman diizinkan dengan JWT valid $\rightarrow$ **Lulus**
12. CORS menolak origin asing tanpa kebocoran stack trace HTML $\rightarrow$ **Lulus**
13. Respon error terstruktur saat database offline tanpa membocorkan koneksi (HTTP 503) $\rightarrow$ **Lulus**
14. Verifikasi implementasi kode `SELECT ... FOR UPDATE` row lock $\rightarrow$ **Lulus**
15. **STATUS PENGUJIAN KONKURENSI LIVE POSTGRESQL (TEST-03):**  
    Sesuai instruksi keselamatan, pengujian 20 request simultan pada PostgreSQL live ditandai **BLOCKED** karena lingkungan saat ini berjalan tanpa koneksi database aktif (`DATABASE_URL`). Skenario ini akan dieksekusi pada **Fase 5 (Uji Terisolasi Supabase Dev)** setelah instance database live tersedia.

#### C. Build & Rekonsiliasi Audit:
- Server TypeScript Build (`npm run build` di `server`): **Exit Code 0 (0 Errors)**
- Frontend TypeScript Check (`npx tsc --noEmit` di root): **Exit Code 0 (0 Errors)**
- Rekonsiliasi Database (`npm run reconcile`): **Verdict: PASSED (11 Token Valid, 0 Duplicate, 0 Orphan)**

---

### 5. Risiko Sisa dan Fitur yang Belum Tersedia

Sesuai instruksi audit, kami **tidak membuat endpoint tiruan** untuk fitur-fitur yang belum dispesifikasikan secara lengkap. Fitur berikut didokumentasikan secara transparan sebagai **BELUM TERSEDIA** di backend Express:

1. **Siklus Persetujuan & Penolakan Admin:**
   - `POST /loan-requests/:id/approve` (Belum tersedia di Express)
   - `POST /loan-requests/:id/reject` (Belum tersedia di Express)
2. **Serah Terima dan Pengembalian Fisik:**
   - `POST /loans/:id/handover` (Belum tersedia di Express)
   - `POST /returns` (Belum tersedia di Express)
   - `POST /returns/:id/receive` (Belum tersedia di Express)
   - `POST /returns/:id/approve` (Belum tersedia di Express)
3. **Agregasi & Master Data:**
   - `GET /audit-logs` (Belum tersedia di Express)
   - `GET /dashboard` (Belum tersedia di Express)
   - CRUD Master data `/categories`, `/locations`, `/funding-sources` (Belum tersedia di Express)
4. **Koneksi Live Database:**
   - Pengujian konkurensi live `SELECT ... FOR UPDATE` menunggu penyediaan instance Supabase dev pada Fase 5.

---

### 6. Status Kriteria Penerimaan Tahap 3

- [x] Kontrak API Express mendukung seluruh pemanggilan `src/services/api.ts` yang relevan.
- [x] Validasi payload menggunakan Zod diterapkan secara ketat.
- [x] Rate limiting aktif pada endpoint publik pengajuan peminjaman.
- [x] Endpoint riwayat pinjaman diproteksi autentikasi (mencegah kebocoran data sensitif).
- [x] Transaksi database dan `FOR UPDATE` dipertahankan.
- [x] Token barcode divalidasi dan error ditangani tanpa membocorkan internal database.
- [x] Seluruh 60 pengujian regresi dan pengujian kontrak API baru lulus 100%.
- [x] Fitur yang belum selesai didokumentasikan tanpa endpoint fiktif.

---

### Titik Berhenti (Stop Point)

> [!NOTE]
> **Pekerjaan Fase 2D Tahap 3 telah selesai.**  
> Tahap 4 (*Frontend UI Routing: pendaftaran rute publik `/b/:tokenOrCode` di `App.tsx`*) **belum dimulai**. Sistem berhenti di sini untuk menunggu tinjauan dan persetujuan tertulis Anda sebelum melanjutkan ke Tahap 4.
