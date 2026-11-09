import { z } from 'zod';

/**
 * SIMSARPRAS API Input Validators & Schemas (Zod)
 * Memvalidasi payload dan format token barcode sebelum query database.
 */

// Format token barcode, kode inventaris, permanentId, atau asset ID
export const TOKEN_REGEX = /^[A-Za-z0-9_\-\.]+$/;

export const tokenParamSchema = z
  .string({ required_error: 'Parameter token atau kode barang wajib diisi.' })
  .trim()
  .min(2, 'Token atau kode barang minimal 2 karakter.')
  .max(100, 'Token atau kode barang maksimal 100 karakter.')
  .regex(
    TOKEN_REGEX,
    'Format token barcode tidak valid. Hanya karakter alfanumerik, tanda hubung (-), titik (.), dan garis bawah (_) yang diperbolehkan.'
  );

export const loanRequestSchema = z.object({
  assetId: z
    .string({ required_error: 'ID atau token barang wajib diisi.' })
    .trim()
    .min(1, 'ID atau token barang tidak boleh kosong.')
    .max(100, 'ID atau token barang maksimal 100 karakter.')
    .regex(TOKEN_REGEX, 'Format ID barang tidak valid.'),
  borrowerName: z
    .string({ required_error: 'Nama peminjam wajib diisi.' })
    .trim()
    .min(2, 'Nama peminjam minimal 2 karakter.')
    .max(200, 'Nama peminjam maksimal 200 karakter.'),
  borrowerEmployeeNumber: z
    .string()
    .trim()
    .max(50, 'NIP/Nomor pegawai maksimal 50 karakter.')
    .default('-'),
  borrowerRole: z
    .enum(['ADMIN_SARPRAS', 'GURU_PEGAWAI', 'KEPALA_SEKOLAH'], {
      errorMap: () => ({
        message: 'Role peminjam harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH.',
      }),
    })
    .default('GURU_PEGAWAI'),
  borrowerId: z.string().trim().max(100).optional(),
  purpose: z
    .string({ required_error: 'Tujuan peminjaman wajib diisi.' })
    .trim()
    .min(3, 'Tujuan peminjaman minimal 3 karakter.')
    .max(500, 'Tujuan peminjaman maksimal 500 karakter.'),
  expectedReturnAt: z
    .string({ required_error: 'Tanggal pengembalian yang direncanakan wajib diisi.' })
    .trim()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Format tanggal pengembalian tidak valid (wajib ISO-8601 string valid).',
    }),
});

/**
 * Normalisasi payload loan request agar mendukung kontrak frontend (src/services/api.ts)
 * maupun kontrak legacy backend Express.
 */
export function normalizeLoanPayload(raw: any) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    assetId: raw.assetId || raw.assetUnitId,
    borrowerName: raw.borrowerName || raw.borrower?.fullName || raw.borrower?.name,
    borrowerEmployeeNumber:
      raw.borrowerEmployeeNumber || raw.borrower?.employeeNumber || raw.borrower?.nip || '-',
    borrowerRole: raw.borrowerRole || raw.borrower?.role || 'GURU_PEGAWAI',
    borrowerId: raw.borrowerId || raw.borrower?.id,
    purpose: raw.purpose,
    expectedReturnAt: raw.expectedReturnAt,
  };
}

/**
 * Skema validasi input login (NIP/Email dan Kata Sandi)
 */
export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'NIP atau email wajib diisi.' })
    .trim()
    .min(3, 'NIP atau email minimal 3 karakter.')
    .max(255, 'NIP atau email maksimal 255 karakter.'),
  password: z
    .string({ required_error: 'Kata sandi wajib diisi.' })
    .min(1, 'Kata sandi tidak boleh kosong.')
    .max(255, 'Kata sandi maksimal 255 karakter.'),
});

/**
 * Skema validasi tambah pengguna baru (Master Data Pengguna)
 */
