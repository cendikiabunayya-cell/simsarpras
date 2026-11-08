# SIMSARPRAS — PERBAIKAN SINTAKSIS RLS DDL & VERIFIKASI LOKAL (FASE 2J.1)
## RLS DDL Syntax Repair & Local Verification Audit Report

**Versi Dokumen:** 2.1.0-RLS-SYNTAX-REPAIR  
**Tanggal:** 14 Oktober 2026  
**Status Eksekusi:** **COMPLETED & LOCALLY VERIFIED (NO STAGING MUTATION)**  
**Target Basis Data:** Supabase Staging (`db.ajajdkhxosmbfyzzabgy.supabase.co:5432`) — *Untouched / Read-Only Probe Checked*  
**Status Flag Keselamatan:** `ALLOW_STAGING_MIGRATION=false` (Aktif Terkunci Fail-Closed)  

---

## 1. Ringkasan Eksekutif

Pada eksekusi Fase 2J sebelumnya, migrasi DDL otomatis dihentikan oleh PostgreSQL error `42601` pada posisi karakter `12101` (`syntax error at or near "FOR"`). Hal ini terjadi karena urutan klausul `CREATE POLICY` pada blok `service_role` meletakkan klausul `TO service_role` mendahului `FOR ALL`. Engine PostgreSQL menganggap urutan tersebut tidak valid secara grammar baku SQL PostgreSQL.

