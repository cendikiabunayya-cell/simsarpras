import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { fundingSourceSchema, updateFundingSourceSchema } from '../validators.js';

export const fundingSourcesRouter = Router();

function formatFundingSource(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

/**
 * 1. GET /api/v1/funding-sources (dan alias /funding-sources)
 * Mendapatkan seluruh daftar sumber pendanaan
 */
fundingSourcesRouter.get('/', async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { isActive } = req.query;
    let query = 'SELECT id, name, description, is_active, created_at FROM funding_sources WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined && isActive !== '') {
      params.push(String(isActive) === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    const data = result.rows.map(formatFundingSource);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Funding Sources Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar sumber pendanaan.',
    });
  }
});

/**
 * 2. POST /api/v1/funding-sources
 * Menambahkan sumber pendanaan baru (ADMIN_SARPRAS)
 */
fundingSourcesRouter.post('/', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const parseResult = fundingSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format input sumber pendanaan tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { name, description, isActive } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // Cek duplikasi nama sumber dana (case-insensitive)
    const nameCheck = await pool.query(
      'SELECT id FROM funding_sources WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_FUNDING_SOURCE',
        message: `Sumber pendanaan "${name}" sudah terdaftar.`,
      });
    }

    const newId = `fs-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO funding_sources (id, name, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, name, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      description || null,
      isActive ?? true,
    ]);

    return res.status(201).json(formatFundingSource(result.rows[0]));
  } catch (error: any) {
    console.error('[Funding Source Creation Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menambahkan sumber pendanaan baru.',
    });
  }
});

/**
 * 3. PATCH /api/v1/funding-sources/:id
 * Mengubah data sumber pendanaan (ADMIN_SARPRAS)
 */
fundingSourcesRouter.patch('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = updateFundingSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format pembaruan sumber dana tidak valid.',
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
    const existing = await pool.query('SELECT * FROM funding_sources WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'FUNDING_SOURCE_NOT_FOUND',
        message: 'Sumber pendanaan tidak ditemukan.',
      });
    }

    const current = existing.rows[0];
    const data = parseResult.data;

    // Cek duplikasi nama jika diubah
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        'SELECT id FROM funding_sources WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1',
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_FUNDING_SOURCE',
          message: `Sumber pendanaan "${data.name}" sudah terdaftar.`,
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
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
      return res.status(200).json(formatFundingSource(current));
    }

    params.push(targetId);
    const updateQuery = `
      UPDATE funding_sources
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);

    // Sinkronisasi funding_source pada tabel assets jika nama diubah
    if (data.name !== undefined && data.name !== current.name) {
      await pool.query('UPDATE assets SET funding_source = $1 WHERE funding_source = $2', [
        data.name,
        current.name,
      ]);
    }

    return res.status(200).json(formatFundingSource(result.rows[0]));
  } catch (error: any) {
    console.error('[Funding Source Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui data sumber pendanaan.',
    });
  }
});

/**
 * 4. DELETE /api/v1/funding-sources/:id
 * Menghapus sumber pendanaan jika tidak ada aset yang mereferensikannya (ADMIN_SARPRAS)
 */
fundingSourcesRouter.delete('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existing = await pool.query('SELECT * FROM funding_sources WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'FUNDING_SOURCE_NOT_FOUND',
        message: 'Sumber pendanaan tidak ditemukan.',
      });
    }

    const currentName = existing.rows[0].name;

    // Periksa apakah sumber dana masih digunakan oleh aset (foreign key mengarah ke funding_sources.name)
    const assetCountRes = await pool.query(
      'SELECT COUNT(*) AS total FROM assets WHERE funding_source = $1',
      [currentName]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: `Sumber pendanaan "${currentName}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Alihkan sumber dana barang terlebih dahulu atau nonaktifkan sumber pendanaan.`,
      });
    }

    await pool.query('DELETE FROM funding_sources WHERE id = $1', [targetId]);
    return res.status(200).json({
      success: true,
      message: `Sumber pendanaan "${currentName}" berhasil dihapus.`,
    });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: 'Sumber pendanaan tidak dapat dihapus karena masih memiliki relasi data aktif.',
      });
    }
    console.error('[Funding Source Deletion Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menghapus sumber pendanaan.',
    });
  }
});
