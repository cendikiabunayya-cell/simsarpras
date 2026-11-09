import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { schoolSettingsSchema } from '../validators.js';

export const schoolSettingsRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_DIR = path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.resolve(SETTINGS_DIR, 'school_settings.json');

export interface SchoolSettingsData {
  schoolName: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: SchoolSettingsData = {
  schoolName: 'Madrasah Ibtidaiyah Swasta Cendikia Bunayya',
  address: 'Jalan Terus Jaya No. 2 Kec. Kabanjahe Kab. Karo Sumut',
  phone: '081234567890',
  email: 'sarpras@cendikiabunayya.sch.id',
  logoUrl: '/logo-cendikia.png',
};

/**
 * Membaca pengaturan sekolah dari Database PostgreSQL / Supabase,
 * dengan fallback ke file JSON jika pool belum terhubung.
 */
async function loadSettings(): Promise<SchoolSettingsData> {
  if (pool) {
    try {
      const res = await pool.query(
        `SELECT school_name, address, phone, email, logo_url, updated_at, updated_by 
         FROM school_settings 
         WHERE id = 'default' 
         LIMIT 1`
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          schoolName: row.school_name || DEFAULT_SETTINGS.schoolName,
          address: row.address ?? DEFAULT_SETTINGS.address,
          phone: row.phone ?? DEFAULT_SETTINGS.phone,
          email: row.email ?? DEFAULT_SETTINGS.email,
          logoUrl: row.logo_url ?? '',
          updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
          updatedBy: row.updated_by ?? undefined,
        };
      }
    } catch (e: any) {
      console.warn('[School Settings DB load error, fallback to file]:', e?.message || e);
    }
  }

  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Menyimpan pengaturan sekolah ke Database PostgreSQL / Supabase,
 * dengan fallback ke file JSON lokal jika database tidak tersedia.
 */
async function saveSettings(data: SchoolSettingsData): Promise<void> {
  if (pool) {
    await pool.query(
      `INSERT INTO school_settings (id, school_name, address, phone, email, logo_url, updated_at, updated_by)
       VALUES ('default', $1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (id) DO UPDATE SET
         school_name = EXCLUDED.school_name,
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         email = EXCLUDED.email,
         logo_url = EXCLUDED.logo_url,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by`,
      [
        data.schoolName,
        data.address,
        data.phone,
        data.email,
        data.logoUrl || '',
        data.updatedBy || 'ADMIN_SARPRAS',
      ]
    );
    return;
  }

  // Fallback lokal disk jika pool tidak ada
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (fsErr: any) {
    console.warn('[School Settings FS save skipped]:', fsErr?.message || fsErr);
  }
}

/**
 * 1. GET /api/v1/school-settings
 * Membaca identitas sekolah (publik / dapat diakses komponen aplikasi)
 */
schoolSettingsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await loadSettings();
    return res.status(200).json(settings);
  } catch (error: any) {
    console.error('[School Settings Read Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat pengaturan identitas sekolah.',
    });
  }
});

/**
 * 2. PATCH /api/v1/school-settings & PUT /api/v1/school-settings
 * Memperbarui identitas sekolah (Hanya ADMIN_SARPRAS)
 */
async function handleUpdateSettings(req: Request, res: Response) {
  const parseResult = schoolSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format pengaturan sekolah tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const currentUser = (req as any).user;

  try {
    const current = await loadSettings();
    const updated: SchoolSettingsData = {
      ...current,
      ...parseResult.data,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.fullName || currentUser?.email || 'ADMIN_SARPRAS',
    };

    await saveSettings(updated);
    return res.status(200).json(updated);
  } catch (error: any) {
    console.error('[School Settings Write Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menyimpan pengaturan sekolah.',
    });
  }
}

schoolSettingsRouter.patch('/', requireAuth, requireRole('ADMIN_SARPRAS'), handleUpdateSettings);
schoolSettingsRouter.put('/', requireAuth, requireRole('ADMIN_SARPRAS'), handleUpdateSettings);
