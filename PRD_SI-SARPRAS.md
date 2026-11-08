# PRD SI-SARPRAS

## Sistem Informasi Inventaris Sarana dan Prasarana Sekolah

-   **Versi:** 1.2
-   **Status:** Baseline produk untuk desain UI dan implementasi
-   **Tanggal:** 10 Oktober 2026
-   **Target awal:** Satu sekolah, dengan arsitektur yang dapat
    dikembangkan menjadi multi-sekolah
-   **Bahasa aplikasi:** Bahasa Indonesia

------------------------------------------------------------------------

## 1. Ringkasan Produk

SI-SARPRAS adalah aplikasi web responsif untuk mengelola inventaris
sarana dan prasarana sekolah. Setiap unit barang yang dilacak secara
individual memiliki kode inventaris dan QR Code unik. Guru dapat
memindai QR untuk mengajukan peminjaman dan pengembalian. Admin
mengelola kebijakan peminjaman per jenis barang, mengonfirmasi serah
terima, menerima barang secara fisik, memeriksa kondisinya, dan
menyetujui penyelesaian pengembalian.

Aplikasi harus mudah digunakan melalui komputer, tablet, maupun HP,
dengan kontrol akses, riwayat transaksi, dan audit yang memadai.

## 2. Tujuan

1.  Memusatkan data inventaris sekolah.
2.  Mempermudah identifikasi barang melalui QR Code.
3.  Mengelola peminjaman dengan mode langsung atau persetujuan admin
    sesuai kebijakan barang.
4.  Memastikan semua pengembalian diajukan guru dan diselesaikan setelah
    penerimaan serta pemeriksaan admin.
5.  Menyediakan laporan kondisi barang, peminjaman, keterlambatan, dan
    riwayat aktivitas.
6.  Mengurangi kesalahan pencatatan, peminjaman ganda, dan kehilangan
    jejak perubahan.

## 3. Pengguna dan Peran

### 3.1 Admin Sarpras

-   Mengelola kategori, katalog barang, unit barang, lokasi, pengguna,
    dan kebijakan peminjaman.
-   Membuat serta mencetak label QR.
-   Menyetujui atau menolak pengajuan yang memerlukan persetujuan.
-   Mengonfirmasi serah terima jika proses memerlukan petugas.
-   Menerima barang yang dikembalikan secara fisik, memeriksa kondisi,
    dan menyetujui penyelesaian.
-   Mengelola perbaikan, stock opname, laporan, dan audit.

### 3.2 Guru/Pegawai

-   Melihat katalog barang sesuai hak akses.
-   Memindai QR Code.
-   Mengajukan peminjaman.
-   Melihat transaksi miliknya.
-   Mengajukan pengembalian melalui pemindaian QR.
-   Melihat status dan riwayat pengajuan sendiri.

### 3.3 Kepala Sekolah

-   Melihat dashboard dan laporan.
-   Hak persetujuan transaksi hanya diberikan jika kebijakan sekolah
    secara eksplisit mengaturnya.

## 4. Ruang Lingkup MVP

Termasuk: 1. Autentikasi dan manajemen peran. 2. Dashboard berdasarkan
peran. 3. Kategori, katalog barang, unit barang, lokasi, dan kondisi. 4.
QR Code unik per unit barang individual. 5. Cetak label satuan atau
massal ke PDF. 6. Mode peminjaman per jenis barang. 7. Pengajuan,
persetujuan, penolakan, pembatalan, dan serah terima. 8. Pengajuan
pengembalian melalui QR, penerimaan fisik, pemeriksaan, dan persetujuan
admin. 9. Riwayat barang dan audit. 10. Laporan dan ekspor PDF/Excel.
11. Penanganan barang rusak dan perbaikan. 12. Stock opname dasar.

Di luar MVP: akuntansi penyusutan aset, pengadaan lengkap, integrasi
eksternal, tanda tangan elektronik tersertifikasi, dan aplikasi mobile
native.

## 5. Arsitektur Teknologi

-   **Frontend:** React, Vite, TypeScript; dideploy ke Cloudflare Pages.
-   **UI:** Tailwind CSS.
-   **Routing:** React Router.
-   **Pengambilan data:** TanStack Query.
-   **Form:** React Hook Form dan Zod.
-   **Backend:** Node.js, Express, TypeScript; dideploy ke Railway atau
    Render.
-   **Validasi backend:** Zod atau validator setara.
-   **Database:** Supabase PostgreSQL.
-   **Autentikasi:** Supabase Auth.
-   **Database access:** PostgreSQL melalui `pg` dan SQL
    terparameterisasi dari backend.
-   **File:** Supabase Storage untuk foto barang dan bukti pemeriksaan.
-   **QR dan PDF:** library QR Code dan PDF di backend.
-   **Testing:** Vitest, Supertest, PostgreSQL integration tests,
    Playwright untuk E2E.
-   **Deployment:** Cloudflare Pages untuk frontend; Railway atau Render
    untuk API.

### Prinsip keamanan arsitektur

-   Frontend tidak boleh mengubah status bisnis secara langsung dengan
    melewati API backend.
-   Backend memverifikasi token Supabase dan memeriksa role/permission.
-   Secret key dan kredensial database hanya berada di lingkungan
    server.
-   Gunakan HTTPS, CORS allowlist, rate limiting, validasi berkas, dan
    audit log.
