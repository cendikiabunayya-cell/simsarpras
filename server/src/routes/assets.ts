import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { tokenParamSchema, assetCreateSchema, assetUpdateSchema } from '../validators.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { sseManager } from '../realtime/sseManager.js';

export const assetsRouter = Router();

// Rate limiter scan publik: 60 request per menit per IP untuk mencegah enumerasi massal (Fase 2I.4)
export const publicScanLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Terlalu banyak permintaan pemindaian barcode dari perangkat Anda. Silakan coba lagi 1 menit kemudian.',
});

/**
 * Format baris database PostgreSQL ke struktur JSON standar SIMSARPRAS internal (Admin/Staff)
 * Digunakan untuk listing data aset terotentikasi yang memuat catatan internal dan sumber dana.
 */
export function formatAssetResponse(row: any) {
  let standardAccessories: string[] = [];
  if (Array.isArray(row.standard_accessories)) {
    standardAccessories = row.standard_accessories;
  } else if (typeof row.standard_accessories === 'string') {
    try {
      standardAccessories = JSON.parse(row.standard_accessories);
    } catch {
      standardAccessories = [];
    }
  }

  const base = {
    id: row.id,
    permanentId: row.permanent_id,
    qrToken: row.qr_token,
    assetCode: row.asset_code,
    itemNumber: row.item_number || null,
    itemName: row.item_name,
    institution: row.institution,
    categoryId: row.category_id,
    categoryName: row.category_name,
    locationId: row.location_id,
    locationName: row.location_name,
    itemBrand: row.item_brand,
    fundingSource: row.funding_source,
    acquisitionYear: row.acquisition_year,
    technicalSpecs: row.technical_specs,
    effectiveLoanMode: row.effective_loan_mode,
    conditionStatus: row.condition_status,
    operationalStatus: row.operational_status,
    photoPath: row.photo_url,
    photoUrl: row.photo_url,
    notes: row.notes,
    standardAccessories,
    isDecommissioned: Boolean(row.is_decommissioned),
    decommissionedAt: row.decommissioned_at,
    decommissionedReason: row.decommissioned_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    ...base,
    asset: base, // Mempertahankan backward compatibility untuk konsumen yang membaca res.asset
  };
}

/**
 * Format baris database PostgreSQL ke struktur JSON publik yang telah disanitasi (Allowlist - Fase 2I.4)
 * Mencegah kebocoran catatan internal staf (notes), sumber pendanaan, dan data internal lain.
 */
