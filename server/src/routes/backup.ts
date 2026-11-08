import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sseManager } from '../realtime/sseManager.js';

export const backupRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_DIR = path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.resolve(SETTINGS_DIR, 'school_settings.json');

/**
 * 1. GET /api/v1/backup/summary
 * Memberikan ringkasan jumlah seluruh data saat ini sebelum diekspor atau dipulihkan
 */
backupRouter.get('/summary', requireAuth, requireRole('ADMIN_SARPRAS'), async (_req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    const [
      usersCount,
      assetsCount,
      categoriesCount,
      locationsCount,
      fundingSourcesCount,
      loansCount,
      auditLogsCount,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM assets WHERE is_decommissioned = false'),
      pool.query('SELECT COUNT(*) FROM categories'),
      pool.query('SELECT COUNT(*) FROM locations'),
      pool.query('SELECT COUNT(*) FROM funding_sources'),
      pool.query('SELECT COUNT(*) FROM loans'),
      pool.query('SELECT COUNT(*) FROM audit_logs'),
    ]);

    return res.status(200).json({
      counts: {
        users: parseInt(usersCount.rows[0].count, 10),
        assets: parseInt(assetsCount.rows[0].count, 10),
        categories: parseInt(categoriesCount.rows[0].count, 10),
        locations: parseInt(locationsCount.rows[0].count, 10),
        fundingSources: parseInt(fundingSourcesCount.rows[0].count, 10),
        loans: parseInt(loansCount.rows[0].count, 10),
        auditLogs: parseInt(auditLogsCount.rows[0].count, 10),
      },
      databaseTime: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Backup Summary Error]:', error?.message || error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Gagal memuat ringkasan basis data.',
    });
  }
});

/**
 * 2. GET /api/v1/backup/export
 * Mengekspor seluruh data SIMSARPRAS ke berkas JSON terstruktur
 */
