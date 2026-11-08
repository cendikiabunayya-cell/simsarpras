import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { pool } from '../../server/src/db.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { MockStorageService } from '../services/mockStorage.js';

describe('SIMSARPRAS Funding Source & Acquisition Year Filter Test Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let adminToken: string;
  let testFundingName: string;
  let testYear: number;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Buat token admin yang valid
    if (pool) {
      const userRes = await pool.query('SELECT id, email, role, full_name FROM users WHERE role = $1 LIMIT 1', ['ADMIN_SARPRAS']);
      const dbAdmin = userRes.rows[0] || {
        id: 'usr-admin-test',
        email: 'admin.test@bunayya.sch.id',
        role: 'ADMIN_SARPRAS',
        full_name: 'Admin Sarpras Test',
      };

      adminToken = generateTestToken({
        id: dbAdmin.id,
        email: dbAdmin.email,
        role: dbAdmin.role || 'ADMIN_SARPRAS',
        fullName: dbAdmin.full_name || 'Admin Sarpras',
      });

      // Dapatkan data pendanaan dan tahun yang tersedia di DB
      const assetRes = await pool.query(`
        SELECT funding_source, acquisition_year
        FROM assets
        WHERE funding_source IS NOT NULL AND acquisition_year IS NOT NULL AND is_decommissioned = false
        LIMIT 1
      `);
      if (assetRes.rows.length > 0) {
        testFundingName = assetRes.rows[0].funding_source;
        testYear = Number(assetRes.rows[0].acquisition_year);
      } else {
        testFundingName = 'BOS Tahap I';
        testYear = 2023;
      }
    } else {
      adminToken = generateTestToken({
        id: 'usr-admin-1',
        email: 'admin.sarpras@smkn1teladan.sch.id',
        role: 'ADMIN_SARPRAS',
        fullName: 'Admin Test',
      });
      testFundingName = 'BOS Reguler';
      testYear = 2024;
    }
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // 1. Filter Sumber Pendanaan Bekerja
  it('1. Filter sumber pendanaan berhasil menyaring barang pada backend (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/assets?fundingSource=${encodeURIComponent(testFundingName)}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    const assets = json.data || json;
    expect(Array.isArray(assets)).toBe(true);

    // Setiap barang yang dihasilkan harus memiliki sumber dana yang sesuai
    assets.forEach((a: any) => {
      expect(a.fundingSource).toBe(testFundingName);
    });
  });

  // 2. Filter Tahun Perolehan Bekerja
  it('2. Filter tahun perolehan berhasil menyaring barang pada backend (HTTP 200)', async () => {
    const res = await fetch(`${baseUrl}/assets?acquisitionYear=${testYear}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    const assets = json.data || json;
    expect(Array.isArray(assets)).toBe(true);

    // Setiap barang yang dihasilkan harus memiliki tahun perolehan yang sesuai
    assets.forEach((a: any) => {
      expect(Number(a.acquisitionYear)).toBe(testYear);
    });
  });

  // 3. Kombinasi Kedua Filter Menggunakan Logika AND
  it('3. Kombinasi kedua filter bekerja dengan logika AND (memenuhi kedua kriteria sekaligus)', async () => {
    const res = await fetch(
      `${baseUrl}/assets?fundingSource=${encodeURIComponent(testFundingName)}&acquisitionYear=${testYear}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    const assets = json.data || json;
    expect(Array.isArray(assets)).toBe(true);

    assets.forEach((a: any) => {
      expect(a.fundingSource).toBe(testFundingName);
      expect(Number(a.acquisitionYear)).toBe(testYear);
    });

    // Jika salah satu kriteria tidak cocok (misal tahun tidak ada), hasil harus 0
    const nonMatchRes = await fetch(
      `${baseUrl}/assets?fundingSource=${encodeURIComponent(testFundingName)}&acquisitionYear=1991`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );
    expect(nonMatchRes.status).toBe(200);
    const nonMatchJson = await nonMatchRes.json();
    expect(nonMatchJson.data.length).toBe(0);
    expect(nonMatchJson.total).toBe(0);
  });

  // 4. Reset Filter Menampilkan Seluruh Data
  it('4. Reset filter (tanpa parameter query) mengembalikan seluruh data inventaris aktif', async () => {
    const res = await fetch(`${baseUrl}/assets`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    const allAssets = json.data || json;
    expect(Array.isArray(allAssets)).toBe(true);
    expect(allAssets.length).toBeGreaterThan(0);
    expect(json.total).toBe(allAssets.length);
  });

  // 5. Endpoint GET /assets/years Mengembalikan Tahun Terurut Descending
  it('5. Endpoint GET /assets/years mengembalikan daftar tahun unik terurut dari terbaru ke terlama', async () => {
    const res = await fetch(`${baseUrl}/assets/years`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const years = await res.json();
    expect(Array.isArray(years)).toBe(true);

    // Pastikan terurut DESC (terbaru ke terlama)
    for (let i = 0; i < years.length - 1; i++) {
      expect(years[i]).toBeGreaterThanOrEqual(years[i + 1]);
    }
  });

  // 6. Penanganan Aman untuk Field Kosong / Nilai Tak Terduga
  it('6. Query dengan tahun perolehan tidak valid atau kosong tidak menyebabkan server error 500', async () => {
    const resInvalidYear = await fetch(`${baseUrl}/assets?acquisitionYear=bukan-angka`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(resInvalidYear.status).toBe(200);

    const resEmptyYear = await fetch(`${baseUrl}/assets?acquisitionYear=`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(resEmptyYear.status).toBe(200);

    const resEmptyFunding = await fetch(`${baseUrl}/assets?fundingSource=`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(resEmptyFunding.status).toBe(200);
  });

  // 7. Pagination dan Total Record Tetap Akurat Sesuai Filter
  it('7. Pagination (limit & offset) mengembalikan total hitung yang akurat sesuai filter aktif', async () => {
    const res = await fetch(
      `${baseUrl}/assets?fundingSource=${encodeURIComponent(testFundingName)}&limit=1&offset=0`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.length).toBeLessThanOrEqual(1);
    expect(typeof json.total).toBe('number');
    expect(json.total).toBeGreaterThanOrEqual(json.data.length);
  });

  // 8. Otorisasi Keamanan: Akses Tanpa Izin Ditolak (HTTP 401)
  it('8. Permintaan daftar barang tanpa token ditolak dengan HTTP 401 UNAUTHORIZED', async () => {
    const resNoAuth = await fetch(`${baseUrl}/assets`);
    expect(resNoAuth.status).toBe(401);

    const resYearsNoAuth = await fetch(`${baseUrl}/assets/years`);
    expect(resYearsNoAuth.status).toBe(401);
  });

  // 9. Kompatibilitas Integritas Data & QR Token
  it('9. Atribut identitas QR (qrToken, assetCode, permanentId) tetap utuh pada hasil filter', async () => {
    const res = await fetch(`${baseUrl}/assets`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const json = await res.json();
    const assets = json.data || json;
    assets.forEach((a: any) => {
      expect(a).toHaveProperty('id');
      expect(a).toHaveProperty('qrToken');
      expect(a).toHaveProperty('assetCode');
      expect(a).toHaveProperty('permanentId');
      expect(typeof a.qrToken).toBe('string');
      expect(a.qrToken.length).toBeGreaterThan(0);
    });
  });

  // 10. Pengujian Unit MockStorageService
  describe('10. Pengujian Unit MockStorageService', () => {
    const storage = MockStorageService.getInstance();

    it('mendukung filter fundingSource pada MockStorageService', () => {
      const results = storage.getAssets({ fundingSource: 'BOS Reguler' });
      expect(results.every((a) => a.fundingSource.toLowerCase() === 'bos reguler')).toBe(true);
    });

    it('mendukung filter acquisitionYear pada MockStorageService', () => {
      const results = storage.getAssets({ acquisitionYear: 2024 });
      expect(results.every((a) => Number(a.acquisitionYear) === 2024)).toBe(true);
    });

    it('mendukung kombinasi AND filter pada MockStorageService', () => {
      const results = storage.getAssets({ fundingSource: 'BOS Reguler', acquisitionYear: 2024 });
      expect(
        results.every(
          (a) => a.fundingSource.toLowerCase() === 'bos reguler' && Number(a.acquisitionYear) === 2024
        )
      ).toBe(true);
    });

    it('getAcquisitionYears mengembalikan daftar tahun unik terurut DESC pada MockStorageService', () => {
      const years = storage.getAcquisitionYears();
      expect(Array.isArray(years)).toBe(true);
      for (let i = 0; i < years.length - 1; i++) {
        expect(years[i]).toBeGreaterThanOrEqual(years[i + 1]);
      }
    });
  });
});
