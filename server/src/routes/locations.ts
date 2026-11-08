import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { locationSchema, updateLocationSchema } from '../validators.js';

export const locationsRouter = Router();

/**
 * Format baris database ke JSON standar
 */
function formatLocation(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  };
}

/**
 * 1. GET /api/v1/locations (dan alias /locations)
 * Mendapatkan seluruh daftar ruangan/lokasi
 */
locationsRouter.get('/', async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { isActive } = req.query;
    let query = 'SELECT id, name, code, description, is_active, created_at FROM locations WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined && isActive !== '') {
      params.push(String(isActive) === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    const data = result.rows.map(formatLocation);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Locations Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar ruangan/lokasi.',
    });
  }
});

/**
 * 2. POST /api/v1/locations
 * Menambahkan ruangan/lokasi baru (ADMIN_SARPRAS)
 */
locationsRouter.post('/', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const parseResult = locationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format input ruangan tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const { name, code, description, isActive } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Cek duplikasi nama ruangan (case-insensitive)
    const nameCheck = await pool.query(
      'SELECT id FROM locations WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_LOCATION_NAME',
        message: `Ruangan dengan nama "${name}" sudah terdaftar.`,
      });
    }

    // Tentukan kode ruangan unik jika tidak diisi
    const finalCode = (code || `RNG-${Date.now().toString().slice(-4)}`).toUpperCase();

    // 2. Cek duplikasi kode ruangan
    const codeCheck = await pool.query(
      'SELECT id FROM locations WHERE UPPER(code) = UPPER($1) LIMIT 1',
      [finalCode]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_LOCATION_CODE',
        message: `Kode ruangan "${finalCode}" sudah digunakan oleh ruangan lain.`,
      });
    }

    const newId = `loc-${Date.now().toString(36)}`;
    const insertQuery = `
      INSERT INTO locations (id, name, code, description, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, code, description, is_active, created_at
    `;
    const result = await pool.query(insertQuery, [
      newId,
      name,
      finalCode,
      description || null,
      isActive ?? true,
    ]);

    return res.status(201).json(formatLocation(result.rows[0]));
  } catch (error: any) {
    console.error('[Location Creation Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menambahkan ruangan baru.',
    });
  }
});

/**
 * 3. PATCH /api/v1/locations/:id
 * Mengubah data ruangan/lokasi (ADMIN_SARPRAS)
 */
locationsRouter.patch('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = updateLocationSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format pembaruan ruangan tidak valid.',
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
    const existing = await pool.query('SELECT * FROM locations WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'LOCATION_NOT_FOUND',
        message: 'Ruangan/lokasi tidak ditemukan.',
      });
    }

    const current = existing.rows[0];
    const data = parseResult.data;

    // Cek duplikasi nama jika diubah
    if (data.name && data.name.toLowerCase() !== current.name.toLowerCase()) {
      const nameCheck = await pool.query(
        'SELECT id FROM locations WHERE LOWER(name) = LOWER($1) AND id != $2 LIMIT 1',
        [data.name, targetId]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_LOCATION_NAME',
          message: `Ruangan dengan nama "${data.name}" sudah terdaftar.`,
        });
      }
    }

    // Cek duplikasi kode jika diubah
    if (data.code && data.code.toUpperCase() !== (current.code || '').toUpperCase()) {
      const codeCheck = await pool.query(
        'SELECT id FROM locations WHERE UPPER(code) = UPPER($1) AND id != $2 LIMIT 1',
        [data.code.toUpperCase(), targetId]
      );
      if (codeCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_LOCATION_CODE',
          message: `Kode ruangan "${data.code}" sudah digunakan oleh ruangan lain.`,
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      params.push(data.name);
      updates.push(`name = $${params.length}`);
    }
    if (data.code !== undefined) {
      params.push(data.code.toUpperCase());
      updates.push(`code = $${params.length}`);
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
      return res.status(200).json(formatLocation(current));
    }

    params.push(targetId);
    const updateQuery = `
      UPDATE locations
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, name, code, description, is_active, created_at
    `;
    const result = await pool.query(updateQuery, params);

    // Sinkronisasi nama ruangan pada aset terkait jika nama diubah
    if (data.name !== undefined && data.name !== current.name) {
      await pool.query('UPDATE assets SET location_name = $1 WHERE location_id = $2', [
        data.name,
        targetId,
      ]);
    }

    return res.status(200).json(formatLocation(result.rows[0]));
  } catch (error: any) {
    console.error('[Location Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui data ruangan.',
    });
  }
});

/**
 * 4. DELETE /api/v1/locations/:id
 * Menghapus ruangan/lokasi jika tidak ada aset yang mereferensikannya (ADMIN_SARPRAS)
 */
locationsRouter.delete('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existing = await pool.query('SELECT * FROM locations WHERE id = $1', [targetId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'LOCATION_NOT_FOUND',
        message: 'Ruangan/lokasi tidak ditemukan.',
      });
    }

    // Periksa apakah ruangan masih digunakan oleh data barang
    const assetCountRes = await pool.query(
      'SELECT COUNT(*) AS total FROM assets WHERE location_id = $1',
      [targetId]
    );
    const assetCount = parseInt(assetCountRes.rows[0].total, 10);
    if (assetCount > 0) {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: `Ruangan "${existing.rows[0].name}" tidak dapat dihapus karena masih digunakan oleh ${assetCount} unit barang/sarana. Pindahkan barang terlebih dahulu atau nonaktifkan ruangan.`,
      });
    }

    await pool.query('DELETE FROM locations WHERE id = $1', [targetId]);
    return res.status(200).json({
      success: true,
      message: `Ruangan "${existing.rows[0].name}" berhasil dihapus.`,
    });
  } catch (error: any) {
    if (error?.code === '23503') {
      return res.status(409).json({
        error: 'RESOURCE_IN_USE',
        message: 'Ruangan tidak dapat dihapus karena masih memiliki relasi data aktif.',
      });
    }
    console.error('[Location Deletion Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menghapus ruangan/lokasi.',
    });
  }
});
