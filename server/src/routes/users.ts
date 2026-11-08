import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from '../validators.js';

export const usersRouter = Router();

// Seluruh endpoint pengguna memerlukan token yang sah dan hak akses ADMIN_SARPRAS
usersRouter.use(requireAuth);
usersRouter.use(requireRole('ADMIN_SARPRAS'));

/**
 * Format baris database PostgreSQL ke struktur JSON aman (tanpa password_hash)
 */
export function formatUserResponse(row: any) {
  return {
    id: row.id,
    fullName: row.full_name,
    employeeNumber: row.employee_number || '-',
    email: row.email,
    role: row.role,
    department: row.department || 'Guru / Pegawai',
    avatarUrl: row.avatar_url || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 1. GET /api/v1/users
 * Mendapatkan daftar seluruh akun pengguna dengan filter opsional pencarian dan peran.
 */
usersRouter.get('/', async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { search, role, isActive } = req.query;
    let query = `
      SELECT id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim().length > 0) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(full_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR employee_number LIKE $${params.length})`;
    }

    if (role && typeof role === 'string' && role.trim().length > 0) {
      params.push(role.trim());
      query += ` AND role = $${params.length}`;
    }

    if (isActive !== undefined && isActive !== '') {
      params.push(String(isActive) === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY created_at ASC';

    const result = await pool.query(query, params);
    const data = result.rows.map(formatUserResponse);

    return res.status(200).json({
      success: true,
      data,
      total: result.rowCount,
    });
  } catch (error: any) {
    console.error('[Users Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar pengguna.',
    });
  }
});

/**
 * 2. POST /api/v1/users
 * Menambahkan akun pengguna baru dengan kata sandi ter-hash bcrypt.
 */
usersRouter.post('/', async (req: Request, res: Response) => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format input pengguna tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { fullName, employeeNumber, email, role, password, department, isActive } =
    parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Cek duplikasi email (case-insensitive)
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_EMAIL',
        message: `Email "${email}" sudah digunakan oleh akun lain.`,
      });
    }

    // 2. Cek duplikasi employee_number jika bukan tanda hubung default '-'
    if (employeeNumber && employeeNumber !== '-') {
      const empCheck = await pool.query(
        'SELECT id FROM users WHERE employee_number = $1 LIMIT 1',
        [employeeNumber]
      );
      if (empCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_EMPLOYEE_NUMBER',
          message: `NIP/Nomor pegawai "${employeeNumber}" sudah digunakan oleh akun lain.`,
        });
      }
    }

    // 3. Hash kata sandi dengan bcrypt (salt rounds 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // 4. Buat identifier ID yang unik
    const newId = `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    // 5. Simpan pengguna baru ke database
    const insertQuery = `
      INSERT INTO users (
        id, email, password_hash, full_name, employee_number, role, department, is_active, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      email,
      passwordHash,
      fullName,
      employeeNumber || '-',
      role,
      department || 'Guru / Pegawai',
      isActive ?? true,
    ]);

    const createdUser = formatUserResponse(result.rows[0]);
    return res.status(201).json({
      success: true,
      message: 'Akun pengguna berhasil ditambahkan.',
      data: createdUser,
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'DUPLICATE_RESOURCE',
        message: 'Email atau NIP sudah terdaftar dalam sistem.',
      });
    }
    console.error('[User Creation Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan sistem saat menyimpan pengguna baru.',
    });
  }
});

/**
 * 3. PATCH /api/v1/users/:id
 * Memperbarui profil, role, atau kata sandi pengguna.
 */