backupRouter.get('/export', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  try {
    // 1. Muat Pengaturan Sekolah (File & Fallback)
    let schoolSettings = {
      schoolName: 'MIS Cendikia Bunayya',
      address: 'Jl. Pendidikan No. 123, Medan, Sumatera Utara',
      phone: '081234567890',
      email: 'sarpras@cendikiabunayya.sch.id',
      logoUrl: '',
    };
    try {
      const raw = await fs.readFile(SETTINGS_FILE, 'utf-8');
      schoolSettings = { ...schoolSettings, ...JSON.parse(raw) };
    } catch {
      // gunakan default jika file belum dibuat
    }

    // 2. Query seluruh data tabel secara paralel menggunakan SELECT * agar akurat dan lengkap
    const [
      usersRes,
      categoriesRes,
      locationsRes,
      fundingSourcesRes,
      assetsRes,
      loansRes,
      returnInspectionsRes,
      auditLogsRes,
    ] = await Promise.all([
      pool.query('SELECT * FROM users ORDER BY created_at ASC'),
      pool.query('SELECT * FROM categories ORDER BY created_at ASC'),
      pool.query('SELECT * FROM locations ORDER BY created_at ASC'),
      pool.query('SELECT * FROM funding_sources ORDER BY created_at ASC'),
      pool.query('SELECT * FROM assets ORDER BY created_at ASC'),
      pool.query('SELECT * FROM loans ORDER BY created_at ASC'),
      pool.query('SELECT * FROM return_inspections ORDER BY created_at ASC'),
      pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500'),
    ]);

    const backupPayload = {
      system: 'SIMSARPRAS_SMART_CAMPUS',
      signature: 'SIMSARPRAS_BACKUP_V2',
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: (req as any).user?.id || 'admin',
        name: (req as any).user?.fullName || 'Admin Sarpras',
        email: (req as any).user?.email || 'admin@simsarpras.sch.id',
      },
      counts: {
        users: usersRes.rows.length,
        categories: categoriesRes.rows.length,
        locations: locationsRes.rows.length,
        fundingSources: fundingSourcesRes.rows.length,
        assets: assetsRes.rows.length,
        loans: loansRes.rows.length,
        returnInspections: returnInspectionsRes.rows.length,
        auditLogs: auditLogsRes.rows.length,
      },
      data: {
        schoolSettings,
        users: usersRes.rows,
        categories: categoriesRes.rows,
        locations: locationsRes.rows,
        fundingSources: fundingSourcesRes.rows,
        assets: assetsRes.rows,
        loans: loansRes.rows,
        returnInspections: returnInspectionsRes.rows,
        auditLogs: auditLogsRes.rows,
      },
    };

    // Rekam ke audit_logs
    try {
      const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await pool.query(
        `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
         VALUES ($1, $2, $3, $4, 'BACKUP_EXPORTED', 'SYSTEM', 'backup-file', 'Unduh Cadangan Basis Data', $5, NOW())`,
        [
          auditId,
          (req as any).user?.id || 'system',
          (req as any).user?.fullName || 'Admin Sarpras',
          (req as any).user?.role || 'ADMIN_SARPRAS',
          `Mengekspor cadangan basis data lengkap: ${assetsRes.rows.length} aset, ${usersRes.rows.length} pengguna, ${loansRes.rows.length} peminjaman.`,
        ]
      );
    } catch (auditErr) {
      console.warn('[Backup Audit Log Warning]:', auditErr);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="backup-simsarpras-${timestamp}.json"`);
    return res.status(200).json(backupPayload);
  } catch (error: any) {
    console.error('[Backup Export Error]:', error?.message || error);
    return res.status(500).json({
      error: 'BACKUP_FAILED',
      message: `Gagal membuat cadangan basis data: ${error?.message || error}`,
    });
  }
});

/**
 * 3. POST /api/v1/backup/restore
 * Memulihkan data dari berkas cadangan JSON ke PostgreSQL dalam transaksi aman (atomic)
 */
backupRouter.post('/restore', requireAuth, requireRole('ADMIN_SARPRAS'), async (req: Request, res: Response) => {
  if (!pool) {
    return res.status(503).json({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database belum terhubung.',
    });
  }

  const { backupData, mode = 'clean' } = req.body;

  if (!backupData || typeof backupData !== 'object') {
    return res.status(400).json({
      error: 'INVALID_BACKUP_PAYLOAD',
      message: 'Format berkas cadangan tidak valid. Objek data cadangan diperlukan.',
    });
  }

  // Verifikasi signature berkas cadangan SIMSARPRAS
  if (
    backupData.signature !== 'SIMSARPRAS_BACKUP_V2' &&
    backupData.system !== 'SIMSARPRAS_SMART_CAMPUS' &&
    !backupData.data?.assets
  ) {
    return res.status(400).json({
      error: 'INVALID_SIGNATURE',
      message: 'Berkas tidak dikenali sebagai berkas cadangan resmi SIMSARPRAS.',
    });
  }

  const data = backupData.data || {};
  const usersList: any[] = Array.isArray(data.users) ? data.users : [];
  const categoriesList: any[] = Array.isArray(data.categories) ? data.categories : [];
  const locationsList: any[] = Array.isArray(data.locations) ? data.locations : [];
  const fundingSourcesList: any[] = Array.isArray(data.fundingSources) ? data.fundingSources : [];
  const assetsList: any[] = Array.isArray(data.assets) ? data.assets : [];
  const loansList: any[] = Array.isArray(data.loans) ? data.loans : [];
  const returnInspectionsList: any[] = Array.isArray(data.returnInspections) ? data.returnInspections : [];

  const client = await pool.connect();

  try {
    // Mulai transaksi atomic
    await client.query('BEGIN');

    // Jika mode 'clean' (pemulihan bersih total), bersihkan tabel dari anak ke induk
    if (mode === 'clean') {
      await client.query('DELETE FROM return_inspections');
      await client.query('DELETE FROM loans');
      await client.query('DELETE FROM assets');
      await client.query('DELETE FROM categories');
      await client.query('DELETE FROM locations');
      await client.query('DELETE FROM funding_sources');
      // Jangan hapus user yang sedang login saat ini agar sesi tidak langsung putus di tengah jalan
      const currentUserId = (req as any).user?.id;
      if (currentUserId) {
        await client.query('DELETE FROM users WHERE id != $1', [currentUserId]);
      } else {
        await client.query('DELETE FROM users');
      }
    }

    // 1. Pulihkan Master Data: Kategori
    for (const cat of categoriesList) {
      if (!cat.id || !cat.name) continue;
      await client.query(
        `INSERT INTO categories (id, name, default_loan_mode, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           default_loan_mode = EXCLUDED.default_loan_mode,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          cat.id,
          cat.name,
          cat.default_loan_mode || cat.defaultLoanMode || 'ADMIN_APPROVAL',
          cat.description || '',
          cat.is_active ?? cat.isActive ?? true,
          cat.created_at || cat.createdAt || null,
        ]
      );
    }

    // 2. Pulihkan Master Data: Ruangan / Lokasi
    for (const loc of locationsList) {
      if (!loc.id || !loc.name) continue;
      await client.query(
        `INSERT INTO locations (id, name, code, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           code = EXCLUDED.code,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          loc.id,
          loc.name,
          loc.code || loc.name.slice(0, 4).toUpperCase(),
          loc.description || '',
          loc.is_active ?? loc.isActive ?? true,
          loc.created_at || loc.createdAt || null,
        ]
      );
    }

    // 3. Pulihkan Master Data: Sumber Pendanaan
    for (const fsItem of fundingSourcesList) {
      if (!fsItem.id || !fsItem.name) continue;
      await client.query(
        `INSERT INTO funding_sources (id, name, description, is_active, created_at)
         VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active`,
        [
          fsItem.id,
          fsItem.name,
          fsItem.description || '',
          fsItem.is_active ?? fsItem.isActive ?? true,
          fsItem.created_at || fsItem.createdAt || null,
        ]
      );
    }

    // 4. Pulihkan Pengguna (Users)
    for (const u of usersList) {
      if (!u.id || !u.email) continue;
      await client.query(
        `INSERT INTO users (id, full_name, employee_number, email, role, is_active, department, avatar_url, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()), COALESCE($11, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           full_name = EXCLUDED.full_name,
           employee_number = EXCLUDED.employee_number,
           email = EXCLUDED.email,
           role = EXCLUDED.role,
           is_active = EXCLUDED.is_active,
           department = EXCLUDED.department,
           avatar_url = EXCLUDED.avatar_url,
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           updated_at = NOW()`,
        [
          u.id,
          u.full_name || u.fullName || 'Pengguna',
          u.employee_number || u.employeeNumber || '-',
          u.email,
          u.role || 'GURU_PEGAWAI',
          u.is_active ?? u.isActive ?? true,
          u.department || 'Umum',
          u.avatar_url || u.avatarUrl || null,
          u.password_hash || u.passwordHash || null,
          u.created_at || u.createdAt || null,
          u.updated_at || u.updatedAt || null,
        ]
      );
    }

    // 5. Pulihkan Aset / Inventaris
    for (const a of assetsList) {
      if (!a.id || !a.item_name && !a.itemName) continue;
      const itemName = a.item_name || a.itemName;
      const assetCode = a.asset_code || a.assetCode || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const permanentId = a.permanent_id || a.permanentId || a.id;
      const qrToken = a.qr_token || a.qrToken || `QR-${assetCode}`;
      const itemNumber = a.item_number ?? a.itemNumber ?? null;
      const institution = a.institution || 'MIS Cendikia Bunayya';
      const categoryId = a.category_id || a.categoryId || null;
      const categoryName = a.category_name || a.categoryName || 'Umum';
      const locationId = a.location_id || a.locationId || locationsList[0]?.id || 'loc-mv8z9zes';
      const locationName = a.location_name || a.locationName || 'Kantor MIS';
      const itemBrand = a.item_brand || a.itemBrand || 'Standar';
      const fundingSource = a.funding_source || a.fundingSource || 'BOS Reguler';
      const acquisitionYear = a.acquisition_year || a.acquisitionYear || 2026;
      const technicalSpecs = a.technical_specs || a.technicalSpecs || '-';
      const effectiveLoanMode = a.effective_loan_mode || a.effectiveLoanMode || 'DIRECT';
      const conditionStatus = a.condition_status || a.conditionStatus || 'GOOD';
      const operationalStatus = a.operational_status || a.operationalStatus || 'AVAILABLE';
      const photoUrl = a.photo_url || a.photoUrl || a.photo_path || a.photoPath || null;
      const notes = a.notes || null;
      const standardAccessories = JSON.stringify(a.standard_accessories || a.standardAccessories || []);
      const isDecommissioned = a.is_decommissioned ?? a.isDecommissioned ?? false;
      const decommissionedAt = a.decommissioned_at || a.decommissionedAt || null;
      const decommissionedReason = a.decommissioned_reason || a.decommissionedReason || null;
      const createdAt = a.created_at || a.createdAt || null;
      const updatedAt = a.updated_at || a.updatedAt || null;

      await client.query(
        `INSERT INTO assets (
           id, permanent_id, qr_token, asset_code, item_number, item_name, institution,
           category_id, category_name, location_id, location_name, item_brand,
           funding_source, acquisition_year, technical_specs, effective_loan_mode,
           condition_status, operational_status, photo_url, notes, standard_accessories,
           is_decommissioned, decommissioned_at, decommissioned_reason, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20, $21::jsonb,
           $22, $23, $24, COALESCE($25, NOW()), COALESCE($26, NOW())
         ) ON CONFLICT (id) DO UPDATE SET
           permanent_id = EXCLUDED.permanent_id,
           qr_token = EXCLUDED.qr_token,
           asset_code = EXCLUDED.asset_code,
           item_number = EXCLUDED.item_number,
           item_name = EXCLUDED.item_name,
           institution = EXCLUDED.institution,
           category_id = EXCLUDED.category_id,
           category_name = EXCLUDED.category_name,
           location_id = EXCLUDED.location_id,
           location_name = EXCLUDED.location_name,
           item_brand = EXCLUDED.item_brand,
           funding_source = EXCLUDED.funding_source,
           acquisition_year = EXCLUDED.acquisition_year,
           technical_specs = EXCLUDED.technical_specs,
           effective_loan_mode = EXCLUDED.effective_loan_mode,
           condition_status = EXCLUDED.condition_status,
           operational_status = EXCLUDED.operational_status,
           photo_url = EXCLUDED.photo_url,
           notes = EXCLUDED.notes,
           standard_accessories = EXCLUDED.standard_accessories,
           is_decommissioned = EXCLUDED.is_decommissioned,
           decommissioned_at = EXCLUDED.decommissioned_at,
           decommissioned_reason = EXCLUDED.decommissioned_reason,
           updated_at = NOW()`,
        [
          a.id,
          permanentId,
          qrToken,
          assetCode,
          itemNumber,
          itemName,
          institution,
          categoryId,
          categoryName,
          locationId,
          locationName,
          itemBrand,
          fundingSource,
          acquisitionYear,
          technicalSpecs,
          effectiveLoanMode,
          conditionStatus,
          operationalStatus,
          photoUrl,
          notes,
          standardAccessories,
          isDecommissioned,
          decommissionedAt,
          decommissionedReason,
          createdAt,
          updatedAt,
        ]
      );
    }

    // 6. Pulihkan Peminjaman (Loans)
    for (const l of loansList) {
      const assetId = l.asset_id || l.assetId || l.unit_id || l.unitId;
      if (!l.id || !assetId) continue;
      const loanNumber = l.loan_number || l.loanNumber || `PINJAM-${Date.now()}`;
      const borrowerId = l.borrower_id || l.borrowerId || null;
      const borrowerName = l.borrower_name || l.borrowerName || 'Peminjam';
      const borrowerEmployeeNumber = l.borrower_employee_number || l.borrowerEmployeeNumber || l.borrower_identifier || l.borrowerIdentifier || '-';
      const borrowerRole = l.borrower_role || l.borrowerRole || 'GURU_PEGAWAI';
      const loanModeSnapshot = l.loan_mode_snapshot || l.loanModeSnapshot || l.loan_mode || l.loanMode || 'DIRECT';
      const purpose = l.purpose || 'Keperluan mengajar';
      const status = l.status || 'ACTIVE';
      const requestedAt = l.requested_at || l.requestedAt || null;
      const approvedAt = l.approved_at || l.approvedAt || null;
      const approvedBy = l.approved_by || l.approvedBy || null;
      const approvedByName = l.approved_by_name || l.approvedByName || null;
      const handoverData = JSON.stringify(l.handover_data || l.handoverData || {});
      const expectedReturnAt = l.expected_return_at || l.expectedReturnAt || null;
      const returnNotes = l.return_notes || l.returnNotes || l.return_inspection_notes || l.returnInspectionNotes || null;
      const rejectionReason = l.rejection_reason || l.rejectionReason || null;
      const createdAt = l.created_at || l.createdAt || null;
      const updatedAt = l.updated_at || l.updatedAt || null;

      await client.query(
        `INSERT INTO loans (
           id, loan_number, asset_id, borrower_id, borrower_name, borrower_employee_number, borrower_role,
           loan_mode_snapshot, purpose, status, requested_at, approved_at, approved_by, approved_by_name,
           handover_data, expected_return_at, return_notes, rejection_reason, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, COALESCE($11, NOW()), $12, $13, $14,
           $15::jsonb, COALESCE($16, NOW() + INTERVAL '1 day'), $17, $18,
           COALESCE($19, NOW()), COALESCE($20, NOW())
         ) ON CONFLICT (id) DO UPDATE SET
           loan_number = EXCLUDED.loan_number,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          l.id,
          loanNumber,
          assetId,
          borrowerId,
          borrowerName,
          borrowerEmployeeNumber,
          borrowerRole,
          loanModeSnapshot,
          purpose,
          status,
          requestedAt,
          approvedAt,
          approvedBy,
          approvedByName,
          handoverData,
          expectedReturnAt,
          returnNotes,
          rejectionReason,
          createdAt,
          updatedAt,
        ]
      );
    }

    // 7. Pulihkan Riwayat Pemeriksaan Pengembalian (Return Inspections)
    for (const insp of returnInspectionsList) {
      const loanId = insp.loan_id || insp.loanId;
      if (!insp.id || !loanId) continue;
      const receivedBy = insp.received_by || insp.receivedBy || insp.inspected_by || insp.inspectedBy || (req as any).user?.id || 'admin';
      const receivedByName = insp.received_by_name || insp.receivedByName || insp.inspected_by_name || insp.inspectedByName || (req as any).user?.fullName || 'Petugas Sarpras';
      const inspectedBy = insp.inspected_by || insp.inspectedBy || receivedBy;
      const inspectedByName = insp.inspected_by_name || insp.inspectedByName || receivedByName;
      const conditionAtReturn = insp.condition_at_return || insp.conditionAtReturn || 'GOOD';
      const resultingStatus = insp.resulting_status || insp.resultingStatus || 'AVAILABLE';
      const notes = insp.notes || null;
      const photoUrl = insp.photo_url || insp.photoUrl || null;
      const createdAt = insp.created_at || insp.createdAt || null;

      await client.query(
        `INSERT INTO return_inspections (
           id, loan_id, received_by, received_by_name, inspected_by, inspected_by_name,
           condition_at_return, resulting_status, notes, photo_url, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, NOW()))
         ON CONFLICT (id) DO UPDATE SET
           condition_at_return = EXCLUDED.condition_at_return,
           resulting_status = EXCLUDED.resulting_status,
           notes = EXCLUDED.notes`,
        [
          insp.id,
          loanId,
          receivedBy,
          receivedByName,
          inspectedBy,
          inspectedByName,
          conditionAtReturn,
          resultingStatus,
          notes,
          photoUrl,
          createdAt,
        ]
      );
    }

    // 8. Pulihkan Pengaturan Sekolah (ke file persisten JSON)
    if (data.schoolSettings) {
      try {
        await fs.mkdir(SETTINGS_DIR, { recursive: true });
        await fs.writeFile(SETTINGS_FILE, JSON.stringify(data.schoolSettings, null, 2), 'utf-8');
      } catch (fileErr) {
        console.warn('[School Settings File Save Warning]:', fileErr);
      }
    }

    // 9. Rekam jejak audit pemulihan basis data
    const auditId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details, created_at)
       VALUES ($1, $2, $3, $4, 'DATABASE_RESTORED', 'SYSTEM', 'backup-restore', 'Pemulihan Basis Data', $5, NOW())`,
      [
        auditId,
        (req as any).user?.id || 'system',
        (req as any).user?.fullName || 'Admin Sarpras',
        (req as any).user?.role || 'ADMIN_SARPRAS',
        `Memulihkan basis data secara ${mode === 'clean' ? 'TIMPA BERSIH (Clean)' : 'GABUNG (Merge)'}: ` +
        `${assetsList.length} aset, ${usersList.length} pengguna, ${categoriesList.length} kategori, ${loansList.length} peminjaman.`,
      ]
    );

    // Komit transaksi atomic
    await client.query('COMMIT');

    // Siarkan notifikasi SSE ke seluruh browser aktif agar auto-reload
    try {
      sseManager.broadcast('asset.updated', {
        action: 'database.restored',
        message: 'Basis data sistem sarpras berhasil dipulihkan dari cadangan.',
      });
    } catch (sseErr) {
      console.warn('[SSE Broadcast Warning]:', sseErr);
    }

    return res.status(200).json({
      success: true,
      message: 'Seluruh data berhasil dipulihkan ke basis data.',
      restoredCounts: {
        users: usersList.length,
        categories: categoriesList.length,
        locations: locationsList.length,
        fundingSources: fundingSourcesList.length,
        assets: assetsList.length,
        loans: loansList.length,
        returnInspections: returnInspectionsList.length,
      },
      restoredAt: new Date().toISOString(),
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Backup Restore Transaction Error]:', error?.message || error);
    return res.status(500).json({
      error: 'RESTORE_FAILED',
      message: `Gagal memulihkan basis data (transaksi dibatalkan): ${error?.message || error}`,
    });
  } finally {
    client.release();
  }
});