-   RLS dapat menjadi lapisan tambahan bila akses langsung ke Supabase
    diperlukan; RLS tidak menggantikan aturan bisnis backend.
-   Gunakan migration berversi untuk seluruh perubahan skema.

## 6. Aturan Peminjaman

Setiap jenis barang memiliki mode efektif: - `DIRECT`: tidak memerlukan
persetujuan admin. - `ADMIN_APPROVAL`: wajib mendapat persetujuan admin.

Mode efektif berasal dari override di katalog barang jika ada; jika
tidak, gunakan mode default kategori. Mode yang berlaku saat pengajuan
disalin ke transaksi sebagai snapshot dan tidak berubah jika kebijakan
diperbarui kemudian.

### 6.1 Mode DIRECT

1.  Guru memindai QR.
2.  Sistem memvalidasi identitas, ketersediaan, dan hak akses.
3.  Guru mengisi tujuan dan rencana pengembalian.
4.  Pengajuan menuju `READY_FOR_HANDOVER`.
5.  Barang baru menjadi `ACTIVE`/`ON_LOAN` setelah serah terima
    dikonfirmasi.
6.  Serah terima dapat dikonfirmasi guru hanya bila kebijakan sekolah
    mengizinkan pengambilan mandiri dan barang benar-benar telah
    diserahkan; selain itu petugas mengonfirmasi.

### 6.2 Mode ADMIN_APPROVAL

1.  Guru memindai QR dan mengajukan peminjaman.
2.  Status menjadi `PENDING_APPROVAL`.
3.  Admin menyetujui atau menolak.
4.  Persetujuan menghasilkan status `APPROVED`, belum berarti barang
    sudah diserahkan.
5.  Status menjadi `READY_FOR_HANDOVER` ketika siap diserahkan.
6.  Setelah serah terima dikonfirmasi, status menjadi `ACTIVE`.

Sistem harus mencegah peminjaman ganda dan memvalidasi ulang
ketersediaan saat persetujuan serta serah terima.

## 7. Alur Pengembalian

1.  Guru memindai QR unit barang yang tercatat sedang dipinjam olehnya.
2.  Guru mengajukan pengembalian.
3.  Status pengembalian menjadi `RETURN_REQUESTED`; unit tetap tidak
    tersedia.
4.  Admin menerima barang secara fisik dan mencatat waktu penerimaan.
5.  Admin memeriksa kondisi, aksesori, dan bukti jika diperlukan.
6.  Admin mencatat hasil pemeriksaan.
7.  Admin menyetujui penyelesaian pengembalian.
8.  Transaksi menjadi `COMPLETED`.
9.  Unit menjadi `AVAILABLE` hanya jika layak digunakan. Jika rusak,
    unit menjadi `MAINTENANCE`; jika hilang, proses kehilangan terpisah
    harus digunakan.

Scan QR hanya mengidentifikasi barang dan tidak membuktikan penerimaan
fisik.

## 8. State Machine

### 8.1 Peminjaman

Status: - `PENDING_APPROVAL` - `APPROVED` - `READY_FOR_HANDOVER` -
`ACTIVE` - `RETURN_REQUESTED` - `RETURN_RECEIVED` - `RETURN_ISSUE` -
`COMPLETED` - `REJECTED` - `CANCELLED`

Transisi: - Mode `ADMIN_APPROVAL`: `PENDING_APPROVAL` → `APPROVED` atau
`REJECTED`. - Mode `DIRECT`: pengajuan valid → `READY_FOR_HANDOVER`. -
`APPROVED` → `READY_FOR_HANDOVER`. - `READY_FOR_HANDOVER` → `ACTIVE`
hanya setelah serah terima. - `ACTIVE` → `RETURN_REQUESTED` melalui
pengajuan guru. - `RETURN_REQUESTED` → `RETURN_RECEIVED` setelah admin
menerima fisik barang. - `RETURN_RECEIVED` → `COMPLETED` setelah
pemeriksaan dan persetujuan. - `RETURN_RECEIVED` → `RETURN_ISSUE` jika
ada masalah yang memerlukan tindak lanjut. - `RETURN_ISSUE` →
`COMPLETED` hanya setelah keputusan penanganan tercatat dan transaksi
dapat ditutup. - Pengajuan yang sah dapat menjadi `CANCELLED` sebelum
serah terima, sesuai aturan.

### 8.2 Status Unit Barang

Pisahkan kondisi fisik dari status operasional.

-   `condition_status`: `GOOD`, `MINOR_DAMAGE`, `MAJOR_DAMAGE`, `LOST`.
-   `operational_status`: `AVAILABLE`, `RESERVED`, `ON_LOAN`,
    `RETURN_PENDING`, `RETURN_INSPECTION`, `MAINTENANCE`, `INACTIVE`,
    `LOST`.

Aturan: - Unit yang `RESERVED`, `ON_LOAN`, `RETURN_PENDING`,
`RETURN_INSPECTION`, `MAINTENANCE`, `INACTIVE`, atau `LOST` tidak dapat
dipinjam. - Unit hanya menjadi `AVAILABLE` setelah pengembalian
disetujui dan dinyatakan layak, atau perbaikan selesai dan disetujui. -
Status transaksi tidak boleh menggantikan status operasional unit.

## 9. Aturan Ketersediaan dan Integritas

