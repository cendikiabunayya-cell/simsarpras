import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app } from '../../server/src/index.js';
import { generateTestToken } from '../../server/src/middleware/auth.js';
import { isValidHttpsUrl, extractGoogleDriveFileId, getOptimizedImageUrl } from '../lib/driveUtils';

describe('SIMSARPRAS Master Data, Foto Barang & Pengaturan Sekolah Test Suite', () => {
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

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // =========================================================================
  // 1. Data Ruang / Lokasi
  // =========================================================================
  describe('1. CRUD Data Ruang / Lokasi (locations)', () => {
    it('mengembalikan daftar seluruh ruangan via GET /api/v1/locations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('name');
      expect(data[0]).toHaveProperty('code');
    });

    it('menolak penambahan ruangan tanpa token autentikasi (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ruang Uji Coba' }),
      });
      expect(res.status).toBe(401);
    });

    it('menolak penambahan ruangan oleh role non-admin GURU_PEGAWAI (HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guruToken}`,
        },
        body: JSON.stringify({ name: 'Ruang Uji Guru' }),
      });
      expect(res.status).toBe(403);
    });

    it('menolak penambahan ruangan dengan nama kosong (HTTP 400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: '' }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });

    let createdLocId: string;
    const testLocName = `Ruang Server Test ${Date.now()}`;

    it('mengizinkan ADMIN_SARPRAS menambah ruangan baru (HTTP 201)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: testLocName,
          code: `SRV-${Date.now().toString().slice(-4)}`,
          description: 'Ruang server pengujian otomatis',
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe(testLocName);
      expect(json.isActive).toBe(true);
      createdLocId = json.id;
    });

    it('mengizinkan ADMIN_SARPRAS mengubah data ruangan (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations/${createdLocId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          description: 'Keterangan telah diperbarui',
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.description).toBe('Keterangan telah diperbarui');
    });

    it('menolak penghapusan ruangan yang masih direferensikan oleh aset inventaris (HTTP 409 RESOURCE_IN_USE)', async () => {
      // loc-1 digunakan oleh aset lab komputer
      const res = await fetch(`${baseUrl}/api/v1/locations/loc-1`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('RESOURCE_IN_USE');
      expect(json.message).toContain('tidak dapat dihapus karena masih digunakan');
    });

    it('mengizinkan penghapusan ruangan yang tidak memiliki relasi aset (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/locations/${createdLocId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 2. Kategori Barang
  // =========================================================================
  describe('2. CRUD Kategori Barang (categories)', () => {
    it('mengembalikan daftar kategori via GET /api/v1/categories', async () => {
      const res = await fetch(`${baseUrl}/api/v1/categories`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((c: any) => c.id === 'cat-tik')).toBe(true);
    });

    it('menolak mutasi kategori tanpa hak akses ADMIN_SARPRAS', async () => {
      const resNoAuth = await fetch(`${baseUrl}/api/v1/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Kategori Gelap' }),
      });
      expect(resNoAuth.status).toBe(401);

      const resGuru = await fetch(`${baseUrl}/api/v1/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guruToken}`,
        },
        body: JSON.stringify({ name: 'Kategori Guru' }),
      });
      expect(resGuru.status).toBe(403);
    });

    let createdCatId: string;
    const testCatName = `Kategori Uji ${Date.now()}`;

    it('mengizinkan ADMIN_SARPRAS menambah kategori baru (HTTP 201)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: testCatName,
          defaultLoanMode: 'ADMIN_APPROVAL',
          description: 'Kategori khusus uji otomatis',
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe(testCatName);
      expect(json.defaultLoanMode).toBe('ADMIN_APPROVAL');
      createdCatId = json.id;
    });

    it('menolak penghapusan kategori yang masih digunakan oleh aset (HTTP 409 RESOURCE_IN_USE)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/categories/cat-tik`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('RESOURCE_IN_USE');
    });

    it('mengizinkan penghapusan kategori bebas relasi (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Sumber Pendanaan
  // =========================================================================
  describe('3. CRUD Sumber Pendanaan (funding_sources)', () => {
    it('mengembalikan seluruh daftar sumber pendanaan', async () => {
      const res = await fetch(`${baseUrl}/api/v1/funding-sources`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((f: any) => f.name === 'BOS Reguler')).toBe(true);
    });

    let createdFundId: string;
    const testFundName = `Hibah Riset ${Date.now()}`;

    it('mengizinkan ADMIN_SARPRAS menambah sumber pendanaan baru', async () => {
      const res = await fetch(`${baseUrl}/api/v1/funding-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: testFundName,
          description: 'Dana hibah riset pengujian otomatis',
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe(testFundName);
      createdFundId = json.id;
    });

    it('menolak penghapusan sumber dana yang masih terhubung dengan aset (HTTP 409)', async () => {
      // fs-1 adalah BOS Reguler yang digunakan banyak aset
      const res = await fetch(`${baseUrl}/api/v1/funding-sources/fs-1`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe('RESOURCE_IN_USE');
    });

    it('mengizinkan penghapusan sumber dana yang belum digunakan oleh aset (HTTP 200)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/funding-sources/${createdFundId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Link Foto Google Drive pada Data Barang & Integritas QR
  // =========================================================================
  describe('4. Link Foto Google Drive & Integritas QR Aset', () => {
    it('memvalidasi protokol HTTPS pada tautan foto dan menolak protokol tidak aman (HTTP)', () => {
      expect(isValidHttpsUrl('http://insecure.example.com/foto.jpg')).toBe(false);
      expect(isValidHttpsUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpsUrl('https://drive.google.com/file/d/12345/view')).toBe(true);
      expect(isValidHttpsUrl('')).toBe(true); // Opsional
    });

    it('mengekstrak ID berkas Google Drive secara akurat dari berbagai format tautan', () => {
      const url1 = 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing';
      expect(extractGoogleDriveFileId(url1)).toBe('1aBcDeFgHiJkLmNoPqRsTuVwXyZ');

      const url2 = 'https://drive.google.com/open?id=2bCdEfGhIjKlMnOpQrStUvWxYz';
      expect(extractGoogleDriveFileId(url2)).toBe('2bCdEfGhIjKlMnOpQrStUvWxYz');

      const thumbnail = getOptimizedImageUrl(url1);
      expect(thumbnail).toContain('https://drive.google.com/thumbnail?id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ&sz=w600');
    });

    it('memperbarui tautan foto barang pada database tanpa merusak permanentId, qrToken, dan assetCode', async () => {
      // Ambil salah satu aset yang ada secara dinamis
      const listRes = await fetch(`${baseUrl}/api/v1/assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      const assetsList = Array.isArray(listJson) ? listJson : listJson.data;
      expect(assetsList.length).toBeGreaterThan(0);
      const targetAsset = assetsList.find((a: any) => !a.id.startsWith('ast-test-')) || assetsList[0];

      const originalQrToken = targetAsset.qrToken;
      const originalPermanentId = targetAsset.permanentId;
      const originalAssetCode = targetAsset.assetCode;
      const assetTargetId = targetAsset.id;

      const drivePhotoUrl = 'https://drive.google.com/file/d/1XyZ987TestPhotoDrive/view?usp=sharing';

      // Update foto via PATCH /api/v1/assets/:id
      const updateRes = await fetch(`${baseUrl}/api/v1/assets/${assetTargetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          photoUrl: drivePhotoUrl,
        }),
      });

      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();

      // Integritas identitas barcode dan QR harus tetap 100% sama
      expect(updated.qrToken).toBe(originalQrToken);
      expect(updated.permanentId).toBe(originalPermanentId);
      expect(updated.assetCode).toBe(originalAssetCode);
      expect(updated.photoUrl).toBe(drivePhotoUrl);

      // Verifikasi saat scan publik via barcode
      const scanRes = await fetch(`${baseUrl}/api/v1/assets/scan?query=${originalAssetCode}`);
      expect(scanRes.status).toBe(200);
      const scanned = await scanRes.json();
      expect(scanned.photoUrl).toBe(drivePhotoUrl);
      expect(scanned.assetCode).toBe(originalAssetCode);
    });

    it('menolak pembaruan aset dengan tautan foto non-HTTPS (HTTP 400)', async () => {
      const listRes = await fetch(`${baseUrl}/api/v1/assets`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listJson = await listRes.json();
      const assetsList = Array.isArray(listJson) ? listJson : listJson.data;
      const assetTargetId = assetsList[0].id;

      const updateRes = await fetch(`${baseUrl}/api/v1/assets/${assetTargetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          photoUrl: 'http://insecure-site.com/image.png',
        }),
      });
      expect(updateRes.status).toBe(400);
      const json = await updateRes.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });
  });

  // =========================================================================
  // 5. Pengaturan Identitas Sekolah
  // =========================================================================
  describe('5. Pengaturan Identitas Sekolah (school_settings)', () => {
    it('mengembalikan identitas sekolah via GET /api/v1/school-settings tanpa login', async () => {
      const res = await fetch(`${baseUrl}/api/v1/school-settings`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('schoolName');
      expect(json).toHaveProperty('address');
    });

    it('menolak pengubahan identitas sekolah tanpa token (HTTP 401)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/school-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName: 'Sekolah Baru' }),
      });
      expect(res.status).toBe(401);
    });

    it('menolak pengubahan identitas sekolah oleh role GURU_PEGAWAI (HTTP 403)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/school-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guruToken}`,
        },
        body: JSON.stringify({ schoolName: 'Sekolah Baru Guru' }),
      });
      expect(res.status).toBe(403);
    });

    it('mengizinkan ADMIN_SARPRAS memperbarui identitas sekolah dan tersimpan secara persisten', async () => {
      const payload = {
        schoolName: 'MIS Cendikia Bunayya Medan',
        address: 'Jl. STM No. 12, Kel. Suka Maju, Kec. Medan Amplas, Kota Medan',
        phone: '061-7890123',
        email: 'info@cendikiabunayya.sch.id',
        logoUrl: 'https://cendikiabunayya.sch.id/assets/logo.png',
      };

      const patchRes = await fetch(`${baseUrl}/api/v1/school-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(payload),
      });

      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.schoolName).toBe(payload.schoolName);
      expect(patched.address).toBe(payload.address);
      expect(patched.logoUrl).toBe(payload.logoUrl);

      // Verifikasi pembacaan ulang via GET
      const getRes = await fetch(`${baseUrl}/api/v1/school-settings`);
      expect(getRes.status).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.schoolName).toBe(payload.schoolName);
      expect(fetched.phone).toBe(payload.phone);
    });

    it('menolak tautan logo sekolah yang menggunakan protokol tidak aman HTTP (HTTP 400)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/school-settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          schoolName: 'MIS Cendikia Bunayya',
          logoUrl: 'http://unsecure-web.org/logo.jpg',
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('VALIDATION_ERROR');
    });
  });
});
