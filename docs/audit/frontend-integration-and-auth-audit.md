# SIMSARPRAS — AUDIT INTEGRASI FRONTEND DAN ALUR AUTENTIKASI
## Forensic Audit: Frontend Authentication Flow, Token Lifecycle & Backend Contract Alignment

**Versi Dokumen:** 2.1.0-FRONTEND-AUTH-AUDIT  
**Tanggal Audit:** 14 Oktober 2026  
**Status Evaluasi:** **BLOCKED (FRONTEND-BACKEND AUTH CONTRACT MISALIGNMENT)**  
**Lingkungan Backend Aktif:** `http://127.0.0.1:10000` (Node.js Express API v2.1.0)  
**Lingkungan Database Lokal:** `127.0.0.1:5432/simsarpras_migration_test` (PostgreSQL 17.11)  
**Isolasi Staging Supabase:** **100% TERISOLASI (NOL KONEKSI KE SUPABASE / SERVER/.ENV TIDAK DISENTUH)**  

---

## 1. Ringkasan Eksekutif

Audit forensik ini dilakukan untuk memverifikasi apakah frontend SIMSARPRAS saat ini dapat melakukan login dan berkomunikasi dengan backend Express API lokal secara terotentikasi.

### Kesimpulan Utama (Verdict):
1. **Frontend Saat Ini Berjalan dalam Mode Mock Lokal Murni:** Alur login pada [`src/pages/Login.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Login.tsx) **tidak memanggil endpoint HTTP apa pun**. Autentikasi frontend saat ini adalah seleksi profil pengguna in-memory berbasis daftar statis `MOCK_USERS`.
2. **Ketiadaan Mekanisme Bearer Token di Frontend:** Frontend sama sekali **tidak memiliki kode untuk menyimpan (storage) maupun mengirimkan (injection)** header `Authorization: Bearer <token>` pada permintaan API.
3. **Ketiadaan Endpoint Login di Backend:** Backend Express (`server/src/index.ts`) **tidak mengimplementasikan route handler `POST /api/v1/auth/login`**.
4. **Alur Peminjaman Mandiri (Public QR) Sudah Siap:** Alur pemindaian QR publik pada [`src/pages/PublicScanLoan.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/PublicScanLoan.tsx) (`GET /assets/scan` dan `POST /loan-requests`) tidak memerlukan token dan sudah 100% selaras dengan backend lokal.
5. **Akses Data Terproteksi Terblokir:** Halaman inventaris internal (`/inventory`) dan persetujuan pinjaman (`/loans/approval`) akan menerima **`HTTP 401 Unauthorized`** jika dihubungkan ke backend karena backend secara ketat menegakkan `requireAuth` sementara frontend tidak mengirimkan token.

---

## 2. Pemeriksaan Alur Autentikasi Frontend Saat Ini

