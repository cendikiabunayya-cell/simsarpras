import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAudit } from '../../server/src/utils/auditLogger';
import { pool } from '../../server/src/db';

vi.mock('../../server/src/db', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('Comprehensive Audit Logging Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Mencatat aktivitas penambahan barang ke audit_logs dengan parameter lengkap', async () => {
    (pool!.query as any).mockResolvedValueOnce({ rows: [] });

    await logAudit({
      userId: 'usr-admin-1',
      userName: 'Admin Sarpras',
      userRole: 'ADMIN_SARPRAS',
      action: 'TAMBAH_BARANG',
      entityType: 'ASSET',
      entityId: 'ast-laptop-01',
      entityName: 'Laptop Acer Aspire',
      details: 'Menambahkan barang baru: Laptop Acer Aspire (INV-001) di Lab Komputer',
      ipAddress: '127.0.0.1',
    });

    expect(pool!.query).toHaveBeenCalledTimes(1);
    const [query, params] = (pool!.query as any).mock.calls[0];
    expect(query).toContain('INSERT INTO audit_logs');
    expect(params[1]).toBe('usr-admin-1');
    expect(params[2]).toBe('Admin Sarpras');
    expect(params[3]).toBe('ADMIN_SARPRAS');
    expect(params[4]).toBe('TAMBAH_BARANG');
    expect(params[5]).toBe('ASSET');
    expect(params[6]).toBe('ast-laptop-01');
    expect(params[7]).toBe('Laptop Acer Aspire');
    expect(params[8]).toContain('Menambahkan barang baru');
    expect(params[9]).toBe('127.0.0.1');
  });

  it('2. Mencatat pembaruan pengaturan identitas sekolah', async () => {
    (pool!.query as any).mockResolvedValueOnce({ rows: [] });

    await logAudit({
      userId: 'usr-admin-1',
      userName: 'Bambang Hermawan',
      userRole: 'ADMIN_SARPRAS',
      action: 'UBAH_PENGATURAN_SEKOLAH',
      entityType: 'SCHOOL_SETTINGS',
      entityId: 'default',
      entityName: 'Madrasah Ibtidaiyah Swasta Cendikia Bunayya',
      details: 'Memperbarui nama kepala madrasah dan pengelola sarpras',
    });

    expect(pool!.query).toHaveBeenCalledTimes(1);
    const [, params] = (pool!.query as any).mock.calls[0];
    expect(params[4]).toBe('UBAH_PENGATURAN_SEKOLAH');
    expect(params[5]).toBe('SCHOOL_SETTINGS');
    expect(params[7]).toBe('Madrasah Ibtidaiyah Swasta Cendikia Bunayya');
  });

  it('3. Fail-safe: kegagalan query database tidak melemparkan error keluar (non-blocking)', async () => {
    (pool!.query as any).mockRejectedValueOnce(new Error('DB Connection Timeout'));

    // Harusnya tidak melempar exception (fail-closed untuk log tapi tidak memutus alur utama)
    await expect(
      logAudit({
        action: 'UBAH_BARANG',
        entityType: 'ASSET',
        entityId: 'ast-99',
        details: 'Testing fail-safe',
      })
    ).resolves.not.toThrow();
  });
});