export function formatPublicAssetResponse(row: any) {
  let standardAccessories: string[] = [];
  if (Array.isArray(row.standard_accessories)) {
    standardAccessories = row.standard_accessories;
  } else if (typeof row.standard_accessories === 'string') {
    try {
      standardAccessories = JSON.parse(row.standard_accessories);
    } catch {
      standardAccessories = [];
    }
  }

  const base = {
    id: row.id,
    permanentId: row.permanent_id,
    qrToken: row.qr_token,
    assetCode: row.asset_code,
    itemNumber: row.item_number || null,
    itemName: row.item_name,
    institution: row.institution,
    categoryId: row.category_id,
    categoryName: row.category_name,
    locationId: row.location_id,
    locationName: row.location_name,
    itemBrand: row.item_brand,
    technicalSpecs: row.technical_specs,
    effectiveLoanMode: row.effective_loan_mode,
    conditionStatus: row.condition_status,
    operationalStatus: row.operational_status,
    photoPath: row.photo_url,
    photoUrl: row.photo_url,
    standardAccessories,
    isDecommissioned: Boolean(row.is_decommissioned),
    decommissionedAt: row.decommissioned_at,
    decommissionedReason: row.decommissioned_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  return {
    ...base,
    asset: base, // Mempertahankan backward compatibility untuk konsumen yang membaca res.asset
  };
}

/**
 * Logika inti pencarian aset berdasarkan token barcode, kode aset, permanentId, atau ID unit
 * Mengembalikan respons ter-allowlist (formatPublicAssetResponse) untuk scan publik.
 */
async function lookupAsset(rawIdentifier: string, res: Response) {
  const parseResult = tokenParamSchema.safeParse(rawIdentifier);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: parseResult.error.errors[0]?.message || 'Format token atau kode inventaris tidak valid.',
    });
  }

  const identifier = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung. Backend dalam mode persiapan.',
    });
  }

  try {
    const query = `
      SELECT 
        id, permanent_id, qr_token, asset_code, item_name, institution,
        category_id, category_name, location_id, location_name, item_brand,
        technical_specs, effective_loan_mode,
        condition_status, operational_status, photo_url,
        standard_accessories, is_decommissioned, decommissioned_at, decommissioned_reason,
        created_at, updated_at
      FROM assets
      WHERE qr_token = $1 OR permanent_id = $1 OR asset_code = $1 OR id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Data barang tidak ditemukan atau kode inventaris salah.',
      });
    }

    const row = result.rows[0];
    const formatted = formatPublicAssetResponse(row);

    if (formatted.isDecommissioned) {
      return res.status(200).json({
        ...formatted,
        notice: 'BARANG_DINONAKTIFKAN',
        message: 'Barang ini telah dinonaktifkan atau dihapus secara logis dari inventaris aktif.',
      });
    }

    return res.status(200).json(formatted);
  } catch (error: any) {
    // Log kesalahan sistem tanpa mengekspos detail SQL/kredensial ke pengguna
    console.error('[Assets Lookup Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Terjadi kesalahan sistem saat mencari data barang.',
    });
  }
}

// 1. Endpoint Scan dengan query parameter ?query=... (dilindungi rate limiter 60 req/min)
assetsRouter.get('/scan', publicScanLimiter, async (req: Request, res: Response) => {
  const queryParam = req.query.query || req.query.code || req.query.token;
  if (!queryParam || typeof queryParam !== 'string') {
    return res.status(400).json({
      error: 'MISSING_QUERY_PARAMETER',
      message: 'Parameter pencarian barcode (?query=...) wajib diisi.',
    });
  }
  return lookupAsset(queryParam, res);
});

// 2. Alias Endpoint Scan dengan path parameter /scan/:token (dilindungi rate limiter)
assetsRouter.get('/scan/:token', publicScanLimiter, async (req: Request, res: Response) => {
  return lookupAsset(req.params.token, res);
});

// 3. Endpoint Legacy /token/:token (dilindungi rate limiter)
assetsRouter.get('/token/:token', publicScanLimiter, async (req: Request, res: Response) => {
  return lookupAsset(req.params.token, res);
});

// 4. Daftar Aset dengan Filter (DILINDUNGI requireAuth - Hanya Staf/Admin Terotentikasi)
assetsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const {
      categoryId,
      locationId,
      operationalStatus,
      fundingSourceId,
      fundingSource,
      acquisitionYear,
      institution,
      itemNumber,
      search,
      q,
      limit,
      offset,
      page,
    } = req.query;

    let query = 'SELECT * FROM assets WHERE is_decommissioned = false';
    const params: any[] = [];

    if (categoryId && typeof categoryId === 'string' && categoryId.trim() !== '') {
      params.push(categoryId.trim());
      query += ` AND category_id = $${params.length}`;
    }
    if (locationId && typeof locationId === 'string' && locationId.trim() !== '') {
      params.push(locationId.trim());
      query += ` AND location_id = $${params.length}`;
    }
    if (operationalStatus && typeof operationalStatus === 'string' && operationalStatus.trim() !== '') {
      params.push(operationalStatus.trim());
      query += ` AND operational_status = $${params.length}`;
    }

    // Filter Sumber Pendanaan (Mendukung ID atau Nama)
    const fundingParam = ((fundingSourceId || fundingSource) as string)?.trim();
    if (fundingParam) {
      params.push(fundingParam);
      query += ` AND (funding_source = $${params.length} OR funding_source IN (SELECT name FROM funding_sources WHERE id = $${params.length}))`;
    }

    // Filter Tahun Perolehan
    if (acquisitionYear !== undefined && acquisitionYear !== '' && acquisitionYear !== null) {
      const parsedYear = parseInt(String(acquisitionYear), 10);
      if (!isNaN(parsedYear)) {
        params.push(parsedYear);
        query += ` AND acquisition_year = $${params.length}`;
      }
    }

    // Filter Satuan Pendidikan
    if (institution && typeof institution === 'string' && institution.trim() !== '') {
      params.push(institution.trim());
      query += ` AND institution = $${params.length}`;
    }

    // Filter Nomor Barang (Mendukung kecocokan langsung atau tanpa leading zero, misal '01' / '1')
    if (itemNumber && typeof itemNumber === 'string' && itemNumber.trim() !== '') {
      const numTrim = itemNumber.trim();
      params.push(numTrim);
      query += ` AND (item_number = $${params.length} OR TRIM(LEADING '0' FROM COALESCE(item_number, '')) = TRIM(LEADING '0' FROM $${params.length}))`;
    }

    // Filter Pencarian Teks
    const searchParam = ((search || q) as string)?.trim();
    if (searchParam) {
      params.push(`%${searchParam}%`);
      query += ` AND (item_name ILIKE $${params.length} OR asset_code ILIKE $${params.length} OR item_brand ILIKE $${params.length} OR technical_specs ILIKE $${params.length} OR COALESCE(item_number, '') ILIKE $${params.length})`;
    }

    // Hitung total data yang cocok sebelum pagination
    let totalCount: number;
    const countRes = await pool.query(`SELECT COUNT(*) FROM (${query}) AS filtered_assets`, params);
    totalCount = parseInt(countRes.rows[0].count, 10);

    query += ' ORDER BY created_at DESC';

    // Dukungan Pagination jika parameter limit/page/offset diberikan
    const limitNum = limit ? parseInt(String(limit), 10) : undefined;
    let offsetNum = offset ? parseInt(String(offset), 10) : undefined;
    if (page && limitNum && offsetNum === undefined) {
      const pageNum = parseInt(String(page), 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        offsetNum = (pageNum - 1) * limitNum;
      }
    }

    if (limitNum && !isNaN(limitNum)) {
      params.push(limitNum);
      query += ` LIMIT $${params.length}`;
    }
    if (offsetNum && !isNaN(offsetNum)) {
      params.push(offsetNum);
      query += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);
    const data = result.rows.map(formatAssetResponse);
    return res.status(200).json({ data, total: totalCount });
  } catch (error: any) {
    console.error('[Assets Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar aset inventaris.',
    });
  }
});

// Endpoint untuk mendapatkan daftar tahun perolehan unik yang tersedia di inventaris
assetsRouter.get('/years', requireAuth, async (_req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const result = await pool.query(`
      SELECT DISTINCT acquisition_year
      FROM assets
      WHERE acquisition_year IS NOT NULL AND is_decommissioned = false
      ORDER BY acquisition_year DESC
    `);
    const years = result.rows
      .map((r) => r.acquisition_year)
      .filter((y): y is number => typeof y === 'number' && !isNaN(y));
    return res.status(200).json(years);
  } catch (error: any) {
    console.error('[Assets Years Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat daftar tahun perolehan.',
    });
  }
});

// 5. Lookup Aset berdasarkan ID (/assets/:id)
assetsRouter.get('/:id', publicScanLimiter, async (req: Request, res: Response) => {
  return lookupAsset(req.params.id, res);
});

/**
 * 6. POST /api/v1/assets
 * Menambahkan aset inventaris baru (ADMIN_SARPRAS)
 */
assetsRouter.post('/', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const parseResult = assetCreateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format data barang tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const data = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Validasi dan resolusi ruangan / lokasi
    const locRes = await pool.query('SELECT id, name FROM locations WHERE id = $1', [data.locationId]);
    if (locRes.rows.length === 0) {
      return res.status(400).json({
        error: 'INVALID_LOCATION',
        message: 'Ruangan / lokasi yang dipilih tidak terdaftar dalam database.',
      });
    }
    const locationName = locRes.rows[0].name;

    // 2. Validasi dan resolusi kategori jika diberikan
    let categoryId = data.categoryId || null;
    let categoryName = data.categoryName || 'Umum';
    if (categoryId) {
      const catRes = await pool.query('SELECT id, name FROM categories WHERE id = $1', [categoryId]);
      if (catRes.rows.length > 0) {
        categoryName = catRes.rows[0].name;
      }
    } else if (data.categoryName) {
      const catRes = await pool.query(
        'SELECT id, name FROM categories WHERE LOWER(name) = LOWER($1)',
        [data.categoryName]
      );
      if (catRes.rows.length > 0) {
        categoryId = catRes.rows[0].id;
        categoryName = catRes.rows[0].name;
      }
    }

    // 3. Tentukan kode aset, QR token, dan permanent ID yang stabil
    const assetCode = (data.assetCode || `INV-${Date.now().toString().slice(-6)}`).toUpperCase();
    const qrToken = (data.qrToken || `QR-${assetCode}`).toUpperCase();
    const permanentId = `ast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const id = permanentId;

    // 4. Validasi keunikan kode aset dan QR token
    const codeCheck = await pool.query(
      'SELECT id FROM assets WHERE asset_code = $1 OR qr_token = $2 LIMIT 1',
      [assetCode, qrToken]
    );
    if (codeCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_ASSET_CODE',
        message: `Kode barang "${assetCode}" atau token QR sudah digunakan oleh barang lain.`,
      });
    }

    const photoUrl = data.photoUrl || data.photoPath || null;

    const insertQuery = `
      INSERT INTO assets (
        id, permanent_id, qr_token, asset_code, item_number, item_name, institution,
        category_id, category_name, location_id, location_name, item_brand,
        funding_source, acquisition_year, technical_specs, effective_loan_mode,
        condition_status, operational_status, photo_url, notes, standard_accessories
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *
    `;

    const insertRes = await pool.query(insertQuery, [
      id,
      permanentId,
      qrToken,
      assetCode,
      data.itemNumber || null,
      data.itemName,
      data.institution,
      categoryId,
      categoryName,
      data.locationId,
      locationName,
      data.itemBrand,
      data.fundingSource,
      data.acquisitionYear,
      data.technicalSpecs,
      data.effectiveLoanMode,
      data.conditionStatus,
      data.operationalStatus,
      photoUrl,
      data.notes || null,
      JSON.stringify(data.standardAccessories || []),
    ]);

    const createdRow = insertRes.rows[0];

    // Siarkan event real-time HANYA setelah data berhasil disimpan ke database
    sseManager.broadcast('asset.updated', {
      assetId: id,
      assetCode,
      action: 'created',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: id,
      status: data.operationalStatus || 'AVAILABLE',
    });

    return res.status(201).json(formatAssetResponse(createdRow));
  } catch (error: any) {
    console.error('[Asset Creation Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menambahkan data barang ke database.',
    });
  }
});

