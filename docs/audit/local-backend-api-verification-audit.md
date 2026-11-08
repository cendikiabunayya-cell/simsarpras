# SIMSARPRAS — AUDIT & VERIFIKASI BACKEND API LOKAL
## Local Backend API Architecture, Readiness & Safety Guardrail Audit Report

**Versi Dokumen:** 2.1.0-BACKEND-API-AUDIT  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi Kode & Build:** **PASS (KOMPILASI TYPESCRIPT 100% SUKSES DENGAN EXIT CODE 0)**  
**Status Evaluasi Runtime HTTP:** **BLOCKED (TARGET BASIS DATA PADA .ENV TERBUKTI STAGING CLOUD, BUKAN LOKAL)**  
**Target Basis Data Terkonfigurasi:** `aws-0-ap-northeast-1.pooler.supabase.com:6543` (Supabase Tokyo Staging)  
**Status Koneksi Staging:** **TERCEGAH / DIBLOKIR SECARA FAIL-CLOSED (Nol Akses)**  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Terkunci Aktif Fail-Closed)  

---

## 1. Ringkasan Eksekutif & Temuan Kritis

Audit read-only dan verifikasi backend API SIMSARPRAS dilakukan untuk memastikan kesiapan backend Express dalam melayani permintaan HTTP secara lokal.

### Verdict Keseluruhan: **`BLOCKED (SAFETY GUARDRAIL ENFORCED)`**

1. **Kode & Arsitektur Backend:** Telah diaudit secara penuh. Kompilasi TypeScript (`tsc`) berhasil 100% tanpa error (`Exit Code: 0`).
2. **Endpoint Health Check & REST:** Telah diidentifikasi secara tepat dari source code resmi (`/api/v1/health` dan `/api/v1/assets/scan`).
3. **Penyebab Pemblokiran Runtime:** Pemeriksaan konfigurasi pada Bagian B menemukan bahwa [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L21) saat ini memuat `DATABASE_URL` yang mengarah ke host **Supabase Tokyo Staging** (`aws-0-ap-northeast-1.pooler.supabase.com:6543`), bukan ke PostgreSQL lokal `127.0.0.1:5432`.
4. Sesuai aturan keselamatan mandat:
   - *"Pastikan konfigurasi database yang akan dipakai adalah database PostgreSQL lokal untuk SIMSARPRAS."*
   - *"Jangan mengubah `APP_ENV`, `ALLOW_STAGING_MIGRATION`, `DIRECT_URL`, atau `DATABASE_URL`."*
   - *"Jangan mengakses atau mengubah Supabase staging."*
   - *"Jangan melanjutkan jika target database tidak dapat dipastikan sebagai lokal."*
   Maka Antigravity **secara sadar menghentikan eksekusi runtime server** demi melindungi database Supabase staging dari akses HTTP yang tidak diotorisasi.

---

## 2. Pemeriksaan Struktur & Arsitektur Backend (Bagian A)

Berdasarkan audit terhadap [`server/package.json`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/package.json) dan [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts):

| Parameter | Spesifikasi Faktual | Keterangan & Referensi Sumber |
|:---|:---|:---|
| **Framework Backend** | Express.js (`express` v4.21.2) | Arsitektur REST API modular dengan middleware CORS, Rate Limiting, JSON body parser, dan error handling terpusat. |
| **Driver Basis Data** | Node-Postgres (`pg` v8.13.1) | Menggunakan connection pool (`Pool`) dengan timeout 5000ms dan idle timeout 30000ms ([`server/src/db.ts:L9-17`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L9-L17)). |
| **Entry Point Backend** | [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts) | Kompilasi target: `server/dist/index.js`. |
| **Script Eksekusi Tersedia** | `npm run dev --prefix server`<br>`npm run build --prefix server`<br>`npm run start --prefix server` | - `dev`: `tsx watch src/index.ts`<br>- `build`: `tsc`<br>- `start`: `node dist/index.js` |
| **Endpoint Health Check Resmi** | `GET /api/v1/health`<br>*(Alias: `GET /health`)* | Diimplementasikan di [`server/src/routes/health.ts:L6-16`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/health.ts#L6-L16). Memanggil `checkDatabaseConnection()` (`SELECT NOW()`). |
| **Endpoint Read-Only yang Tersedia** | `GET /api/v1/assets/scan?query=...`<br>`GET /api/v1/assets/scan/:token` | Diimplementasikan di [`server/src/routes/assets.ts:L182-197`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L182-L197). Dilindungi rate limiter 60 req/menit dan mengembalikan data aset yang disanitasi. |

---

## 3. Pemeriksaan Konfigurasi Database (Bagian B)

Pemeriksaan mendalam terhadap variabel lingkungan di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env) dilakukan tanpa menampilkan kredensial rahasia:

- **Hostname `DATABASE_URL`:** `aws-0-ap-northeast-1.pooler.supabase.com`
- **Port `DATABASE_URL`:** `6543` (PgBouncer Transaction Pooler)
- **Hostname `DIRECT_URL`:** `db.ajajdkhxosmbfyzzabgy.supabase.co`
- **Port `DIRECT_URL`:** `5432` (Direct Session Mode)
- **Status Lokalisasi:** **BUKAN LOKAL (REMOTE SUPABASE STAGING TOKYO)**.
- **Port Server Express:** `PORT=10000` (Fallback default `10000`).

