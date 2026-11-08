# SI-SARPRAS Web — Sistem Informasi Inventaris Sarana dan Prasarana Sekolah

> **Versi Baseline:** 1.2  
> **Status:** Frontend Production-Ready (React + Vite + TypeScript + Tailwind CSS + TanStack Query)  
> **Target Sekolah:** SMK Negeri 1 Teladan Jakarta  
> **Bahasa Aplikasi:** Bahasa Indonesia  

---

## 📌 Ringkasan Implementasi

Frontend **SI-SARPRAS** dibangun dengan kepatuhan ketat terhadap spesifikasi **PRD SI-SARPRAS**. Seluruh alur state machine peminjaman, pemindaian QR Code, serah terima fisik barang, verifikasi bertahap pengembalian, dan matriks hak akses per peran telah diimplementasikan secara komprehensif.

Aplikasi dilengkapi dengan **Mode Simulasi / Mock Data terstruktur** yang secara transparan memberi tanda bahwa data saat ini disimpan di browser lokal dan siap dialihkan ke backend **Express API** dengan mengatur environment variable `VITE_API_BASE_URL`.

---

## 🚀 Fitur Utama & Pemetaan Halaman PRD

### 1. Dashboard Responsif Berbasis Peran
- **Admin Sarpras:** KPI metric cards (Total Inventaris, Unit Tersedia, Sedang Dipinjam, Dalam Perbaikan, Antrean Persetujuan, Antrean Verifikasi Pengembalian), grafik distribusi kategori, pemetaan kondisi fisik, dan log aktivitas audit terkini.
- **Guru / Pegawai:** Tampilan task-oriented dengan tombol utama *"Scan QR Sekarang"*, kartu pinjaman aktif milik sendiri, tanggal jatuh tempo & badge peringatan keterlambatan (*overdue*).
- **Kepala Sekolah:** Ringkasan eksekutif tata kelola aset, evaluasi kepatuhan peminjaman, serta rekapitulasi nilai perolehan inventaris.

### 2. Data Inventaris & Pelacakan Unit Individual
- Tabel inventaris terperinci: Kode Aset unik (misal: `SARPRAS-ELK-2026-001`), pratinjau grafik QR Code, nama barang, merek/model, ruangan/lokasi, kebijakan pinjam, badge kondisi fisik (`Baik`, `Rusak Ringan`, `Rusak Berat`, `Hilang`), dan badge status operasional (`AVAILABLE`, `ON_LOAN`, `RESERVED`, `MAINTENANCE`, dll.).
- Pencarian multi-kriteria (kode aset, nama barang, nomor seri) dan filter dinamis kategori, ruangan, dan status.
- Modal Detail Unit: Spesifikasi lengkap, riwayat perolehan, checklist aksesori bawaan standar, dan tombol cetak label / pinjam instan.
- Modal Tambah Unit Baru (Khusus Admin): Form validasi registrasi unit fisik baru ke katalog.

### 3. Cetak Label QR Code (Satuan & Massal)
- Memenuhi standar PRD Bab 16: Memuat nama sekolah (`SMK NEGERI 1 TELADAN`), nama barang, kode inventaris, grafik QR Code presisi, dan ruangan/lokasi.
- Pemilihan fleksibel: Checklist satuan atau tombol pilih semua / batal semua.
- Pengaturan layout stiker: Ukuran stiker (Standar 70x40 mm, Ringkas 50x30 mm, Kartu Aset 85x54 mm), susunan kolom cetak (1, 2, atau 3 kolom), opsi garis batas potong.
- Layout cetak bersih memanfaatkan CSS `@media print` sehingga dialog cetak browser (`Ctrl+P` / `window.print()`) otomatis hanya mencetak lembar stiker tanpa elemen UI navigasi.

### 4. Scan QR Code Cerdas & Viewfinder
- Viewfinder kamera dengan animasi garis laser scanner, instruksi pemindaian, dan fallback input manual kode inventaris / token QR.
- Pill tombol cepat untuk simulasi pemindaian sampel unit inventaris dalam satu klik.
- **State-Aware Action Dispatcher**:
  - JIKA `AVAILABLE` → Tombol aktif *"Ajukan Peminjaman"*.
  - JIKA `ON_LOAN` oleh guru yang login → Tombol aktif *"Ajukan Pengembalian"*.
  - JIKA `ON_LOAN` oleh staf lain → Notifikasi peringatan bahwa barang sedang dipinjam oleh orang lain.
  - JIKA `MAINTENANCE` atau dalam pemeriksaan → Penjelasan status bahwa unit tidak dapat dipinjam.

### 5. Siklus Peminjaman & Kepatuhan State Machine
- **Mode `DIRECT`**: Pengajuan valid langsung menuju status `READY_FOR_HANDOVER` (unit menjadi `RESERVED`, bukan `ON_LOAN`). Tidak memerlukan persetujuan admin, namun serah terima fisik tetap wajib dicatat!
- **Mode `ADMIN_APPROVAL`**: Pengajuan wajib masuk ke antrean `PENDING_APPROVAL`. Admin dapat menyetujui (berubah ke `READY_FOR_HANDOVER`) atau menolak dengan alasan wajib (unit kembali `AVAILABLE`).
- **Serah Terima Fisik (Handover)**: Admin/petugas memverifikasi fisik peminjam, checklist kelengkapan aksesori, mencatat kondisi saat diserahkan, dan mengonfirmasi serah terima. Transaksi resmi menjadi `ACTIVE` dan unit menjadi `ON_LOAN`.

