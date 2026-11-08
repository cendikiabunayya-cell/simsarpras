import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { loanRequestSchema, normalizeLoanPayload } from '../validators.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { formatAssetResponse } from './assets.js';
import { sseManager } from '../realtime/sseManager.js';

export const loansRouter = Router();

// Rate limiter: 10 pengajuan pinjaman per menit per IP untuk mencegah spam submission
export const loanSubmissionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Terlalu banyak permintaan pengajuan pinjaman dari perangkat Anda. Silakan tunggu 1 menit.',
});

/**
 * Format baris database PostgreSQL ke struktur JSON standar SIMSARPRAS
 */
export function formatLoanResponse(row: any, assetRow?: any) {
  return {
    id: row.id,
    loanNumber: row.loan_number,
    assetId: row.asset_id,
    borrowerId: row.borrower_id || null,
    borrowerName: row.borrower_name,
    borrowerEmployeeNumber: row.borrower_employee_number || '-',
    borrowerRole: row.borrower_role || 'GURU_PEGAWAI',
    status: row.status,
    loanModeSnapshot: row.loan_mode_snapshot,
    purpose: row.purpose,
    requestedAt: row.requested_at,
    expectedReturnAt: row.expected_return_at,
    approvedBy: row.approved_by || null,
    approvedAt: row.approved_at || null,
    rejectionReason: row.rejection_reason || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    unit: assetRow ? formatAssetResponse(assetRow) : undefined,
  };
}

/**
 * Handler bersama untuk pengajuan peminjaman (POST /loans/request dan POST /loan-requests)
 * Dilengkapi Pessimistic Row Lock (FOR UPDATE) untuk menjamin ACID dan mencegah double-booking.
 */
async function handleLoanSubmission(req: Request, res: Response) {
  // 1. Normalisasi payload (kompatibel src/services/api.ts dan legacy Express)
  const normalized = normalizeLoanPayload(req.body);

  // 2. Validasi input skema menggunakan Zod
  const parseResult = loanRequestSchema.safeParse(normalized);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Data pengajuan peminjaman tidak memenuhi syarat validasi.',
      details: parseResult.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  const {
    assetId,
    borrowerName,
    borrowerEmployeeNumber,
    borrowerRole,
    borrowerId,
    purpose,
    expectedReturnAt,
  } = parseResult.data;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung. Backend dalam mode persiapan.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 3. Ambil data aset dengan Pessimistic Row Lock (FOR UPDATE)
    const assetRes = await client.query(
      `SELECT id, operational_status, effective_loan_mode, item_name, is_decommissioned 
       FROM assets 
       WHERE id = $1 OR qr_token = $1 OR permanent_id = $1 OR asset_code = $1
       FOR UPDATE`,
      [assetId]
    );

    if (assetRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Barang tidak ditemukan di inventaris.',
      });
    }

    const asset = assetRes.rows[0];
    const canonicalAssetId = asset.id;

    if (asset.is_decommissioned) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ASSET_DECOMMISSIONED',
        message: 'Barang ini telah dinonaktifkan dari inventaris dan tidak dapat dipinjam.',
      });
    }

    if (asset.operational_status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'ASSET_NOT_AVAILABLE',
        message: `Barang saat ini berstatus ${asset.operational_status} dan tidak sedang tersedia untuk dipinjam.`,
      });
    }

    // 4. Tentukan status awal berdasarkan mode peminjaman
    const isDirect = asset.effective_loan_mode === 'DIRECT';
    const initialLoanStatus = isDirect ? 'ACTIVE' : 'PENDING_APPROVAL';
    const nextUnitStatus = isDirect ? 'ON_LOAN' : 'RESERVED';

    // 5. Perbarui status unit aset di bawah lock transaksi
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, updated_at = NOW() 
       WHERE id = $2`,
      [nextUnitStatus, canonicalAssetId]
    );

    // 6. Buat ID & nomor peminjaman unik
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const loanNumber = `PINJAM-${dateStr}-${randomSuffix}`;
    const loanId = `loan-${Date.now()}-${randomSuffix}`;

    // 7. Masukkan transaksi peminjaman
    const loanInsertRes = await client.query(
      `INSERT INTO loans (
        id, loan_number, asset_id, borrower_id, borrower_name, borrower_employee_number,
        borrower_role, status, loan_mode_snapshot, purpose, expected_return_at, requested_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        loanId,
        loanNumber,
        canonicalAssetId,
        borrowerId || null,
        borrowerName,
        borrowerEmployeeNumber || '-',
        borrowerRole || 'GURU_PEGAWAI',
        initialLoanStatus,
        asset.effective_loan_mode,
        purpose,
        expectedReturnAt,
      ]
    );

    await client.query('COMMIT');

    // 8. Siarkan event real-time HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.created', {
      loanId,
      loanNumber,
      assetId: canonicalAssetId,
      borrowerName,
      status: initialLoanStatus,
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: canonicalAssetId,
      status: nextUnitStatus,
    });

    const formattedLoan = formatLoanResponse(loanInsertRes.rows[0], asset);

    return res.status(201).json({
      ...formattedLoan,
      loan: formattedLoan,
      message: isDirect
        ? 'Peminjaman mandiri berhasil aktif (Mode Direct).'
        : 'Pengajuan peminjaman berhasil dicatat dan menunggu persetujuan admin.',
      nextUnitStatus,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Loan Request Error]:', error?.message || error);
    return res.status(500).json({
      error: 'TRANSACTION_FAILED',
      message: 'Gagal memproses transaksi peminjaman.',
    });
  } finally {
    client.release();
  }
}