1.  Satu unit individual hanya boleh memiliki satu pinjaman aktif.
2.  Ketersediaan divalidasi ulang saat pengajuan, persetujuan, dan serah
    terima.
3.  Gunakan transaksi PostgreSQL dan `SELECT ... FOR UPDATE` atau
    mekanisme setara untuk menghindari race condition.
4.  Gunakan tabel `asset_active_loans` dengan `asset_unit_id` sebagai
    primary key untuk mengunci satu pinjaman aktif per unit.
5.  Buat/hapus kunci pinjaman aktif dalam transaksi database yang sama
    dengan perubahan status resmi.
6.  Pengembalian yang belum disetujui tidak melepaskan unit untuk
    peminjaman baru.
7.  Permintaan duplikat harus ditangani secara idempotent.
8.  Penghapusan barang yang memiliki riwayat dilakukan dengan
    pengarsipan, bukan hard delete.
9.  Catat pelaku, waktu, status asal/tujuan, dan alasan perubahan.
10. Simpan waktu dengan `timestamptz`; tampilkan dalam zona waktu
    `Asia/Jakarta`.
11. Jika pinjaman berisi beberapa unit, setiap unit harus memiliki hasil
    serah terima dan pemeriksaan pengembalian tersendiri.
12. Barang hilang mengikuti proses khusus, bukan pengembalian normal.

## 10. Struktur Database

Gunakan UUID sebagai primary key untuk tabel utama, foreign key,
constraint, indeks, dan `timestamptz`.

### 10.1 `profiles`

-   `id UUID PK REFERENCES auth.users(id)`
-   `full_name`
-   `employee_number`
-   `is_active`
-   `created_at`, `updated_at`

### 10.2 `roles`, `permissions`, `user_roles`

Tabel role dan permission; gunakan relasi many-to-many untuk peran
pengguna.

### 10.3 `categories`

-   `id UUID PK`
-   `name`
-   `default_loan_mode` (`DIRECT` / `ADMIN_APPROVAL`)
-   `is_active`
-   timestamps

### 10.4 `locations`

-   `id UUID PK`
-   `name`
-   `code UNIQUE`
-   `description`
-   `is_active`
-   timestamps

### 10.5 `items`

-   `id UUID PK`
-   `category_id FK`
-   `name`, `brand`, `model`
-   `tracking_mode` (`INDIVIDUAL` / `QUANTITY`)
-   `loan_mode_override NULL`
-   `is_active`
-   timestamps

Mode efektif adalah `loan_mode_override` bila terisi, jika tidak gunakan
`categories.default_loan_mode`.

### 10.6 `asset_units`

-   `id UUID PK`
-   `item_id FK`
-   `location_id FK`
-   `asset_code UNIQUE`
-   `qr_token_hash UNIQUE`
-   `serial_number NULL`
-   `acquisition_date NULL`
-   `acquisition_cost NULL`
-   `condition_status`
-   `operational_status`
-   `photo_path NULL`
-   `notes NULL`
-   timestamps

QR menggunakan token acak yang aman. Simpan hash token di database dan
jangan memasukkan informasi pribadi ke dalam QR.

### 10.7 `loan_requests`

-   `id UUID PK`
-   `loan_number UNIQUE`
-   `borrower_id FK`
-   `status`
-   `loan_mode_snapshot`
-   `purpose`
-   `requested_at`
-   `expected_return_at`
-   `approved_by NULL`
-   `approved_at NULL`
-   `rejection_reason NULL`
-   `cancelled_at NULL`
-   timestamps

### 10.8 `loan_request_items`

-   `id UUID PK`
-   `loan_request_id FK`
-   `asset_unit_id FK`
-   `created_at`
-   `UNIQUE(loan_request_id, asset_unit_id)`

Untuk MVP, fokus pada barang individual. Barang kuantitas membutuhkan
model stok dan reservasi tersendiri.

### 10.9 `loans`

-   `id UUID PK`
-   `loan_request_id UNIQUE FK`
-   `handed_over_by FK`
-   `handed_over_at`
-   `handover_notes NULL`
-   timestamps

### 10.10 `loan_items`

-   `id UUID PK`
-   `loan_id FK`
-   `asset_unit_id FK`
-   `condition_at_handover`
-   `due_at`
-   `returned_at NULL`
-   timestamps

### 10.11 `asset_active_loans`

-   `asset_unit_id UUID PK FK`
-   `loan_item_id UUID UNIQUE FK`
-   `created_at`

Baris hanya ada saat unit sedang dipinjam. Ini merupakan perlindungan
tambahan untuk satu pinjaman aktif per unit.

### 10.12 `return_requests`

-   `id UUID PK`
-   `loan_id FK`
-   `requested_by FK`
-   `status`
-   `requested_at`
-   `received_by NULL`
-   `received_at NULL`
-   `inspected_at NULL`
-   `approved_by NULL`
-   `approved_at NULL`
-   `notes NULL`
-   timestamps

### 10.13 `return_items`

-   `id UUID PK`
-   `return_request_id FK`
-   `loan_item_id FK`
-   `condition_at_return`
-   `accessories_complete`
-   `issue_description NULL`
-   `photo_path NULL`
-   timestamps
-   `UNIQUE(return_request_id, loan_item_id)`

### 10.14 Tabel pendukung

