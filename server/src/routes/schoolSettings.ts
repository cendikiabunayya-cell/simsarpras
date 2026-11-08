import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { schoolSettingsSchema } from '../validators.js';

export const schoolSettingsRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Menargetkan direktori server/data/school_settings.json
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
  schoolName: 'MIS Cendikia Bunayya',
  address: 'Jl. Pendidikan No. 123, Medan, Sumatera Utara',
  phone: '081234567890',
  email: 'sarpras@cendikiabunayya.sch.id',
  logoUrl: '',
};

/**
 * Membaca pengaturan sekolah dari file persisten JSON
 */
async function loadSettings(): Promise<SchoolSettingsData> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    // Jika file belum ada, kembalikan pengaturan default
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Menyimpan pengaturan sekolah ke file JSON persisten
 */
async function saveSettings(data: SchoolSettingsData): Promise<void> {
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
