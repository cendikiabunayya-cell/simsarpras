# CHECKPOINT RESMI — FASE 2D TAHAP 4
## Frontend UI Routing untuk Barcode Publik

**Waktu Eksekusi:** 2026-10-13  
**Status Otorisasi:** Tahap 4 Selesai (Menunggu persetujuan manusia sebelum Tahap 5)  
**Dokumen Referensi:** `docs/audit/phase-2d-resolution-plan.md`  
**Prinsip Batasan:** Tidak menghubungkan frontend ke Express atau Supabase, tidak melakukan migrasi database, tidak mengubah identitas barcode yang sudah tercetak, dan tidak memodifikasi data localStorage.

---

### 1. Berkas yang Diubah

| No | File | Tipe Perubahan | Deskripsi Perubahan |
|---|---|---|---|
| 1 | [`src/App.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/App.tsx) | **Diperbarui** | Mendaftarkan `<Route path="/b/:tokenOrCode" element={<PublicScanLoan />} />` di luar layout admin (`AppLayout`). |
| 2 | [`src/test/qrIdentityAndUrl.test.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/qrIdentityAndUrl.test.tsx) | **Diperbarui** | Menambahkan suite pengujian Bagian 8 (5 skenario uji baru) yang memvalidasi routing `/b/:tokenOrCode`, pembacaan parameter URL, isolasi tanpa login, penanganan token tak dikenal, dan penanganan barang nonaktif. |

---

### 2. Rute yang Didaftarkan dan Cara Kerjanya