-   `asset_movements`: histori perpindahan dan status.
-   `maintenance_records`: catatan perbaikan.
-   `asset_labels`: histori pencetakan.
-   `audit_logs`: pelaku, aksi, entitas, nilai sebelum/sesudah, waktu.
-   `notifications`: notifikasi.
-   `stock_opname_sessions` dan `stock_opname_items`: pemeriksaan fisik.

## 11. Matriks Permission

  Permission                 Admin Sarpras   Guru/Pegawai                Kepala Sekolah
  -------------------------- --------------- --------------------------- ------------------
  `dashboard.view`           Semua           Terbatas                    Semua
  `items.view`               Ya              Ya                          Ya
  `items.manage`             Ya              Tidak                       Tidak
  `assets.manage`            Ya              Tidak                       Tidak
  `assets.labels.print`      Ya              Tidak                       Tidak
  `loan_requests.create`     Ya              Ya                          Opsional
  `loan_requests.view_own`   Ya              Ya                          Tidak
  `loan_requests.view_all`   Ya              Tidak                       Ya
  `loan_requests.approve`    Ya              Tidak                       Opsional
  `loan_requests.reject`     Ya              Tidak                       Opsional
  `loans.handover`           Ya              Terbatas sesuai kebijakan   Tidak
  `returns.request_own`      Ya              Ya                          Tidak
  `returns.receive`          Ya              Tidak                       Tidak
  `returns.inspect`          Ya              Tidak                       Tidak
  `returns.approve`          Ya              Tidak                       Opsional
  `reports.view`             Semua           Terbatas                    Semua
  `users.manage`             Ya              Tidak                       Tidak
  `audit_logs.view`          Ya              Tidak                       Sesuai kebijakan

Guru hanya dapat mengakses transaksi miliknya. Persetujuan diri sendiri
sebaiknya dilarang bila pemisahan tugas diwajibkan sekolah.

## 12. Endpoint API

Prefix: `/api/v1`. Semua endpoint dilindungi autentikasi dan permission
yang sesuai.

### Inventaris dan QR

-   `GET /items`
-   `POST /items`
-   `PATCH /items/:id`
-   `GET /assets`
-   `POST /assets`
-   `GET /assets/:id`
-   `PATCH /assets/:id`
-   `GET /qr/:token`
-   `POST /assets/:id/labels`
-   `POST /labels/export`

### Peminjaman

-   `POST /loan-requests`
-   `GET /loan-requests`
-   `GET /loan-requests/:id`
-   `POST /loan-requests/:id/approve`
-   `POST /loan-requests/:id/reject`
-   `POST /loan-requests/:id/cancel`
-   `POST /loans/:id/handover`

### Pengembalian

-   `POST /returns/scan`
-   `POST /returns`
-   `GET /returns`
-   `GET /returns/:id`
-   `POST /returns/:id/receive`
-   `POST /returns/:id/inspect`
-   `POST /returns/:id/approve`
-   `POST /returns/:id/flag-issue`

### Laporan dan konfigurasi

-   `PATCH /items/:id/loan-policy`
-   `GET /dashboard`
-   `GET /reports/assets`
-   `GET /reports/loans`
-   `GET /reports/returns`
-   `GET /reports/overdue`
-   `GET /audit-logs`

Gunakan kode respons `200`, `201`, `401`, `403`, `404`, `409`, dan `422`
secara konsisten. Endpoint transaksi harus mendukung idempotensi atau
pencegahan duplikasi setara.

## 13. Struktur Repository

``` text
si-sarpras/
├── apps/
│   ├── web/                 # React + Vite + TypeScript
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       │   ├── inventory/
│   │       │   ├── qr-scanner/
│   │       │   ├── loans/
│   │       │   ├── returns/
│   │       │   └── reports/
│   │       ├── hooks/
│   │       ├── lib/
│   │       └── routes/
│   └── api/                 # Express + TypeScript
│       └── src/
│           ├── config/
│           ├── middleware/
│           ├── modules/
│           ├── services/
│           ├── db/
│           ├── app.ts
│           └── server.ts
├── packages/
│   └── contracts/           # Tipe dan schema bersama
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   └── e2e/
├── package.json
└── README.md
```

## 14. Persyaratan UI/UX

### Prinsip desain

-   Modern, bersih, profesional, dan mudah dipelajari staf sekolah.
-   Responsif untuk desktop, tablet, dan HP.
-   Gunakan Bahasa Indonesia yang konsisten.
-   Status transaksi harus memiliki label teks, bukan hanya warna.
-   Formulir menampilkan validasi yang jelas.
-   Tombol tindakan disesuaikan dengan status dan permission.
-   Pemindaian QR harus memiliki fallback pencarian kode manual.
-   Tampilkan loading, empty state, error state, konfirmasi, dan
    keberhasilan.
-   Jangan tampilkan tombol persetujuan kepada guru.
-   Aksi penting harus meminta konfirmasi dan alasan jika diperlukan.

### Menu Admin

1.  Dashboard
2.  Data Inventaris
3.  Kategori Barang
4.  Lokasi dan Ruangan
5.  Cetak Label QR
6.  Persetujuan Peminjaman
7.  Serah Terima
8.  Verifikasi Pengembalian
9.  Perawatan dan Perbaikan
10. Stock Opname
11. Laporan
12. Pengguna dan Hak Akses
13. Audit Aktivitas
14. Pengaturan Kebijakan Peminjaman

### Menu Guru/Pegawai

