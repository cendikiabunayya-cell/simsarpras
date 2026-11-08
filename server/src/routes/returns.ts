import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { sseManager } from '../realtime/sseManager.js';
import { formatLoanResponse } from './loans.js';

export const returnsRouter = Router();

/**
 * 1. POST /api/v1/returns (dan /returns)
 * Guru mengajukan pengembalian barang via riwayat peminjaman atau scan QR (Mendukung Login maupun Tanpa Login)
 */
returnsRouter.post('/', optionalAuth, async (req: Request, res: Response) => {
  const loanId = req.body?.loanId || req.body?.loan_id;
  const notes = req.body?.notes;

  if (!loanId) {
    return res.status(400).json({
      error: 'MISSING_LOAN_ID',
      message: 'ID transaksi peminjaman wajib disertakan.',
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

    // 1. Kunci baris peminjaman
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data transaksi peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];

    // Validasi kepemilikan pinjaman: Guru login hanya boleh mengembalikan barang sendiri (Admin dan pengembalian fisik bebas)
    const userRole = (req as any).user?.role;
    const userId = (req as any).user?.id;
    if (userId && userRole !== 'ADMIN_SARPRAS' && currentLoan.borrower_id && currentLoan.borrower_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Anda hanya dapat mengajukan pengembalian untuk barang yang Anda pinjam sendiri.',
      });
    }

    // Pencegahan pengembalian ganda
    if (currentLoan.status === 'RETURN_REQUESTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ALREADY_RETURN_REQUESTED',
        message: 'Pengembalian barang sudah diajukan sebelumnya dan sedang menunggu verifikasi admin.',
      });
    }

    if (currentLoan.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ALREADY_COMPLETED',
        message: 'Transaksi peminjaman ini telah selesai.',
      });
    }

    // Status harus ACTIVE atau APPROVED atau READY_FOR_HANDOVER
    if (currentLoan.status !== 'ACTIVE' && currentLoan.status !== 'APPROVED' && currentLoan.status !== 'READY_FOR_HANDOVER') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_LOAN_STATUS',
        message: `Pengembalian tidak dapat diajukan untuk pinjaman dengan status ${currentLoan.status}.`,
      });
    }

    // 2. Perbarui status peminjaman menjadi RETURN_REQUESTED
    const updateRes = await client.query(
      `UPDATE loans 
       SET status = 'RETURN_REQUESTED', return_notes = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [notes || null, loanId]
    );

    // Perbarui status aset menjadi RETURN_PENDING
    await client.query(
      `UPDATE assets 
       SET operational_status = 'RETURN_PENDING', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );

    // Catat ke audit log
    const auditId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const userName = (req as any).user?.fullName || currentLoan.borrower_name || 'Guru / Pegawai';
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, 'PENGAJUAN_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        userId || currentLoan.borrower_id,
        userName,
        userRole || 'GURU_PEGAWAI',
        currentLoan.id,
        currentLoan.loan_number,
        `Pengajuan pengembalian unit pinjaman ${currentLoan.loan_number} oleh ${userName}.`,
        req.ip || null,
      ]
    );

    await client.query('COMMIT');

    const updatedLoan = formatLoanResponse(updateRes.rows[0]);

    // 3. Siarkan event real-time HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.returned', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: 'RETURN_REQUESTED',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId: currentLoan.asset_id,
      status: 'RETURN_PENDING',
    });

    return res.status(200).json(updatedLoan);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Return Request Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memproses pengajuan pengembalian barang.',
    });
  } finally {
    client.release();
  }
});

/**
 * 2. POST /api/v1/returns/:id/verify (dan /returns/:id/verify)
 * Alur Baru: Admin Sarpras memverifikasi penerimaan barang fisik langsung selesai (COMPLETED)
 * Menggantikan tahap pemeriksaan terpisah.
 */