export const createUserSchema = z.object({
  fullName: z
    .string({ required_error: 'Nama lengkap wajib diisi.' })
    .trim()
    .min(2, 'Nama lengkap minimal 2 karakter.')
    .max(255, 'Nama lengkap maksimal 255 karakter.'),
  employeeNumber: z
    .string()
    .trim()
    .max(50, 'NIP/Nomor pegawai maksimal 50 karakter.')
    .optional()
    .default('-'),
  email: z
    .string({ required_error: 'Email kedinasan wajib diisi.' })
    .trim()
    .email('Format email tidak valid.')
    .max(255, 'Email maksimal 255 karakter.'),
  role: z.enum(['ADMIN_SARPRAS', 'GURU_PEGAWAI', 'KEPALA_SEKOLAH'], {
    errorMap: () => ({
      message: 'Peran harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH.',
    }),
  }),
  password: z
    .string({ required_error: 'Kata sandi awal wajib diisi.' })
    .min(6, 'Kata sandi minimal 6 karakter.')
    .max(255, 'Kata sandi maksimal 255 karakter.'),
  department: z
    .string()
    .trim()
    .max(255, 'Departemen maksimal 255 karakter.')
    .optional()
    .default('Guru / Pegawai'),
  isActive: z.boolean().optional().default(true),
});

/**
 * Skema validasi ubah pengguna (Master Data Pengguna)
 */
export const updateUserSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Nama lengkap minimal 2 karakter.')
    .max(255, 'Nama lengkap maksimal 255 karakter.')
    .optional(),
  employeeNumber: z
    .string()
    .trim()
    .max(50, 'NIP/Nomor pegawai maksimal 50 karakter.')
    .optional(),
  email: z
    .string()
    .trim()
    .email('Format email tidak valid.')
    .max(255, 'Email maksimal 255 karakter.')
    .optional(),
  role: z
    .enum(['ADMIN_SARPRAS', 'GURU_PEGAWAI', 'KEPALA_SEKOLAH'], {
      errorMap: () => ({
        message: 'Peran harus salah satu dari: ADMIN_SARPRAS, GURU_PEGAWAI, KEPALA_SEKOLAH.',
      }),
    })
    .optional(),
  password: z
    .string()
    .min(6, 'Kata sandi baru minimal 6 karakter.')
    .max(255, 'Kata sandi maksimal 255 karakter.')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .trim()
    .max(255, 'Departemen maksimal 255 karakter.')
    .optional(),
  isActive: z.boolean().optional(),
});

/**
 * Skema validasi status aktif pengguna (Aktifkan / Nonaktifkan Akun)
 */
export const updateUserStatusSchema = z.object({
  isActive: z.boolean({
    required_error: 'Status aktif (isActive) wajib berupa nilai boolean true atau false.',
    invalid_type_error: 'Status aktif (isActive) harus boolean.',
  }),
});

