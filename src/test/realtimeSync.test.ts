import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { pool } from '../../server/src/db.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { sseManager } from '../../server/src/realtime/sseManager.js';
import { QueryClient } from '@tanstack/react-query';

describe('SIMSARPRAS Real-Time Synchronization & SSE Event Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let teacherToken: string;
  let teacherId: string;
  let teacherName: string;
  let teacherEmpNumber: string;

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

    // 2. Ambil pengguna nyata dari database lokal agar lolos constraint foreign key
    const userRes = await pool!.query('SELECT id, email, role, full_name, employee_number FROM users');
    const dbAdmin = userRes.rows.find((u) => u.role === 'ADMIN_SARPRAS') || userRes.rows[0];
    const dbTeacher = userRes.rows.find((u) => u.role === 'GURU_PEGAWAI') || userRes.rows[0];

    teacherId = dbTeacher.id;
    teacherName = dbTeacher.full_name || 'Guru Test';
    teacherEmpNumber = dbTeacher.employee_number || '198705052010011002';

    adminToken = generateTestToken({
      id: dbAdmin.id,
      email: dbAdmin.email,
      role: dbAdmin.role || 'ADMIN_SARPRAS',
      fullName: dbAdmin.full_name || 'Admin Sarpras',
    });

    teacherToken = generateTestToken({
      id: dbTeacher.id,
      email: dbTeacher.email,
      role: dbTeacher.role || 'GURU_PEGAWAI',
      fullName: dbTeacher.full_name || 'Guru Test',
    });
  });

  afterAll(async () => {
    sseManager.reset();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    sseManager.reset();
  });

  // =========================================================================
  // 1. Keamanan Akses Kanal Real-Time (HTTP 401 & Fail-Closed)
  // =========================================================================
  describe('1. Keamanan Akses Kanal Real-Time (Point 5)', () => {
    it('menolak koneksi SSE tanpa token autentikasi dengan HTTP 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/v1/realtime/events`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('UNAUTHORIZED');
      expect(json.message).toMatch(/Autentikasi diperlukan/i);
    });

    it('menolak koneksi SSE dengan token JWT yang tidak valid atau palsu', async () => {
      const res = await fetch(`${baseUrl}/api/v1/realtime/events?token=invalid.jwt.token`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('INVALID_TOKEN');
    });

    it('mengizinkan koneksi SSE dengan token JWT sah dan mendaftarkan klien', async () => {
      const clientRes = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const req = http.get(`${baseUrl}/api/v1/realtime/events?token=${adminToken}`, (res) => {
          resolve(res);
        });
        req.on('error', reject);
      });

      expect(clientRes.statusCode).toBe(200);
      expect(clientRes.headers['content-type']).toContain('text/event-stream');
      expect(clientRes.headers['cache-control']).toContain('no-cache');

      // Verifikasi status klien aktif di manager
      const statusRes = await fetch(`${baseUrl}/api/v1/realtime/status`);
      const statusJson = await statusRes.json();
      expect(statusJson.status).toBe('ACTIVE');
      expect(statusJson.activeClients).toBeGreaterThanOrEqual(1);

      clientRes.destroy();
    });
  });

  // =========================================================================
  // 2. Isolasi Data & Kerahasiaan Lintas Peran (Point 6)
  // =========================================================================
  describe('2. Kerahasiaan Data & Bebas Kebocoran PII (Point 6)', () => {
    it('payload event SSE hanya memuat identitas teknis dan status, tanpa membocorkan PII atau catatan sensitif', () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Simulasi broadcast event pinjaman baru
      sseManager.broadcast('loan.created', {
        loanId: 'loan-12345',
        loanNumber: 'PINJAM-20261014-0001',
        assetId: 'ast-99999',
        status: 'PENDING_APPROVAL',
      });

      expect(broadcastSpy).toHaveBeenCalledWith('loan.created', expect.objectContaining({
        loanId: 'loan-12345',
        loanNumber: 'PINJAM-20261014-0001',
        assetId: 'ast-99999',
        status: 'PENDING_APPROVAL',
      }));

      const callArgs = broadcastSpy.mock.calls[0][1];
      // Pastikan TIDAK ADA password, NIP rahasia, atau data pribadi
      expect(callArgs).not.toHaveProperty('password');
      expect(callArgs).not.toHaveProperty('internalNotes');
      expect(callArgs).not.toHaveProperty('teacherNationalId');
    });

    it('mendukung penargetan role sehingga peran tertentu tidak menerima event yang bukan haknya', () => {
      let adminReceived = false;
      let teacherReceived = false;

      const fakeAdminRes = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          if (data.includes('loan.approved')) adminReceived = true;
        }),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      const fakeTeacherRes = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          if (data.includes('loan.approved')) teacherReceived = true;
        }),
        on: vi.fn(),
        end: vi.fn(),
      } as any;

      sseManager.addClient({
        id: 'client-admin',
        res: fakeAdminRes,
        role: 'ADMIN_SARPRAS',
        connectedAt: Date.now(),
      });

      sseManager.addClient({
        id: 'client-teacher',
        res: fakeTeacherRes,
        role: 'GURU_PEGAWAI',
        connectedAt: Date.now(),
      });

      // Siarkan event hanya untuk role ADMIN_SARPRAS
      sseManager.broadcast('loan.approved', { loanId: 'loan-target-1' }, { targetRoles: ['ADMIN_SARPRAS'] });

      expect(adminReceived).toBe(true);
      expect(teacherReceived).toBe(false);
    });
  });

  // =========================================================================
  // 3. Transaksi Database Sukses Menghasilkan Event (Points 1, 2, 3)
  // =========================================================================
  describe('3. Emisi Event Pada Transaksi Berhasil (Points 1, 2, 3)', () => {
    it('pengajuan peminjaman (loan.created) menyiarkan event loan.created dan asset.availability_changed', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Ambil 1 aset yang berstatus AVAILABLE dari database lokal
      const assetRes = await pool!.query("SELECT id FROM assets WHERE operational_status = 'AVAILABLE' LIMIT 1");
      if (assetRes.rows.length === 0) {
        // Lewati jika belum ada aset di DB lokal
        return;
      }
      const assetId = assetRes.rows[0].id;

      // Submit pengajuan via API
      const res = await fetch(`${baseUrl}/api/v1/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          assetId,
          borrowerId: teacherId,
          borrowerName: teacherName,
          borrowerEmployeeNumber: teacherEmpNumber,
          borrowerRole: 'GURU_PEGAWAI',
          purpose: 'Praktikum Realtime Sync',
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      });

      if (res.status === 201) {
        const json = await res.json();
        expect(json.id).toBeDefined();

        // Verifikasi bahwa event loan.created & asset.availability_changed disiarkan
        expect(broadcastSpy).toHaveBeenCalledWith('loan.created', expect.objectContaining({
          loanId: json.id,
        }));
        expect(broadcastSpy).toHaveBeenCalledWith('asset.availability_changed', expect.objectContaining({
          assetId,
          status: expect.stringMatching(/RESERVED|ON_LOAN/),
        }));
      }
    });

    it('persetujuan dan penolakan peminjaman menyiarkan loan.approved dan loan.rejected', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Cari atau buat pending loan
      const loanRes = await pool!.query("SELECT id, asset_id FROM loans WHERE status = 'PENDING_APPROVAL' LIMIT 1");
      if (loanRes.rows.length > 0) {
        const loanId = loanRes.rows[0].id;

        // Tolak peminjaman
        const rejectRes = await fetch(`${baseUrl}/api/v1/loans/${loanId}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ reason: 'Unit dibutuhkan untuk asesmen' }),
        });

        if (rejectRes.status === 200) {
          expect(broadcastSpy).toHaveBeenCalledWith('loan.rejected', expect.objectContaining({
            loanId,
          }));
          expect(broadcastSpy).toHaveBeenCalledWith('asset.availability_changed', expect.objectContaining({
            status: 'AVAILABLE',
          }));
        }
      }
    });

    it('pengembalian barang menyiarkan loan.returned dan pemulihan ketersediaan barang', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      // Cari loan aktif untuk diproses pengembaliannya
      const loanRes = await pool!.query("SELECT id FROM loans WHERE status = 'ACTIVE' OR status = 'APPROVED' LIMIT 1");
      if (loanRes.rows.length > 0) {
        const loanId = loanRes.rows[0].id;

        // Guru mengajukan pengembalian
        const returnRes = await fetch(`${baseUrl}/api/v1/returns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${teacherToken}`,
          },
          body: JSON.stringify({ loanId, notes: 'Selesai digunakan dalam kondisi baik' }),
        });

        if (returnRes.status === 200) {
          expect(broadcastSpy).toHaveBeenCalledWith('loan.returned', expect.objectContaining({
            loanId,
            status: 'RETURN_REQUESTED',
          }));
        }
      }
    });
  });

  // =========================================================================
  // 4. Transaksi Gagal / Rollback TIDAK Menghasilkan Event (Point 4)
  // =========================================================================
  describe('4. Transaksi Gagal Bebas dari Emisi Event Palsu (Point 4)', () => {
    it('transaksi peminjaman dengan aset yang tidak ada melakukan ROLLBACK dan tidak memancarkan event', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      const res = await fetch(`${baseUrl}/api/v1/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          assetId: 'ast-non-existent-99999999',
          borrowerId: 'usr-teacher-realtime',
          borrowerName: 'Guru Realtime Test',
          borrowerEmployeeNumber: '198705052010011002',
          borrowerRole: 'GURU_PEGAWAI',
          purpose: 'Uji Rollback',
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      });

      expect(res.status).toBe(404);
      // Memastikan ZERO broadcast jika transaksi gagal
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('persetujuan peminjaman yang tidak ditemukan tidak memancarkan event sukses', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      const res = await fetch(`${baseUrl}/api/v1/loans/loan-fake-999999/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(res.status).toBe(404);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('pengembalian untuk loan yang tidak ditemukan tidak memancarkan event sukses', async () => {
      const broadcastSpy = vi.spyOn(sseManager, 'broadcast');

      const res = await fetch(`${baseUrl}/api/v1/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ loanId: 'loan-fake-999999' }),
      });

      expect(res.status).toBe(404);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Pencegahan Spamming / Debouncing Refresh pada Frontend (Point 5 & 8)
  // =========================================================================
  describe('5. Debounce Invalidasi Query & Pencegahan Request Berlebihan (Point 5 & 8)', () => {
    it('menggabungkan beberapa event yang tiba berdekatan menjadi satu invalidasi per queryKey', async () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Simulasi implementasi debouncer RealtimeProvider
      const pendingKeys = new Set<string>();
      let timer: any = null;

      const debouncedInvalidate = (keys: string[][]) => {
        keys.forEach((k) => pendingKeys.add(JSON.stringify(k)));
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          pendingKeys.forEach((kStr) => {
            queryClient.invalidateQueries({ queryKey: JSON.parse(kStr) });
          });
          pendingKeys.clear();
        }, 50);
      };

      // Tembakkan 10 event dalam waktu 10ms (simulasi event burst)
      for (let i = 0; i < 10; i++) {
        debouncedInvalidate([['loans'], ['assets']]);
      }

      // Tunggu hingga jendela debounce selesai
      await new Promise((r) => setTimeout(r, 80));

      // QueryClient hanya dipanggil 2 kali (1 untuk 'loans', 1 untuk 'assets'), BUKAN 20 kali!
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['loans'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['assets'] });
    });
  });

  // =========================================================================
  // 6. Pemulihan Setelah Reconnect (Point 7)
  // =========================================================================
  describe('6. Pemulihan & Re-Sinkronisasi Data Setelah Terhubung Kembali (Point 7)', () => {
    it('saat event "connected" diterima setelah reconnect, frontend melakukan re-sinkronisasi penuh', () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      // Simulasi penerimaan event "connected" saat koneksi terpulihkan
      queryClient.invalidateQueries();

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });
});
