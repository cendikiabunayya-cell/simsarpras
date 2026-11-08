# SIMSARPRAS — LAPORAN PRA-KONEKTIVITAS STAGING (FASE 2H)
## Staging Connectivity & Environment Configuration Preflight

**Versi Dokumen:** 2.1.0-CONNECTIVITY-PREFLIGHT-REV1  
**Tanggal Pelaksanaan:** 14 Oktober 2026  
**Status Evaluasi:** PREFLIGHT & PROBE COMPLETED (Tanpa migrasi, tanpa seed, tanpa eksekusi SQL)  
**Rekomendasi Akhir:** **`BLOCKED (AWAITING REAL STAGING CREDENTIALS)`**  
*(Skrip probe terisolasi telah selesai diimplementasikan dan guardrail migrasi terbukti 100% aktif. Status konektivitas live BLOCKED karena kredensial pada `server/.env` masih berupa string placeholder)*

---

## 1. Matriks Status Evaluasi Preflight

| No | Parameter Pemeriksaan Preflight | Status | Klasifikasi Hasil | Bukti Empiris & Lokasi Kode |
|:---|:---|:---:|:---:|:---|
| 1 | **Status Konfigurasi Lingkungan (`server/.env`)** | **BLOCKED** | Placeholder Detected | File terdeteksi, namun `STAGING_PROJECT_REF`, `DIRECT_URL`, dan `DATABASE_URL` masih memuat string template placeholder. |
| 2 | **Status Probe Konektivitas Staging** | **BLOCKED** | Non-Destructive Halt | Skrip [`server/scripts/probe.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/probe.ts) mengklasifikasikan kegagalan sebagai `CONFIG_PLACEHOLDER` tanpa membuka socket TCP. |
| 3 | **Jenis Endpoint & Port yang Diuji** | **BLOCKED** | Sanitized Target | • `DIRECT_SESSION_PORT_5432` $\rightarrow$ Target: `[PLACEHOLDER_NOT_CONFIGURED]`, Port: `5432`<br>• `TRANSACTION_POOLER_PORT_6543` $\rightarrow$ Target: `[PLACEHOLDER_NOT_CONFIGURED]`, Port: `6543` |
| 4 | **Bukti Nol Mutasi Database** | **PASS** | Read-Only Guarantee | `server/scripts/probe.ts` terisolasi 100% dari migrator dan hanya dirancang mengeksekusi `SELECT 1` saat host valid tersedia. |
| 5 | **Error Tersanitasi** | **PASS** | Sanitized Error | `"Nilai URL masih berupa string placeholder template dan belum diisi kredensial riil."` |
| 6 | **Status Guardrail Migrasi** | **PASS** | Fail-Closed Active | `APP_ENV=staging`, `ALLOW_STAGING_MIGRATION=false`. Migrasi live ditolak keras dengan abort kode 1. |
| 7 | **Integritas Data Lokal & Barcode** | **PASS** | Preserved 100% | Seluruh data mock, `localStorage`, `qrToken`, dan routing publik `/b/:tokenOrCode` tetap utuh. |

---

## 2. Implementasi Probe Terisolasi ([`server/scripts/probe.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/probe.ts))

Sesuai instruksi audit ("*Periksa kode migrator untuk memastikan probe dapat dijalankan tanpa memanggil fungsi migrasi*"), sebuah skrip probe terisolasi telah diimplementasikan secara terpisah dari runner migrasi:

### Karakteristik Desain Probe:
1. **Terpisah dari Runner Migrasi:** Dijalankan melalui `npm run probe --prefix server` tanpa memanggil `runMigration()`.
2. **Jaminan Read-Only:** Ketika host valid tersedia, probe hanya menjalankan query metadata:
   ```sql
   SELECT 1 as probe_check, NOW() as server_time, current_database() as db_name, version() as pg_version;
   ```
3. **Pencegahan Koneksi ke Host Placeholder:** Jika nilai URL masih berupa placeholder atau bukan URI standar, probe berhenti sebelum memanggil `new Pool()` dan tidak membuka soket jaringan fisik.
4. **Klasifikasi Penyebab Error:** Mengklasifikasikan kegagalan ke dalam kategori diagnostik:
   - `CONFIG_PLACEHOLDER` (Nilai belum diisi kredensial nyata)
   - `INVALID_URI` (Format URL tidak valid)
   - `PRODUCTION_DETECTED` (Target memuat kata kunci produksi)
   - `ENDPOINT_MISMATCH` (Project Ref tidak cocok)
   - `DNS_RESOLUTION_FAILURE` (Gagal resolusi nama domain)
   - `NETWORK_ACCESS_FAILURE` (Koneksi timeout/firewall)
   - `TLS_HANDSHAKE_FAILURE` (Gagal sertifikat SSL)
   - `AUTHENTICATION_FAILURE` (Password salah)

