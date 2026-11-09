import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { categorySchema, updateCategorySchema } from '../validators.js';
import { logAudit } from '../utils/auditLogger.js';

export const categoriesRouter = Router();

function formatCategory(row: any) {
  return {
    id: row.id,
    name: row.name,
    defaultLoanMode: row.default_loan_mode,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

/**
 * 1. GET /api/v1/categories (dan alias /categories)
 * Mendapatkan seluruh daftar kategori barang
 */
categoriesRouter.get('/', async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { isActive } = req.query;
    let query = 'SELECT id, name, default_loan_mode, description, is_active, created_at FROM categories WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined && isActive !== '') {
      params.push(String(isActive) === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    const data = result.rows.map(formatCategory);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Categories Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar kategori.',
    });
  }
});

/**
 * 2. POST /api/v1/categories
 * Menambahkan kategori barang baru (ADMIN_SARPRAS)
 */
categoriesRouter.post('/', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const parseResult = categorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format input kategori tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { name, defaultLoanMode, description, isActive } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // Cek duplikasi nama kategori (case-insensitive)
    const nameCheck = await pool.query(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_CATEGORY_NAME',
        message: `Kategori dengan nama "${name}" sudah terdaftar.`,
      });
    }

    const newId = `cat-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO categories (id, name, default_loan_mode, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, default_loan_mode, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      defaultLoanMode || 'DIRECT',
      description || null,
      isActive ?? true,
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.email || 'Admin Sarpras',
      userRole: req.user?.role || 'ADMIN_SARPRAS',
      action: 'TAMBAH_KATEGORI',
      entityType: 'CATEGORY',
      entityId: newId,
      entityName: name,
      details: `Menambahkan kategori baru: "${name}" (Mode: ${defaultLoanMode || 'DIRECT'})`,
      ipAddress: req.ip,
    });

    return res.status(201).json(formatCategory(result.rows[0]));
  } catch (error: any) {
    console.error('[Category Creation Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menambahkan kategori baru.',
    });
  }
});

/**
 * 3. PATCH /api/v1/categories/:id
 * Mengubah data kategori (ADMIN_SARPRAS)
 */
categoriesRouter.patch('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = updateCategorySchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format pembaruan kategori tidak valid.',
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
    const existing = await pool.query('SELECT * FROM categories WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }

    const current = existing.rows[0];
    const data = parseResult.data;

    // Cek duplikasi nama jika diubah
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1',
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_CATEGORY_NAME',
          message: `Kategori dengan nama "${data.name}" sudah terdaftar.`,
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.defaultLoanMode !== undefined) {
      params.push(data.defaultLoanMode);
      updates.push(`default_loan_mode = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description);
      updates.push(`description = $${params.length}`);
    }
    if (data.isActive !== undefined) {
      params.push(data.isActive);
      updates.push(`is_active = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(200).json(formatCategory(current));
    }

    params.push(targetId);
    const updateQuery = `
      UPDATE categories
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, default_loan_mode, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);

    // Sinkronisasi category_name pada aset terkait jika nama kategori diubah
    if (data.name !== undefined && data.name !== current.name) {
      await pool.query('UPDATE assets SET category_name = $1 WHERE category_id = $2', [
        data.name,
        targetId,
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.email || 'Admin Sarpras',
      userRole: req.user?.role || 'ADMIN_SARPRAS',
      action: 'UBAH_KATEGORI',
      entityType: 'CATEGORY',
      entityId: targetId,
      entityName: data.name || current.name,
      details: `Memperbarui data kategori: "${data.name || current.name}"`,
      ipAddress: req.ip,
    });

    return res.status(200).json(formatCategory(result.rows[0]));
  } catch (error: any) {
    console.error('[Category Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui data kategori.',
    });
  }
});

/**
 * 4. DELETE /api/v1/categories/:id
 * Menghapus kategori barang jika tidak ada aset yang mereferensikannya (ADMIN_SARPRAS)
 */
categoriesRouter.delete('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existing = await pool.query('SELECT * FROM categories WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'CATEGORY_NOT_FOUND',
        message: 'Kategori tidak ditemukan.',
      });
    }

    // Periksa apakah kategori masih digunakan oleh aset
    const assetCountRes = await pool.query(
      'SELECT COUNT(*) AS total FROM assets WHERE category_id = $1',
      [targetId]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: `Kategori "${existing.rows[0].name}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Pindahkan kategori barang terlebih dahulu atau nonaktifkan kategori.`,
      });
    }

    await pool.query('DELETE FROM categories WHERE id = $1', [targetId]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.email || 'Admin Sarpras',
      userRole: req.user?.role || 'ADMIN_SARPRAS',
      action: 'HAPUS_KATEGORI',
      entityType: 'CATEGORY',
      entityId: targetId,
      entityName: existing.rows[0].name,
      details: `Menghapus kategori: "${existing.rows[0].name}"`,
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: `Kategori "${existing.rows[0].name}" berhasil dihapus.`,
    });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: 'Kategori tidak dapat dihapus karena masih memiliki relasi data aktif.',
      });
    }
    console.error('[Category Deletion Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menghapus kategori.',
    });
  }
});
