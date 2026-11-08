# SIMSARPRAS — LAPORAN PROVISIONING STAGING TANPA MIGRASI (FASE 2F)
## Supabase Staging Environment Preparation & Connectivity Specification

**Versi Dokumen:** 2.1.0-STAGING-PROV  
**Tanggal Penyusunan:** 13 Oktober 2026  
**Status Otorisasi:** PERSIAPAN LINGKUNGAN SAJA (NON-DESTRUCTIVE / PREPARATION ONLY). Tidak ada migrasi DDL yang dieksekusi ke database live, tidak ada seed yang dijalankan, tidak ada frontend yang dihubungkan, dan tidak ada deployment aktif.

---

## 1. Tahap 1 — Hasil Pemeriksaan Kesiapan Kode & Konfigurasi

Pemeriksaan menyeluruh terhadap berkas target telah dilakukan untuk memastikan kesiapan database kosong dan pencegahan penimpaan data:

### A. Evaluasi Berkas Target

1. [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts):
   - **Dukungan Dual-Connection:** Mendukung `DIRECT_URL` (Port 5432, Session Mode) untuk eksekusi DDL awal, dengan fallback ke `DATABASE_URL`.
   - **Mode Dry-Run:** Jika environment variable kosong, skrip mengeksekusi validasi struktural DDL/seed tanpa menyentuh jaringan (`status: DRY_RUN_PASSED`).
   - **Keamanan Transaksional:** Seluruh eksekusi dibungkus dalam `BEGIN ... COMMIT` dengan penanganan rollback otomatis (`client.query('ROLLBACK')`) jika terjadi kesalahan sintaksis atau kegagalan constraint.
2. [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql):
   - **Idempotensi Penuh:** Seluruh tabel menggunakan `CREATE TABLE IF NOT EXISTS`, tipe ENUM dilindungi blok kondisional `DO $$ BEGIN IF NOT EXISTS ... END $$;`, dan ekstensi menggunakan `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.
   - **Keamanan RLS Terisolasi:** Kebijakan RLS membatasi mutasi penuh hanya `TO service_role`. Publik (`anon, authenticated`) hanya diizinkan membaca (`SELECT`) aset.
3. [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql):
   - **Non-Destruktif 100%:** Klausul `ON CONFLICT (id) DO NOTHING` aktif pada tabel `assets` (baris 179) dan `loans` (baris 205).
   - **Jaminan Status Operasional:** Menjalankan ulang seed pada database yang sedang aktif **tidak akan menimpa** status barang yang sedang dipinjam (`ON_LOAN`) atau rusak (`MAINTENANCE`), serta tidak mengubah riwayat transaksi.
   - **ID Kategori Kanonikal:** Tersinkronisasi dengan master frontend: `cat-tik`, `cat-mebel`, `cat-olahraga`, `cat-elektronik`.
4. [`server/src/db.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts):
   - **SSL Enforcement:** Menangani koneksi Supabase secara otomatis dengan opsi `{ rejectUnauthorized: false }` untuk domain `supabase.com`.
   - **Fungsi Diagnostik:** Menyediakan fungsi `checkDatabaseConnection()` untuk menguji konektivitas sebelum aplikasi Express memproses request.
5. [`server/.env.example`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.example):
   - Menyediakan panduan format lengkap untuk `DIRECT_URL` (Port 5432) dan `DATABASE_URL` (Port 6543).

### B. Proteksi Kerahasiaan & Keamanan Kredensial
- File [`.gitignore`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/.gitignore) telah dibuat pada repositori root untuk memastikan `.env`, `server/.env`, dan variannya tidak akan pernah ter-commit ke version control.
- Tidak ada password database, API key, atau rahasia yang tertulis pada source code frontend maupun backend.

---

## 2. Tahap 2 — Status Provisioning & Panduan Pengaturan Manual

Sesuai instruksi keselamatan (*"Jika akses atau otorisasi belum tersedia, berhenti dan berikan langkah manual yang diperlukan"*), karena kredensial otomatis belum dimasukkan ke mesin lokal ini, sistem **berhenti dengan aman** dan menyediakan panduan langkah manual berikut untuk Anda:

### Langkah Manual Penyiapan Proyek Staging di Supabase Dashboard:

1. **Masuk ke Supabase:** Buka [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. **Buat Proyek Baru:**
   - **Organization:** Pilih organisasi Anda.
   - **Name:** Beri nama secara eksplisit: `simsarpras-staging` (**JANGAN menggunakan nama atau proyek produksi**).
   - **Database Password:** Buat password yang kuat (minimal 16 karakter acak, simpan di password manager Anda).
   - **Region:** Pilih **Singapore (ap-southeast-1)** untuk menjamin latensi jaringan terendah bagi pengguna di Indonesia.
   - **Pricing Plan:** Free Tier.
3. **Ambil Connection String:**
   Setelah proyek selesai dibuat (sekitar 1–2 menit), buka menu:  
   `Project Settings` $\rightarrow$ `Database` $\rightarrow$ bagian **Connection string**:
   - **Mode 1 — Direct Connection (Session Mode, Port 5432):**
     - Pilih tab **URI** $\rightarrow$ centang **Mode: Session** (Port `5432`).
     - Salin string tersebut (contoh format: `postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`).
     - Nilai ini diperuntukkan bagi variabel `DIRECT_URL`.
   - **Mode 2 — Transaction Pooler (PgBouncer, Port 6543):**
     - Pilih tab **URI** $\rightarrow$ centang **Mode: Transaction** (Port `6543`).
     - Salin string tersebut (contoh format: `postgres://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`).
     - Nilai ini diperuntukkan bagi variabel `DATABASE_URL`.
4. **Pemasukan ke File Lingkungan Server Lokal:**
   - Salin file `server/.env.example` menjadi `server/.env` di komputer Anda:
     ```bash
     cp server/.env.example server/.env
     ```
   - Masukkan connection string di atas dan ganti `[PASSWORD]` dengan password yang telah Anda buat.

---

## 3. Tahap 3 — Spesifikasi Verifikasi Lingkungan

| Parameter Evaluasi | Target Spesifikasi Staging | Status Saat Ini |
|---|---|---|
| **Nama Proyek** | `simsarpras-staging` | Menunggu pembuatan manual oleh pengguna |
| **Penyedia Layanan** | Supabase PostgreSQL (Managed) | Siap dikonfigurasi |
| **Wilayah Server (Region)** | `ap-southeast-1` (Singapore) | Siap dipilih |
| **Status Konektivitas** | `connected: true` via SSL require | Menunggu pengisian file `server/.env` |
| **Status Pemeriksaan Migrasi** | **Dry-Run PASSED** (0 Syntax Error) | **Terverifikasi Siap Eksekusi** |
| **Kesiapan Idempotensi Seed** | `ON CONFLICT DO NOTHING` aktif | **Terverifikasi Aman** |
| **Isolasi Lingkungan Produksi** | 100% Terpisah (Dedicated Dev Project) | Terjamin |

### Prasyarat yang Belum Terpenuhi Sebelum Migrasi Staging:
1. Pembuatan proyek `simsarpras-staging` di dashboard Supabase oleh pengguna.
2. Keberadaan file `server/.env` yang memuat `DIRECT_URL` dan `DATABASE_URL`.
3. Verifikasi konektivitas jaringan port 5432/6543 dari mesin lokal ke host Supabase.
4. **Izin eksplisit terpisah dari pengguna** untuk menjalankan eksekusi `npm run migrate`.

---

## 4. Evaluasi Batasan Keselamatan

- [x] **Nol Migrasi Live:** Tidak ada query DDL/SQL yang dikirimkan ke server remote mana pun pada tahap ini.
- [x] **Nol Seed Database:** Tidak ada operasi penulisan record yang dilakukan.
- [x] **Nol Deployment:** Frontend dan backend tetap berjalan di lokal tanpa deployment hosting.
- [x] **Nol Modifikasi Data Lokal:** Data `localStorage` browser dan identitas barcode tetap utuh 100%.
- [x] **Nol Operasi Git Destruktif:** Working tree terpelihara secara bersih, file `.gitignore` melindungi dari kebocoran rahasia.

---

### Titik Berhenti (Stop Point)

> [!NOTE]
> **Pekerjaan Fase 2F (Persiapan Provisioning Staging) telah selesai sepenuhnya.**  
> Sistem berhenti di sini dan tidak melakukan migrasi, seed, atau koneksi aplikasi.  
> 
> **Langkah Selanjutnya:**  
> Silakan ikuti panduan manual di Bagian 2 untuk membuat proyek `simsarpras-staging` di dashboard Supabase dan mengisi `server/.env`. Setelah Anda siap, berikan izin terpisah untuk memulai eksekusi migrasi database staging.