1.  Beranda
2.  Scan QR
3.  Cari Barang
4.  Ajukan Peminjaman
5.  Peminjaman Saya
6.  Ajukan Pengembalian
7.  Riwayat Transaksi
8.  Profil

### Menu Kepala Sekolah

1.  Dashboard
2.  Laporan Inventaris
3.  Laporan Peminjaman dan Pengembalian
4.  Ringkasan Kondisi Barang
5.  Audit atau ringkasan aktivitas sesuai izin

## 15. Dashboard

Dashboard admin menampilkan: - Total unit inventaris. - Unit tersedia. -
Unit sedang dipinjam. - Unit dalam perbaikan. - Pengajuan menunggu
persetujuan. - Pengembalian menunggu penerimaan/pemeriksaan. - Pinjaman
terlambat. - Aktivitas terbaru. - Grafik barang berdasarkan kategori,
lokasi, dan kondisi.

Angka pada dashboard harus berasal dari API/database, bukan angka
statis.

Dashboard guru menampilkan: - Pinjaman aktif milik sendiri. - Pengajuan
yang menunggu keputusan. - Barang yang mendekati atau melewati jatuh
tempo. - Pengembalian yang menunggu verifikasi. - Tombol utama "Scan
QR".

## 16. Cetak Label QR Code

Label minimal memuat: - Nama sekolah. - Nama barang. - Kode
inventaris. - QR Code. - Ruangan/lokasi jika diperlukan.

Fitur: - Cetak satuan dan massal. - Pratinjau. - PDF dengan ukuran label
yang dapat diatur. - Cetak ulang tanpa mengganti identitas barang. - QR
memakai token acak yang aman; data sensitif tidak disimpan di QR. -
Endpoint scan memeriksa autentikasi dan hak akses.

## 17. Laporan

1.  Daftar inventaris.
2.  Rekapitulasi berdasarkan kategori dan lokasi.
3.  Kondisi barang.
4.  Barang sedang dipinjam.
5.  Pinjaman terlambat.
6.  Riwayat peminjaman per barang/pengguna.
7.  Pengembalian dan kondisi akhir.
8.  Perbaikan dan tindak lanjut.
9.  Stock opname dan selisih.
10. Audit aktivitas.

Dukung filter tanggal, kategori, lokasi, kondisi, status, dan ekspor
PDF/Excel.

## 18. Test Case Penerimaan

### Peminjaman

-   `L-01`: Mode `DIRECT` langsung menuju `READY_FOR_HANDOVER` jika
    valid.
-   `L-02`: Mode `ADMIN_APPROVAL` menghasilkan `PENDING_APPROVAL`.
-   `L-03`: Persetujuan admin belum mengaktifkan pinjaman sebelum serah
    terima.
-   `L-04`: Penolakan tidak mengunci unit.
-   `L-05`: Serah terima valid mengubah status transaksi ke `ACTIVE` dan
    unit ke `ON_LOAN`.
-   `L-06`: Serah terima tanpa persetujuan ditolak untuk mode yang
    mewajibkannya.
-   `L-07`: Unit yang sudah dipinjam tidak bisa dipinjam lagi.
-   `L-08`: Mode tidak bisa dipalsukan lewat payload frontend.
-   `L-09`: Request duplikat tidak membuat transaksi ganda.
-   `L-10`: Dua permintaan bersamaan hanya menghasilkan satu peminjaman
    valid.

### Pengembalian

-   `R-01`: Guru dapat mengajukan pengembalian untuk pinjamannya
    sendiri.
-   `R-02`: Guru tidak dapat mengembalikan transaksi milik orang lain.
-   `R-03`: Pengajuan pengembalian tidak langsung membuat unit tersedia.
-   `R-04`: Guru tidak dapat menyetujui pengembalian.
-   `R-05`: Admin harus mencatat penerimaan fisik.
-   `R-06`: Persetujuan tanpa pemeriksaan lengkap ditolak.
-   `R-07`: Barang baik dan lengkap menjadi `AVAILABLE` setelah
    persetujuan.
-   `R-08`: Barang rusak menjadi `MAINTENANCE`.
-   `R-09`: Pengembalian ganda tidak menghasilkan record ganda.
-   `R-10`: Pengembalian parsial hanya melepas unit yang sudah
    disetujui.

### Keamanan dan integritas

-   `P-01`: Guru tidak dapat membaca detail transaksi orang lain.
-   `P-02`: Guru tidak dapat memanggil endpoint persetujuan.
-   `P-03`: Pengguna tanpa izin tidak dapat mengubah kebijakan barang.
-   `P-04`: Kode inventaris dan token QR duplikat ditolak.
-   `P-05`: Kegagalan transaksi menghasilkan rollback tanpa perubahan
    parsial.
-   `P-06`: Audit mencatat aktor, waktu, dan keputusan.
-   `P-07`: Token QR tidak valid tidak mengungkap data barang.
-   `P-08`: Backup dan pemulihan database berhasil diuji.

Gunakan Vitest dan Supertest untuk unit/feature tests, PostgreSQL
integration tests untuk constraint dan locking, serta Playwright untuk
alur pengguna end-to-end.

## 19. Nonfunctional Requirements

-   **Keamanan:** autentikasi, otorisasi server, validasi input,
    pembatasan CORS, rate limiting, pengelolaan secret.
-   **Integritas:** transaksi atomik dan perlindungan terhadap
    peminjaman ganda.
