import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { pool } from '../../server/src/db.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { MockStorageService } from '../services/mockStorage';
import { AssetUnit } from '../types';

describe('SIMSARPRAS Asset Deletion & Inactive Status Compliance Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  const adminToken = generateTestToken({
    id: 'usr-admin-1',
    fullName: 'Bambang Hermawan, S.Kom.',
    employeeNumber: '198204152008011005',
    email: 'admin.sarpras@smkn1teladan.sch.id',
    role: 'ADMIN_SARPRAS',
  });

  const guruToken = generateTestToken({
    id: 'usr-guru-1',
    fullName: 'Siti Nurhaliza, S.Pd.',
    employeeNumber: '199003202015022003',
    email: 'siti.nurhaliza@smkn1teladan.sch.id',
    role: 'GURU_PEGAWAI',
  });

  const kepsekToken = generateTestToken({
    id: 'usr-kepsek-1',
    fullName: 'Drs. H. Ahmad Sudirman, M.Pd.',
    employeeNumber: '196811121994031002',
    email: 'kepsek@smkn1teladan.sch.id',
    role: 'KEPALA_SEKOLAH',
  });

  const timestamp = Date.now();
  const testActiveAssetId = `ast-test-act-${timestamp}`;
  const testInactiveNoLoanId = `ast-test-inact-noloan-${timestamp}`;
  const testInactiveWithHistoryId = `ast-test-inact-hist-${timestamp}`;
  const testInactiveWithActiveLoanId = `ast-test-inact-actloan-${timestamp}`;

  const testActiveLoanId = `loan-test-act-${timestamp}`;
  const testCompletedLoanId = `loan-test-comp-${timestamp}`;

  beforeAll(async () => {
    // 1. Jalankan test HTTP server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    if (pool) {
      // Ambil ruangan dan kategori yang valid dari database
      const locRes = await pool.query('SELECT id, name FROM locations LIMIT 1');
      const locationId = locRes.rows[0]?.id || 'loc-r-lab-komputer-1';
      const locationName = locRes.rows[0]?.name || 'Laboratorium Komputer 1';

      const catRes = await pool.query('SELECT id, name FROM categories LIMIT 1');
      const categoryId = catRes.rows[0]?.id || 'cat-tik';
      const categoryName = catRes.rows[0]?.name || 'TIK/Multimedia';

      const fundRes = await pool.query('SELECT name FROM funding_sources LIMIT 1');
      const fundingSource = fundRes.rows[0]?.name || 'BOS Reguler';

      // 1. Siapkan aset AKTIF (operational_status = 'AVAILABLE', is_decommissioned = false)
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_id, category_name, location_id, location_name, funding_source,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          testActiveAssetId,
          `PID-${testActiveAssetId}`,
          `QR-${testActiveAssetId}`,
          `CODE-${testActiveAssetId}`,
          'Laptop Aktif Uji SIMSARPRAS',
          'MIS Cendikia Bunayya',
          categoryId,
          categoryName,
          locationId,
          locationName,
          fundingSource,
          'DIRECT',
          'GOOD',
          'AVAILABLE',
        ]
      );

      // 2. Siapkan aset TIDAK AKTIF tanpa riwayat peminjaman (operational_status = 'INACTIVE')
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_id, category_name, location_id, location_name, funding_source,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          testInactiveNoLoanId,
          `PID-${testInactiveNoLoanId}`,
          `QR-${testInactiveNoLoanId}`,
          `CODE-${testInactiveNoLoanId}`,
          'Proyektor Rusak Berat Tanpa Transaksi',
          'MIS Cendikia Bunayya',
          categoryId,
          categoryName,
          locationId,
          locationName,
          fundingSource,
          'DIRECT',
          'MAJOR_DAMAGE',
          'INACTIVE',
        ]
      );

      // 3. Siapkan aset TIDAK AKTIF dengan riwayat peminjaman lampau (COMPLETED)
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_id, category_name, location_id, location_name, funding_source,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          testInactiveWithHistoryId,
          `PID-${testInactiveWithHistoryId}`,
          `QR-${testInactiveWithHistoryId}`,
          `CODE-${testInactiveWithHistoryId}`,
          'Kamera DSLR Lama dengan Riwayat Peminjaman',
          'MIS Cendikia Bunayya',
          categoryId,
          categoryName,
          locationId,
          locationName,
          fundingSource,
          'DIRECT',
          'GOOD',
          'INACTIVE',
        ]
      );

      await pool.query(
        `INSERT INTO loans (
          id, loan_number, asset_id, borrower_id, borrower_name, borrower_role,
          status, loan_mode_snapshot, purpose, expected_return_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '1 day')`,
        [
          testCompletedLoanId,
          `LOAN-COMP-${timestamp}`,
          testInactiveWithHistoryId,
          'usr-guru-1',
          'Siti Nurhaliza, S.Pd.',
          'GURU_PEGAWAI',
          'COMPLETED',
          'DIRECT',
          'Praktikum Fotografi',
        ]
      );

      // 4. Siapkan aset TIDAK AKTIF yang saat ini masih memiliki transaksi peminjaman AKTIF
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_id, category_name, location_id, location_name, funding_source,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          testInactiveWithActiveLoanId,
          `PID-${testInactiveWithActiveLoanId}`,
          `QR-${testInactiveWithActiveLoanId}`,
          `CODE-${testInactiveWithActiveLoanId}`,
          'Sound Portable dengan Peminjaman Aktif',
          'MIS Cendikia Bunayya',
          categoryId,
          categoryName,
          locationId,
          locationName,
          fundingSource,
          'ADMIN_APPROVAL',
          'GOOD',
          'INACTIVE',
        ]
      );

      await pool.query(
        `INSERT INTO loans (
          id, loan_number, asset_id, borrower_id, borrower_name, borrower_role,
          status, loan_mode_snapshot, purpose, expected_return_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '2 days')`,
        [
          testActiveLoanId,
          `LOAN-ACT-${timestamp}`,
          testInactiveWithActiveLoanId,
          'usr-guru-1',
          'Siti Nurhaliza, S.Pd.',
          'GURU_PEGAWAI',
          'ACTIVE',
          'ADMIN_APPROVAL',
          'Acara Upacara Bendera',
        ]
      );
    }
  });

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query("DELETE FROM audit_logs WHERE entity_id LIKE 'ast-test-%'");
        await pool.query("DELETE FROM loans WHERE asset_id LIKE 'ast-test-%'");
        await pool.query("DELETE FROM assets WHERE id LIKE 'ast-test-%'");
      } catch (cleanupErr) {
        console.warn('[Test Cleanup Warning]:', cleanupErr);
      }
    }

    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // =========================================================================
  // 1. Validasi Autentikasi dan Otorisasi (RBAC)
  // =========================================================================
  describe('1. Validasi Autentikasi dan Otorisasi (RBAC)', () => {
    it('menolak permintaan penghapusan tanpa token autentikasi (HTTP 401 UNAUTHORIZED)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveNoLoanId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('menolak permintaan penghapusan dari peran GURU_PEGAWAI (HTTP 403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveNoLoanId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${guruToken}` },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
    });

    it('menolak permintaan penghapusan dari peran KEPALA_SEKOLAH (HTTP 403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveNoLoanId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${kepsekToken}` },
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // 2. Aturan Ketat: Barang Aktif Tidak Boleh Dihapus (HTTP 409)
  // =========================================================================
  describe('2. Aturan Ketat Penolakan Barang Aktif', () => {
    it('menolak penghapusan barang aktif dengan HTTP 409 Conflict dan kode CANNOT_DELETE_ACTIVE_ASSET', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testActiveAssetId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Mencoba menghapus barang aktif' }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('CANNOT_DELETE_ACTIVE_ASSET');
      expect(json.message).toContain('Barang aktif tidak boleh dihapus');

      // Pastikan barang masih tetap ada dan utuh di database
      if (pool) {
        const check = await pool.query('SELECT id, operational_status FROM assets WHERE id = $1', [
          testActiveAssetId,
        ]);
        expect(check.rows.length).toBe(1);
        expect(check.rows[0].operational_status).toBe('AVAILABLE');
      }
    });
  });

  // =========================================================================
  // 3. Aturan Transaksi Aktif: Penolakan Barang dengan Peminjaman Berjalan
  // =========================================================================
  describe('3. Proteksi Integritas Transaksi Peminjaman Aktif', () => {
    it('menolak penghapusan barang tidak aktif yang masih memiliki peminjaman aktif dengan HTTP 409 ACTIVE_LOANS_EXIST', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveWithActiveLoanId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('ACTIVE_LOANS_EXIST');
      expect(json.message).toContain('masih terkait dengan');
      expect(json.message).toContain('transaksi peminjaman aktif');
    });
  });

  // =========================================================================
  // 4. Penghapusan Permanen untuk Barang Tidak Aktif Tanpa Riwayat
  // =========================================================================
  describe('4. Penghapusan Permanen (Hard Delete) Barang Tanpa Riwayat', () => {
    it('berhasil menghapus permanen barang tidak aktif tanpa riwayat peminjaman (HTTP 200, mode: DELETED)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveNoLoanId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Barang rusak berat dan tidak pernah dipakai' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mode).toBe('DELETED');
      expect(json.message).toContain('berhasil dihapus secara permanen');

      // Verifikasi di database: baris sudah tidak ada
      if (pool) {
        const check = await pool.query('SELECT id FROM assets WHERE id = $1', [testInactiveNoLoanId]);
        expect(check.rows.length).toBe(0);

        // Verifikasi audit_logs mencatat aksi HAPUS_BARANG
        const auditCheck = await pool.query(
          "SELECT action, entity_id FROM audit_logs WHERE entity_id = $1 AND action = 'HAPUS_BARANG'",
          [testInactiveNoLoanId]
        );
        expect(auditCheck.rows.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // =========================================================================
  // 5. Pengarsipan Aman (Soft Delete) untuk Barang dengan Riwayat Transaksi
  // =========================================================================
  describe('5. Pengarsipan Aman (Soft Delete) untuk Barang Ber-Riwayat', () => {
    it('mengarsipkan barang tidak aktif dengan riwayat peminjaman demi menjaga integritas data audit (HTTP 200, mode: ARCHIVED)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/${testInactiveWithHistoryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Dilelang karena penggantian sarana baru' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.mode).toBe('ARCHIVED');
      expect(json.message).toContain('memiliki riwayat transaksi peminjaman, sehingga diarsipkan');

      // Verifikasi di database: data aset tetap ada dengan is_decommissioned = true
      if (pool) {
        const check = await pool.query(
          'SELECT id, is_decommissioned, decommissioned_reason, operational_status, qr_token, asset_code, permanent_id FROM assets WHERE id = $1',
          [testInactiveWithHistoryId]
        );
        expect(check.rows.length).toBe(1);
        const row = check.rows[0];
        expect(row.is_decommissioned).toBe(true);
        expect(row.operational_status).toBe('INACTIVE');
        expect(row.decommissioned_reason).toBe('Dilelang karena penggantian sarana baru');
        // Identitas QR dan kode tetap terjaga utuh
        expect(row.qr_token).toBe(`QR-${testInactiveWithHistoryId}`);
        expect(row.asset_code).toBe(`CODE-${testInactiveWithHistoryId}`);
        expect(row.permanent_id).toBe(`PID-${testInactiveWithHistoryId}`);

        // Verifikasi riwayat transaksi peminjaman tetap utuh tidak rusak
        const loanCheck = await pool.query('SELECT id, status FROM loans WHERE id = $1', [
          testCompletedLoanId,
        ]);
        expect(loanCheck.rows.length).toBe(1);
        expect(loanCheck.rows[0].status).toBe('COMPLETED');

        // Verifikasi audit log mencatat aksi ARSIP_BARANG
        const auditCheck = await pool.query(
          "SELECT action, entity_id FROM audit_logs WHERE entity_id = $1 AND action = 'ARSIP_BARANG'",
          [testInactiveWithHistoryId]
        );
        expect(auditCheck.rows.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('memastikan lookup/scan terhadap barang yang diarsipkan mengembalikan notice BARANG_DINONAKTIFKAN tanpa error 500', async () => {
      const res = await fetch(`${baseUrl}/api/v1/assets/scan?query=QR-${testInactiveWithHistoryId}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.notice).toBe('BARANG_DINONAKTIFKAN');
      expect(json.isDecommissioned).toBe(true);
      expect(json.operationalStatus).toBe('INACTIVE');
    });
  });

  // =========================================================================
  // 6. Uji Konkurensi & Mutex (Race Condition Prevention)
  // =========================================================================
  describe('6. Penanganan Permintaan Bersamaan (Concurrency Safety)', () => {
    it('mencegah race condition ketika dua permintaan penghapusan tiba secara bersamaan', async () => {
      if (!pool) return;

      const locRes = await pool.query('SELECT id, name FROM locations LIMIT 1');
      const locId = locRes.rows[0].id;
      const locName = locRes.rows[0].name;

      const concurrentAssetId = `ast-test-conc-${Date.now()}`;
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_name, location_id, location_name,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)`,
        [
          concurrentAssetId,
          `PID-${concurrentAssetId}`,
          `QR-${concurrentAssetId}`,
          `CODE-${concurrentAssetId}`,
          'Unit Uji Konkurensi',
          'MIS Cendikia Bunayya',
          'TIK/Multimedia',
          locId,
          locName,
          'DIRECT',
          'GOOD',
          'INACTIVE',
        ]
      );

      // Jalankan 2 permintaan penghapusan secara paralel
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/v1/assets/${concurrentAssetId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Request A' }),
        }),
        fetch(`${baseUrl}/api/v1/assets/${concurrentAssetId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'Request B' }),
        }),
      ]);

      const statuses = [res1.status, res2.status];
      // Tepat satu request harus berhasil (200), dan request kedua harus 404 (ASSET_NOT_FOUND)
      expect(statuses).toContain(200);
      expect(statuses).toContain(404);

      // Bersihkan jika ada audit log
      await pool.query('DELETE FROM audit_logs WHERE entity_id = $1', [concurrentAssetId]);
    });
  });

  // =========================================================================
  // 7. Mock Storage & Frontend Service Testing
  // =========================================================================
  describe('7. Mock Storage Service Layer Compliance', () => {
    const storageInstance = MockStorageService.getInstance();

    it('storage.deleteAsset menolak barang berstatus aktif', () => {
      const activeUnit: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'> = {
        itemName: 'Mock Active Laptop',
        categoryName: 'TIK',
        technicalSpecs: 'Intel Core i5',
        itemBrand: 'Asus',
        fundingSource: 'BOS Reguler',
        acquisitionYear: 2024,
        locationId: 'loc-1',
        locationName: 'Lab 1',
        assetCode: 'INV-MOCK-ACT',
        qrToken: 'QR-INV-MOCK-ACT',
        effectiveLoanMode: 'DIRECT',
        conditionStatus: 'GOOD',
        operationalStatus: 'AVAILABLE',
        isDecommissioned: false,
      };

      const added = storageInstance.addAsset(activeUnit);

      expect(() => storageInstance.deleteAsset(added.id)).toThrow(
        /Barang aktif tidak boleh dihapus/
      );
    });

    it('storage.deleteAsset menghapus barang tidak aktif tanpa pinjaman dengan mode DELETED', () => {
      const inactiveUnit: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'> = {
        itemName: 'Mock Inactive Projector',
        categoryName: 'TIK',
        technicalSpecs: 'Epson LCD',
        itemBrand: 'Epson',
        fundingSource: 'BOS Reguler',
        acquisitionYear: 2023,
        locationId: 'loc-1',
        locationName: 'Lab 1',
        assetCode: 'INV-MOCK-INACT',
        qrToken: 'QR-INV-MOCK-INACT',
        effectiveLoanMode: 'DIRECT',
        conditionStatus: 'MAJOR_DAMAGE',
        operationalStatus: 'INACTIVE',
        isDecommissioned: false,
      };

      const added = storageInstance.addAsset(inactiveUnit);
      const res = storageInstance.deleteAsset(added.id, 'Rusak parah');
      expect(res.success).toBe(true);
      expect(res.mode).toBe('DELETED');

      // Pastikan sudah tidak ditemukan di mock storage
      const found = storageInstance.getAssetById(added.id);
      expect(found).toBeUndefined();
    });
  });
});
