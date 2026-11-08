import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { sseManager } from '../realtime/sseManager.js';

export const realtimeRouter = Router();

/**
 * Endpoint Utama Server-Sent Events (SSE)
 * GET /api/v1/realtime/events?token=<jwtToken>
 * 
 * Aturan Keamanan:
 * - Wajib menyertakan token JWT autentikasi yang sah (melalui query param ?token=... atau header Authorization).
 * - Pengguna tanpa autentikasi ditolak dengan HTTP 401 demi mencegah akses tidak berhak.
 */
realtimeRouter.get('/events', (req: Request, res: Response) => {
  // 1. Ekstraksi token dari query parameter atau Authorization header
  let token: string | undefined;

  if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.slice(7).trim();
  }

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Autentikasi diperlukan untuk terhubung ke kanal real-time SIMSARPRAS.',
    });
  }

  // 2. Verifikasi keabsahan JWT token
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      id?: string;
      role?: string;
      sub?: string;
    };

    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userId = decoded.id || decoded.sub;
    const role = decoded.role || 'GURU_PEGAWAI';

    // 3. Daftarkan klien ke SSE Manager
    sseManager.addClient({
      id: clientId,
      res,
      userId,
      role,
      connectedAt: Date.now(),
    });
  } catch (err: any) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Token autentikasi tidak valid atau telah kedaluwarsa.',
    });
  }
});

/**
 * Endpoint Status & Monitoring Koneksi Real-time
 * GET /api/v1/realtime/status
 */
realtimeRouter.get('/status', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ACTIVE',
    activeClients: sseManager.getClientCount(),
    timestamp: new Date().toISOString(),
  });
});