returnsRouter.post('/:id/verify', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const loanId = req.params.id;
  const { notes, conditionAtReturn = 'GOOD', accessoriesComplete = true } = req.body;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Kunci baris peminjaman
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data transaksi peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];

    // Pencegahan verifikasi ganda jika sudah COMPLETED
    if (currentLoan.status === 'COMPLETED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'ALREADY_COMPLETED',
        message: 'Transaksi pengembalian ini sudah selesai diverifikasi sebelumnya.',
      });
    }

    // Status harus RETURN_REQUESTED, RETURN_RECEIVED, atau ACTIVE
    if (
      currentLoan.status !== 'RETURN_REQUESTED' &&
      currentLoan.status !== 'RETURN_RECEIVED' &&
      currentLoan.status !== 'ACTIVE'
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_LOAN_STATUS',
        message: `Pengembalian tidak dapat diverifikasi untuk status ${currentLoan.status}.`,
      });
    }

    const assetId = currentLoan.asset_id;

    // 2. Kunci baris aset untuk memeriksa kondisi dan kepemilikan
    const assetRes = await client.query(
      `SELECT id, asset_code, is_decommissioned, condition_status FROM assets WHERE id = $1 FOR UPDATE`,
      [assetId]
    );

    if (assetRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'ASSET_NOT_FOUND',
        message: 'Data barang inventaris tidak ditemukan.',
      });
    }

    const currentAsset = assetRes.rows[0];

    // 3. Tentukan status ketersediaan akhir:
    // Pulihkan menjadi AVAILABLE jika barang tidak dinonaktifkan (is_decommissioned === false)
    // dan tidak dalam kondisi rusak
    let resultingStatus = 'AVAILABLE';
    if (currentAsset.is_decommissioned) {
      resultingStatus = 'INACTIVE';
    } else if (conditionAtReturn && conditionAtReturn !== 'GOOD') {
      resultingStatus = 'MAINTENANCE';
    }

    const resultingCondition = conditionAtReturn || currentAsset.condition_status || 'GOOD';

    // Perbarui aset
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, condition_status = $2, updated_at = NOW() 
       WHERE id = $3`,
      [resultingStatus, resultingCondition, assetId]
    );

    // Admin pelaksana verifikasi
    const adminUser = (req as any).user || {};
    const adminId = adminUser.id || 'usr-admin-1';
    const adminName = adminUser.fullName || 'Admin Sarpras';

    // 4. Perbarui status peminjaman menjadi COMPLETED
    const loanUpdateRes = await client.query(
      `UPDATE loans 
       SET status = 'COMPLETED', approved_by = $1, approved_at = NOW(), updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [adminId, loanId]
    );

    // 5. Simpan ke tabel return_inspections demi menjaga integritas data historis & foreign key
    const inspectionId = `insp-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const inspectionNotes = notes || 'Verifikasi penerimaan pengembalian langsung disetujui oleh Admin Sarpras.';

    await client.query(
      `INSERT INTO return_inspections (
        id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
        approved_by, approved_by_name, approved_at, condition_at_return, accessories_complete,
        notes, resulting_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12)
      ON CONFLICT (loan_id) DO UPDATE SET
        approved_by = EXCLUDED.approved_by,
        approved_by_name = EXCLUDED.approved_by_name,
        approved_at = EXCLUDED.approved_at,
        condition_at_return = EXCLUDED.condition_at_return,
        accessories_complete = EXCLUDED.accessories_complete,
        resulting_status = EXCLUDED.resulting_status,
        notes = EXCLUDED.notes`,
      [
        inspectionId,
        loanId,
        adminId,
        adminName,
        adminId,
        adminName,
        adminId,
        adminName,
        resultingCondition,
        Boolean(accessoriesComplete),
        inspectionNotes,
        resultingStatus,
      ]
    );

    // 6. Catat pada audit_logs
    const auditId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await client.query(
      `INSERT INTO audit_logs (
        id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, 'VERIFIKASI_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        adminId,
        adminName,
        adminUser.role || 'ADMIN_SARPRAS',
        currentLoan.id,
        currentLoan.loan_number,
        `Verifikasi penerimaan pengembalian unit ${currentAsset.asset_code} (${currentLoan.loan_number}) disetujui oleh ${adminName}. Status peminjaman COMPLETED, status unit ${resultingStatus}.`,
        req.ip || null,
      ]
    );

    await client.query('COMMIT');

    const formatted = formatLoanResponse(loanUpdateRes.rows[0]);

    // 7. Siarkan event SSE HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.returned', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId,
      status: 'COMPLETED',
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId,
      status: resultingStatus,
      conditionStatus: resultingCondition,
    });

    return res.status(200).json({
      ...formatted,
      message: 'Verifikasi penerimaan barang berhasil. Pengembalian selesai.',
      resultingStatus,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Return Verification Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memverifikasi pengembalian barang.',
    });
  } finally {
    client.release();
  }
});

/**
 * 3. POST /api/v1/returns/:id/receive (dan /returns/:id/receive)
 * Kompatibilitas mundur: Admin Sarpras menerima fisik barang
 */