// 1. Endpoint Pengajuan Pinjaman (Legacy Path /request dan Top-level /)
loansRouter.post('/request', loanSubmissionLimiter, handleLoanSubmission);
loansRouter.post('/', loanSubmissionLimiter, handleLoanSubmission);

// 2. Daftar Transaksi Peminjaman (Dilindungi Auth Token)
loansRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { status } = req.query;
    let query = `
      SELECT l.*, 
             a.id as a_id, a.item_name, a.asset_code, a.qr_token, a.permanent_id,
             a.photo_url, a.category_name, a.location_name, a.effective_loan_mode,
             a.condition_status, a.operational_status
      FROM loans l
      JOIN assets a ON l.asset_id = a.id
    `;
    const params: any[] = [];

    if (status && typeof status === 'string') {
      params.push(status);
      query += ` WHERE l.status = $1`;
    }

    query += ' ORDER BY l.requested_at DESC';

    const result = await pool.query(query, params);
    const data = result.rows.map((row) =>
      formatLoanResponse(row, {
        id: row.a_id,
        item_name: row.item_name,
        asset_code: row.asset_code,
        qr_token: row.qr_token,
        permanent_id: row.permanent_id,
        photo_url: row.photo_url,
        category_name: row.category_name,
        location_name: row.location_name,
        effective_loan_mode: row.effective_loan_mode,
        condition_status: row.condition_status,
        operational_status: row.operational_status,
      })
    );

    return res.status(200).json({ data, total: result.rowCount });
  } catch (error: any) {
    console.error('[Loans Listing Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat riwayat peminjaman.',
    });
  }
});