### 6. Alur 3 Langkah Pengembalian Barang
1. **Pengajuan Guru**: Guru memindai QR unit yang sedang dipinjamnya. Transaksi menjadi `RETURN_REQUESTED`, unit menjadi `RETURN_PENDING` (*tetap tidak tersedia untuk orang lain*).
2. **Penerimaan Fisik Admin**: Admin menerima fisik barang, mencatat petugas penerima dan waktu penerimaan. Transaksi menjadi `RETURN_RECEIVED`, unit menjadi `RETURN_INSPECTION`.
3. **Pemeriksaan & Persetujuan Admin**: Admin mengecek kondisi fisik akhir dan kelengkapan aksesori:
   - JIKA kondisi `Baik`: Status transaksi menjadi `COMPLETED`, unit kembali `AVAILABLE`.
   - JIKA kondisi `Rusak Ringan` / `Rusak Berat`: Status transaksi menjadi `COMPLETED`, unit otomatis dialihkan ke `MAINTENANCE` (tidak dapat dipinjam ulang hingga diperbaiki).

### 7. Laporan & Rekapitulasi Resmi
- Rekapitulasi Buku Induk Inventaris, Laporan Peminjaman Aktif, Laporan Pengembalian & Kondisi Akhir, serta Laporan Aset Rusak / Perbaikan.
- Ekspor data tabel ke format **CSV (Excel compatible)**.
- Format cetak laporan resmi sekolah dengan **Kop Surat Dinas Pendidikan DKI Jakarta** dan lembar pengesahan tanda tangan **Kepala Sekolah** dan **Admin Sarpras**.

### 8. Pengaturan Kebijakan & Audit Trail
- Konfigurasi mode peminjaman per jenis barang (Override `DIRECT` vs `ADMIN_APPROVAL` atau mengikuti default kategori).
- Audit trail read-only yang mencatat pelaku, waktu, jenis aksi, entitas, dan detail mutasi.

---

## 🛠️ Arsitektur Teknologi & Keamanan

| Lapisan | Teknologi | Catatan Implementasi |
| :--- | :--- | :--- |
| **Framework** | React 18 + Vite 6 + TypeScript | Strict typing, path aliases `@/*` |
| **Styling** | Tailwind CSS v3 | Palette Navy Profesional (`#0f2777`), clean surfaces, `@media print` |
| **Routing** | React Router DOM v6 | Layout adaptif (Admin, Guru, Kepala Sekolah) |
| **State & Data** | TanStack Query v5 | Cache invalidation otomatis saat mutasi status |
| **Testing** | Vitest + Testing Library | 14 test lulus mencakup state machine & UI |
| **Keamanan** | Zero-Secret Frontend | Tidak ada credential rahasia di client, audit logging |

---

## 🧪 Menjalankan Project

### 1. Mode Development Server
```bash
npm run dev
```
Aplikasi dapat diakses di: `http://localhost:5173/`

### 2. Menjalankan Unit & Integration Tests
```bash
npm test
```
Menjalankan 14 skenario pengujian di Vitest:
- `L-01`: Mode DIRECT langsung menuju READY_FOR_HANDOVER tanpa persetujuan.
- `L-02`: Mode ADMIN_APPROVAL wajib menghasilkan PENDING_APPROVAL.
- `L-03`: Persetujuan admin belum mengaktifkan ON_LOAN sebelum serah terima.
- `L-05`: Serah terima fisik mengubah status ke ACTIVE dan unit ke ON_LOAN.
- `R-01` & `R-03`: Pengembalian oleh guru mengubah status ke RETURN_REQUESTED dan unit tetap tidak tersedia.
- `R-05` & `R-07`: Penerimaan fisik dan pemeriksaan kondisi BAIK mengubah status ke COMPLETED dan unit kembali AVAILABLE.
- `R-08`: Pengembalian dengan kondisi RUSAK menjadikan unit berstatus MAINTENANCE.
- `L-07`: Peminjaman ganda ditolak bila unit sedang tidak AVAILABLE.
- `P-02`: Guru tidak memiliki izin menyetujui peminjaman.
- Pengujian komponen reusable: `Badge`, `StatCard`, `EmptyState`, `ErrorMessage`, dan helper status.

### 3. Build Produksi
```bash
npm run build
```
Menghasilkan bundle statis di folder `dist/` yang siap dideploy ke **Cloudflare Pages**.

### 4. Menghubungkan ke Backend Express API
Cukup buat file `.env` di root direktori:
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```
Ketika variabel ini terisi, API client `src/services/api.ts` akan otomatis mengirimkan request HTTP langsung ke endpoint Express API tanpa mengubah kode komponen.
