import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { config } from '../config.js';
import { requireAuth, AuthenticatedUser } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { loginSchema } from '../validators.js';

export const authRouter = Router();

// Rate limiter login: maksimal 10 percobaan per menit per IP untuk mencegah brute-force
export const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan masuk dari perangkat Anda. Silakan coba lagi setelah 1 menit.',
});

/**
 * 1. POST /api/v1/auth/login (dan alias /auth/login)
 * Memvalidasi kredensial (NIP atau Email) dan Kata Sandi terhadap database PostgreSQL.
 * Menerbitkan Bearer JWT yang sah berdasarkan data pengguna riil.
 */
authRouter.post('/login', loginLimiter, async (req: Request, res: Response) => {
  // Validasi format input Zod
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format permintaan login tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { identifier, password } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung. Backend dalam mode persiapan.',
    });
  }

  try {
    // Cari user berdasarkan email (case-insensitive) atau nomor pegawai (NIP)
    const query = `
      SELECT id, email, password_hash, full_name, employee_number, role, department, avatar_url, is_active
      FROM users
      WHERE LOWER(email) = LOWER($1) OR employee_number = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      // Tolak dengan pesan generik aman (tidak membocorkan apakah NIP/email terdaftar)
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'NIP/Email atau kata sandi tidak valid.',
      });
    }

    const user = result.rows[0];

    // Periksa status aktif akun pengguna
    if (!user.is_active) {
      return res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'Akun pengguna dinonaktifkan. Silakan hubungi Administrator Sarpras.',
      });
    }

    // Verifikasi kata sandi dengan bcrypt
    const passwordHash = user.password_hash || '';
    const isMatch = await bcrypt.compare(password, passwordHash);

    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'NIP/Email atau kata sandi tidak valid.',
      });
    }

    // Terbitkan JWT resmi berdasarkan data riil dari database (bukan input klien)
    const tokenPayload: AuthenticatedUser = {
      id: user.id,
      fullName: user.full_name,
      employeeNumber: user.employee_number || '-',
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn as any,
    });

    return res.status(200).json({
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        employeeNumber: user.employee_number || '-',
        email: user.email,
        role: user.role,
        department: user.department,
        avatarUrl: user.avatar_url,
      },
    });
  } catch (error: any) {
    console.error('[Auth Login Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan sistem saat memproses autentikasi.',
    });
  }
});

/**
 * 2. GET /api/v1/auth/me (dan alias /auth/me)
 * Mengembalikan profil pengguna yang sedang login berdasarkan Bearer Token JWT.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.user;
  if (!authUser) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Sesi otorisasi tidak valid.',
    });
  }

  if (!pool) {
    // Mode tanpa database: kembalikan klaim token
    return res.status(200).json({
      user: {
        id: authUser.id,
        fullName: authUser.fullName,
        employeeNumber: authUser.employeeNumber,
        email: authUser.email,
        role: authUser.role,
      },
    });
  }

  try {
    const query = `
      SELECT id, email, full_name, employee_number, role, department, avatar_url, is_active
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [authUser.id]);

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND_OR_INACTIVE',
        message: 'Pengguna tidak ditemukan atau akun telah dinonaktifkan.',
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      user: {
        id: row.id,
        fullName: row.full_name,
        employeeNumber: row.employee_number || '-',
        email: row.email,
        role: row.role,
        department: row.department,
        avatarUrl: row.avatar_url,
      },
    });
  } catch (error: any) {
    console.error('[Auth Profile Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat profil pengguna.',
    });
  }
});

/**
 * 3. POST /api/v1/auth/logout (dan alias /auth/logout)
 * Logout stateless: merespons konfirmasi sukses untuk pembersihan token di sisi klien.
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  return res.status(200).json({
    message: 'Logout berhasil. Sesi lokal dibersihkan.',
  });
});