/**
 * 7. PATCH /api/v1/assets/:id
 * Memperbarui data aset (ADMIN_SARPRAS)
 * Menjaga identitas QR, permanentId, dan assetCode agar tidak rusak tanpa sengaja.
 */
assetsRouter.patch('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const parseResult = assetUpdateSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Format data perbaruan barang tidak valid.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const data = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existingRes = await pool.query('SELECT * FROM assets WHERE id = $1', [targetId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Data barang tidak ditemukan.',
      });
    }

    const current = existingRes.rows[0];

    // Jika locationId diubah, validasi dan dapatkan nama ruangan baru
    let locationName = current.location_name;
    if (data.locationId && data.locationId !== current.location_id) {
      const locRes = await pool.query('SELECT id, name FROM locations WHERE id = $1', [data.locationId]);
      if (locRes.rows.length === 0) {
        return res.status(400).json({
          error: 'INVALID_LOCATION',
          message: 'Ruangan/lokasi tidak valid.',
        });
      }
      locationName = locRes.rows[0].name;
    }

    // Resolusi nama kategori jika categoryId berubah
    let categoryName = current.category_name;
    if (data.categoryId && data.categoryId !== current.category_id) {
      const catRes = await pool.query('SELECT id, name FROM categories WHERE id = $1', [data.categoryId]);
      if (catRes.rows.length > 0) {
        categoryName = catRes.rows[0].name;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (data.itemName !== undefined) {
      params.push(data.itemName);
      updates.push(`item_name = $${params.length}`);
    }
    if (data.itemNumber !== undefined) {
      params.push(data.itemNumber || null);
      updates.push(`item_number = $${params.length}`);
    }
    if (data.institution !== undefined) {
      params.push(data.institution);
      updates.push(`institution = $${params.length}`);
    }
    if (data.categoryId !== undefined) {
      params.push(data.categoryId);
      updates.push(`category_id = $${params.length}`);
      params.push(categoryName);
      updates.push(`category_name = $${params.length}`);
    } else if (data.categoryName !== undefined) {
      params.push(data.categoryName);
      updates.push(`category_name = $${params.length}`);
    }
    if (data.locationId !== undefined) {
      params.push(data.locationId);
      updates.push(`location_id = $${params.length}`);
      params.push(locationName);
      updates.push(`location_name = $${params.length}`);
    }
    if (data.itemBrand !== undefined) {
      params.push(data.itemBrand);
      updates.push(`item_brand = $${params.length}`);
    }
    if (data.fundingSource !== undefined) {
      params.push(data.fundingSource);
      updates.push(`funding_source = $${params.length}`);
    }
    if (data.acquisitionYear !== undefined) {
      params.push(data.acquisitionYear);
      updates.push(`acquisition_year = $${params.length}`);
    }
    if (data.technicalSpecs !== undefined) {
      params.push(data.technicalSpecs);
      updates.push(`technical_specs = $${params.length}`);
    }
    if (data.effectiveLoanMode !== undefined) {
      params.push(data.effectiveLoanMode);
      updates.push(`effective_loan_mode = $${params.length}`);
    }
    if (data.conditionStatus !== undefined) {
      params.push(data.conditionStatus);
      updates.push(`condition_status = $${params.length}`);
    }
    if (data.operationalStatus !== undefined) {
      params.push(data.operationalStatus);
      updates.push(`operational_status = $${params.length}`);
    }
    const newPhoto = data.photoUrl !== undefined ? data.photoUrl : data.photoPath;
    if (newPhoto !== undefined) {
      params.push(newPhoto || null);
      updates.push(`photo_url = $${params.length}`);
    }
    if (data.notes !== undefined) {
      params.push(data.notes || null);
      updates.push(`notes = $${params.length}`);
    }
    if (data.standardAccessories !== undefined) {
      params.push(JSON.stringify(data.standardAccessories));
      updates.push(`standard_accessories = $${params.length}`);
    }

    updates.push(`updated_at = NOW()`);

    params.push(targetId);
    const updateQuery = `
      UPDATE assets
      SET ${updates.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, params);
    const updatedRow = updateRes.rows[0];
    const formatted = formatAssetResponse(updatedRow);

    // Siarkan event real-time setelah perubahan aset berhasil disimpan
    sseManager.broadcast('asset.updated', {
      assetId: formatted.id,
      assetCode: formatted.assetCode,
      action: 'updated',
    });

    if (data.operationalStatus !== undefined || data.conditionStatus !== undefined) {
      sseManager.broadcast('asset.availability_changed', {
        assetId: formatted.id,
        status: formatted.operationalStatus,
      });
    }

    return res.status(200).json(formatted);
  } catch (error: any) {
    console.error('[Asset Update Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memperbarui data barang di database.',
    });
  }
});

/**
 * 8. POST /api/v1/assets/:id/decommission
 * Menonaktifkan aset secara logis (Soft Decommission) oleh ADMIN_SARPRAS.
 * Mengubah operational_status menjadi 'INACTIVE' dan is_decommissioned = true.
 */
assetsRouter.post('/:id/decommission', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const reason = (req.body?.reason || 'Dinonaktifkan oleh administrator').trim();

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const existingRes = await pool.query('SELECT * FROM assets WHERE id = $1', [targetId]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Data barang tidak ditemukan.',
      });
    }

    const current = existingRes.rows[0];

    // Cek apakah barang memiliki transaksi peminjaman aktif
    const activeLoansRes = await pool.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE asset_id = $1 
         AND status IN ('PENDING_APPROVAL', 'APPROVED', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED', 'RETURN_ISSUE')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);
    if (activeLoansCount > 0) {
      return res.status(409).json({
        error: 'ACTIVE_LOANS_EXIST',
        message: `Barang "${current.item_name}" (${current.asset_code}) tidak dapat dinonaktifkan karena masih terikat dalam transaksi peminjaman aktif atau proses pengembalian.`,
      });
    }

    const updateQuery = `
      UPDATE assets
      SET is_decommissioned = true,
          decommissioned_at = NOW(),
          decommissioned_reason = $1,
          operational_status = 'INACTIVE',
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, [reason, targetId]);
    const updatedRow = updateRes.rows[0];
    const formatted = formatAssetResponse(updatedRow);

    // Catat audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          req.user?.id || 'system',
          req.user?.fullName || 'Admin Sarpras',
          req.user?.role || 'ADMIN_SARPRAS',
          'NONAKTIF_BARANG',
          'ASSET',
          targetId,
          current.item_name,
          `Menonaktifkan barang inventaris: ${current.item_name} (${current.asset_code}) — Alasan: ${reason}`,
        ]
      );
    } catch (auditErr) {
      console.warn('[Audit Log Write Warning]:', auditErr);
    }

    sseManager.broadcast('asset.updated', {
      assetId: formatted.id,
      assetCode: formatted.assetCode,
      action: 'decommissioned',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: formatted.id,
      status: 'INACTIVE',
    });

    return res.status(200).json(formatted);
  } catch (error: any) {
    console.error('[Asset Decommission Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menonaktifkan data barang di database.',
    });
  }
});