// 3. Detail Peminjaman berdasarkan ID (Dilindungi Auth Token)
loansRouter.get('/:id', requireAuth, async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const { id } = req.params;
    const query = `
      SELECT l.*, 
             a.id as a_id, a.item_name, a.asset_code, a.qr_token, a.permanent_id,
             a.photo_url, a.category_name, a.location_name, a.effective_loan_mode,
             a.condition_status, a.operational_status
      FROM loans l
      JOIN assets a ON l.asset_id = a.id
      WHERE l.id = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data transaksi peminjaman tidak ditemukan.',
      });
    }

    const row = result.rows[0];
    const data = formatLoanResponse(row, {
      id: row.a_id,
      item_name: row.item_name,
      asset_code: row.asset_code,
      qr_token: row.qr_token,
      permanent_id: row.permanent_id,
      photo_url: row.photo_url,
      category_name: row.category_name,
      location_name: row.location_name,
      effective_loan_mode: row.effective_loan_mode,
      condition_status: row.condition_status,
      operational_status: row.operational_status,
    });

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[Loan Detail Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat detail peminjaman.',
    });
  }
});

// 4. Setujui Pengajuan Peminjaman (ADMIN_SARPRAS)
loansRouter.post('/:id/approve', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const loanId = req.params.id;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loanRes = await client.query(
      'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data permohonan peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];

    if (currentLoan.status !== 'PENDING_APPROVAL') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_LOAN_STATUS',
        message: `Hanya pengajuan berstatus PENDING_APPROVAL yang dapat disetujui. Status saat ini: ${currentLoan.status}.`,
      });
    }

    const adminUser = (req as any).user || {};
    const adminId = adminUser.id || 'usr-admin-1';
    const adminName = adminUser.fullName || 'Admin Sarpras';

    // Perbarui status pinjaman menjadi ACTIVE
    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'ACTIVE', approved_by = $1, approved_by_name = $2, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [adminId, adminName, loanId]
    );

    // Perbarui unit aset menjadi ON_LOAN
    await client.query(
      `UPDATE assets 
       SET operational_status = 'ON_LOAN', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );

    await client.query('COMMIT');

    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);

    // Siarkan event real-time HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.approved', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: 'ACTIVE',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: currentLoan.asset_id,
      status: 'ON_LOAN',
    });

    return res.status(200).json(formatted);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Loan Approve Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menyetujui peminjaman.',
    });
  } finally {
    client.release();
  }
});

// 5. Tolak Pengajuan Peminjaman (ADMIN_SARPRAS)
loansRouter.post('/:id/reject', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const loanId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Alasan penolakan permohonan peminjaman wajib diisi.',
    });
  }

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loanRes = await client.query(
      'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data permohonan peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];

    if (currentLoan.status !== 'PENDING_APPROVAL') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_LOAN_STATUS',
        message: `Hanya pengajuan berstatus PENDING_APPROVAL yang dapat ditolak. Status saat ini: ${currentLoan.status}.`,
      });
    }

    const adminUser = (req as any).user || {};
    const adminId = adminUser.id || 'usr-admin-1';
    const adminName = adminUser.fullName || 'Admin Sarpras';

    // Perbarui status pinjaman menjadi REJECTED
    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'REJECTED', rejection_reason = $1, approved_by = $2, approved_by_name = $3, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [reason.trim(), adminId, adminName, loanId]
    );

    // Kembalikan unit aset menjadi AVAILABLE
    await client.query(
      `UPDATE assets 
       SET operational_status = 'AVAILABLE', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );

    await client.query('COMMIT');

    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);

    // Siarkan event real-time HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.rejected', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: 'REJECTED',
      reason: reason.trim(),
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: currentLoan.asset_id,
      status: 'AVAILABLE',
    });

    return res.status(200).json(formatted);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Loan Reject Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menolak peminjaman.',
    });
  } finally {
    client.release();
  }
});

// 6. Konfirmasi Handover / Serah Terima Barang Fisik
loansRouter.post('/:id/handover', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const loanId = req.params.id;
  const { conditionAtHandover, accessoriesVerified, notes } = req.body;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const loanRes = await client.query(
      'SELECT * FROM loans WHERE id = $1 FOR UPDATE',
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];
    const handoverData = JSON.stringify({
      conditionAtHandover: conditionAtHandover || 'GOOD',
      accessoriesVerified: accessoriesVerified ?? true,
      notes: notes || null,
      handedOverAt: new Date().toISOString(),
    });

    const updatedLoanRes = await client.query(
      `UPDATE loans 
       SET status = 'ACTIVE', handover_data = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [handoverData, loanId]
    );

    await client.query(
      `UPDATE assets 
       SET operational_status = 'ON_LOAN', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );

    await client.query('COMMIT');

    const formatted = formatLoanResponse(updatedLoanRes.rows[0]);

    sseManager.broadcast('loan.approved', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: 'ACTIVE',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: currentLoan.asset_id,
      status: 'ON_LOAN',
    });

    return res.status(200).json(formatted);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Loan Handover Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memproses serah terima barang.',
    });
  } finally {
    client.release();
  }
});