### 2.1 Analisis `src/pages/Login.tsx`
Pemeriksaan baris kode [`src/pages/Login.tsx:24-62`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Login.tsx#L24-L62):
- **Aksi Submit Form (`handleSubmit`):**
  - Mengambil nilai input `identifier` (NIP/Email) dan `password`.
  - Melakukan pencarian lokal (*client-side search*) pada array `allUsers` yang disuplai oleh `AuthContext`:
    ```typescript
    const matched = allUsers.find(
      (u) =>
        u.employeeNumber === identifier.trim() ||
        u.email.toLowerCase() === identifier.trim().toLowerCase()
    );
    if (matched) {
      switchUser(matched);
      setIsLoading(false);
      navigate('/');
    }
    ```
  - Nilai `password` sama sekali **diabaikan** (tidak divalidasi ke backend maupun hash lokal).
- **Aksi Cepat Demo (`handleQuickLogin`):**
  - Menetapkan peran (`ADMIN_SARPRAS`, `GURU_PEGAWAI`, `KEPALA_SEKOLAH`), mencari objek user terkait, lalu memanggil `switchUser(user)`.
- **Bukti Faktual:** **Nol panggilan HTTP (`fetch` / `axios`)** dieksekusi saat pengguna melakukan login.

### 2.2 Analisis `src/context/AuthContext.tsx`
Pemeriksaan baris kode [`src/context/AuthContext.tsx:23-40`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/context/AuthContext.tsx#L23-L40):
- State `currentUser` diinisialisasi dengan `MOCK_USERS[0]` (Bambang Hermawan).
- State `allUsers` diinisialisasi dengan konstanta array `MOCK_USERS` dari [`src/data/mockData.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/data/mockData.ts).
- `handleSwitchUser` memanggil `api.switchUser(user)` dan mengupdate state React lokal `currentUser`.
- Tidak ada state atau variabel penyimpan token JWT.

### 2.3 Analisis `src/services/api.ts`
Pemeriksaan baris kode [`src/services/api.ts:15-56`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/services/api.ts#L15-L56):
- Variabel penentu mode:
  ```typescript
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  export const IS_MOCK_MODE = !API_BASE_URL;
  ```
  Karena file `.env` root tidak mendefinisikan `VITE_API_BASE_URL`, aplikasi secara default beroperasi dalam `IS_MOCK_MODE = true`.
- **Perilaku jika `VITE_API_BASE_URL` diisi (Mode API Aktif):**
  - `getCurrentUser()`: Memanggil `fetch(`${API_BASE_URL}/auth/me`)` **tanpa header Authorization**. Endpoint ini menghasilkan **HTTP 404** di backend saat ini.
  - `switchUser(user)`: Mengembalikan objek `user` secara langsung (**no-op**, tidak ada panggilan API, tidak ada pengambilan token).
  - `getAllUsers()`: Memanggil `fetch(`${API_BASE_URL}/users`)` **tanpa header Authorization**. Endpoint ini menghasilkan **HTTP 404** di backend saat ini.

---

## 3. Analisis Siklus Hidup Token & Penyedia Autentikasi

### 3.1 Penyimpanan dan Pengiriman Bearer Token
- **Penyimpanan:** Tidak ada kode di frontend (`localStorage`, `sessionStorage`, `IndexedDB`, atau cookie) yang menyimpan JWT.
- **Pengiriman:** Seluruh pemanggilan fungsi `fetch` di [`src/services/api.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/services/api.ts) (misalnya baris 136 untuk `/assets` dan baris 226 untuk `/loan-requests`) **tidak menyertakan header `Authorization`**.
- Satu-satunya berkas di direktori `src/` yang memiliki header `Authorization: Bearer ...` adalah berkas tes integrasi Vitest [`src/test/apiContract.test.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/test/apiContract.test.ts#L245).

### 3.2 Audit Penyedia Autentikasi Eksternal (Supabase Auth / Firebase / OAuth)
- Pemeriksaan dependensi pada [`package.json`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/package.json#L13-L25):
  - Frontend murni menggunakan pustaka React, Tailwind, Lucide, React Query, dan Zod.
  - Tidak ada SDK Supabase (`@supabase/supabase-js`), Firebase Auth, Auth0, atau NextAuth yang terpasang di frontend.
- **Sumber Token Resmi:** Satu-satunya penerbit token yang dirancang dalam arsitektur sistem adalah modul backend Express [`server/src/middleware/auth.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/middleware/auth.ts) yang menandatangani token JWT HMAC-SHA256 (`HS256`) menggunakan `JWT_SECRET`.

---

## 4. Matriks Keselarasan Kontrak Frontend vs Backend

| Fitur / Endpoint | Dipanggil oleh Frontend (`api.ts`) | Tersedia di Backend Express | Status Proteksi Backend | Status Kompatibilitas Saat Ini |
|:---|:---|:---|:---:|:---:|
| **Health Check** | *(Tidak dipanggil langsung)* | `GET /api/v1/health` | Publik | **COMPATIBLE (HTTP 200)** |
| **Scan Barcode Publik** | `GET /assets/scan?query=...` | `GET /assets/scan` | Publik (Rate-limited) | **COMPATIBLE (HTTP 200)** |
| **Lookup Unit Publik** | `GET /assets/:id` | `GET /assets/:id` | Publik (Allowlist) | **COMPATIBLE (HTTP 200)** |
| **Pengajuan Pinjam Mandiri** | `POST /loan-requests` | `POST /loan-requests` | Publik (Pessimistic Lock) | **COMPATIBLE (HTTP 201)** |
| **Listing Inventaris Terproteksi** | `GET /assets` | `GET /assets` | **Wajib Bearer Token (`requireAuth`)** | **MISALIGNED (HTTP 401)** — Frontend tidak kirim token |
| **Riwayat Pinjaman Terproteksi** | `GET /loan-requests` | `GET /loans` (alias) | **Wajib Bearer Token (`requireAuth`)** | **MISALIGNED (HTTP 401)** — Frontend tidak kirim token |
| **Login Pengguna** | *(Tidak ada panggilan HTTP)* | **Belum Ada** (`POST /api/v1/auth/login` = 404) | - | **NOT IMPLEMENTED** |
| **Profil Pengguna Aktif** | `GET /auth/me` | **Belum Ada** (`GET /auth/me` = 404) | - | **NOT IMPLEMENTED** |
| **Daftar Master Pengguna** | `GET /users` | **Belum Ada** (`GET /users` = 404) | - | **NOT IMPLEMENTED** |
| **Master Data (Categories, Locations, Funding)** | `GET /categories`, `/locations`, `/funding-sources` | **Belum Ada** (Endpoints = 404) | - | **NOT IMPLEMENTED** |
| **Dashboard Metrics** | `GET /dashboard` | **Belum Ada** (`GET /dashboard` = 404) | - | **NOT IMPLEMENTED** |

---

## 5. Pemisahan Bukti Faktual vs Asumsi

| Pernyataan / Hipotesis | Kategori | Bukti Faktual dari Audit Kode |
|:---|:---:|:---|
| *"Frontend sudah siap berkomunikasi penuh dengan backend lokal jika `VITE_API_BASE_URL` diisi."* | **ASUMSI SALAH** | Frontend akan langsung mengalami kegagalan pada `api.getCurrentUser()`, `api.getAssets()` (401), dan `api.getDashboardMetrics()` (404). |
| *"Kegagalan `GET /api/v1/assets` (401) disebabkan oleh kerusakan middleware auth backend."* | **ASUMSI SALAH** | Middleware backend bekerja dengan benar dan sesuai spesifikasi keamanan. Kegagalan terjadi karena frontend memang belum pernah dihubungkan untuk mengirim Bearer JWT. |
| *"Frontend memiliki route login sendiri di browser tetapi belum memanggil backend."* | **FAKTA KODE** | Dibuktikan oleh baris 24-48 pada [`src/pages/Login.tsx`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/src/pages/Login.tsx) yang hanya melakukan seleksi in-memory. |
| *"Backend Express v2.1.0 tidak memiliki endpoint `POST /login`."* | **FAKTA KODE** | Dibuktikan oleh berkas [`server/src/index.ts`](file:///c:/Users/Lenovo/Documents/SIMSARPRAS/server/src/index.ts) yang hanya mendaftarkan `healthRouter`, `assetsRouter`, dan `loansRouter`. |
| *"Alur peminjaman mandiri via QR code publik sudah kompatibel dengan backend lokal."* | **FAKTA KODE** | Dibuktikan oleh kontrak `GET /assets/scan` dan `POST /loan-requests` yang keduanya tidak memerlukan header `Authorization` dan menerima payload frontend. |

---

## 6. Daftar Blocker Utama

1. **Blocker 1 (Backend Auth Route Gap):** Tidak ada endpoint `POST /api/v1/auth/login` dan `GET /api/v1/auth/me` pada server Express.
2. **Blocker 2 (Frontend Token Transport Gap):** Frontend tidak memiliki state atau helper HTTP (`fetchWithAuth`) yang menyertakan header `Authorization: Bearer <token>`.
3. **Blocker 3 (Kredensial Akun Database):** Database PostgreSQL lokal memuat 4 akun staf dengan kolom `password_hash` berisi hash sintetis (dummy hash). Tanpa mekanisme login backend atau penyetelan password yang diketahui, pengujian login riil belum dapat dilakukan.

---

## 7. Rekomendasi Perubahan Minimum yang Aman (Untuk Ditinjau Operator)

Jika operator memutuskan untuk mengaktifkan integrasi login frontend ke backend lokal di masa mendatang:

### A. Sisi Backend (`server/`):
1. **Tambahkan Router Autentikasi (`server/src/routes/auth.ts`):**
   - Implementasikan `POST /api/v1/auth/login`:
     - Menerima `{ identifier, password }`.
     - Mencari user di tabel `users` berdasarkan `employee_number` atau `email`.
     - Memvalidasi password menggunakan `bcrypt.compare` (atau mekanisme dev fallback yang terkontrol).
     - Menghasilkan token JWT menggunakan `generateTestToken` / `jwt.sign(payload, config.jwtSecret)`.
     - Mengembalikan `{ token, user: { id, fullName, role, ... } }`.
   - Implementasikan `GET /api/v1/auth/me`:
     - Dilindungi `requireAuth`.
     - Mengembalikan data user dari `req.user`.
2. **Daftarkan `authRouter` pada `server/src/index.ts`.**

### B. Sisi Frontend (`src/`):
1. **Perbarui `src/services/api.ts`:**
   - Tambahkan fungsi `login(identifier, password)` yang memanggil `POST /auth/login`.
   - Simpan token di `sessionStorage` (aman untuk sesi tab browser).
   - Buat helper `authFetch(url, options)` yang secara otomatis melampirkan header `Authorization: Bearer ${token}` untuk endpoint terproteksi (`/assets`, `/loans`).
2. **Perbarui `src/pages/Login.tsx`:**
   - Ubah `handleSubmit` agar memanggil `await api.login(identifier, password)`.
3. **Perbarui `src/context/AuthContext.tsx`:**
   - Simpan token dan panggil `api.getCurrentUser()` dengan token aktif saat aplikasi dimuat.

---

## 8. Status Akhir Audit
- **Status Integrasi Login Frontend:** **BLOCKED (RANCANGAN MOCK SAAT INI BELUM TERHUBUNG KE BACKEND HTTP)**
- **Status Tindakan:** **AUDIT SELESAI. TIDAK ADA KODE YANG DIUBAH (SESUAI ATURAN KESELAMATAN #1).**