/**
 * 9. DELETE /api/v1/assets/:id
 * Menghapus data barang inventaris (ADMIN_SARPRAS only).
 * 
 * Aturan Ketat:
 * 1. Barang AKTIF tidak boleh dihapus -> HTTP 409 Conflict (CANNOT_DELETE_ACTIVE_ASSET).
 * 2. Barang dengan transaksi aktif (PENDING_APPROVAL, APPROVED, READY_FOR_HANDOVER, ACTIVE,
 *    RETURN_REQUESTED, RETURN_RECEIVED, RETURN_ISSUE) ditolak -> HTTP 409 (ACTIVE_LOANS_EXIST).
 * 3. Barang tidak aktif dengan riwayat transaksi terdahulu: diarsipkan / soft-deleted (mode: 'ARCHIVED')
 *    demi integritas foreign key RESTRICT dan audit trail.
 * 4. Barang tidak aktif tanpa riwayat transaksi apa pun: dihapus permanen (mode: 'DELETED').
 * 5. Eksekusi dalam transaksi ACID dengan SELECT ... FOR UPDATE untuk keamanan konkurensi.
 * 6. Pencatatan audit_logs dan broadcast realtime.
 */
assetsRouter.delete('/:id', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const reason = (req.body?.reason || 'Dihapus oleh administrator inventaris').trim();

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Kunci baris aset menggunakan SELECT ... FOR UPDATE untuk mencegah race condition konkurensi
    const assetRes = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [targetId]);
    if (assetRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Data barang tidak ditemukan dalam database.',
      });
    }

    const asset = assetRes.rows[0];

    // 2. Evaluasi status keaktifan barang
    // Status aktif: operational_status !== 'INACTIVE' DAN is_decommissioned == false
    // Nilai operational_status tidak aktif: 'INACTIVE'
    const isInactive = asset.operational_status === 'INACTIVE' || Boolean(asset.is_decommissioned);

    if (!isInactive) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CANNOT_DELETE_ACTIVE_ASSET',
        message: `Barang "${asset.item_name}" (${asset.asset_code}) masih berstatus aktif (${asset.operational_status}). Barang aktif tidak boleh dihapus. Silakan nonaktifkan barang terlebih dahulu sebelum diajukan untuk dihapus.`,
      });
    }

    // 3. Periksa apakah barang masih memiliki transaksi peminjaman aktif atau pengembalian berjalan
    const activeLoansRes = await client.query(
      `SELECT COUNT(*) AS total FROM loans 
       WHERE asset_id = $1 
         AND status IN ('PENDING_APPROVAL', 'APPROVED', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED', 'RETURN_ISSUE')`,
      [targetId]
    );
    const activeLoansCount = parseInt(activeLoansRes.rows[0].total, 10);

    if (activeLoansCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'ACTIVE_LOANS_EXIST',
        message: `Barang "${asset.item_name}" (${asset.asset_code}) tidak dapat dihapus karena masih terkait dengan ${activeLoansCount} transaksi peminjaman aktif atau pengembalian yang sedang berjalan.`,
      });
    }

    // 4. Periksa apakah barang memiliki riwayat transaksi peminjaman lampau (COMPLETED, REJECTED, CANCELLED)
    const totalLoansRes = await client.query(
      'SELECT COUNT(*) AS total FROM loans WHERE asset_id = $1',
      [targetId]
    );
    const totalLoansCount = parseInt(totalLoansRes.rows[0].total, 10);

    let deleteMode: 'DELETED' | 'ARCHIVED' = 'DELETED';
    let resultData: any = null;

    if (totalLoansCount > 0) {
      // Memiliki riwayat transaksi: Terapkan pengarsipan / soft delete
      deleteMode = 'ARCHIVED';
      const updateRes = await client.query(
        `UPDATE assets 
         SET is_decommissioned = true, 
             decommissioned_at = COALESCE(decommissioned_at, NOW()), 
             decommissioned_reason = $1, 
             operational_status = 'INACTIVE', 
             updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [reason, targetId]
      );
      resultData = formatAssetResponse(updateRes.rows[0]);
    } else {
      // Tidak memiliki riwayat relasi peminjaman: Hapus permanen
      deleteMode = 'DELETED';
      await client.query('DELETE FROM assets WHERE id = $1', [targetId]);
      resultData = {
        id: asset.id,
        assetCode: asset.asset_code,
        itemName: asset.item_name,
        permanentId: asset.permanent_id,
        qrToken: asset.qr_token,
      };
    }

    // 5. Catat audit log dalam transaksi ACID
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        auditId,
        req.user?.id || 'system',
        req.user?.fullName || 'Admin Sarpras',
        req.user?.role || 'ADMIN_SARPRAS',
        deleteMode === 'DELETED' ? 'HAPUS_BARANG' : 'ARSIP_BARANG',
        'ASSET',
        targetId,
        asset.item_name,
        deleteMode === 'DELETED'
          ? `Menghapus data barang secara permanen: ${asset.item_name} (${asset.asset_code}) — Alasan: ${reason}`
          : `Mengarsipkan data barang dengan riwayat transaksi: ${asset.item_name} (${asset.asset_code}) — Alasan: ${reason}`,
      ]
    );

    // Commit transaksi
    await client.query('COMMIT');

    // 6. Siarkan event SSE real-time setelah commit berhasil
    sseManager.broadcast('asset.updated', {
      assetId: targetId,
      assetCode: asset.asset_code,
      action: deleteMode === 'DELETED' ? 'deleted' : 'archived',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: targetId,
      status: 'INACTIVE',
    });

    return res.status(200).json({
      success: true,
      mode: deleteMode,
      message:
        deleteMode === 'DELETED'
          ? `Data barang "${asset.item_name}" (${asset.asset_code}) berhasil dihapus secara permanen.`
          : `Barang "${asset.item_name}" (${asset.asset_code}) memiliki riwayat transaksi peminjaman, sehingga diarsipkan secara aman untuk menjaga keutuhan riwayat audit.`,
      data: resultData,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Asset Deletion Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memproses penghapusan barang.',
    });
  } finally {
    client.release();
  }
});

