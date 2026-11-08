import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { pool } from '../../server/src/db.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { sseManager } from '../../server/src/realtime/sseManager.js';
import { MockStorageService } from '../services/mockStorage.js';
import { UserProfile } from '../types';

describe('SIMSARPRAS Simplified Return Flow Test Suite (Pengajuan -> Verifikasi Penerimaan -> Selesai)', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let otherTeacherToken: string;
  let dbAdmin: any;
  let dbTeacher: any;
  let dbOtherTeacher: any;

  let storage: MockStorageService;

  const mockAdmin: UserProfile = {
    id: 'usr-admin-1',
    fullName: 'Bambang Hermawan, S.Kom.',
    employeeNumber: '198204152008011005',
    email: 'admin.sarpras@smkn1teladan.sch.id',
    role: 'ADMIN_SARPRAS',
    isActive: true,
  };

  const mockGuru1: UserProfile = {
    id: 'usr-guru-1',
    fullName: 'Siti Nurhaliza, S.Pd.',
    employeeNumber: '199003202015022003',
    email: 'siti.nurhaliza@smkn1teladan.sch.id',
    role: 'GURU_PEGAWAI',
    isActive: true,
  };

  const mockGuru2: UserProfile = {
    id: 'usr-guru-2',
    fullName: 'Ahmad Fauzi, M.Pd.',
    employeeNumber: '198811122014031001',
    email: 'ahmad.fauzi@smkn1teladan.sch.id',
    role: 'GURU_PEGAWAI',
    isActive: true,
  };

  beforeAll(async () => {
    // 1. Start HTTP test server
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // 2. Fetch real users from local DB if pool is available
    if (pool) {
      const userRes = await pool.query('SELECT id, email, role, full_name, employee_number FROM users');
      dbAdmin = userRes.rows.find((u) => u.role === 'ADMIN_SARPRAS') || userRes.rows[0];
      const teachers = userRes.rows.filter((u) => u.role === 'GURU_PEGAWAI');
      dbTeacher = teachers[0] || userRes.rows[0];
      dbOtherTeacher = teachers[1] || { ...dbTeacher, id: 'usr-other-teacher', email: 'other@sekolah.sch.id' };

      adminToken = generateTestToken({
        id: dbAdmin.id,
        email: dbAdmin.email,
        role: dbAdmin.role || 'ADMIN_SARPRAS',
        fullName: dbAdmin.full_name || 'Admin Sarpras',
      });

      otherTeacherToken = generateTestToken({
        id: dbOtherTeacher.id,
        email: dbOtherTeacher.email,
        role: 'GURU_PEGAWAI',
        fullName: 'Guru Lain',
      });
    }
  });

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query("DELETE FROM return_inspections WHERE loan_id LIKE 'loan-ret-test-%'");
        await pool.query("DELETE FROM audit_logs WHERE entity_id LIKE 'loan-ret-test-%' OR entity_id LIKE 'ast-ret-test-%'");
        await pool.query("DELETE FROM loans WHERE id LIKE 'loan-ret-test-%' OR asset_id LIKE 'ast-ret-test-%'");
        await pool.query("DELETE FROM assets WHERE id LIKE 'ast-ret-test-%'");
      } catch (cleanupErr) {
        console.warn('[Test Cleanup Warning]:', cleanupErr);
      }
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    storage = MockStorageService.getInstance();
    storage.resetToDefaults();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. STATE MACHINE & SERVICE LEVEL TESTS
  // =========================================================================
  describe('A. State Machine & MockStorage Logic', () => {
    it('1. Guru dapat mengajukan pengembalian yang valid (berstatus RETURN_REQUESTED)', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);

      const returned = storage.submitReturnRequest({
        loanId: loan.id,
        borrowerUser: mockGuru1,
        notes: 'Peminjaman tuntas, charger lengkap',
      });

      expect(returned.status).toBe('RETURN_REQUESTED');
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RETURN_PENDING');
    });

    it('2. Admin dapat langsung memverifikasi penerimaan tanpa tahap pemeriksaan terpisah', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });

      // Verifikasi 1 langkah langsung selesai
      const verified = storage.verifyReturn(loan.id, mockAdmin, 'Fisik dan charger diterima lengkap');

      expect(verified.status).toBe('COMPLETED');
      expect(verified.approvedBy).toBe(mockAdmin.id);
      expect(verified.returnInspection?.approvedByName).toBe(mockAdmin.fullName);
    });

    it('3. Setelah verifikasi berhasil, ketersediaan barang otomatis pulih menjadi AVAILABLE', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });
      storage.verifyReturn(loan.id, mockAdmin);

      const restoredAsset = storage.getAssetById(unit.id)!;
      expect(restoredAsset.operationalStatus).toBe('AVAILABLE');
      expect(restoredAsset.conditionStatus).toBe('GOOD');
    });

    it('4. Barang yang dinonaktifkan (decommissioned) tidak berubah menjadi AVAILABLE melainkan tetap INACTIVE', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });

      // Simulasikan barang dinonaktifkan
      storage.decommissionAsset(unit.id, 'Barang dialihkan untuk penghapusan');

      // Admin memverifikasi pengembalian
      storage.verifyReturn(loan.id, mockAdmin);

      const updatedAsset = storage.getAssetById(unit.id)!;
      expect(updatedAsset.operationalStatus).toBe('INACTIVE');
    });

    it('5. Pengguna yang tidak berwenang (bukan peminjam) ditolak saat mengajukan pengembalian', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);

      // Guru 2 mencoba mengembalikan pinjaman Guru 1
      expect(() => {
        storage.submitReturnRequest({
          loanId: loan.id,
          borrowerUser: mockGuru2,
        });
      }).toThrow(/Anda hanya dapat mengajukan pengembalian/);
    });

    it('6. Pengembalian ganda ditolak dengan aman', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });

      // Coba ajukan pengembalian lagi saat sudah RETURN_REQUESTED
      expect(() => {
        storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });
      }).toThrow(/Pengembalian barang sudah diajukan sebelumnya/);

      // Verifikasi selesai
      storage.verifyReturn(loan.id, mockAdmin);

      // Coba verifikasi lagi setelah COMPLETED
      expect(() => {
        storage.verifyReturn(loan.id, mockAdmin);
      }).toThrow(/sudah selesai diverifikasi/);
    });

    it('7. Pengguna non-admin ditolak saat mencoba melakukan verifikasi penerimaan', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar kelas X',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });

      expect(() => {
        storage.verifyReturn(loan.id, mockGuru1);
      }).toThrow(/Akses ditolak: Hanya Admin Sarpras/);
    });

    it('8. Riwayat transaksi dan audit log tetap terjaga secara lengkap', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Presentasi',
        expectedReturnAt: '2026-10-16T15:00:00Z',
        borrower: mockGuru1,
      });
      storage.approveLoanRequest(loan.id, mockAdmin);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: mockGuru1 });
      storage.verifyReturn(loan.id, mockAdmin);

      const logs = storage.getAuditLogs();
      const relevantLogs = logs.filter((l) => l.entityId === loan.id);

      expect(relevantLogs.some((l) => l.action === 'PENGAJUAN_PENGEMBALIAN')).toBe(true);
      expect(relevantLogs.some((l) => l.action === 'VERIFIKASI_PENGEMBALIAN')).toBe(true);
    });
  });

  // =========================================================================
  // 2. BACKEND EXPRESS API LAYER & SSE EVENT INTEGRITY
  // =========================================================================
  describe('B. Backend API Layer & SSE Event Integrity', () => {
    it('9. POST /api/v1/returns menolak guru mengembalikan pinjaman milik orang lain (HTTP 403)', async () => {
      if (!pool) return;

      // Ambil transaksi aktif yang ada di DB
      const activeRes = await pool.query(
        `SELECT id, borrower_id FROM loans WHERE status = 'ACTIVE' LIMIT 1`
      );
      if (activeRes.rows.length === 0) return;

      const activeLoan = activeRes.rows[0];

      // Request dengan token guru lain
      const res = await fetch(`${baseUrl}/api/v1/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherTeacherToken}`,
        },
        body: JSON.stringify({
          loanId: activeLoan.id,
          notes: 'Mencoba kembalikan milik orang lain',
        }),
      });

      // Jika borrower_id bukan otherTeacher, wajib ditolak dengan 403
      if (activeLoan.borrower_id !== dbOtherTeacher.id) {
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error).toBe('FORBIDDEN');
      }
    });

    it('10. POST /api/v1/returns/:id/verify menyelesaikan pengembalian dalam 1 langkah dan memancarkan SSE', async () => {
      if (!pool) return;

      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Buat aset dan peminjaman uji coba mandiri agar tidak mengganggu test lain
      const catRes = await pool.query('SELECT id, name FROM categories LIMIT 1');
      const locRes = await pool.query('SELECT id, name FROM locations LIMIT 1');
      const categoryId = catRes.rows[0].id;
      const categoryName = catRes.rows[0].name;
      const locationId = locRes.rows[0].id;
      const locationName = locRes.rows[0].name;

      const testAssetId = `ast-ret-test-${Date.now()}`;
      await pool.query(
        `INSERT INTO assets (
          id, permanent_id, qr_token, asset_code, item_name, institution,
          category_id, category_name, location_id, location_name, funding_source,
          effective_loan_mode, condition_status, operational_status, is_decommissioned
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)`,
        [
          testAssetId,
          `PID-${testAssetId}`,
          `QR-${testAssetId}`,
          `CODE-${testAssetId}`,
          'Unit Uji Pengembalian Dedicated',
          'MIS Cendikia Bunayya',
          categoryId,
          categoryName,
          locationId,
          locationName,
          'BOS Reguler',
          'DIRECT',
          'GOOD',
          'RETURN_PENDING',
        ]
      );

      const testLoanId = `loan-ret-test-${Date.now()}`;
      const testLoanNumber = `PINJAM-${Date.now()}`;
      await pool.query(
        `INSERT INTO loans (id, loan_number, asset_id, borrower_id, borrower_name, status, loan_mode_snapshot, purpose, expected_return_at, requested_at)
         VALUES ($1, $2, $3, $4, $5, 'RETURN_REQUESTED', 'DIRECT', 'Uji coba verifikasi', NOW() + INTERVAL '1 day', NOW())`,
        [testLoanId, testLoanNumber, testAssetId, dbTeacher.id, dbTeacher.full_name || 'Guru Test']
      );

      // Admin melakukan verifikasi penerimaan
      const res = await fetch(`${baseUrl}/api/v1/returns/${testLoanId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          notes: 'Fisik barang terverifikasi utuh dan berfungsi baik',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('COMPLETED');

      // Verifikasi status aset pulih di DB
      const checkAsset = await pool.query(`SELECT operational_status FROM assets WHERE id = $1`, [testAssetId]);
      expect(checkAsset.rows[0].operational_status).toBe('AVAILABLE');

      // Verifikasi event SSE dipancarkan setelah COMMIT
      expect(broadcastSpy).toHaveBeenCalledWith('loan.returned', expect.objectContaining({
        loanId: testLoanId,
        status: 'COMPLETED',
      }));
      expect(broadcastSpy).toHaveBeenCalledWith('asset.availability_changed', expect.objectContaining({
        assetId: testAssetId,
        status: 'AVAILABLE',
      }));

      // Verifikasi tercatat di audit_logs
      const auditRes = await pool.query(
        `SELECT action, details FROM audit_logs WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [testLoanId]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
      expect(auditRes.rows[0].action).toBe('VERIFIKASI_PENGEMBALIAN');
    });

    it('11. Transaksi gagal tidak menghasilkan event sukses SSE', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Panggil verifikasi untuk ID yang tidak ada
      const res = await fetch(`${baseUrl}/api/v1/returns/non-existent-loan-id/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(404);
      // Memastikan SSE tidak memancarkan event sukses
      expect(broadcastSpy).not.toHaveBeenCalledWith('loan.returned', expect.anything());
    });

    it('12. Pengembalian ganda pada endpoint /verify ditolak dengan HTTP 400', async () => {
      if (!pool) return;

      // Cari loan yang sudah COMPLETED
      const completedRes = await pool.query(
        `SELECT id FROM loans WHERE status = 'COMPLETED' LIMIT 1`
      );
      if (completedRes.rows.length === 0) return;

      const completedId = completedRes.rows[0].id;

      const res = await fetch(`${baseUrl}/api/v1/returns/${completedId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('ALREADY_COMPLETED');
    });
  });
});
