import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { SyncIndicator } from '../components/ui/SyncIndicator';
import { LoanApproval } from '../pages/LoanApproval';
import { Inventory } from '../pages/Inventory';
import { MyLoans } from '../pages/MyLoans';
import { api } from '../services/api';
import {
  AUTO_REFRESH_INTERVAL,
  getAutoRefreshOptions,
} from '../hooks/useAutoRefreshQuery';
import { LoanRequest, AssetUnit } from '../types';

describe('SIMSARPRAS Auto-Refresh & Background Polling Suite (5000ms)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{ui}</AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  describe('1. Konfigurasi Query dan Peniadaan Polling 5 Detik', () => {
    it('Polling otomatis berkala 5 detik dinonaktifkan secara default (refetchInterval: false)', () => {
      expect(AUTO_REFRESH_INTERVAL).toBe(false);
      const opts = getAutoRefreshOptions();
      expect(opts.refetchInterval).toBe(false);
      expect(opts.refetchIntervalInBackground).toBe(false);
      expect(opts.refetchOnWindowFocus).toBe(true);
    });

    it('Mendukung pengaktifan interval kustom jika secara eksplisit diaktifkan', () => {
      const opts = getAutoRefreshOptions({ enabled: true, interval: 10000 });
      expect(opts.refetchInterval).toBe(10000);
    });
  });

  describe('2. Indikator Sinkronisasi (SyncIndicator)', () => {
    it('Menampilkan status "Memperbarui data..." saat isFetching=true dan !isLoading', () => {
      render(
        <SyncIndicator
          isFetching={true}
          isLoading={false}
          dataUpdatedAt={Date.now()}
        />
      );
      expect(screen.getByText(/Memperbarui data\.\.\./i)).toBeInTheDocument();
    });

    it('Menampilkan format waktu "Terakhir diperbarui: HH:mm:ss" saat data selesai dimuat', () => {
      const testTimestamp = new Date('2026-10-14T14:30:45').getTime();
      render(
        <SyncIndicator
          isFetching={false}
          isLoading={false}
          dataUpdatedAt={testTimestamp}
        />
      );
      expect(screen.getByText(/Terakhir diperbarui: \d{2}[.:]\d{2}[.:]\d{2}/i)).toBeInTheDocument();
    });

    it('Menampilkan "Sinkronisasi terganggu" secara wajar saat isError=true tanpa popup mengganggu', () => {
      let retried = false;
      render(
        <SyncIndicator
          isFetching={false}
          isLoading={false}
          isError={true}
          onRefresh={() => {
            retried = true;
          }}
        />
      );
      expect(screen.getByText(/Sinkronisasi terganggu/i)).toBeInTheDocument();
      const retryBtn = screen.getByText(/Coba lagi/i);
      fireEvent.click(retryBtn);
      expect(retried).toBe(true);
    });
  });

  describe('3. Deteksi Transaksi Baru dari HP Tanpa Reload Halaman (LoanApproval)', () => {
    it('Pengajuan peminjaman baru dari guru otomatis tampil pada daftar persetujuan admin', async () => {
      const mockInitialLoans = [
        {
          id: 'loan-existing-1',
          loanNumber: 'PINJAM-20261014-1111',
          assetId: 'ast-1',
          borrowerId: 'usr-teacher-1',
          borrowerName: 'Siti Nurhaliza, S.Pd.',
          borrowerRole: 'GURU_PEGAWAI',
          status: 'PENDING_APPROVAL',
          loanModeSnapshot: 'ADMIN_APPROVAL',
          purpose: 'Praktikum Biologi Kelas 8',
          requestedAt: new Date().toISOString(),
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
          unit: {
            id: 'ast-1',
            assetCode: 'INV-TIK-2026-001',
            itemName: 'Mikroskop Digital Binokuler',
            categoryName: 'Laboratorium IPA',
            locationName: 'Laboratorium Biologi',
            operationalStatus: 'RESERVED',
            conditionStatus: 'GOOD',
            effectiveLoanMode: 'ADMIN_APPROVAL',
            acquisitionYear: 2026,
            fundingSource: 'BOS Reguler',
            qrToken: 'TOKEN-BIO-001',
            permanentId: 'PID-BIO-001',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ] as unknown as LoanRequest[];

      const getLoansSpy = vi.spyOn(api, 'getLoans').mockResolvedValueOnce(mockInitialLoans);

      renderWithProviders(<LoanApproval />);

      // Awalnya ada 1 pinjaman
      expect(await screen.findByText('PINJAM-20261014-1111')).toBeInTheDocument();
      expect(screen.getByText(/Mikroskop Digital Binokuler/i)).toBeInTheDocument();

      // Simulasi guru melakukan scan QR dan submit pengajuan baru di HP
      const mockUpdatedLoans = [
        ...mockInitialLoans,
        {
          id: 'loan-new-from-mobile',
          loanNumber: 'PINJAM-20261014-9999',
          assetUnitId: 'ast-2',
          borrowerId: 'usr-teacher-2',
          borrowerName: 'Ahmad Fauzi, S.Kom.',
          borrowerRole: 'GURU_PEGAWAI',
          status: 'PENDING_APPROVAL',
          loanModeSnapshot: 'ADMIN_APPROVAL',
          purpose: 'Presentasi Proyektor Ruang Multimedia',
          requestedAt: new Date().toISOString(),
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
          unit: {
            id: 'ast-2',
            assetCode: 'INV-TIK-2026-002',
            itemName: 'Proyektor Epson EB-X500',
            categoryName: 'TIK/Multimedia',
            locationName: 'Ruang Server & TIK',
            operationalStatus: 'RESERVED',
            conditionStatus: 'GOOD',
            effectiveLoanMode: 'ADMIN_APPROVAL',
            acquisitionYear: 2026,
            fundingSource: 'BOS Reguler',
            qrToken: 'TOKEN-PROY-002',
            permanentId: 'PID-PROY-002',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ] as unknown as LoanRequest[];

      getLoansSpy.mockResolvedValue(mockUpdatedLoans);

      // Trigger refetch (mensimulasikan timer polling 5 detik)
      await queryClient.refetchQueries({ queryKey: ['loans'] });

      // Transaksi baru dari HP muncul tanpa reload halaman browser
      expect(await screen.findByText('PINJAM-20261014-9999')).toBeInTheDocument();
      expect(screen.getByText(/Proyektor Epson EB-X500/i)).toBeInTheDocument();
      expect(screen.getByText(/Ahmad Fauzi, S\.Kom\./i)).toBeInTheDocument();
    });
  });

  describe('4. Integritas Formulir Saat Polling Berjalan (Form Safety)', () => {
    it('Input formulir yang sedang diketik admin TIDAK tertimpa oleh polling di latar belakang', async () => {
      const mockLoans = [
        {
          id: 'loan-1',
          loanNumber: 'PINJAM-20261014-0001',
          assetId: 'ast-1',
          borrowerId: 'usr-1',
          borrowerName: 'Guru Uji',
          borrowerRole: 'GURU_PEGAWAI',
          status: 'PENDING_APPROVAL',
          loanModeSnapshot: 'ADMIN_APPROVAL',
          purpose: 'Uji Kelayakan',
          requestedAt: new Date().toISOString(),
          expectedReturnAt: new Date(Date.now() + 86400000).toISOString(),
          unit: {
            id: 'ast-1',
            assetCode: 'INV-001',
            itemName: 'Laptop Asus',
            categoryName: 'TIK',
            locationName: 'Lab Komputer',
            operationalStatus: 'RESERVED',
            conditionStatus: 'GOOD',
            effectiveLoanMode: 'ADMIN_APPROVAL',
            acquisitionYear: 2026,
            fundingSource: 'BOS',
            qrToken: 'TOK-1',
            permanentId: 'PID-1',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ] as unknown as LoanRequest[];

      vi.spyOn(api, 'getLoans').mockResolvedValue(mockLoans);

      renderWithProviders(<LoanApproval />);

      expect(await screen.findByText('PINJAM-20261014-0001')).toBeInTheDocument();

      // Admin mengklik tombol "Tolak" (bukan tab "Ditolak")
      const rejectButton = screen.getByRole('button', { name: /^Tolak$/i });
      fireEvent.click(rejectButton);

      // Admin sedang mengetik alasan penolakan
      const textarea = await screen.findByPlaceholderText(/Contoh: Unit barang telah dijadwalkan/i);
      fireEvent.change(textarea, { target: { value: 'Barang sedang dijadwalkan untuk ujian nasional' } });
      expect(textarea).toHaveValue('Barang sedang dijadwalkan untuk ujian nasional');

      // Polling background berjalan memperbarui data
      await queryClient.refetchQueries({ queryKey: ['loans'] });

      // Verifikasi: Teks yang sedang diketik admin TIDAK hilang atau ter-reset
      expect(textarea).toHaveValue('Barang sedang dijadwalkan untuk ujian nasional');
    });
  });

  describe('5. Penanganan Error Polling Tanpa Crash Halaman', () => {
    it('Jika request polling backend gagal sementara, tampilan tetap mempertahankan data sebelumnya', async () => {
      const mockInitialAssets = [
        {
          id: 'ast-1',
          assetCode: 'INV-TIK-2026-001',
          itemName: 'Komputer Server Utama',
          categoryName: 'TIK/Multimedia',
          locationName: 'Ruang Server & TIK',
          operationalStatus: 'AVAILABLE',
          conditionStatus: 'GOOD',
          effectiveLoanMode: 'DIRECT',
          acquisitionYear: 2026,
          fundingSource: 'BOS Reguler',
          qrToken: 'TOKEN-SERVER-001',
          permanentId: 'PID-SERVER-001',
          notes: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ] as unknown as AssetUnit[];

      const getAssetsSpy = vi.spyOn(api, 'getAssets').mockResolvedValueOnce(mockInitialAssets);

      renderWithProviders(<Inventory />);

      expect(await screen.findByText(/Komputer Server Utama/i)).toBeInTheDocument();

      // Simulasi kegagalan jaringan pada polling berikutnya
      getAssetsSpy.mockRejectedValueOnce(new Error('Koneksi timeout 504'));

      // Trigger polling
      await queryClient.refetchQueries({ queryKey: ['assets'] }).catch(() => {});

      // Halaman TIDAK crash atau blank, data sebelumnya tetap utuh
      expect(screen.getByText(/Komputer Server Utama/i)).toBeInTheDocument();
    });
  });

  describe('6. Pembersihan Polling Saat Komponen Dilepas (Unmount)', () => {
    it('Query observer dibersihkan saat komponen di-unmount tanpa kebocoran interval', async () => {
      vi.spyOn(api, 'getLoans').mockResolvedValue([]);

      const { unmount } = renderWithProviders(<MyLoans />);

      // Tunggu hingga pemuatan awal selesai
      expect(await screen.findByText(/Tidak Ada Data Peminjaman/i)).toBeInTheDocument();

      // Query terdaftar dan memiliki 1 observer aktif
      const query = queryClient.getQueryCache().find({ queryKey: ['loans'] });
      expect(query?.state.status).toBe('success');
      expect(query?.getObserversCount()).toBe(1);

      // Unmount komponen
      unmount();

      // Observer berkurang ke 0, membuktikan pembersihan listener dan pencegahan memory leak
      expect(query?.getObserversCount()).toBe(0);
    });
  });
});
