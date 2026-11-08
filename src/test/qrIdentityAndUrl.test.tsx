import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { QrScanner } from '../pages/QrScanner';
import { AppRoutes } from '../App';
import { api } from '../services/api';
import {
  generateDomainMigrationSnippets,
  getCanonicalQrUrl,
  isLocalOrTemporaryHost,
  savePublicQrConfig,
  validatePublicDomain,
} from '../services/qrUrlService';
import { AssetUnit } from '../types';

describe('Mekanisme Identitas Barang & URL QR Code yang Stabil', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    api.resetMockData();
  });

  describe('1. Validasi Pemisahan URL Publik dari IP Lokal & Localhost', () => {
    it('mendeteksi alamat IP, localhost, dan hosting preview sebagai host lokal/sementara', () => {
      expect(isLocalOrTemporaryHost('localhost:5173')).toBe(true);
      expect(isLocalOrTemporaryHost('http://localhost:5173')).toBe(true);
      expect(isLocalOrTemporaryHost('127.0.0.1')).toBe(true);
      expect(isLocalOrTemporaryHost('http://192.168.100.45:5173')).toBe(true);
      expect(isLocalOrTemporaryHost('10.0.0.5')).toBe(true);
      expect(isLocalOrTemporaryHost('172.20.0.10:8080')).toBe(true);
      expect(isLocalOrTemporaryHost('app.ngrok.io')).toBe(true);
      expect(isLocalOrTemporaryHost('test.trycloudflare.com')).toBe(true);

      // Domain publik resmi bukan host lokal/sementara
      expect(isLocalOrTemporaryHost('https://sarpras.cendikiabunayya.sch.id')).toBe(false);
      expect(isLocalOrTemporaryHost('https://cendikiabunayya.sch.id')).toBe(false);
    });

    it('memberikan peringatan validasi jika URL domain yang dimasukkan menggunakan IP lokal', () => {
      const warnResult = validatePublicDomain('http://192.168.1.100:5173');
      expect(warnResult.isValid).toBe(true);
      expect(warnResult.isWarning).toBe(true);
      expect(warnResult.message).toMatch(/terdeteksi sebagai alamat IP lokal/i);

      const okResult = validatePublicDomain('https://sarpras.cendikiabunayya.sch.id');
      expect(okResult.isValid).toBe(true);
      expect(okResult.isWarning).toBe(false);

      const invalidResult = validatePublicDomain('');
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('2. Pembuatan URL QR Kanonikal Stabil & Mode IP', () => {
    it('secara default menghasilkan URL QR dengan IP lokal server agar HP di Wi-Fi sekolah bisa langsung scan', () => {
      const mockAsset: AssetUnit = {
        id: 'unit-laptop-01',
        permanentId: 'PERM-UUID-LAPTOP-01',
        assetCode: 'INV-TIK-2024-001',
        itemName: 'Laptop Guru ASUS ExpertBook',
        categoryName: 'TIK/Multimedia',
        technicalSpecs: 'Core i5, 16GB RAM',
        itemBrand: 'ASUS',
        fundingSource: 'BOS Reguler',
        acquisitionYear: 2024,
        locationId: 'loc-1',
        locationName: 'Lab TIK',
        qrToken: 'QR-TIK-ASUS-001',
        effectiveLoanMode: 'ADMIN_APPROVAL',
        conditionStatus: 'GOOD',
        operationalStatus: 'AVAILABLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const qrUrl = getCanonicalQrUrl(mockAsset);
      // Default kembali ke IP
      expect(qrUrl).toContain('http://192.168.100.45:5173');
      expect(qrUrl).toContain('/scan?code=INV-TIK-2024-001');
    });

    it('mendukung pengalihan ke mode custom domain jika sudah di-hosting online', () => {
      savePublicQrConfig({
        mode: 'custom',
        publicBaseUrl: 'https://sarpras.cendikiabunayya.sch.id',
        urlPattern: 'path',
      });

      const mockAsset: AssetUnit = {
        id: 'unit-bola-01',
        permanentId: 'PERM-BOLA-01',
        assetCode: 'INV-OLR-2026-003',
        itemName: 'Bola Basket',
        categoryName: 'Alat Olahraga',
        technicalSpecs: 'Size 7',
        itemBrand: 'Molten',
        fundingSource: 'BOS',
        acquisitionYear: 2026,
        locationId: 'loc-6',
        locationName: 'Gudang OLR',
        qrToken: 'QR-BOLA',
        effectiveLoanMode: 'DIRECT',
        conditionStatus: 'GOOD',
        operationalStatus: 'AVAILABLE',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };

      const qrUrl = getCanonicalQrUrl(mockAsset);
      expect(qrUrl).toBe('https://sarpras.cendikiabunayya.sch.id/q/INV-OLR-2026-003');
    });

    it('mendukung kustomisasi IP lokal kustom jika jaringan router berubah', () => {
      savePublicQrConfig({
        mode: 'ip',
        ipBaseUrl: 'http://192.168.1.50:5173',
        urlPattern: 'query',
      });

      const mockAsset: AssetUnit = {
        id: 'unit-proyektor-01',
        permanentId: 'PERM-PROY-01',
        assetCode: 'INV-TIK-2024-002',
        itemName: 'Proyektor Epson',
        categoryName: 'TIK/Multimedia',
        technicalSpecs: '3600 Lumens',
        itemBrand: 'Epson',
        fundingSource: 'BOS',
        acquisitionYear: 2024,
        locationId: 'loc-1',
        locationName: 'Lab TIK',
        qrToken: 'QR-PROY',
        effectiveLoanMode: 'ADMIN_APPROVAL',
        conditionStatus: 'GOOD',
        operationalStatus: 'AVAILABLE',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const qrUrl = getCanonicalQrUrl(mockAsset);
      expect(qrUrl).toBe('http://192.168.1.50:5173/scan?code=INV-TIK-2024-002');
    });
  });

  describe('3. Generator Script Prosedur Migrasi & Redirect Domain', () => {
    it('menghasilkan konfigurasi Nginx, Apache .htaccess, Cloudflare, dan script HTML redirect universal', () => {
      const snippets = generateDomainMigrationSnippets(
        'https://sarpras-lama.sekolah.sch.id',
        'https://sarpras.cendikiabunayya.sch.id'
      );

      // Nginx HTTP 301
      expect(snippets.nginxSnippet).toContain('server_name sarpras-lama.sekolah.sch.id;');
      expect(snippets.nginxSnippet).toContain('return 301 https://sarpras.cendikiabunayya.sch.id$request_uri;');

      // Apache .htaccess
      expect(snippets.apacheSnippet).toContain('RewriteEngine On');
      expect(snippets.apacheSnippet).toContain('RewriteRule ^(.*)$ https://sarpras.cendikiabunayya.sch.id/$1 [R=301,L]');

      // Cloudflare
      expect(snippets.cloudflareRule).toContain('Dynamic Redirect');
      expect(snippets.cloudflareRule).toContain('Status Code: 301');

      // Standalone HTML Redirect
      expect(snippets.htmlRedirectScript).toContain('window.location.replace');
      expect(snippets.htmlRedirectScript).toContain('currentPath + currentSearch');
    });
  });

  describe('4. Identitas Permanen & Independensi dari Perubahan Data', () => {
    it('memastikan pencarian barang berhasil melalui permanentId, id, assetCode, atau qrToken', async () => {
      const assetByCode = await api.getAssetByCodeOrQr('INV-TIK-2024-001');
      expect(assetByCode).toBeDefined();
      expect(assetByCode.itemName).toContain('Laptop Guru ASUS');

      // Pencarian lewat ID unik
      const assetById = await api.getAssetByCodeOrQr('unit-laptop-01');
      expect(assetById).toBeDefined();
      expect(assetById.id).toBe('unit-laptop-01');

      // Pencarian lewat QR token
      const assetByToken = await api.getAssetByCodeOrQr('QR-TIK-ASUS-001');
      expect(assetByToken).toBeDefined();
      expect(assetByToken.id).toBe('unit-laptop-01');
    });

    it('memastikan pengubahan nama barang atau lokasi tidak merusak identitas permanen', async () => {
      const original = await api.getAssetByCodeOrQr('INV-TIK-2024-001');
      const originalId = original.id;
      const originalPermId = original.permanentId;

      // Update nama dan lokasi barang
      const updated = await api.updateAsset(originalId, {
        itemName: 'Laptop Guru ASUS Diperbarui',
        locationName: 'Ruang Guru Baru',
      });

      expect(updated.id).toBe(originalId);
      expect(updated.permanentId).toBe(originalPermId);

      // Barang tetap bisa ditemukan via kode lama atau permanent ID
      const refound = await api.getAssetByCodeOrQr('INV-TIK-2024-001');
      expect(refound.id).toBe(originalId);
      expect(refound.itemName).toBe('Laptop Guru ASUS Diperbarui');
    });
  });

  describe('5. Penanganan Barang Dinonaktifkan / Dihapus Secara Logis (Soft Delete)', () => {
    it('menonaktifkan aset secara logis dan menampilkan informasi penonaktifan yang sesuai saat di-scan', async () => {
      // Nonaktifkan unit proyektor
      const decommissioned = await api.decommissionAsset(
        'unit-proyektor-01',
        'Lensa pecah dan lampu proyektor mati total, tidak ekonomis diperbaiki'
      );

      expect(decommissioned.operationalStatus).toBe('INACTIVE');
      expect(decommissioned.isDecommissioned).toBe(true);
      expect(decommissioned.decommissionedReason).toContain('Lensa pecah');

      // Render halaman scan untuk unit yang dinonaktifkan
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={[`/scan?code=${decommissioned.assetCode}`]}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <QrScanner />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi unit ditemukan dan menampilkan banner penonaktifan
      const statusTitle = await screen.findByText(
        /Barang Telah Dinonaktifkan \/ Dihapus Secara Logis/i
      );
      expect(statusTitle).toBeInTheDocument();

      // Verifikasi alasan penonaktifan tercantum
      expect(screen.getByText(/Lensa pecah/i)).toBeInTheDocument();

      // Verifikasi garansi bahwa QR code tidak dialihkan ke barang lain
      expect(
        screen.getByText(/QR Code ini tetap permanen merujuk ke data historis unit ini/i)
      ).toBeInTheDocument();

      // Tombol pinjam TIDAK boleh muncul untuk unit nonaktif
      expect(screen.queryByRole('button', { name: /Ajukan Peminjaman/i })).not.toBeInTheDocument();
    });
  });

  describe('6. Pemindaian Google Lens & Dukungan Permalink Pendek', () => {
    it('membuka halaman barang yang benar via rute permalink /q/:tokenOrCode tanpa instal aplikasi', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/q/INV-TIK-2024-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Routes>
                <Route path="/q/:tokenOrCode" element={<QrScanner />} />
              </Routes>
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Barang berhasil dimuat langsung di browser web
      const assetTitle = await screen.findByText(/Laptop Guru ASUS/i);
      expect(assetTitle).toBeInTheDocument();
      expect(screen.getAllByText(/INV-TIK-2024-001/i).length).toBeGreaterThanOrEqual(1);

      // Tombol ajuan peminjaman langsung siap diakses
      expect(screen.getByRole('button', { name: /Ajukan Peminjaman/i })).toBeInTheDocument();
    });
  });

  describe('7. Halaman Khusus Peminjaman Mandiri Scan QR (Tanpa Akses Menu & Tanpa Login)', () => {
    it('memastikan rute /scan adalah halaman khusus tanpa sidebar/navbar menu dan dapat mengajukan pinjaman tanpa login', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/scan?code=INV-TIK-2024-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi header halaman khusus peminjaman mandiri
      const headerTitles = await screen.findAllByText(/Peminjaman Mandiri/i);
      expect(headerTitles.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Tanpa Login/i)).toBeInTheDocument();

      // Verifikasi TIDAK ADA menu-menu internal admin (tidak dapat akses semua menu)
      expect(screen.queryByText('Dashboard Sarpras')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Inventaris')).not.toBeInTheDocument();
      expect(screen.queryByText('Persetujuan Penerimaan')).not.toBeInTheDocument();
      expect(screen.queryByText('Verifikasi Pengembalian')).not.toBeInTheDocument();
      expect(screen.queryByText('Laporan & Rekapitulasi')).not.toBeInTheDocument();
      expect(screen.queryByText('Kebijakan Peminjaman')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Aktivitas')).not.toBeInTheDocument();

      // Verifikasi barang hasil scan tampil
      const assetTitle = await screen.findByText(/Laptop Guru ASUS/i);
      expect(assetTitle).toBeInTheDocument();

      // Klik tombol Ajukan Peminjaman
      const loanBtn = screen.getByRole('button', { name: /Ajukan Peminjaman/i });
      fireEvent.click(loanBtn);

      // Isi form nama peminjam secara bebas (teks box yang dapat diketik tanpa login)
      const nameInput = (await screen.findByPlaceholderText(
        /Ketik nama lengkap peminjam/i
      )) as HTMLInputElement;
      expect(nameInput).toBeInTheDocument();
      fireEvent.change(nameInput, { target: { value: 'Ibu Fatimah Zahra, S.Pd' } });
      expect(nameInput.value).toBe('Ibu Fatimah Zahra, S.Pd');

      // Pilih keperluan cepat
      const presetBtn = screen.getByRole('button', { name: /\+ Mengajar di Kelas/i });
      fireEvent.click(presetBtn);

      // Kirim pengajuan peminjaman mandiri
      const submitBtn = screen.getByRole('button', { name: /Kirim Pengajuan/i });
      expect(submitBtn).toBeEnabled();
      fireEvent.click(submitBtn);

      // Verifikasi notifikasi berhasil disimpan
      const successFeedback = await screen.findByText(/Pengajuan Berhasil Disimpan/i);
      expect(successFeedback).toBeInTheDocument();
    });

    it('memastikan rute permalink /q/:tokenOrCode juga membuka halaman mandiri tanpa menu admin', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/q/INV-TIK-2024-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi unit dimuat di halaman mandiri
      const asset = await screen.findByText(/Laptop Guru ASUS/i);
      expect(asset).toBeInTheDocument();

      // Menu admin tetap tidak boleh muncul
      expect(screen.queryByText('Dashboard Sarpras')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Inventaris')).not.toBeInTheDocument();
      expect(screen.getByText(/Tanpa Login/i)).toBeInTheDocument();
    });
  });

  describe('8. Pendaftaran & Verifikasi Rute Publik Barcode Baru (/b/:tokenOrCode - Fase 2D Tahap 4)', () => {
    it('memastikan rute /b/:tokenOrCode membuka halaman peminjaman mandiri tanpa login dan tanpa sidebar/navbar menu admin', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/b/QR-TIK-ASUS-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi komponen PublicScanLoan aktif dan unit dimuat
      const asset = await screen.findByText(/Laptop Guru ASUS/i);
      expect(asset).toBeInTheDocument();
      expect(screen.getByText(/Tanpa Login/i)).toBeInTheDocument();

      // Menu admin internal TIDAK boleh muncul
      expect(screen.queryByText('Dashboard Sarpras')).not.toBeInTheDocument();
      expect(screen.queryByText('Data Inventaris')).not.toBeInTheDocument();
      expect(screen.queryByText('Persetujuan Penerimaan')).not.toBeInTheDocument();
      expect(screen.queryByText('Audit Aktivitas')).not.toBeInTheDocument();
    });

    it('mendukung resolusi berbagai format identitas (token QR, permanentId, assetCode) via /b/:tokenOrCode', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // Uji lewat permanentId
      render(
        <MemoryRouter initialEntries={['/b/PERM-TIK-ASUS-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      const asset = await screen.findByText(/Laptop Guru ASUS/i);
      expect(asset).toBeInTheDocument();
    });

    it('menampilkan peringatan Data Tidak Ditemukan saat token pada /b/:tokenOrCode tidak dikenal di sistem', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/b/TOKEN-TIDAK-ADA-DI-DATABASE']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi alert pesan error tampil
      await waitFor(() => {
        expect(screen.getByText('Data Tidak Ditemukan')).toBeInTheDocument();
        expect(screen.getByText(/Barang dengan kode atau token QR/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('menampilkan banner penonaktifan secara logis saat rute /b/:tokenOrCode membuka barang yang dinonaktifkan', async () => {
      // Nonaktifkan 1 unit aset terlebih dahulu
      await api.decommissionAsset('unit-laptop-01', 'Rusak total terkena tumpahan air kopi');

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/b/QR-TIK-ASUS-001']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi notifikasi penonaktifan logis muncul
      const decommissionNotice = await screen.findByText(/Barang Telah Dinonaktifkan \/ Dihapus Secara Logis/i);
      expect(decommissionNotice).toBeInTheDocument();
      expect(screen.getByText(/tumpahan air kopi/i)).toBeInTheDocument();

      // Tombol ajukan peminjaman tidak boleh ada
      expect(screen.queryByRole('button', { name: /Ajukan Peminjaman/i })).not.toBeInTheDocument();
    });

    it('mempertahankan seluruh rute admin (/inventory, /dashboard) tanpa terpengaruh rute /b/:tokenOrCode', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/inventory']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Halaman inventaris admin memuat layout admin
      const inventoryHeader = await screen.findByText(/Data Barang & Sarana Prasarana/i);
      expect(inventoryHeader).toBeInTheDocument();
      expect(screen.getByText('Dashboard Sarpras')).toBeInTheDocument();
    });
  });

  // --- 9. Ketahanan UI Scan Publik terhadap Respons 401 & Nilai Non-Array (Fase 2I.6) ---
  describe('9. Ketahanan UI Scan Publik terhadap Respons 401, Data Array Valid, dan Nilai Non-Array (Fase 2I.6)', () => {
    it('halaman /scan dan mode input manual tidak crash saat getAssets merespon error 401', async () => {
      // Simulasikan endpoint backend /assets menolak akses publik dengan error 401
      vi.spyOn(api, 'getAssets').mockImplementation(async () => {
        throw new Error('Autentikasi diperlukan untuk mengakses data ini.');
      });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/scan']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Verifikasi halaman scan publik tetap render sempurna tanpa crash .slice()
      const badges = await screen.findAllByText(/Peminjaman Mandiri/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);

      // Input manual tetap dapat diakses
      expect(screen.getByPlaceholderText(/Contoh: INV-TIK-2024-001/i)).toBeInTheDocument();

      // Pilihan cepat contoh barang disembunyikan secara aman
      expect(screen.queryByText(/Pilihan Cepat Contoh Barang:/i)).not.toBeInTheDocument();
    });

    it('pencarian kode manual tetap sukses dan tidak crash saat getLoans mengembalikan 401', async () => {
      // Simulasikan getAssets dan getLoans merespon error 401
      vi.spyOn(api, 'getAssets').mockRejectedValue(new Error('401 UNAUTHORIZED'));
      vi.spyOn(api, 'getLoans').mockRejectedValue(new Error('401 UNAUTHORIZED'));

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/scan']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      const input = await screen.findByPlaceholderText(/Contoh: INV-TIK-2024-001/i);
      const searchBtn = screen.getByRole('button', { name: /Cari/i });

      // Ketik kode dan lakukan pencarian via endpoint publik getAssetByCodeOrQr
      fireEvent.change(input, { target: { value: 'QR-TIK-ASUS-001' } });
      fireEvent.click(searchBtn);

      // Verifikasi data barang berhasil dimuat dan tombol ajukan pinjaman aktif
      const assetTitle = await screen.findByText(/Laptop Guru ASUS ExpertBook/i);
      expect(assetTitle).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Ajukan Peminjaman/i })).toBeInTheDocument();
    });

    it('halaman /scan menampilkan tombol pilihan cepat jika getAssets mengembalikan array valid', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/scan']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Saat mock mengembalikan array valid, pil pilihan cepat muncul
      const pillLabel = await screen.findByText(/Pilihan Cepat Contoh Barang:/i);
      expect(pillLabel).toBeInTheDocument();
      expect(screen.getByText('INV-TIK-2024-001')).toBeInTheDocument();
    });

    it('halaman /qr-scan di AppLayout tidak crash jika getAssets mengembalikan format non-array / null', async () => {
      vi.spyOn(api, 'getAssets').mockResolvedValue(null as any);
      vi.spyOn(api, 'getLoans').mockResolvedValue({ error: 'UNAUTHORIZED' } as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <MemoryRouter initialEntries={['/qr-scan']}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>
      );

      // Memastikan QrScanner tetap merender komponen pencarian tanpa crash
      const scanHeading = await screen.findByText(/Peminjaman via Barcode/i);
      expect(scanHeading).toBeInTheDocument();
      expect(screen.queryByText(/Klik Cepat Contoh Barang untuk Uji Coba:/i)).not.toBeInTheDocument();
    });
  });
});