#### Pendaftaran Rute:
Di [`src/App.tsx:L33-L37`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/App.tsx#L33-L37):
```tsx
{/* Halaman Khusus Peminjaman Mandiri via Scan QR Code (Tanpa Menu & Tanpa Login) */}
<Route path="/scan" element={<PublicScanLoan />} />
<Route path="/q/:tokenOrCode" element={<PublicScanLoan />} />
<Route path="/b/:tokenOrCode" element={<PublicScanLoan />} />
<Route path="/pinjam" element={<PublicScanLoan />} />
```

#### Mekanisme Kerja:
1. **Penerimaan Request:**
   Ketika guru memindai barcode fisik yang dialihkan oleh Cloudflare Worker (atau tautan langsung) ke `https://<domain>/b/QR-TIK-ASUS-001`, React Router mencocokkan pola `/b/:tokenOrCode`.
2. **Pengekstrakan Parameter:**
   Komponen [`PublicScanLoan`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx) mengekstrak nilai melalui `useParams<{ tokenOrCode?: string }>()`:
   ```ts
   const codeFromUrl = searchParams.get('code') || searchParams.get('token') || params.tokenOrCode;
   ```
3. **Pencarian Aset Otomatis:**
   Hook `useEffect` mendeteksi keberadaan `codeFromUrl` dan langsung memanggil `handleLookup(codeFromUrl, true)` secara otomatis.
4. **Isolasi Halaman Publik (Tanpa Login):**
   Rute `/b/:tokenOrCode` berada di luar `<Route element={<AppLayout />}>`. Guru hanya melihat kartu barang dan form pengajuan peminjaman mandiri. Tidak ada sidebar admin, navbar internal sekolah, tombol dashboard, maupun menu audit yang dapat diakses dari rute ini.
5. **Penanganan Kasus Khusus:**
   - **Token Tak Dikenal:** Menampilkan alert rose `Data Tidak Ditemukan` dengan pesan penjelasan dan opsi pencarian manual.
   - **Barang Dinonaktifkan (`isDecommissioned`):** Menampilkan banner abu-abu resmi `Barang Telah Dinonaktifkan / Dihapus Secara Logis`, alasan penonaktifan, waktu arsip, serta menyembunyikan tombol ajukan peminjaman.
   - **Barang Sedang Dipinjam (`ON_LOAN`):** Menampilkan identitas peminjam aktif, tanggal jatuh tempo, dan opsi pengajuan pengembalian mandiri.
   - **Barang Dalam Perawatan (`MAINTENANCE`):** Menampilkan peringatan perbaikan teknis dan mencegah peminjaman baru.

---

### 3. Hasil Pengujian Sebelum dan Sesudah

| Metrik Uji | Sebelum Tahap 4 | Sesudah Tahap 4 | Status |
|---|---|---|---|
| **Total Test Suites** | 5 passed (5) | **5 passed (5)** | **Lulus 100%** |
| **Total Unit Tests** | 60 passed (60) | **65 passed (65)** | **Lulus (+5 tes)** |
| `src/test/qrIdentityAndUrl.test.tsx` | 12 passed | **17 passed** | **Lulus (+5 tes)** |
| `src/test/apiContract.test.ts` | 15 passed | **15 passed** | **Lulus** |
| `src/test/databaseMigration.test.ts` | 7 passed | **7 passed** | **Lulus** |
| `src/test/statemachine.test.ts` | 15 passed | **15 passed** | **Lulus** |
| `src/test/components.test.tsx` | 11 passed | **11 passed** | **Lulus** |

#### Rincian 5 Pengujian Baru (Bagian 8 `qrIdentityAndUrl.test.tsx`):
1. `memastikan rute /b/:tokenOrCode membuka halaman peminjaman mandiri tanpa login dan tanpa sidebar/navbar menu admin` $\rightarrow$ **Lulus**
2. `mendukung resolusi berbagai format identitas (token QR, permanentId, assetCode) via /b/:tokenOrCode` $\rightarrow$ **Lulus**
3. `menampilkan peringatan Data Tidak Ditemukan saat token pada /b/:tokenOrCode tidak dikenal di sistem` $\rightarrow$ **Lulus**
4. `menampilkan banner penonaktifan secara logis saat rute /b/:tokenOrCode membuka barang yang dinonaktifkan` $\rightarrow$ **Lulus**
5. `mempertahankan seluruh rute admin (/inventory, /dashboard) tanpa terpengaruh rute /b/:tokenOrCode` $\rightarrow$ **Lulus**

#### Build & Typecheck:
- Frontend Typecheck (`npx tsc --noEmit`): **Exit Code 0 (0 Errors)**
- Server Build (`npm run build` di `server`): **Exit Code 0 (0 Errors)**
- Rekonsiliasi Audit (`npm run reconcile` di `server`): **Verdict: PASSED (11/11 Valid, 0 Duplikat, 0 Orphan)**

---

### 4. Status Kompatibilitas Barcode

| Format URL / Rute | Contoh Nilai | Status Kompatibilitas | Keterangan |
|---|---|---|---|
| URL Barcode Lokal (Lama) | `http://192.168.100.45:5173/scan?code=INV-TIK-2024-001` | **Kompatibel Penuh** | Tetap didukung untuk jaringan lokal sekolah tanpa perlu cetak ulang stiker lama. |
| URL Permalink Pendek | `http://192.168.100.45:5173/q/INV-TIK-2024-001` | **Kompatibel Penuh** | Tetap aktif melayani scan Google Lens dan direct link. |
| URL Barcode Produksi Baru | `https://<domain>/b/QR-TIK-ASUS-001` | **Kompatibel Penuh** | Kini terdaftar resmi di React Router, memuat unit secara instan tanpa redirect ke Dashboard. |
| Lookup via `permanentId` | `https://<domain>/b/PERM-TIK-ASUS-001` | **Kompatibel Penuh** | Berhasil menemukan unit yang sama secara deterministik. |
| URL Fisik / Identitas Aset | `qrToken`, `assetCode`, `permanentId` | **0 Perubahan (100% Preserved)** | Integritas identitas fisik 11 unit aset terjaga sepenuhnya. |

---

### 5. Risiko Tersisa & Kebutuhan Konfigurasi Hosting SPA

#### Kebutuhan Konfigurasi SPA Fallback Rewrite (Critical for Deployment):
- Aplikasi frontend SIMSARPRAS adalah **Single Page Application (SPA)** yang mengandalkan routing sisi peramban (`react-router-dom`).
- Jika guru memindai barcode fisik langsung atau me-refresh browser pada path dalam seperti `https://sarpras-app.pages.dev/b/QR-TIK-ASUS-001`, web server hosting statis akan mencari file statis fisik bernama `/b/QR-TIK-ASUS-001` di storage hosting.
- Jika hosting statis tidak memiliki konfigurasi SPA rewrite ke `/index.html`, server hosting akan mengembalikan **HTTP 404 Not Found dari Web Server**, sebelum kode JavaScript React Router sempat dieksekusi di browser.
- **Rekomendasi Konfigurasi Hosting untuk Fase 5:**
  - **Cloudflare Pages:** Buat file `_redirects` dengan isi:  
    `/*    /index.html   200`
  - **Nginx Web Server:** Tambahkan directive fallback:  
    `location / { try_files $uri $uri/ /index.html; }`
  - **Apache Web Server:** Tambahkan `.htaccess` mod_rewrite ke `index.html`.

---

### 6. Kriteria Penerimaan yang Belum Dapat Diverifikasi

Sesuai instruksi audit yang ketat, hal-hal berikut dicatat secara jujur sebagai belum diverifikasi pada pengujian unit lokal ini:
1. **Pemindaian Kamera Fisik & Google Lens Real-World:**
   Pengujian saat ini memvalidasi navigasi URL DOM dan penguraian parameter. Kinerja pemindaian optik kamera HP guru pada berbagai kondisi pencahayaan dan resolusi lensa fisik memerlukan verifikasi lapangan pada Fase 5.
2. **Koneksi Internet Publik Eksternal:**
   Pengujian saat ini dijalankan pada memori router dan localhost. Kinerja loading dari luar Wi-Fi sekolah memerlukan deployment hosting publik pada Fase 5.

---

### 7. Evaluasi Kriteria Penerimaan Tahap 4

- [x] Rute `/b/:tokenOrCode` terdaftar menggunakan komponen publik `PublicScanLoan`.
- [x] Parameter URL diteruskan dan diuraikan dengan benar oleh halaman pemindaian.
- [x] Penanganan token tidak valid, barang tidak ditemukan, dan barang dinonaktifkan telah diuji dan berfungsi.
- [x] Seluruh rute admin (`/inventory`, `/dashboard`, dll.) dan layout internal tetap terpelihara tanpa regresi.
- [x] Kompatibilitas dengan URL barcode lama berbasis IP dan barcode baru berbasis `/b/...` terpenuhi.
- [x] Nol perubahan pada token fisik (`qrToken`), kode barang (`assetCode`), atau identitas permanen (`permanentId`).
- [x] Seluruh 65 unit test lulus 100%.

---

### Titik Berhenti (Stop Point)

> [!NOTE]
> **Pekerjaan Fase 2D Tahap 4 telah selesai sepenuhnya.**  
> Tahap 5 (*Uji Terisolasi pada Supabase Dev / Staging Deployment*), integrasi frontend-backend, dan migrasi database **belum disentuh**. Sistem berhenti di sini untuk menunggu tinjauan dan persetujuan resmi Anda.
