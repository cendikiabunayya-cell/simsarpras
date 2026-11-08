import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthenticatedUser {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware untuk memproteksi endpoint data internal/sensitif (riwayat pinjaman)
 * Mencegah eksposur data transaksi dan identitas peminjam tanpa otentikasi.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Akses ditolak. Token otorisasi (Bearer Token) diperlukan untuk mengakses sumber daya ini.',
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Token otorisasi kosong.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (_error: any) {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Token otorisasi tidak valid atau telah kadaluarsa.',
    });
  }
}

/**
 * Middleware untuk membatasi akses berdasarkan peran pengguna (Role-Based Access Control)
 * Contoh: requireRole('ADMIN_SARPRAS')
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Akses ditolak. Token otorisasi diperlukan.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: `Akses ditolak. Peran "${req.user.role}" tidak memiliki hak akses untuk tindakan ini.`,
      });
    }

    next();
  };
}

/**
 * Helper untuk membuat token otentikasi uji coba
 */
export function generateTestToken(payload: Partial<AuthenticatedUser> = {}, expiresIn: string | number = '1h'): string {
  return jwt.sign(
    {
      id: payload.id || 'usr-test-1',
      fullName: payload.fullName || 'Pengguna Uji Coba',
      employeeNumber: payload.employeeNumber || 'NIP-TEST-001',
      email: payload.email || 'test@cendikia.sch.id',
      role: payload.role || 'ADMIN_SARPRAS',
    },
    config.jwtSecret,
    { expiresIn: expiresIn as any }
  );
}