returnsRouter.post('/:id/receive', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
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
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data transaksi peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];

    // Status harus RETURN_REQUESTED atau ACTIVE
    if (currentLoan.status !== 'RETURN_REQUESTED' && currentLoan.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'INVALID_LOAN_STATUS',
        message: `Penerimaan fisik tidak dapat diproses untuk status ${currentLoan.status}.`,
      });
    }

    const updateRes = await client.query(
      `UPDATE loans 
       SET status = 'RETURN_RECEIVED', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [loanId]
    );

    await client.query(
      `UPDATE assets 
       SET operational_status = 'RETURN_INSPECTION', updated_at = NOW() 
       WHERE id = $1`,
      [currentLoan.asset_id]
    );

    await client.query('COMMIT');

    const updatedLoan = formatLoanResponse(updateRes.rows[0]);

    // Siarkan event real-time setelah COMMIT
    sseManager.broadcast('loan.returned', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId: currentLoan.asset_id,
      status: 'RETURN_RECEIVED',
    });

    return res.status(200).json(updatedLoan);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Return Receive Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal mencatat penerimaan fisik barang.',
    });
  } finally {
    client.release();
  }
});

/**
 * 4. POST /api/v1/returns/:id/approve (dan /returns/:id/approve)
 * Kompatibilitas mundur: Admin menyetujui pengembalian final
 */
returnsRouter.post('/:id/approve', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  const loanId = req.params.id;
  const {
    conditionAtReturn = 'GOOD',
    accessoriesComplete = true,
    issueDescription,
    notes,
    photoPath,
    photoUrl,
  } = req.body;

  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Kunci baris peminjaman
    const loanRes = await client.query(
      `SELECT * FROM loans WHERE id = $1 FOR UPDATE`,
      [loanId]
    );

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'LOAN_NOT_FOUND',
        message: 'Data transaksi peminjaman tidak ditemukan.',
      });
    }

    const currentLoan = loanRes.rows[0];
    const assetId = currentLoan.asset_id;

    // Periksa status decommissioned
    const assetRes = await client.query(`SELECT is_decommissioned FROM assets WHERE id = $1 FOR UPDATE`, [assetId]);
    const isDecommissioned = assetRes.rows[0]?.is_decommissioned;

    let resultingStatus = conditionAtReturn === 'GOOD' ? 'AVAILABLE' : 'MAINTENANCE';
    if (isDecommissioned) resultingStatus = 'INACTIVE';

    // Kunci dan perbarui aset
    await client.query(
      `UPDATE assets 
       SET operational_status = $1, condition_status = $2, updated_at = NOW() 
       WHERE id = $3`,
      [resultingStatus, conditionAtReturn, assetId]
    );

    // Perbarui status peminjaman menjadi COMPLETED
    const loanUpdateRes = await client.query(
      `UPDATE loans 
       SET status = 'COMPLETED', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [loanId]
    );

    // Catat data inspeksi pengembalian fisik
    const inspectionId = `insp-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const adminUser = (req as any).user || {};
    const adminId = adminUser.id || 'usr-admin-1';
    const adminName = adminUser.fullName || 'Admin Sarpras';

    await client.query(
      `INSERT INTO return_inspections (
        id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
        approved_by, approved_by_name, approved_at, condition_at_return, accessories_complete,
        issue_description, notes, photo_url, resulting_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, $13, $14)
      ON CONFLICT (loan_id) DO UPDATE SET
        condition_at_return = EXCLUDED.condition_at_return,
        accessories_complete = EXCLUDED.accessories_complete,
        resulting_status = EXCLUDED.resulting_status,
        notes = EXCLUDED.notes`,
      [
        inspectionId,
        loanId,
        adminId,
        adminName,
        adminId,
        adminName,
        adminId,
        adminName,
        conditionAtReturn,
        Boolean(accessoriesComplete),
        issueDescription || null,
        notes || null,
        photoUrl || photoPath || null,
        resultingStatus,
      ]
    );

    // Catat ke audit log
    const auditId = `aud-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, 'VERIFIKASI_PENGEMBALIAN', 'RETURN', $5, $6, $7, $8, NOW())`,
      [
        auditId,
        adminId,
        adminName,
        adminUser.role || 'ADMIN_SARPRAS',
        currentLoan.id,
        currentLoan.loan_number,
        `Pemeriksaan fisik pengembalian disetujui oleh ${adminName}. Status COMPLETED, unit ${resultingStatus}.`,
        req.ip || null,
      ]
    );

    await client.query('COMMIT');

    const formatted = formatLoanResponse(loanUpdateRes.rows[0]);

    // 4. Siarkan event real-time HANYA setelah transaksi berhasil di-COMMIT
    sseManager.broadcast('loan.returned', {
      loanId: currentLoan.id,
      loanNumber: currentLoan.loan_number,
      assetId,
      status: 'COMPLETED',
      conditionAtReturn,
    });
    sseManager.broadcast('asset.availability_changed', {
      assetId,
      status: resultingStatus,
      conditionStatus: conditionAtReturn,
    });

    return res.status(200).json({
      ...formatted,
      message: 'Pemeriksaan pengembalian fisik berhasil disetujui.',
      resultingStatus,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Return Approval Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal menyelesaikan inspeksi pengembalian barang.',
    });
  } finally {
    client.release();
  }
});