---

## 3. Bukti Empiris Eksekusi Terminal

### A. Hasil Uji Probe Konektivitas (`npm run probe --prefix server`)

```text
=====================================================
 SIMSARPRAS - STAGING CONNECTIVITY PROBE (FASE 2H)
=====================================================
Timestamp:        2026-10-14T02:15:27.226Z
Config Status:    BLOCKED
Overall Status:   BLOCKED
-----------------------------------------------------
[1] DIRECT_URL Probe (Port 5432 / DDL Session Mode):
    Status:       BLOCKED
    Target:       [PLACEHOLDER_NOT_CONFIGURED]
    Kategori:     CONFIG_PLACEHOLDER
    Detail:       Nilai URL masih berupa string placeholder template dan belum diisi kredensial riil.
-----------------------------------------------------
[2] DATABASE_URL Probe (Port 6543 / API Pooler Mode):
    Status:       BLOCKED
    Target:       [PLACEHOLDER_NOT_CONFIGURED]
    Kategori:     CONFIG_PLACEHOLDER
    Detail:       Nilai URL masih berupa string placeholder template dan belum diisi kredensial riil.
-----------------------------------------------------
[3] Guardrail Keselamatan Migrasi:
    APP_ENV:                  staging
    ALLOW_STAGING_MIGRATION:  false
    Migrasi Dicegah Guardrail: YA (AMAN)
=====================================================
```

---

### B. Hasil Uji Penolakan Runner Migrasi (`npm run migrate --prefix server`)

```text
=====================================================
 SIMSARPRAS - DATABASE MIGRATION RUNNER (FASE 2G-2)
=====================================================

[1/5] Mengaudit data sumber (Mock / Pre-migration state)...
- Total Aset: 11
- Total Kategori: 4
- Total Lokasi: 7
- Token Unik Terverifikasi: 11 (Duplikat: 0)
- Status Audit: PASSED

[2/5] Memverifikasi identitas target lingkungan (Guardrail Keselamatan)...

❌ EKSEKUSI MIGRASI DITOLAK DEMI KESELAMATAN SISTEM:
   Alasan: Konfirmasi migrasi tidak ditemukan. Wajib menyetel ALLOW_STAGING_MIGRATION='true'.
Error: Migration Guardrail Abort: Konfirmasi migrasi tidak ditemukan. Wajib menyetel ALLOW_STAGING_MIGRATION='true'.
```

---

## 4. Langkah Selanjutnya untuk Pengguna (Membuka Blokir)

Untuk menyelesaikan probe konektivitas staging secara nyata:

1. Buka file [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env).
2. Ganti nilai placeholder template dengan nilai nyata dari dashboard Supabase:
   - `STAGING_PROJECT_REF`: Masukkan Reference ID proyek staging Supabase Anda.
   - `DIRECT_URL`: Masukkan Connection String URI **Mode Session** (Port `5432`).
   - `DATABASE_URL`: Masukkan Connection String URI **Mode Transaction** (Port `6543`).
3. **Pertahankan `ALLOW_STAGING_MIGRATION=false`** (Jangan diubah menjadi `true`).
4. Beritahu agen setelah file disimpan, agar sistem dapat menjalankan `npm run probe` untuk memverifikasi handshake jaringan secara nyata.

---

## 5. Rekomendasi Akhir

### Status: **`BLOCKED (AWAITING REAL STAGING CREDENTIALS)`**

### Alasan:
Infrastruktur audit dan skrip probe read-only telah siap dan terverifikasi secara lokal. Namun status keseluruhan tetap **BLOCKED** karena nilai konfigurasi di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env) masih berupa template placeholder, sehingga konektivitas fisik ke server Supabase belum dapat dibuktikan.

*Keberhasilan probe nantinya bukan merupakan persetujuan migrasi. Migrasi tetap membutuhkan persetujuan terpisah.*