### Evaluasi Guardrail Keselamatan:
Aturan keselamatan secara tegas menyatakan: *"Jangan melanjutkan jika target database tidak dapat dipastikan sebagai lokal."*  
Karena `DATABASE_URL` mengarah ke host Supabase Cloud Staging, inisiasi koneksi `pg.Pool` akan mengirim traffic ke internet menuju staging database. Oleh karena itu, pengujian runtime server ditahan secara fail-closed.

---

## 4. Hasil Pemeriksaan Aman (Bagian C)

1. **Pemeriksaan Dependensi:** Seluruh dependensi pada `server/package.json` terpasang lengkap di `server/node_modules/`.
2. **Kompilasi & Typecheck:**
   - Perintah: `npm run build --prefix server`
   - Hasil Aktual: `Exit Code: 0`
   - Output: `> simsarpras-server@2.1.0 build > tsc`
   - Evaluasi: 100% bebas dari kesalahan tipe data TypeScript dan sintaks.
3. **Pengujian Runtime Server & HTTP:**
   - Status: **DITAHAN (BLOCKED)** sesuai aturan keselamatan.
   - Tidak ada proses server yang dibiarkan menggantung di background.
   - Tidak ada permintaan HTTP yang dikirim ke database Supabase staging.

---

## 5. Rincian Laporan Berdasarkan 8 Poin Mandat (Bagian D)

| No | Poin Pemeriksaan | Status / Hasil Aktual | Bukti Faktual |
|:---:|:---|:---:|:---|
| **1** | **Framework & Entry Point** | **TERVERIFIKASI** | Express.js 4.21.2. Entry point: [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts) (TypeScript) / `server/dist/index.js` (JavaScript). |
| **2** | **Perintah Eksekusi Backend** | **TERIDENTIFIKASI** | `npm run dev --prefix server` (Development / tsx) atau `npm run start --prefix server` (Production). |
| **3** | **Apakah Server Berhasil Start** | **TIDAK DIJALANKAN (BLOCKED)** | Proses server tidak dijalankan demi mencegah koneksi ke host staging luar negeri yang tertera di `server/.env`. |
| **4** | **Alamat & Port Lokal** | **TERKONFIGURASI** | Port `10000` (`http://localhost:10000` / `http://127.0.0.1:10000`). |
| **5** | **HTTP Status & Respons Endpoint** | **BELUM DIUJI (PENDING)** | Endpoint resmi: `GET /api/v1/health` (return 200/503) dan `GET /api/v1/assets/scan` (return 200/404). Belum diuji runtime karena server tidak diizinkan mengontak cloud staging. |
| **6** | **Koneksi Database Lokal** | **BELUM TERHUBUNG (CONFIG MISMATCH)** | Backend membaca `DATABASE_URL` dari `server/.env`. Nilai aktif saat ini menunjuk ke Supabase staging, bukan database lokal `127.0.0.1:5432`. |
| **7** | **Error yang Ditemukan** | **CONFIG BLOCKER DETECTED** | Terdeteksi benturan konfigurasi: `server/.env` menampung kredensial staging, sementara instruksi audit melarang pengubahan `.env` dan melarang pengaksesan staging cloud. |
| **8** | **Status Akhir** | **BLOCKED** | Sesuai batas bukti aktual, sistem menghentikan proses tanpa mengarang respons HTTP atau memalsukan koneksi database lokal. |

---

## 6. Kepatuhan Batas Keselamatan

1. **Supabase Staging:** **NOL KONEKSI & NOL MUTASI**. Target cloud staging terlindungi dari akses runtime HTTP tidak sengaja.
2. **Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12) tetap terkunci.
3. **Integritas Konfigurasi & Berkas:** Tidak ada perubahan pada `.env`, skema, seed, maupun kode sumber.
4. **Preservasi Database Lokal:** Kedua database lokal (`simsarpras_migration_test` dan `simsarpras_idempotency_test`) dipertahankan utuh.
5. **Kerahasiaan Kredensial:** Nol password, secret, atau connection string yang dibocorkan ke laporan.

---

## 7. Rekomendasi Solusi untuk Operator

Agar pengujian runtime HTTP backend dapat dijalankan terhadap database PostgreSQL lokal tanpa melanggar aturan pengubahan `.env`:

1. **Opsi 1 (Konfigurasi Runtime Sementara):** Operator dapat menyuplai variabel lingkungan lokal secara in-line di sesi terminal (misal: `$env:DATABASE_URL="postgresql://postgres:[PASSWORD]@127.0.0.1:5432/simsarpras_migration_test"`), lalu menjalankan `npm run dev --prefix server`.
2. **Opsi 2 (Izin Perubahan `.env`):** Operator memberikan izin eksplisit untuk memperbarui `DATABASE_URL` pada `server/.env` agar mengarah ke database lokal `simsarpras_migration_test`.
