import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { pool } from '../../server/src/db.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { getStoredToken, setStoredToken, removeStoredToken } from '../services/api';

describe('SIMSARPRAS Master Data Pengguna & Logout Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const adminToken = generateTestToken({
    id: 'usr-admin-1',
    fullName: 'Bambang Hermawan, S.Kom.',
    employeeNumber: '198204152008011005',
    email: 'admin.sarpras@smkn1teladan.sch.id',
    role: 'ADMIN_SARPRAS',
  });

  const guruToken = generateTestToken({
    id: 'usr-guru-1',
    fullName: 'Siti Nurhaliza, S.Pd.',
    employeeNumber: '199003202015022003',
    email: 'siti.nurhaliza@smkn1teladan.sch.id',
    role: 'GURU_PEGAWAI',
  });

  const kepsekToken = generateTestToken({
    id: 'usr-kepsek-1',
    fullName: 'Drs. H. Ahmad Sudirman, M.Pd.',
    employeeNumber: '196811121994031002',
    email: 'kepsek@smkn1teladan.sch.id',
    role: 'KEPALA_SEKOLAH',
  });

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // =========================================================================
  // 1. Uji Logout dan Pembersihan Sesi
  // =========================================================================
  describe('1. Logout dan Pembersihan Sesi', () => {
    it('membersihkan token sesi lokal saat fungsi logout dipanggil', async () => {
      setStoredToken('sample-jwt-token');
      expect(getStoredToken()).toBe('sample-jwt-token');

      // Panggil endpoint logout backend
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('Logout berhasil');

      // Sesi lokal dibersihkan
      removeStoredToken();
      expect(getStoredToken()).toBeNull();
    });

    it('mendukung endpoint logout tanpa token untuk pembersihan sisi klien yang aman', async () => {
      const res = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
      });
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // 2. Proteksi Halaman dan Endpoint Tanpa Autentikasi
  // =========================================================================
  describe('2. Akses Tanpa Autentikasi Ditolak (Fail-Closed)', () => {
    it('menolak akses GET /api/v1/users tanpa Bearer Token dengan HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('menolak akses POST /api/v1/users tanpa Bearer Token dengan HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Budi' }),
      });
      expect(res.status).toBe(401);
    });

    it('menolak akses GET /api/v1/assets tanpa Bearer Token dengan HTTP 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets`);
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 3. Otorisasi Pengelolaan Pengguna (Role Matrix)
  // =========================================================================
  describe('3. Pembatasan Hak Akses Berdasarkan Peran (RBAC)', () => {
    it('mengizinkan ADMIN_SARPRAS untuk melihat daftar pengguna', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it('menolak peran GURU_PEGAWAI saat mengakses GET /api/v1/users dengan HTTP 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${guruToken}` },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
      expect(json.message).toContain('tidak memiliki hak akses');
    });

    it('menolak peran KEPALA_SEKOLAH saat mengakses GET /api/v1/users dengan HTTP 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${kepsekToken}` },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
    });

    it('menolak peran GURU_PEGAWAI saat mencoba menambah pengguna (POST /api/v1/users)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${guruToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Percobaan Pengguna Guru',
          email: 'percobaan.guru@smkn1teladan.sch.id',
          role: 'ADMIN_SARPRAS',
          password: 'Password1r 23!',
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. Sanitasi Output & Pencegahan Kebocoran Kata Sandi
  // =========================================================================
  describe('4. Kerahasiaan Data (Anti-Leak Kata Sandi & Hash)', () => {
    it('memastikan password_hash dan password tidak pernah dikembalikan pada GET /api/v1/users', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      json.data.forEach((user: any) => {
        expect(user.password).toBeUndefined();
        expect(user.password_hash).toBeUndefined();
        expect(user.passwordHash).toBeUndefined();
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('fullName');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
        expect(user).toHaveProperty('isActive');
      });
    });
  });

  // =========================================================================
  // 5. Validasi Duplikasi Email & NIP
  // =========================================================================
  describe('5. Penolakan Duplikasi Email dan NIP', () => {
    it('menolak pembuatan pengguna dengan email yang sudah terdaftar (HTTP 409)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Admin Kloning',
          email: 'admin.sarpras@smkn1teladan.sch.id', // Email admin yang sudah ada
          role: 'ADMIN_SARPRAS',
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('DUPLICATE_EMAIL');
      expect(json.message).toContain('sudah digunakan');
    });

    it('menolak pembuatan pengguna dengan NIP yang sudah terdaftar (HTTP 409)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Pegawai Kloning NIP',
          employeeNumber: '198204152008011005', // NIP admin yang sudah ada
          email: 'pegawai.unik.baru@smkn1teladan.sch.id',
          role: 'GURU_PEGAWAI',
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('DUPLICATE_EMPLOYEE_NUMBER');
      expect(json.message).toContain('sudah digunakan');
    });
  });

  // =========================================================================
  // 6. Proteksi Akun Admin Terakhir & Diri Sendiri
  // =========================================================================
  describe('6. Proteksi Akun Admin Terakhir & Self-Deactivation', () => {
    it('menolak admin menonaktifkan akun dirinya sendiri saat sedang login (HTTP 400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users/usr-admin-1/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('CANNOT_DEACTIVATE_SELF');
    });
  });

  // =========================================================================
  // 7. Integritas Data Aset & Identitas QR
  // =========================================================================
  describe('7. Integritas Data Aset dan Identitas QR Tetap Utuh', () => {
    it('memastikan 11 aset inventaris tetap utuh dengan identitas QR stabil', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const assets = json.data || json;
      expect(assets.length).toBeGreaterThanOrEqual(11);

      // Pastikan atribut QR dan permanentId tidak berubah
      assets.forEach((asset: any) => {
        expect(asset.id).toBeTruthy();
        expect(asset.permanentId).toBeTruthy();
        expect(asset.qrToken).toBeTruthy();
        expect(asset.assetCode).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // 8. Siklus Hidup Pengguna (Buat, Ubah Profil, Nonaktifkan, Tolak Login)
  // =========================================================================
  describe('8. Siklus Lengkap Pengelolaan Pengguna & Penolakan Login Akun Nonaktif', () => {
    let createdUserId: string | null = null;
    const testEmail = `guru.uji.${Date.now()}@smkn1teladan.sch.id`;
    const testNip = `NIP-${Date.now().toString().slice(-10)}`;
    const testPassword = 'PasswordUji123!';

    afterAll(async () => {
      // Bersihkan akun pengujian sementara agar tidak mengotori basis data
      if (createdUserId && pool) {
        try {
          await pool.query('DELETE FROM users WHERE id = $1', [createdUserId]);
        } catch { }
      }
    });

    it('admin berhasil membuat akun pengguna baru dengan kata sandi ter-hash', async () => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Guru Pengujian Otomatis',
          employeeNumber: testNip,
          email: testEmail,
          role: 'GURU_PEGAWAI',
          password: testPassword,
          department: 'Laboratorium Komputer',
          isActive: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.fullName).toBe('Guru Pengujian Otomatis');
      expect(json.data.email).toBe(testEmail);
      expect(json.data.role).toBe('GURU_PEGAWAI');
      expect(json.data.isActive).toBe(true);
      expect(json.data.password).toBeUndefined();
      expect(json.data.password_hash).toBeUndefined();

      createdUserId = json.data.id;
    });

    it('admin berhasil memperbarui profil pengguna tanpa menimpa kata sandi', async () => {
      if (!createdUserId) return;

      const res = await fetch(`${baseUrl}/api/v1/users/${createdUserId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'Guru Pengujian Otomatis Terupdate',
          department: 'Unit Multimedia & TI',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.fullName).toBe('Guru Pengujian Otomatis Terupdate');
      expect(json.data.department).toBe('Unit Multimedia & TI');
    });

    it('pengguna baru dapat login saat status aktif', async () => {
      if (!createdUserId) return;

      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.token).toBeTruthy();
      expect(json.user.email).toBe(testEmail);
    });

    it('admin menonaktifkan akun pengguna dengan PATCH /api/v1/users/:id/status', async () => {
      if (!createdUserId) return;

      const res = await fetch(`${baseUrl}/api/v1/users/${createdUserId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: false }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.isActive).toBe(false);
    });

    it('akun yang telah dinonaktifkan ditolak saat login dengan HTTP 403 ACCOUNT_INACTIVE', async () => {
      if (!createdUserId) return;

      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: testEmail,
          password: testPassword,
        }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('ACCOUNT_INACTIVE');
      expect(json.message).toContain('Akun pengguna dinonaktifkan');
    });
  });

});
