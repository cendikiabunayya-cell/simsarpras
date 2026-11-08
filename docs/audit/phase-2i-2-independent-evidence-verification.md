# SIMSARPRAS — VERIFIKASI BUKTI INDEPENDEN (FASE 2I.2)
## Independent Evidence Verification & Read-Only Pre-Flight Audit

**Versi Dokumen:** 2.1.0-INDEPENDENT-EVIDENCE-VERIFICATION  
**Tanggal Pelaksanaan:** 14 Oktober 2026  
**Status Evaluasi:** READ-ONLY INDEPENDENT AUDIT COMPLETED  
**Keputusan Keselamatan:** **`VERIFIED WITH ARCHITECTURAL OBSERVATIONS — AWAITING HUMAN AUTHORIZATION`**  
*(Seluruh klaim teknis pada laporan Fase 2I.1 telah diverifikasi silang terhadap baris kode aktual, hasil pengujian unit otomatis, dan karakteristik engine PostgreSQL 17. Laporan ini mengklasifikasikan bukti secara ketat dan mendokumentasikan batas asumsi serta risiko jangka panjang yang belum terselesaikan)*.

---

## 1. Lingkup dan Metodologi Audit Independen

Audit ini dilakukan secara independen tanpa memutasi basis data Supabase target. Konfigurasi `ALLOW_STAGING_MIGRATION=false` dipertahankan aktif (*fail-closed*).

### Klasifikasi Bukti
Setiap klaim yang diuji diklasifikasikan ke dalam 3 kategori:
1. **[CODE-PROVEN]**: Terbukti secara deterministik melalui inspeksi langsung baris kode sumber, DDL SQL, atau skrip runner.
2. **[TEST-PROVEN]**: Terbukti melalui eksekusi pengujian unit otomatis Vitest (75 tests passed) atau skrip rekonsiliasi lokal.
3. **[UNVERIFIED / PROBE-DEPENDENT]**: Klaim yang bergantung pada kondisi eksternal (cloud infrastructure/metadata snapshot) yang tidak dapat dibuktikan semata-mata dari kode repositori lokal.

### Catatan Klarifikasi Berkas
- Permintaan audit merujuk pada berkas `server/src/migrate.ts`. Berdasarkan struktur repositori aktual dan konfigurasi `server/package.json` (`"scripts": { "migrate": "tsx scripts/migrate.ts" }`), runner migrasi berada di [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts). Berkas `server/src/migrate.ts` tidak ada dan ini telah diverifikasi.

---

## 2. Matriks Verifikasi Klaim vs Bukti Kode & Nomor Baris