-   **Kinerja:** pagination, indeks, dan query yang efisien untuk ribuan
    unit.
-   **Responsif:** mendukung desktop, tablet, dan smartphone.
-   **Audit:** perubahan status dan keputusan dapat ditelusuri.
-   **Backup:** tersedia prosedur pemulihan yang diuji.
-   **Privasi:** data pribadi hanya dapat diakses oleh peran yang
    berwenang.
-   **Ketersediaan:** tampilkan pesan jelas ketika API atau jaringan
    tidak tersedia.
-   **Aksesibilitas:** form berlabel, kontras memadai, navigasi
    keyboard, dan status tidak hanya memakai warna.

## 20. Deployment

### Frontend Cloudflare Pages

-   Build command: `npm run build`
-   Output directory: `dist`
-   Environment:
    -   `VITE_API_BASE_URL`
    -   `VITE_SUPABASE_URL`
    -   `VITE_SUPABASE_PUBLISHABLE_KEY`

Semua `VITE_` variable dapat terlihat di browser. Jangan menyimpan
secret di frontend.

### Backend Railway/Render

-   Build command disesuaikan dengan workspace TypeScript.
-   Start command menjalankan hasil build.
-   Environment:
    -   `NODE_ENV=production`
    -   `PORT`
    -   `FRONTEND_ORIGIN`
    -   `SUPABASE_URL`
    -   `SUPABASE_PUBLISHABLE_KEY` bila diperlukan untuk verifikasi
        konfigurasi
    -   `SUPABASE_SECRET_KEY` hanya jika benar-benar diperlukan di
        server
    -   `DATABASE_URL`

Backend harus menyediakan `GET /health`, membaca `PORT` dari
environment, menggunakan TLS untuk koneksi database sesuai kebutuhan
provider, dan tidak mencatat secret ke log.

### Supabase

-   Terapkan migration secara berurutan.
-   Konfigurasikan Auth dan Storage.
-   Gunakan role database dengan hak minimum.
-   Aktifkan backup sesuai paket.
-   Pisahkan project development dan production.
-   Jangan menjalankan migration destruktif terhadap production tanpa
    backup dan prosedur persetujuan.

Harga, batas kuota, dan fitur gratis tiap provider harus diverifikasi
pada saat deployment karena dapat berubah.

## 21. Tahapan Implementasi

1.  **Fondasi:** repository, TypeScript, konfigurasi, migration,
    autentikasi, roles.
2.  **Inventaris:** katalog, unit, lokasi, kategori, pencarian, QR.
3.  **Peminjaman:** state machine, policy per jenis barang, approval,
    reservasi, serah terima.
4.  **Pengembalian:** scan, pengajuan, penerimaan fisik, pemeriksaan,
    persetujuan.
5.  **Laporan:** dashboard, PDF/Excel, audit, stock opname.
6.  **Hardening:** integration test, concurrency test, permission test,
    backup/restore, E2E.
7.  **Pilot:** input data awal, pelatihan, evaluasi, perbaikan sebelum
    produksi.

## 22. Definition of Done

MVP dianggap siap diuji operasional jika: - Semua modul ruang lingkup
MVP berfungsi. - State machine hanya mengizinkan transisi yang sah. -
Mode peminjaman per jenis barang bekerja sesuai konfigurasi. -
Pengembalian selalu melalui pengajuan guru dan persetujuan admin. - Unit
yang sedang dipinjam atau menunggu pemeriksaan tidak dapat dipinjam
ulang. - Barang rusak tidak otomatis tersedia. - Semua test kritis
lulus. - Role dan permission diuji langsung melalui API. - Migration,
backup, dan pemulihan telah diverifikasi. - Dokumentasi setup,
deployment, dan operasional tersedia.

------------------------------------------------------------------------

# Lampiran A --- Prompt Desain UI/UX SI-SARPRAS

Gunakan prompt berikut pada AI UI design tool atau coding agent yang
akan membuat desain antarmuka. Prompt ini berfokus pada desain UI dan
prototipe, bukan mengubah aturan bisnis yang sudah dikunci di PRD.

## Prompt utama

Anda adalah Senior Product Designer dan Frontend Engineer yang ahli
dalam merancang aplikasi SaaS administrasi pendidikan.

Rancang UI/UX profesional untuk **SI-SARPRAS --- Sistem Informasi
Inventaris Sarana dan Prasarana Sekolah**, aplikasi web untuk mengelola
inventaris, QR Code, peminjaman, pengembalian, pemeriksaan kondisi
barang, dan laporan.

### 1. Teknologi dan batasan

-   React + Vite + TypeScript.
-   Tailwind CSS.
-   React Router.
-   TanStack Query untuk integrasi data jika backend tersedia.
-   React Hook Form dan Zod untuk form.
-   Ikon konsisten dari Lucide.
-   Responsif pada desktop, tablet, dan smartphone.
-   Frontend dideploy ke Cloudflare Pages.
-   Backend direncanakan menggunakan Express API; jangan menaruh
    kredensial rahasia di frontend.
-   Jika API belum tersedia, gunakan mock data terstruktur dan tandai
    jelas bahwa data masih simulasi. Jangan berpura-pura transaksi telah
    tersimpan di server.

### 2. Arah visual

Buat tampilan modern, bersih, profesional, tepercaya, dan mudah dipahami
operator sekolah.

-   Gunakan latar netral dengan permukaan putih atau abu-abu sangat
    muda.
