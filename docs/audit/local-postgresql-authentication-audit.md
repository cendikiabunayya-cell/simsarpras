# SIMSARPRAS — AUDIT & PANDUAN AUTENTIKASI POSTGRESQL LOKAL
## Local PostgreSQL Authentication Investigation & Remediation Guide

**Versi Dokumen:** 2.1.0-LOCAL-AUTH-AUDIT  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi:** **BLOCKED (MENUNGGU PENGISIAN KATA SANDI LOKAL DI server/.env.local OLEH OPERATOR)**  
**Target Basis Data:** `simsarpras_migration_test` @ `127.0.0.1:5432`  
**Metode Autentikasi Server:** `scram-sha-256` (Dikonfirmasi dari `pg_hba.conf`)  
**Status Staging Supabase:** **DISCONNECTED & ISOLATED (Nol Akses)**  
**Safety Flag:** `ALLOW_STAGING_MIGRATION=false` pada [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12)  

---

## 1. Ringkasan Investigasi & Temuan Faktual

Pemeriksaan forensik terhadap kegagalan autentikasi `password authentication failed for user "postgres"` menghasilkan temuan berikut:

1. **Engine PostgreSQL Lokal Aktif:** Server PostgreSQL 17 aktif mendengarkan koneksi pada port `5432` (PID: 27008).
2. **Metode Autentikasi:** Berkas konfigurasi `C:\Program Files\PostgreSQL\17\data\pg_hba.conf` menerapkan metode **`scram-sha-256`** untuk seluruh koneksi loopback (`127.0.0.1/32` dan `::1/128`).
3. **Akun Pengguna Resmi:** Operator telah berhasil terhubung dan mengeksekusi perintah menggunakan akun pengguna superuser **`postgres`**.
4. **Penyebab Utama Error HTTP 503:**
   Pada file [`server/.env.local`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local#L10), variabel `DATABASE_URL` masih menggunakan placeholder teks mentah:
   ```env
   DATABASE_URL="postgresql://postgres:[LOCAL_PASSWORD]@127.0.0.1:5432/simsarpras_migration_test"
   ```
   Driver Node-Postgres (`pg`) mengirimkan string literal `[LOCAL_PASSWORD]` ke server PostgreSQL lokal. Server menolak string tersebut karena tidak cocok dengan hash SCRAM-SHA-256 yang tersimpan di katalog `pg_authid`.

---

## 2. Pemeriksaan Lingkungan & Bukti Faktual

| Parameter Pemeriksaan | Metode / Sumber Bukti | Hasil Faktual | Status |
|:---|:---|:---|:---:|
| **Port 5432 Lokal** | `Get-NetTCPConnection -LocalPort 5432` | Aktif (State: `Listen`, PID: `27008`, `postgres.exe`) | **PASS** |
| **Metode Autentikasi** | `pg_hba.conf` baris 114-118 | `host all all 127.0.0.1/32 scram-sha-256`<br>`host all all ::1/128 scram-sha-256` | **PASS** |
| **Katalog Database** | `SELECT datname FROM pg_database` (Turn 2J.4C) | Database `simsarpras_migration_test` ada dan aktif | **PASS** |
| **Kesiapan Tabel `assets`** | Audit Fase 2J.4B | 11 unit aset terisi lengkap dengan token QR permanen | **PASS** |
| **Konfigurasi Lokal Backend** | [`server/.env.local`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local) | Target: `127.0.0.1:5432/simsarpras_migration_test` (Bebas dari Supabase) | **PASS** |
| **Status Password di .env.local** | Pembacaan [`server/.env.local:L10`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local#L10) | Masih memuat placeholder `[LOCAL_PASSWORD]` | **BLOCKED** |

---

## 3. Prosedur Verifikasi Mandiri oleh Operator (Strict Privacy)

Sesuai Aturan Keselamatan #4: *"Jangan mencetak atau meminta password ditampilkan di terminal maupun laporan"*, operator dipersilakan melakukan verifikasi dan pengisian kata sandi secara pribadi tanpa membagikan nilainya ke AI assistant.

### Langkah 1: Uji Akses Read-Only ke Database Lokal
Buka terminal PowerShell Anda dan jalankan perintah uji verifikasi berikut:
```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' `
  -h 127.0.0.1 -p 5432 -U postgres `
  -W -d simsarpras_migration_test `
  -c "SELECT current_database(), count(*) AS total_assets FROM assets;"
```
- Masukkan kata sandi akun `postgres` lokal Anda saat muncul prompt `Password: `.
- Jika berhasil, terminal akan menampilkan:
  ```
       current_database      | total_assets 
  ---------------------------+--------------
   simsarpras_migration_test |           11
  (1 row)
  ```
  Ini membuktikan bahwa kata sandi Anda benar dan tabel aset siap dibaca oleh aplikasi.

### Langkah 2: Perbarui Berkas [`server/.env.local`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local)
1. Buka berkas [`server/.env.local`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local) yang sudah terbuka di IDE Anda.
2. Pada baris ke-10, ganti `[LOCAL_PASSWORD]` dengan kata sandi superuser `postgres` lokal Anda:
   ```env
   DATABASE_URL="postgresql://postgres:<PASSWORD_LOKAL_ANDA>@127.0.0.1:5432/simsarpras_migration_test"
   ```
   *(Catatan: Jika kata sandi Anda memuat karakter khusus seperti `@`, `#`, `:`, `%`, pastikan di-encode URL, misal `@` menjadi `%40`, `#` menjadi `%23`)*.
3. Simpan berkas (`Ctrl + S`). File ini telah diabaikan oleh Git ([`.gitignore:L18`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/.gitignore#L18)) sehingga tidak akan pernah ter-commit.

---

## 4. Rencana Verifikasi Pasca-Pengisian oleh Operator

Setelah berkas [`server/.env.local`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env.local) disimpan dengan kata sandi yang benar:

1. Jalankan backend Express:
   ```powershell
   npm run start --prefix server
   ```
2. Jalankan pengujian endpoint health check di terminal terpisah:
   ```powershell
   curl.exe -i http://localhost:10000/api/v1/health
   ```
3. Kriteria Keberhasilan Faktual:
   - Status HTTP: **`200 OK`** (bukan 503).
   - Payload JSON:
     ```json
     {
       "status": "OK",
       "service": "SIMSARPRAS Express API",
       "version": "2.1.0",
       "database": {
         "connected": true,
         "message": "Terhubung ke PostgreSQL pada [TIMESTAMP]"
       }
     }
     ```

---

## 5. Kepatuhan Batas Keselamatan

1. **Kode Aplikasi:** Tidak diubah.
2. **Konfigurasi Staging:** File [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12) tidak diubah (`ALLOW_STAGING_MIGRATION=false` terkunci).
3. **Kerahasiaan Kredensial:** Nol password atau connection secret yang dicetak ke terminal atau dokumen audit.
4. **Preservasi Database:** Database `simsarpras_migration_test` dan `simsarpras_idempotency_test` dipertahankan utuh.
5. **Koneksi Staging:** Tidak ada koneksi yang dibuka ke Supabase Cloud Tokyo.
