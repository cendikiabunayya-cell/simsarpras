import type { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();

  const limiter = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Gunakan req.ip atau fallback headers
    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);

    let record = store.get(key);

    if (!record || record.resetTime <= now) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(key, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > options.max) {
      res.setHeader('Retry-After', resetSeconds);
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message:
          options.message ||
          'Terlalu banyak permintaan pengajuan peminjaman dari IP ini. Silakan coba lagi beberapa saat kemudian.',
        retryAfterSeconds: resetSeconds,
      });
    }

    next();
  };

  limiter.reset = () => {
    store.clear();
  };

  return limiter;
}