-   Gunakan warna utama biru tua atau biru profesional dengan aksen
    hijau secukupnya untuk status berhasil.
-   Gunakan tipografi sans-serif yang mudah dibaca.
-   Terapkan jarak antarelemen konsisten, hierarki visual jelas, tabel
    mudah dipindai, dan tombol tindakan yang mudah ditemukan.
-   Hindari gradien berlebihan, efek glassmorphism, ornamen dekoratif,
    dan animasi yang tidak perlu.
-   Status transaksi harus memiliki teks dan indikator visual, bukan
    hanya warna.
-   Sediakan skeleton loading, empty state, error state, success state,
    dan dialog konfirmasi.
-   Pastikan kontras, ukuran target sentuh, label form, dan navigasi
    keyboard memadai.

### 3. Layout utama

**Admin desktop** - Sidebar kiri yang dapat diciutkan. - Header berisi
judul halaman, breadcrumb, notifikasi, dan menu profil. - Area konten
dengan lebar nyaman. - Kartu statistik di bagian atas dashboard. - Tabel
dengan pencarian, filter, pagination, dan tindakan per baris.

**Guru/Pegawai** - Antarmuka lebih sederhana dan berorientasi tugas. -
Pada HP, tampilkan navigasi bawah atau menu ringkas. - Tombol "Scan QR"
menjadi tindakan utama. - Status pinjaman dan langkah berikutnya harus
mudah dimengerti. - Formulir peminjaman/pengembalian singkat dan nyaman
digunakan di layar kecil.

### 4. Halaman yang harus dirancang

#### A. Login

-   Logo dan nama SI-SARPRAS.
-   Form login.
-   Validasi input dan pesan kesalahan.
-   Loading saat autentikasi.
-   Tampilan responsif.

#### B. Dashboard Admin

-   Total unit barang.
-   Barang tersedia.
-   Barang sedang dipinjam.
-   Barang dalam perbaikan.
-   Pengajuan pinjaman menunggu persetujuan.
-   Pengembalian menunggu penerimaan atau pemeriksaan.
-   Pinjaman terlambat.
-   Grafik inventaris per kategori dan lokasi.
-   Aktivitas terbaru.
-   Shortcut ke tambah barang, cetak label, persetujuan, dan
    pengembalian.
-   Semua angka berasal dari API atau mock data yang diberi penanda.

#### C. Data Inventaris

-   Tabel dengan kode, nama barang, kategori, lokasi, kondisi, status,
    dan QR.
-   Pencarian dan filter.
-   Tombol tambah barang.
-   Impor/ekspor bila relevan.
-   Halaman detail barang dengan foto, kode inventaris, riwayat, lokasi,
    dan status.
-   Bedakan katalog barang dan unit individual.

#### D. Form Tambah/Edit Barang

-   Nama barang, kategori, merek/model, nomor seri.
-   Lokasi dan tanggal perolehan.
-   Kondisi fisik.
-   Mode pelacakan.
-   Mode peminjaman `DIRECT` atau `ADMIN_APPROVAL`.
-   Foto dan catatan.
-   Validasi dan pesan error yang jelas.

#### E. Cetak Label QR

-   Daftar unit yang belum memiliki label atau perlu dicetak ulang.
-   Pemilihan satu atau banyak unit.
-   Pratinjau label.
-   Identitas sekolah, nama barang, kode inventaris, dan QR.
-   Pengaturan ukuran label dan layout kertas.
-   Tombol ekspor PDF dan cetak.
-   Cetak ulang tidak membuat identitas barang baru.

#### F. Scan QR

-   Tampilan kamera yang ramah HP.
-   Instruksi izin kamera.
-   Indikator saat QR ditemukan.
-   Fallback input kode inventaris manual.
-   Hasil scan menampilkan barang, lokasi, kondisi, dan status.
-   Jika barang tidak tersedia, jelaskan alasannya dan jangan
    menampilkan tombol peminjaman yang tidak sah.

#### G. Pengajuan Peminjaman Guru

-   Barang hasil scan.
-   Keperluan.
-   Tanggal dan waktu rencana pengembalian.
-   Catatan.
-   Ringkasan mode peminjaman:
    -   `DIRECT`: tidak perlu persetujuan admin, tetapi serah terima
        tetap harus tercatat.
    -   `ADMIN_APPROVAL`: menunggu keputusan admin.
-   Halaman konfirmasi dan status pengajuan.

#### H. Persetujuan Peminjaman Admin

-   Tab menunggu persetujuan, disetujui, ditolak.
-   Detail barang, peminjam, tujuan, dan tanggal.
-   Tombol setujui atau tolak.
-   Form alasan penolakan.
-   Status yang jelas.
-   Jangan tampilkan tahap persetujuan untuk transaksi `DIRECT`.

#### I. Serah Terima

-   Detail pengajuan yang siap diserahkan.
-   Verifikasi unit dan peminjam.
-   Kondisi barang saat diserahkan.
-   Kelengkapan/aksesori.
-   Konfirmasi waktu dan pihak yang menyerahkan.
-   Tombol konfirmasi serah terima.
-   Jelaskan bahwa pinjaman baru aktif setelah serah terima dicatat.

#### J. Peminjaman Saya