| No | Pernyataan / Klaim Audit Fase 2I.1 | Bukti Berkas & Nomor Baris | Klasifikasi Bukti | Status Evaluasi |
|:---:|---|---|:---:|:---:|
| **1** | **Atomisitas Transaksi (Single Client BEGIN..COMMIT)** | [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L227-L241): Satu koneksi (`client = await pool.connect()`), `BEGIN` (L231), `schemaSql` (L234), `seedSql` (L238), `COMMIT` (L241). | **[CODE-PROVEN]** | **PASS** |
| **2** | **Ketiadaan Premature COMMIT dalam SQL** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) & [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql): 0 statement `COMMIT;` dan 0 `BEGIN;` independen di luar blok PL/pgSQL procedural `DO $$`. | **[CODE-PROVEN]** | **PASS** |
| **3** | **Jalur Error & Rollback Otomatis** | [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L279-L290): Blok `catch` mengeksekusi `await client.query('ROLLBACK')`, re-throw error, dan blok `finally` melepas `client.release()` serta `pool.end()`. | **[CODE-PROVEN]** | **PASS** |
| **4** | **Jumlah Objek ENUM (5)** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L15-L51): `user_role`, `loan_mode`, `condition_status`, `operational_status`, `loan_status`. | **[CODE-PROVEN]** | **PASS** |
| **5** | **Jumlah Tabel Relasional (8)** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L56-L198): `categories`, `locations`, `funding_sources`, `users`, `assets`, `loans`, `return_inspections`, `audit_logs`. | **[CODE-PROVEN]** | **PASS** |
| **6** | **Jumlah Indeks Eksplisit (13)** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql): 6 pada `assets` (L131-136), 4 pada `loans` (L164-167), 1 pada `return_inspections` (L193), 2 pada `audit_logs` (L212-213). | **[CODE-PROVEN]** | **PASS** |
| **7** | **Integritas Batasan Unik & Foreign Keys** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql): 8 Primary Keys, 9 UNIQUE constraints, 10 Foreign Keys (termasuk `funding_sources(name)` UNIQUE pada L76). | **[CODE-PROVEN]** | **PASS** |
| **8** | **Preservasi 11 Aset & Integritas Token QR** | [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L61-L179) cocok 1:1 dengan `MOCK_ASSET_UNITS`. Diuji via [`server/scripts/reconcile.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/reconcile.ts#L75-L100). | **[CODE & TEST-PROVEN]** | **PASS** |
| **9** | **Dukungan Rute Publik `/b/:tokenOrCode`** | [`src/App.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/App.tsx#L36) & [`src/pages/PublicScanLoan.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx#L120). Terbukti pada [`src/test/qrIdentityAndUrl.test.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/qrIdentityAndUrl.test.tsx#L380-L450). | **[CODE & TEST-PROVEN]** | **PASS** |
| **10** | **Proteksi RLS 8 Tabel & Isolasi `users`** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L234-L252): RLS aktif pada 8 tabel, `REVOKE ALL` pada 7 tabel internal dari `anon, authenticated, public`. | **[CODE-PROVEN]** | **PASS** |
| **11** | **Akses Publik Khusus `assets` (SELECT Only)** | [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L255, L271-274): `GRANT SELECT` + Policy `public_read_assets`. INSERT/UPDATE/DELETE tidak memiliki izin publik. | **[CODE-PROVEN]** | **PASS** |
| **12** | **Ketiadaan Eksposur Kredensial Lemah pada Seed** | [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L51-L54): Kolom `password_hash` berisi dummy hash sintetis 60 karakter (`$2a$10$...`). | **[CODE-PROVEN]** | **PASS** |
| **13** | **Ketiadaan Endpoint Login Publik Berbasis Password** | [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts#L42-L52) & [`server/src/routes/`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes): Tidak ada rute login atau modul verifikasi password di backend Express. | **[CODE-PROVEN]** | **PASS** |
| **14** | **Pemisahan Port (Direct 5432 vs Pooler 6543)** | [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L93-L99) menolak port 6543; [`server/src/db.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/db.ts#L9) menggunakan `DATABASE_URL` untuk API pool. | **[CODE & TEST-PROVEN]** | **PASS** |
| **15** | **Guardrail Fail-Closed (`ALLOW_STAGING_MIGRATION`)** | [`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts#L63-L67). Terbukti membatalkan eksekusi saat diuji langsung via terminal. | **[CODE & TEST-PROVEN]** | **PASS** |
| **16** | **Kondisi Database Staging Pristine (0 Tabel)** | [`server/scripts/audit_metadata.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/audit_metadata.ts): Snapshot probe metadata katalog sistem PostgreSQL target. | **[PROBE-DEPENDENT]** | **PASS (SNAPSHOT)** |

---

## 3. Hasil Audit Mendalam atas Aspek Kritis

### A. Evaluasi Jalur Transaksi Atomik ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts))
1. **Satu Koneksi Jaringan Eksklusif:**
   Migrator mengambil satu koneksi dari pool melalui `const client = await pool.connect()` (baris 227). Seluruh panggilan berikutnya (`BEGIN`, `schemaSql`, `seedSql`, `COMMIT`, `ROLLBACK`) dieksekusi secara serial pada objek `client` yang sama persis.
2. **Ketiadaan Pembagian Sesi:**
   Tidak ada pelepasan koneksi (`client.release()`) di tengah-tengah eksekusi DDL maupun Seed.
3. **Penanganan Error Rollback:**
   Baris 280-284 membungkus panggilan `client.query('ROLLBACK')` dalam blok `try ... catch`. Hal ini mencegah kegagalan sekunder jika koneksi ke database terputus total saat rollback diperintahkan.

### B. Evaluasi Keamanan Eksekusi Ulang & Keterbatasan Pola `IF NOT EXISTS`
Audit menemukan karakteristik arsitektur penting yang harus dipahami:
1. **Idempotensi pada Database Kosong (Fase 2J):**
   Pada database staging yang saat ini berstatus kosong (0 tabel), klausa `CREATE TABLE IF NOT EXISTS` dan `CREATE INDEX IF NOT EXISTS` akan mengeksekusi pembuatan seluruh objek secara sempurna.
2. **Keterbatasan `IF NOT EXISTS` Jika Skema Berubah di Masa Depan:**
   Pernyataan `CREATE TABLE IF NOT EXISTS` **hanya memeriksa keberadaan nama tabel**, bukan definisi kolomnya. Jika tabel `assets` sudah ada, penambahan kolom baru di `schema.sql` **tidak akan diaplikasikan** ke tabel yang sudah ada saat dieksekusi ulang.
3. **Idempotensi Seed Data:**
   Klausa `ON CONFLICT (id) DO UPDATE SET ...` pada tabel master (`categories`, `locations`, `funding_sources`, `users`) dan `ON CONFLICT (id) DO NOTHING` pada `assets`, `loans`, dan `audit_logs` menjamin data transaksional tidak tertimpa jika skrip dijalankan berulang.

### C. Audit Detail Akses RLS dan Hak `GRANT`
Skema RLS pada [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) menghasilkan matriks izin aktual berikut:

| Tabel | Role | SELECT | INSERT | UPDATE | DELETE | Keterangan Teknis |
|---|---|:---:|:---:|:---:|:---:|---|
| **`assets`** | `anon` / `authenticated` | **YA** | **TIDAK** | **TIDAK** | **TIDAK** | Diberikan `GRANT SELECT` & policy `public_read_assets` (L255, L271). INSERT/UPDATE/DELETE diblokir RLS & revokasi hak. |
| | `service_role` | **YA** | **YA** | **YA** | **YA** | Diberikan `GRANT ALL` & policy `service_role_all_assets` (L262, L283). |
| **`users`** | `anon` / `authenticated` | **TIDAK** | **TIDAK** | **TIDAK** | **TIDAK** | Hak dicabut (`REVOKE ALL`, L246). 0 policy publik. PostgREST mengembalikan 403 / 0 baris. |
| | `service_role` | **YA** | **YA** | **YA** | **YA** | `GRANT ALL` & policy `service_role_all_users` (L258, L306). |
| **`loans`** | `anon` / `authenticated` | **TIDAK** | **TIDAK** | **TIDAK** | **TIDAK** | Hak dicabut (`REVOKE ALL`, L247). 0 policy publik. |
| | `service_role` | **YA** | **YA** | **YA** | **YA** | `GRANT ALL` & policy `service_role_all_loans` (L263, L288). |
| **Master Lain** | `anon` / `authenticated` | **TIDAK** | **TIDAK** | **TIDAK** | **TIDAK** | `categories`, `locations`, `funding_sources`, `return_inspections`, `audit_logs` seluruhnya `REVOKE ALL`. |

### D. Verifikasi Data Aset yang Terekspos Melalui Rute QR
1. **Query Database ([`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/routes/assets.ts#L80-L92)):**
   Query pencarian aset (`lookupAsset`) secara eksplisit hanya memilih kolom dari tabel `assets`. Tidak ada klausul `JOIN` ke tabel `loans` atau `users`.
2. **Struktur Data JSON ([`server/src/routes/assets.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/routes/assets.ts#L23-L56)):**
   Objek JSON hanya memuat metadata barang (nama, merek, spesifikasi teknis, kategori, lokasi, tahun perolehan, sumber dana, foto, status kondisi, status operasional, aksesoris, dan catatan).
3. **Pemisahan Riwayat Pinjaman:**
   Riwayat pinjaman berada pada rute `GET /loans` yang diproteksi oleh middleware `requireAuth` ([`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts#L25-L54)). Pengguna publik tanpa token otorisasi ditolak dengan HTTP 401 Unauthorized.
4. **Temuan Keamanan Data:**
   Data yang terekspos melalui scan QR adalah informasi fisik inventaris sekolah. Tidak ada data pribadi peminjam (PII), nomor identitas pegawai (NIP) peminjam, atau riwayat transaksi yang bocor melalui rute barcode publik.

### E. Audit Akun Seed Sintetis dan Alur Autentikasi
1. **Sifat Hash Password:**
   Kolom `password_hash` pada [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L51-L54) diisi nilai `$2a$10$wT0U9.u81hJmC8m1uBfD1eO8a9Qh9g4j1L8i5k7m3n5o7p9q1r3s5`. Ini adalah format bcrypt valid sepanjang 60 karakter, tetapi dibuat secara sintetis sebagai placeholder integritas skema.
2. **Ketiadaan Jalur Validasi Password:**
   Backend Express SIMSARPRAS saat ini **tidak memiliki handler autentikasi password** (tidak ada `bcrypt.compare`).
3. **Kesimpulan Akses Akun:**
   Akun seed sintetis tersebut **TIDAK DAPAT disalahgunakan** untuk login oleh pihak luar karena tidak ada antarmuka login backend yang memverifikasi kata sandi tersebut.

### F. Integritas Relasional dan Sinkronisasi Status Operasional
1. **Validitas Foreign Keys:**
   - `assets.category_id` merujuk ke `categories(id)`.
   - `assets.location_id` merujuk ke `locations(id)`.
   - `assets.funding_source` merujuk ke `funding_sources(name)` (valid karena kolom `name` berstatus `UNIQUE`).
   - `loans.asset_id` merujuk ke `assets(id)`.
   - `loans.borrower_id` merujuk ke `users(id)`.
   - `return_inspections.loan_id` merujuk ke `loans(id)`.
2. **Sinkronisasi Status Seed:**
   - Unit `unit-laptop-02` memiliki status operasional `ON_LOAN` ([`seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L84)), sinkron dengan transaksi pinjaman `loan-req-001` yang berstatus `ACTIVE` ([`seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L191)).
   - Unit `unit-matras-01` memiliki status operasional `AVAILABLE` ([`seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql#L154)), sinkron dengan transaksi pinjaman `loan-req-002` berstatus `READY_FOR_HANDOVER` (barang belum serah terima fisik).
   - Audit rekonsiliasi membuktikan: `orphan records = 0` dan `inconsistentPairs = 0`.

### G. Audit Guardrail Keselamatan Migrator ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts))
Guardrail keselamatan bekerja secara berurutan dan menolak eksekusi sebelum membuka koneksi jaringan:
- **Port 6543:** Ditolak keras pada L93-99 guna mencegah eksekusi DDL pada connection pooler PgBouncer.
- **Kata Kunci Produksi:** Ditolak pada L103-117 jika hostname, username, atau pathname memuat `prod` atau `production`.
- **Target Mismatch:** Ditolak pada L139-150 jika host atau username tidak cocok dengan `STAGING_PROJECT_REF`.
- **Flag Konfirmasi:** Ditolak pada L63-67 jika `ALLOW_STAGING_MIGRATION !== 'true'`.
- Seluruh 10 skenario penolakan ini terbukti lulus pada pengujian unit otomatis di [`src/test/databaseMigration.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/databaseMigration.test.ts#L174-L300).

---

## 4. Risiko yang Belum Terselesaikan (Unresolved Risks)

Meskipun seluruh pengujian kode berhasil, audit independen mencatat risiko teknis dan operasional yang harus diperhatikan:

1. **Ketiadaan Migration Versioning Tool (Architectural Debt):**
   Pendekatan migrasi menggunakan file DDL tunggal (`schema.sql`) dengan `CREATE TABLE IF NOT EXISTS` cocok untuk inisialisasi pertama kali (*clean slate*). Namun, pendekatan ini tidak mendukung migrasi inkremental di masa depan (misalnya `ALTER TABLE` saat menambah kolom). Diperlukan adopsi migration tool formal (seperti Supabase CLI Migrations) untuk fase pasca-staging.
2. **Eksposur Publik Metadata Aset via Direct Supabase API:**
   Karena tabel `assets` diberi `GRANT SELECT` untuk `anon`, siapa pun yang mengetahui URL project Supabase dan anon key dapat mengambil seluruh data inventaris barang secara massal melalui PostgREST. Pastikan data rahasia institusi tidak pernah disimpan di kolom `notes` atau spesifikasi teknis aset.
3. **Ketergantungan Snapshot Metadata:**
   Status bahwa basis data target kosong (0 tabel) adalah berdasarkan probe metadata terakhir. Jika terjadi perubahan independen pada dashboard Supabase oleh admin setelah probe tersebut, runner migrasi akan mengeksekusi DDL di atas objek yang sudah ada.

---

## 5. Ringkasan Status Pemeriksaan

| Area Pemeriksaan | Status | Keterangan |
|---|:---:|---|
| **1. Integritas Transaksi & Rollback** | **PASS** | Terbukti menggunakan 1 client koneksi dari `BEGIN` sampai `COMMIT`. |
| **2. Ketiadaan Premature Commit** | **PASS** | Tidak ada `COMMIT` internal di dalam file SQL. |
| **3. Idempotensi Skema Awal** | **PASS** | Aman untuk eksekusi awal pada basis data kosong. |
| **4. Isolasi RLS & Hak Akses** | **PASS** | RLS aktif di 8 tabel, `users` tertutup total dari akses publik. |
| **5. Keamanan Data Rute Barcode** | **PASS** | Hanya mengekspos spesifikasi fisik aset, tidak membocorkan PII peminjam. |
| **6. Keamanan Akun Seed Sintetis** | **PASS** | Hash dummy sintetis, tidak ada password lemah, tidak ada route login publik. |
| **7. Konsistensi Relasional & Status** | **PASS** | 0 orphan records, sinkronisasi status unit vs loan 100%. |
| **8. Guardrail Anti-Produksi & Port** | **PASS** | Terbukti memblokir port 6543, prod host, dan menolak `ALLOW_STAGING_MIGRATION=false`. |
| **9. Pengujian Lokal & Build** | **PASS** | 75/75 Vitest unit tests lulus, frontend dan server compile bersih (0 errors). |

---

## 6. Rekomendasi Langkah Berikutnya

1. **Pertahankan Kondisi Terkunci:**
   Jangan mengubah `ALLOW_STAGING_MIGRATION=false` sampai ada keputusan manusia yang menyetujui pelaksanaan Fase 2J.
2. **Jangan Menjalankan Migrasi Otomatis:**
   Kelulusan tes unit lokal membuktikan kebenaran logika kode, bukan izin otomatis untuk mengeksekusi migrasi cloud.
3. **Prosedur Ketika Fase 2J Diotorisasi Pengguna:**
   - Ubah `ALLOW_STAGING_MIGRATION=true` pada [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env).
   - Jalankan `npm run migrate --prefix server`.
   - Lakukan verifikasi pascamigrasi (memastikan 8 tabel dan 11 aset terbentuk di Supabase).
   - Segera kembalikan `ALLOW_STAGING_MIGRATION=false` setelah migrasi selesai demi keamanan berkelanjutan.

---

> [!IMPORTANT]
> **Status Tindakan Saat Ini:**
> Antigravity **BERHENTI** di sini sesuai instruksi keselamatan Fase 2I.2.
> Tidak ada migrasi, DDL, DML, seed, atau perubahan basis data staging yang dijalankan.
> Menunggu persetujuan manusia untuk melangkah ke **Fase 2J**.