usersRouter.patch('/:id', async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = updateUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format input pembaruan pengguna tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Ambil akun pengguna target
    const existing = await pool.query(
      'SELECT id, email, full_name, employee_number, role, department, is_active FROM users WHERE id = $1',
      [targetId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Pengguna tidak ditemukan.',
      });
    }

    const currentTarget = existing.rows[0];
    const data = parseResult.data;

    // 2. Proteksi admin terakhir jika role diubah dari ADMIN_SARPRAS ke role lain
    if (currentTarget.role === 'ADMIN_SARPRAS' && data.role && data.role !== 'ADMIN_SARPRAS') {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND is_active = true AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          error: 'LAST_ADMIN_PROTECTED',
          message: 'Tidak dapat mengubah peran admin aktif terakhir sistem demi menjaga kelangsungan operasional.',
        });
      }
    }

    // 3. Cek duplikasi email jika email diubah
    if (data.email && data.email.toLowerCase() !== currentTarget.email.toLowerCase()) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1',
        [data.email, targetId]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_EMAIL',
          message: `Email "${data.email}" sudah digunakan oleh akun lain.`,
        });
      }
    }

    // 4. Cek duplikasi NIP jika NIP diubah dan bukan '-'
    if (
      data.employeeNumber &&
      data.employeeNumber !== '-' &&
      data.employeeNumber !== currentTarget.employee_number
    ) {
      const empCheck = await pool.query(
        'SELECT id FROM users WHERE employee_number = $1 AND id != $2 LIMIT 1',
        [data.employeeNumber, targetId]
      );
      if (empCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_EMPLOYEE_NUMBER',
          message: `NIP/Nomor pegawai "${data.employeeNumber}" sudah digunakan oleh akun lain.`,
        });
      }
    }

    // 5. Susun kolom-kolom yang akan diupdate secara dinamis dan aman
    const updates: string[] = [];
    const params: any[] = [];

    if (data.fullName !== undefined) {
      params.push(data.fullName);
      updates.push(`full_name = $${params.length}`);
    }
    if (data.employeeNumber !== undefined) {
      params.push(data.employeeNumber);
      updates.push(`employee_number = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email);
      updates.push(`email = $${params.length}`);
    }
    if (data.role !== undefined) {
      params.push(data.role);
      updates.push(`role = $${params.length}`);
    }
    if (data.department !== undefined) {
      params.push(data.department);
      updates.push(`department = $${params.length}`);
    }
    if (data.isActive !== undefined) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }

    // Hash kata sandi baru hanya jika diisi (string tidak kosong)
    if (data.password && data.password.trim().length >= 6) {
      const newHash = await bcrypt.hash(data.password, 10);
      params.push(newHash);
      updates.push(`password_hash = $${params.length}`);
    }

    updates.push('updated_at = NOW()');

    params.push(targetId);
    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;

    const result = await pool.query(updateQuery, params);
    const updatedUser = formatUserResponse(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: 'Data pengguna berhasil diperbarui.',
      data: updatedUser,
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        error: 'DUPLICATE_RESOURCE',
        message: 'Email atau NIP sudah terdaftar dalam sistem.',
      });
    }
    console.error('[User Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui data pengguna.',
    });
  }
});

/**
 * 4. PATCH /api/v1/users/:id/status
 * Mengaktifkan atau menonaktifkan akun pengguna (Soft Disable).
 */
usersRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = updateUserStatusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Status aktif (isActive) harus berupa boolean.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { isActive } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existing = await pool.query(
      'SELECT id, role, is_active FROM users WHERE id = $1',
      [targetId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Pengguna tidak ditemukan.',
      });
    }

    const currentTarget = existing.rows[0];

    // Jika menonaktifkan akun
    if (!isActive) {
      // 1. Tidak boleh menonaktifkan akun sendiri
      if (req.user?.id === targetId) {
        return res.status(400).json({
          error: 'CANNOT_DEACTIVATE_SELF',
          message: 'Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk.',
        });
      }

      // 2. Proteksi admin terakhir
      if (currentTarget.role === 'ADMIN_SARPRAS') {
        const adminCountRes = await pool.query(
          "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND is_active = true AND id != $1",
          [targetId]
        );
        const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
        if (remainingAdmins === 0) {
          return res.status(400).json({
            error: 'LAST_ADMIN_PROTECTED',
            message: 'Akun admin aktif terakhir tidak dapat dinonaktifkan demi keamanan sistem.',
          });
        }
      }
    }

    const updateQuery = `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, full_name, employee_number, role, department, avatar_url, is_active, created_at, updated_at
    `;
    const result = await pool.query(updateQuery, [isActive, targetId]);
    const updatedUser = formatUserResponse(result.rows[0]);

    return res.status(200).json({
      success: true,
      message: isActive
        ? 'Akun pengguna berhasil diaktifkan kembali.'
        : 'Akun pengguna berhasil dinonaktifkan.',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('[User Status Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui status akun pengguna.',
    });
  }
});

/**
 * 5. DELETE /api/v1/users/:id
 * Menghapus akun pengguna secara permanen jika tidak memiliki tanggungan peminjaman aktif.
 */
usersRouter.delete('/:id', async (req: Request, res: Response) => {
  const targetId = req.params.id;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Cek keberadaan pengguna
    const existing = await pool.query(
      'SELECT id, role, full_name, email FROM users WHERE id = $1',
      [targetId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: 'Pengguna tidak ditemukan.',
      });
    }

    const currentTarget = existing.rows[0];

    // 2. Proteksi diri sendiri
    if (req.user?.id === targetId) {
      return res.status(400).json({
        error: 'CANNOT_DELETE_SELF',
        message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk.',
      });
    }

    // 3. Proteksi admin terakhir
    if (currentTarget.role === 'ADMIN_SARPRAS') {
      const adminCountRes = await pool.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN_SARPRAS' AND id != $1",
        [targetId]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0].total, 10);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          error: 'LAST_ADMIN_PROTECTED',
          message: 'Akun admin aktif terakhir tidak dapat dihapus demi keamanan sistem.',
        });
      }
    }

    // 4. Proteksi tanggungan peminjaman aktif
    const activeLoansRes = await pool.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE borrower_id = $1 AND status IN ('PENDING_APPROVAL', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);
    if (activeLoansCount > 0) {
      return res.status(400).json({
        error: 'ACTIVE_LOANS_EXIST',
        message: 'Pengguna tidak dapat dihapus karena masih memiliki peminjaman barang aktif atau pengembalian yang sedang berjalan.',
      });
    }

    // 5. Cek keterikatan inspeksi fisik pengembalian
    const inspectionRes = await pool.query(
      `SELECT COUNT(*) AS total FROM return_inspections 
       WHERE received_by = $1 OR inspected_by = $1`,
      [targetId]
    );
    const inspectionCount = parseInt(inspectionRes.rows[0].total, 10);
    if (inspectionCount > 0) {
      return res.status(400).json({
        error: 'AUDIT_TRAIL_LOCKED',
        message: 'Pengguna tidak dapat dihapus permanen karena tercatat dalam berkas verifikasi pengembalian fisik barang. Gunakan opsi Nonaktifkan Akun untuk menjaga keabsahan audit.',
      });
    }

    // 6. Eksekusi penghapusan
    await pool.query('DELETE FROM users WHERE id = $1', [targetId]);

    // 7. Catat audit log penghapusan
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit-${Date.now()}`,
          req.user?.id || 'system',
          req.user?.fullName || 'Admin Sarpras',
          req.user?.role || 'ADMIN_SARPRAS',
          'HAPUS_PENGGUNA',
          'USER',
          targetId,
          currentTarget.full_name,
          `Menghapus akun pengguna: ${currentTarget.full_name} (${currentTarget.email})`,
        ]
      );
    } catch (auditErr) {
      console.warn('[Audit Log Write Warning]:', auditErr);
    }

    return res.status(200).json({
      success: true,
      message: `Akun pengguna ${currentTarget.full_name} berhasil dihapus secara permanen.`,
    });
  } catch (error: any) {
    console.error('[User Delete Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menghapus akun pengguna.',
    });
  }
});
