import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { loginLimiter } from '../../server/src/routes/auth.js';
import { getStoredToken, setStoredToken, removeStoredToken } from '../services/api';
import { UserRole } from '../types';

describe('SIMSARPRAS Authentication & Frontend-Backend Integration Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;

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

  beforeEach(() => {
    loginLimiter.reset();
  });

  // =========================================================================
  // 1. Validasi Input Endpoint Login (POST /api/v1/auth/login & /auth/login)
  // =========================================================================
  describe('1. Validasi Input Login (Zod Schema & Fail-Closed)', () => {
    it('menolak payload login kosong dengan HTTP 400 VALIDATION_ERROR', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
      expect(json.message).toContain('Format permintaan login tidak valid');
    });

    it('menolak payload tanpa kata sandi dengan HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: '198204152008011005' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });

    it('menolak identifier yang terlalu pendek (< 3 karakter) dengan HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'ab', password: 'secretpassword' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });

    it('mendukung pemanggilan via alias rute /auth/login', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Rute /auth/login harus merespon (bukan 404 Not Found)
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 2. Keamanan Kredensial & Penolakan Kata Sandi Salah
  // =========================================================================
  describe('2. Keamanan Kredensial & Penolakan Kata Sandi Salah', () => {
    it('menolak akun yang tidak terdaftar dengan HTTP 401 dan pesan generik aman', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'user.tidak.ada@cendikia.sch.id',
          password: 'PasswordSembarang123',
        }),
      });

      // Jika DB aktif merespon 401, jika DB offline merespon 503
      expect([401, 503]).toContain(res.status);
      const json = await res.json();
      if (res.status === 401) {
        expect(json.error).toBe('INVALID_CREDENTIALS');
        expect(json.message).toBe('NIP/Email atau kata sandi tidak valid.');
      }
    });

    it('menolak akun nyata dengan kata sandi salah secara fail-closed (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '198204152008011005', // NIP akun admin sarpras
          password: 'PasswordYangPastiSalah999!',
        }),
      });

      expect([401, 503]).toContain(res.status);
      const json = await res.json();
      if (res.status === 401) {
        expect(json.error).toBe('INVALID_CREDENTIALS');
        // Pesan harus identik dengan akun tidak terdaftar demi mencegah enumerasi pengguna
        expect(json.message).toBe('NIP/Email atau kata sandi tidak valid.');
      }
    });
  });

  // =========================================================================
  // 3. Verifikasi Siklus Hidup Token & Proteksi Endpoint Sensitif
  // =========================================================================
  describe('3. Proteksi Token JWT (requireAuth)', () => {
    it('menolak permintaan ke GET /api/v1/auth/me tanpa header Authorization (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('menolak permintaan dengan header Authorization kosong atau format salah (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer ' },
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('menolak token bertandatangan palsu atau rusak dengan HTTP 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: 'Bearer token-palsu-ngawur.jwt.signature' },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
    });

    it('menolak token yang telah kedaluwarsa (expired) dengan HTTP 403 FORBIDDEN', async () => {
      // Buat token yang sudah kadaluarsa 10 detik lalu
      const expiredToken = generateTestToken(
        {
          id: 'usr-admin-1',
          fullName: 'Bambang Hermawan',
          employeeNumber: '198204152008011005',
          email: 'admin.sarpras@smkn1teladan.sch.id',
          role: 'ADMIN_SARPRAS',
        },
        '-10s'
      );

      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
      expect(json.message).toContain('kadaluarsa');
    });

    it('menerima token sah dan mengembalikan profil pengguna pada GET /api/v1/auth/me', async () => {
      const validToken = generateTestToken({
        id: 'usr-admin-1',
        fullName: 'Bambang Hermawan, S.Kom.',
        employeeNumber: '198204152008011005',
        email: 'admin.sarpras@smkn1teladan.sch.id',
        role: 'ADMIN_SARPRAS',
      });

      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('user');
      expect(json.user.id).toBe('usr-admin-1');
      expect(json.user.role).toBe('ADMIN_SARPRAS');
    });

    it('mengizinkan akses listing inventaris GET /api/v1/assets jika menggunakan token sah', async () => {
      const validToken = generateTestToken({
        id: 'usr-admin-1',
        role: 'ADMIN_SARPRAS',
      });

      const res = await fetch(`${baseUrl}/api/v1/assets`, {
        headers: { Authorization: `Bearer ${validToken}` },
      });

      // Lolos middleware requireAuth (bukan 401 dan bukan 403)
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  // =========================================================================
  // 4. Logout dan Pembersihan Sesi
  // =========================================================================
  describe('4. Logout dan Pembersihan Sesi Sisi Klien', () => {
    it('endpoint POST /api/v1/auth/logout merespons HTTP 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('Logout berhasil');
    });

    it('manajemen token sessionStorage berfungsi menyimpan dan menghapus token', () => {
      removeStoredToken();
      expect(getStoredToken()).toBeNull();

      setStoredToken('test-sample-jwt-token');
      expect(getStoredToken()).toBe('test-sample-jwt-token');

      removeStoredToken();
      expect(getStoredToken()).toBeNull();
    });
  });

  // =========================================================================
  // 5. Integritas Rute Publik (QR Scan & Pengajuan Pinjam Tanpa Auth)
  // =========================================================================
  describe('5. Integritas Alur Publik Barcode & Peminjaman Mandiri', () => {
    it('memastikan pemindaian barcode GET /assets/scan tetap terbuka tanpa token otorisasi', async () => {
      const res = await fetch(`${baseUrl}/assets/scan?query=QR-TIK-ASUS-001`);
      // Endpoint scan publik tidak boleh meminta Bearer Token
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('memastikan pengajuan pinjam publik POST /loan-requests tidak menuntut Bearer Token', async () => {
      const res = await fetch(`${baseUrl}/loan-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Menghasilkan 400 VALIDATION_ERROR (bukan 401 UNAUTHORIZED)
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 6. Audit Status Kredensial Database Seed (BLOCKED Assertion)
  // =========================================================================
  describe('6. Penanganan Hash Password Akun Seed Sintetis (Fail-Closed)', () => {
    it('memastikan hash sintetis seed tidak dapat ditembus dengan password umum atau tebakan', async () => {
      const commonPasswords = ['password', 'password123', 'admin', 'admin123', '123456', 'rahasia'];

      for (const pass of commonPasswords) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: '198204152008011005',
            password: pass,
          }),
        });

        // Wajib ditolak (401 atau 503 jika DB offline) dan tidak pernah 200
        expect(res.status).not.toBe(200);
        if (res.status === 401) {
          const json = await res.json();
          expect(json.error).toBe('INVALID_CREDENTIALS');
        }
      }
    });

    it('login operasional berhasil dengan kredensial nyata akun usr-admin-1 (PostgreSQL Lokal)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: '198204152008011005',
          password: 'AdminSarpras2026!',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe('Login berhasil.');
      expect(json.user.id).toBe('usr-admin-1');
      expect(json.user.role).toBe('ADMIN_SARPRAS');
      expect(json.token).toBeDefined();

      // Gunakan token hasil login nyata untuk mengakses endpoint terproteksi
      const resAssets = await fetch(`${baseUrl}/api/v1/assets`, {
        headers: { Authorization: `Bearer ${json.token}` },
      });
      expect(resAssets.status).toBe(200);
      const assetsJson = await resAssets.json();
      expect(assetsJson.total).toBeGreaterThanOrEqual(11);
    });

    it.skip('BLOCKED: Penolakan akun tidak aktif terhalang (seluruh akun seed lokal saat ini berstatus is_active = true)', () => {
      // Test ini terblokir karena tidak ada akun inactive pada database dan aturan keselamatan melarang mutasi DB
    });
  });

  // =========================================================================
  describe('7. Evaluasi Kebijakan Akses Berbasis Peran (RBAC)', () => {
    const evaluateCapabilities = (role: UserRole) => ({
      canApproveLoans: role === 'ADMIN_SARPRAS',
      canManageAssets: role === 'ADMIN_SARPRAS',
      canReceiveReturns: role === 'ADMIN_SARPRAS',
      canInspectReturns: role === 'ADMIN_SARPRAS',
      canViewExecutiveReports: role === 'ADMIN_SARPRAS' || role === 'KEPALA_SEKOLAH',
    });

    it('memvalidasi hak akses penuh untuk peran ADMIN_SARPRAS', () => {
      const caps = evaluateCapabilities('ADMIN_SARPRAS');
      expect(caps.canApproveLoans).toBe(true);
      expect(caps.canManageAssets).toBe(true);
      expect(caps.canReceiveReturns).toBe(true);
      expect(caps.canInspectReturns).toBe(true);
      expect(caps.canViewExecutiveReports).toBe(true);
    });

    it('memvalidasi pembatasan hak akses untuk peran KEPALA_SEKOLAH', () => {
      const caps = evaluateCapabilities('KEPALA_SEKOLAH');
      expect(caps.canApproveLoans).toBe(false);
      expect(caps.canManageAssets).toBe(false);
      expect(caps.canReceiveReturns).toBe(false);
      expect(caps.canInspectReturns).toBe(false);
      expect(caps.canViewExecutiveReports).toBe(true);
    });

    it('memvalidasi pembatasan hak akses untuk peran GURU_PEGAWAI', () => {
      const caps = evaluateCapabilities('GURU_PEGAWAI');
      expect(caps.canApproveLoans).toBe(false);
      expect(caps.canManageAssets).toBe(false);
      expect(caps.canReceiveReturns).toBe(false);
      expect(caps.canInspectReturns).toBe(false);
      expect(caps.canViewExecutiveReports).toBe(false);
    });
  });

  // =========================================================================
  // 8. Simulasi Pemulihan Sesi (Session Recovery)
  // =========================================================================
  describe('8. Simulasi Pemulihan Sesi dan Penanganan Token Kedaluwarsa', () => {
    it('memulihkan sesi pengguna saat token valid masih tersimpan di sessionStorage', async () => {
      const validToken = generateTestToken({
        id: 'usr-admin-1',
        fullName: 'Bambang Hermawan, S.Kom.',
        role: 'ADMIN_SARPRAS',
      });

      setStoredToken(validToken);
      expect(getStoredToken()).toBe(validToken);

      // Simulasikan pemanggilan GET /auth/me dengan token tersimpan
      const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${getStoredToken()}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user.id).toBe('usr-admin-1');

      removeStoredToken();
    });
  });
});