-   Kartu atau tabel transaksi milik guru.
-   Status, barang, tanggal pinjam, jatuh tempo.
-   Filter aktif, menunggu persetujuan, dan selesai.
-   Peringatan keterlambatan.
-   Tombol tindakan berdasarkan status.

#### K. Pengajuan Pengembalian Guru

-   Guru scan QR barang yang sedang dipinjamnya.
-   Ringkasan transaksi aktif.
-   Konfirmasi barang yang akan dikembalikan.
-   Catatan dan foto opsional.
-   Tombol ajukan pengembalian.
-   Status setelah diajukan: menunggu admin menerima dan memeriksa.
-   Tegaskan bahwa pengajuan tidak langsung menyelesaikan pinjaman.

#### L. Penerimaan dan Pemeriksaan Pengembalian Admin

-   Daftar pengembalian menunggu tindakan.
-   Verifikasi identitas unit dan transaksi.
-   Tombol "Terima Barang" untuk mencatat penerimaan fisik.
-   Form kondisi akhir, kelengkapan, foto, dan catatan.
-   Tombol simpan pemeriksaan.
-   Tombol persetujuan final hanya aktif jika pemeriksaan lengkap.
-   Jika barang baik: status akhir unit tersedia.
-   Jika barang rusak: transaksi dapat diselesaikan dengan catatan
    tindak lanjut, unit berstatus perbaikan.
-   Tampilkan nama admin dan waktu setiap tindakan.

#### M. Laporan

-   Inventaris per kategori/lokasi.
-   Barang sedang dipinjam.
-   Pinjaman terlambat.
-   Pengembalian dan kondisi akhir.
-   Perbaikan.
-   Filter tanggal, kategori, lokasi, status.
-   Ekspor PDF/Excel.
-   Gunakan tabel yang mudah dibaca dan grafik sederhana.

#### N. Pengguna dan Kebijakan

-   Daftar pengguna dan peran.
-   Aktivasi/nonaktifkan akun.
-   Pengaturan mode peminjaman per jenis barang.
-   Konfirmasi sebelum perubahan kebijakan.
-   Riwayat perubahan kebijakan.

#### O. Audit Aktivitas

-   Tabel pelaku, aksi, entitas, waktu, dan ringkasan perubahan.
-   Filter pengguna, tanggal, dan jenis aktivitas.
-   Data audit bersifat read-only untuk pengguna yang berwenang.

### 5. Aturan UX yang tidak boleh dilanggar

1.  Guru tidak boleh melihat tombol menyetujui peminjaman atau
    pengembalian.
2.  Guru hanya melihat transaksi miliknya.
3.  Pengajuan pengembalian tidak boleh menampilkan status selesai
    sebelum disetujui admin.
4.  Barang yang sedang dipinjam, menunggu pengembalian, atau dalam
    perbaikan tidak boleh ditampilkan sebagai tersedia.
5.  Mode `DIRECT` tidak boleh menghilangkan pencatatan serah terima.
6.  Mode `ADMIN_APPROVAL` tidak boleh melewati persetujuan admin.
7.  Tombol dan form harus mengikuti status transaksi.
8.  Semua aksi penting harus menampilkan feedback yang jelas.
9.  Jangan menggunakan data statistik statis seolah-olah data produksi.
10. Jangan menyimpan secret atau mengakses database langsung dari
    browser.

### 6. Output yang diminta

1.  Sitemap dan user flow.
2.  Design system sederhana: warna, tipografi, spacing, radius,
    komponen, dan status.
3.  Desain high-fidelity untuk desktop dan mobile.
4.  Komponen reusable untuk kartu statistik, tabel, badge status, form,
    dialog, dan scanner.
5.  Prototipe interaktif untuk alur peminjaman dan pengembalian.
6.  Implementasi React + Vite + TypeScript yang terstruktur.
7.  Mock data terpisah dari komponen UI.
8.  Daftar asumsi dan halaman yang membutuhkan API.
9.  Pastikan semua halaman konsisten dengan state machine dan aturan
    bisnis PRD SI-SARPRAS.

Mulai dari sitemap, user flow, dan design system; lanjutkan ke dashboard
admin, inventaris, scan QR, peminjaman, dan pengembalian. Jangan
menambahkan fitur baru yang mengubah aturan bisnis tanpa menjelaskan
dampaknya terlebih dahulu.

## Prompt singkat untuk AI coding agent

> Bangun frontend SI-SARPRAS menggunakan React, Vite, TypeScript,
> Tailwind CSS, React Router, dan TanStack Query. Ikuti PRD SI-SARPRAS
> secara ketat. Implementasikan layout responsif untuk Admin,
> Guru/Pegawai, dan Kepala Sekolah. Prioritaskan halaman Dashboard,
> Inventaris, Cetak QR, Scan QR, Peminjaman, Pengembalian, dan Laporan.
> Gunakan komponen reusable, tipe TypeScript yang ketat, mock data
> terpisah, serta API client yang siap dihubungkan ke Express. Jangan
> menyimpan secret di frontend. Jangan menganggap transaksi berhasil
> jika masih memakai mock data. Patuhi state machine: mode `DIRECT`
> tetap mencatat serah terima; mode `ADMIN_APPROVAL` wajib menunggu
> persetujuan; pengembalian selalu diajukan guru dan baru selesai
> setelah admin menerima, memeriksa, dan menyetujui. Sertakan loading,
> empty, error, success, validasi, aksesibilitas, dan test untuk alur
> kritis.