/**
 * Validasi tautan URL aman HTTPS (untuk Google Drive atau foto aset)
 */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(1000, 'URL tautan foto maksimal 1000 karakter.')
  .refine(
    (val) => {
      if (!val) return true; // Opsional / kosong diperbolehkan
      // Izinkan path lokal publik seperti /logo-cendikia.png
      if (val.startsWith('/')) return true;
      try {
        const parsed = new URL(val);
        // Wajib protokol HTTPS aman (tolak javascript:, data:, file:, http:, dll)
        if (parsed.protocol !== 'https:') return false;
        if (parsed.username || parsed.password) return false;
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Tautan foto harus berupa URL valid dengan protokol HTTPS (https://) dan tidak menggunakan skema berbahaya.' }
  );

/**
 * Skema validasi Ruangan / Lokasi
 */
export const locationSchema = z.object({
  name: z
    .string({ required_error: 'Nama ruangan/lokasi wajib diisi.' })
    .trim()
    .min(2, 'Nama ruangan minimal 2 karakter.')
    .max(100, 'Nama ruangan maksimal 100 karakter.'),
  code: z
    .string()
    .trim()
    .max(50, 'Kode ruangan maksimal 50 karakter.')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Keterangan ruangan maksimal 500 karakter.')
    .optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateLocationSchema = locationSchema.partial();

/**
 * Skema validasi Kategori Barang
 */
export const categorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(100, 'Nama kategori maksimal 100 karakter.'),
  defaultLoanMode: z
    .enum(['DIRECT', 'ADMIN_APPROVAL'], {
      errorMap: () => ({
        message: 'Mode peminjaman harus DIRECT atau ADMIN_APPROVAL.',
      }),
    })
    .default('DIRECT'),
  description: z
    .string()
    .trim()
    .max(500, 'Keterangan kategori maksimal 500 karakter.')
    .optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = categorySchema.partial();

/**
 * Skema validasi Sumber Pendanaan
 */
export const fundingSourceSchema = z.object({
  name: z
    .string({ required_error: 'Nama sumber pendanaan wajib diisi.' })
    .trim()
    .min(2, 'Nama sumber pendanaan minimal 2 karakter.')
    .max(100, 'Nama sumber pendanaan maksimal 100 karakter.'),
  description: z
    .string()
    .trim()
    .max(500, 'Keterangan sumber dana maksimal 500 karakter.')
    .optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateFundingSourceSchema = fundingSourceSchema.partial();

/**
 * Skema validasi Pengaturan Identitas Sekolah
 */
export const schoolSettingsSchema = z.object({
  schoolName: z
    .string({ required_error: 'Nama sekolah wajib diisi.' })
    .trim()
    .min(2, 'Nama sekolah minimal 2 karakter.')
    .max(255, 'Nama sekolah maksimal 255 karakter.'),
  address: z
    .string()
    .trim()
    .max(500, 'Alamat sekolah maksimal 500 karakter.')
    .optional()
    .default(''),
  phone: z
    .string()
    .trim()
    .max(50, 'Nomor telepon/kontak maksimal 50 karakter.')
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .max(255, 'Email sekolah maksimal 255 karakter.')
    .refine(
      (val) => {
        if (!val) return true;
        return z.string().email().safeParse(val).success;
      },
      { message: 'Format email sekolah tidak valid.' }
    )
    .optional()
    .default(''),
  logoUrl: httpsUrlSchema.optional().default(''),
  headmasterName: z.string().trim().max(255).optional().default(''),
  headmasterNip: z.string().trim().max(100).optional().default(''),
  sarprasManagerName: z.string().trim().max(255).optional().default(''),
  sarprasManagerNip: z.string().trim().max(100).optional().default(''),
});

/**
 * Skema validasi tambah aset baru
 */
export const assetCreateSchema = z.object({
  itemName: z
    .string({ required_error: 'Nama barang wajib diisi.' })
    .trim()
    .min(2, 'Nama barang minimal 2 karakter.')
    .max(255, 'Nama barang maksimal 255 karakter.'),
  institution: z.string().trim().max(128).optional().default('MIS Cendikia Bunayya'),
  categoryId: z.string().trim().max(64).optional(),
  categoryName: z.string().trim().max(128).optional(),
  locationId: z
    .string({ required_error: 'Ruangan/lokasi wajib dipilih.' })
    .trim()
    .min(1, 'Ruangan/lokasi wajib dipilih.'),
  locationName: z.string().trim().max(128).optional(),
  itemBrand: z.string().trim().max(128).optional().default('Standar'),
  fundingSource: z.string().trim().max(128).optional().default('BOS Reguler'),
  acquisitionYear: z
    .union([z.number(), z.string()])
    .transform((val) => Number(val) || new Date().getFullYear())
    .optional(),
  technicalSpecs: z.string().trim().max(2000).optional().default('-'),
  effectiveLoanMode: z.enum(['DIRECT', 'ADMIN_APPROVAL']).optional().default('DIRECT'),
  conditionStatus: z
    .enum(['GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE', 'LOST'])
    .optional()
    .default('GOOD'),
  operationalStatus: z
    .enum([
      'AVAILABLE',
      'UNAVAILABLE',
      'RESERVED',
      'ON_LOAN',
      'RETURN_PENDING',
      'RETURN_INSPECTION',
      'MAINTENANCE',
      'INACTIVE',
      'LOST',
    ])
    .optional()
    .default('AVAILABLE'),
  photoUrl: httpsUrlSchema.optional().nullable(),
  photoPath: httpsUrlSchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional(),
  assetCode: z.string().trim().max(64).optional(),
  itemNumber: z.string().trim().max(64).optional().nullable(),
  qrToken: z.string().trim().max(64).optional(),
  serialNumber: z.string().trim().max(128).optional(),
  standardAccessories: z.array(z.string()).optional().default([]),
});

export const assetUpdateSchema = assetCreateSchema.partial();