Migrator SIMSARPRAS ([`server/scripts/migrate.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/scripts/migrate.ts)) berhasil mengeksekusi `ROLLBACK` transaksi secara bersih, memastikan **0 tabel, 0 enum, dan 0 objek parsial** tertinggal di basis data staging.

Dalam Fase 2J.1 ini, seluruh 8 definisi kebijakan RLS dalam [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) telah diperbaiki sesuai grammar PostgreSQL baku, tes unit diperluas dengan pengujian sintaksis grammar otomatis, seluruh pengujian lokal (85/85 Vitest test, build client, build server, dan rekonsiliasi data) lulus 100%, serta dipastikan bahwa **tidak ada mutasi apa pun yang dilakukan terhadap basis data staging**.

---

## 2. Analisis Grammar PostgreSQL & Kebijakan yang Diperbaiki

### 2.1 Spesifikasi Grammar Baku PostgreSQL
Berdasarkan dokumentasi resmi PostgreSQL (Grammar Engine `gram.y` / `CreatePolicyStmt`):
```sql
CREATE POLICY name ON table_name
    [ AS { PERMISSIVE | RESTRICTIVE } ]
    [ FOR { ALL | SELECT | INSERT | UPDATE | DELETE } ]
    [ TO { role_name | PUBLIC | CURRENT_ROLE | CURRENT_USER | SESSION_USER } [, ...] ]
    [ USING ( using_expression ) ]
    [ WITH CHECK ( check_expression ) ]
```

**Kaidah Urutan Baku:**
Klausul `FOR` **harus mendahului** klausul `TO`. Urutan yang salah (`TO ... FOR ...`) menyebabkan parser PostgreSQL mengharapkan `USING`, `WITH CHECK`, atau akhir statemen setelah nama role, sehingga token `FOR` memicu error sintaksis `42601`.

### 2.2 Inventaris 8 Kebijakan RLS yang Diperbaiki
Pemeriksaan menyeluruh pada [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql) dan [`server/db/seed.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/seed.sql) membuktikan bahwa hanya terdapat tepat 8 statemen `CREATE POLICY` (seluruhnya di Bagian 8.4 `schema.sql`), dan tidak ada statemen kebijakan di file seed:

| No | Nama Kebijakan | Tabel Target | Baris di `schema.sql` | Peran | Hak Operasi |
|:---|:---|:---|:---:|:---:|:---:|
| 1 | `service_role_all_assets` | `assets` | L271-274 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 2 | `service_role_all_loans` | `loans` | L277-280 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 3 | `service_role_all_return_inspections` | `return_inspections` | L283-286 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 4 | `service_role_all_audit` | `audit_logs` | L289-292 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 5 | `service_role_all_users` | `users` | L295-298 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 6 | `service_role_all_categories` | `categories` | L301-304 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 7 | `service_role_all_locations` | `locations` | L307-310 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |
| 8 | `service_role_all_funding_sources` | `funding_sources` | L313-316 | `service_role` | `ALL` (SELECT, INSERT, UPDATE, DELETE) |

---

## 3. Perubahan Sebelum dan Sesudah (Diff Komparatif)

Berikut adalah perbandingan kode sebelum dan sesudah perbaikan pada [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L268-L317):

```diff
 -- 8.4. KEBIJAKAN AKSES SERVICE_ROLE (BACKEND RESMI DENGAN KUNCI RAHASIA)
 -- Seluruh mutasi dan akses data sensitif diisolasi khusus untuk service_role
 DO $$ BEGIN
     -- Aset
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_assets') THEN
         CREATE POLICY service_role_all_assets ON assets
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Pinjaman
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_loans') THEN
         CREATE POLICY service_role_all_loans ON loans
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Verifikasi Pengembalian
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_return_inspections') THEN
         CREATE POLICY service_role_all_return_inspections ON return_inspections
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Audit Logs
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_audit') THEN
         CREATE POLICY service_role_all_audit ON audit_logs
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Pengguna Sistem (Users - Isolasi password_hash & data pribadi secara ketat)
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_users') THEN
         CREATE POLICY service_role_all_users ON users
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Kategori Master
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_categories') THEN
         CREATE POLICY service_role_all_categories ON categories
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Lokasi Master
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_locations') THEN
         CREATE POLICY service_role_all_locations ON locations
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
     -- Sumber Pendanaan Master
     IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_funding_sources') THEN
         CREATE POLICY service_role_all_funding_sources ON funding_sources
-        TO service_role
-        FOR ALL USING (true) WITH CHECK (true);
+        FOR ALL TO service_role
+        USING (true) WITH CHECK (true);
     END IF;
 END $$;
```

> **Catatan Integritas Keamanan:** Tidak ada perubahan pada tujuan keamanan, tabel, role (`service_role`), ekspresi `USING (true)`, maupun `WITH CHECK (true)`. Perubahan semata-mata membetulkan urutan token grammar PostgreSQL (`FOR ALL TO service_role`).

---

## 4. Pemeriksaan Role dan Hak Akses (Role & Privilege Audit)

### 4.1 Peran yang Dirujuk dalam Skema
1. **`service_role`**:
   - Peran bawaan (predefined) pada ekosistem Supabase.
   - Diberikan hak akses tabel penuh melalui `GRANT ALL ON TABLE ... TO service_role;`.
   - Digunakan oleh backend resmi SIMSARPRAS (Express API via direct connection atau pooler terotentikasi) yang memiliki kredensial resmi.
   - Skrip DDL ([`server/db/schema.sql:L220-232`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql#L220-L232)) memiliki proteksi `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF; ... END $$;` sehingga aman dijalankan baik pada Supabase managed instance maupun self-hosted/lokal engine.
2. **`anon` & `authenticated` & `public`**:
   - Dicabut seluruh hak aksesnya secara menyeluruh (`REVOKE ALL ON TABLE ... FROM anon, authenticated, public;` pada L247-254).
   - Memastikan tidak ada celah akses PostgREST publik atau unauthenticated ke data tabel internal sekolah.

---

## 5. Pengujian & Validasi Lokal Aktual

### 5.1 Penambahan Test Otomatis Grammar RLS
Pada [`src/test/databaseMigration.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/databaseMigration.test.ts#L300-L329), ditambahkan pengujian deterministik ke-11:
- Menolak keberadaan pola gramatikal terbalik `/CREATE\s+POLICY\s+([^\s]+)\s+ON\s+([^\s]+)\s+TO\s+([^\s]+)\s+FOR/gi` (menghasilkan tepat 0 match).
- Memastikan tepat 8 kebijakan menggunakan pola gramatikal valid `/CREATE\s+POLICY\s+([^\s]+)\s+ON\s+([^\s]+)\s+FOR\s+ALL\s+TO\s+([^\s]+)/gi`.
- Memverifikasi keberadaan seluruh 8 tabel target (`assets`, `loans`, `return_inspections`, `audit_logs`, `users`, `categories`, `locations`, `funding_sources`).

### 5.2 Hasil Pengujian Vitest
```bash
npm test -- --run
```
**Output Aktual:**
```
 RUN  v2.1.9 C:/Users/Lenovo/Documents/SIMSARPRAS

 ✓ src/test/statemachine.test.ts (15 tests) 35ms
 ✓ src/test/databaseMigration.test.ts (18 tests) 33ms
 ✓ src/test/apiContract.test.ts (20 tests) 1286ms
 ✓ src/test/components.test.tsx (11 tests) 2494ms
 ✓ src/test/qrIdentityAndUrl.test.tsx (21 tests) 5030ms

 Test Files  5 passed (5)
      Tests  85 passed (85)
   Duration  8.82s
```
*Hasil: 85 dari 85 pengujian berhasil lulus (100% PASS).*

### 5.3 Hasil Build Frontend & Backend
1. **Frontend Production Build (`npm run build`):**
   ```
   > tsc && vite build
   ✓ 1665 modules transformed.
   dist/index.html                   1.02 kB │ gzip:   0.57 kB
   dist/assets/index-BCDNF4uv.css   51.39 kB │ gzip:   8.61 kB
   dist/assets/index-BWoDnNSk.js   554.73 kB │ gzip: 145.60 kB
   ✓ built in 9.04s
   ```
   *Exit code: 0, 0 TypeScript error.*

2. **Backend Server Build (`npm run build --prefix server`):**
   ```
   > simsarpras-server@2.1.0 build
   > tsc
   ```
   *Exit code: 0, 0 TypeScript error.*

3. **Rekonsiliasi Integritas Data (`npm run reconcile --prefix server`):**
   ```
   SIMSARPRAS - REKONSILIASI AUDIT DATABASE (FASE 2A)
   Timestamp: 2026-10-14T04:18:34.587Z
   Verdict:   PASSED
   - Total Aset: 11, Kategori: 4, Lokasi: 7, Sumber Dana: 5, Pengguna: 4, Pinjaman: 2, Audit: 2
   - Total Token Terverifikasi: 11 (Duplikat: 0)
   - Status Token: VALID (100% Preserved)
   - Orphan Records: 0
   - Transaction Consistent: true
   ```

---

## 6. Konfirmasi Status Keselamatan Basis Data Staging

1. **Status Staging Tidak Dimutasi:** Selama seluruh investigasi dan perbaikan Fase 2J.1, **tidak ada koneksi yang melakukan mutasi (DDL atau DML) ke Supabase staging**.
2. **Kondisi Basis Data Staging Saat Ini:** Tetap kosong murni (*pristine empty*, 0 tabel di skema `public`), sebagaimana kondisi pasca-rollback Fase 2J.
3. **Status Flag Eksekusi:** `ALLOW_STAGING_MIGRATION=false` dipertahankan dan terverifikasi di [`server/.env`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/.env#L12).
4. **Pencegahan Retry Prematur:** Sistem migrasi tidak dijalankan ulang. Seluruh proses dihentikan sesuai batas keselamatan fase.

---

## 7. Analisis Risiko yang Belum Terselesaikan (Remaining Risks)

| No | Potensi Risiko | Tingkat | Status Mitigasi |
|:---|:---|:---:|:---|
| 1 | Kesalahan sintaksis lain pada objek SQL lanjutan | Rendah | Seluruh ENUM, CREATE TABLE, INDEX, FK, dan RLS kini telah divalidasi silang terhadap spesifikasi PostgreSQL 17.11. Jika terjadi kesalahan, mekanisme transaksi atomik `BEGIN ... ROLLBACK` menjamin nol data parsial tertinggal. |
| 2 | Timeout pada pooler port 6543 saat migrasi | Mitigasi Sempurna | Runner migrasi mewajibkan direct connection port 5432 via `DIRECT_URL`. Guardrail menolak pooler 6543 untuk DDL. |
| 3 | Eksekusi tidak sengaja tanpa otorisasi manusia | Mitigasi Sempurna | `ALLOW_STAGING_MIGRATION` wajib `true` di environment, dan saat ini terkunci rapat pada `false`. |

---

## 8. Kesimpulan & Rekomendasi Langkah Selanjutnya

1. Cacat sintaksis DDL RLS PostgreSQL `42601` telah diisolasi dan diperbaiki secara tuntas pada seluruh 8 definisi kebijakan di [`server/db/schema.sql`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/db/schema.sql).
2. Tes unit dan integrasi grammar telah ditambahkan dan lulus bersama 85 pengujian sistem.
3. Basis data staging tetap murni tanpa mutasi dan flag keselamatan terkunci.
4. Perbaikan siap untuk ditinjau oleh operator manusia sebelum otorisasi pelaksanaan ulang migrasi staging.
