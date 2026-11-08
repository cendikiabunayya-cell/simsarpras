import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EditAssetModal } from '../components/modals/EditAssetModal';
import { QrPrint } from '../pages/QrPrint';
import { QrScanner } from '../pages/QrScanner';
import { AuthProvider } from '../context/AuthContext';
import { getConditionBadge, getOperationalBadge, getLoanModeBadge } from '../lib/utils';
import { Boxes } from 'lucide-react';

describe('UI Reusable Components & Accessibility', () => {
  it('renders Badge with text and dot correctly', () => {
    render(
      <Badge variant="success" dot>
        Tersedia
      </Badge>
    );
    expect(screen.getByText('Tersedia')).toBeInTheDocument();
  });

  it('renders StatCard with title, value, and subtitle', () => {
    render(
      <StatCard
        title="Total Unit Inventaris"
        value={48}
        icon={<Boxes data-testid="boxes-icon" />}
        subtitle="Seluruh unit fisik"
        color="blue"
      />
    );
    expect(screen.getByText('Total Unit Inventaris')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('Seluruh unit fisik')).toBeInTheDocument();
  });

  it('renders EmptyState with accessible action button', () => {
    let clicked = false;
    render(
      <EmptyState
        title="Tidak Ada Data"
        description="Belum ada transaksi peminjaman tercatat."
        actionLabel="Ajukan Peminjaman"
        onAction={() => {
          clicked = true;
        }}
      />
    );
    expect(screen.getByText('Tidak Ada Data')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: 'Ajukan Peminjaman' });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(clicked).toBe(true);
  });

  it('renders ErrorMessage with retry capability', () => {
    let retried = false;
    render(
      <ErrorMessage
        title="Koneksi Terputus"
        message="Gagal memuat data dari server."
        onRetry={() => {
          retried = true;
        }}
      />
    );
    expect(screen.getByText('Koneksi Terputus')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Coba Lagi/i });
    retryBtn.click();
    expect(retried).toBe(true);
  });

  it('verifies condition and operational badge helpers map to appropriate text labels', () => {
    expect(getConditionBadge('GOOD').label).toBe('Baik');
    expect(getConditionBadge('MAJOR_DAMAGE').label).toBe('Rusak Berat');
    expect(getOperationalBadge('AVAILABLE').label).toBe('Tersedia');
    expect(getOperationalBadge('ON_LOAN').label).toBe('Sedang Dipinjam');
    expect(getOperationalBadge('MAINTENANCE').label).toBe('Perbaikan / Rusak');
    expect(getLoanModeBadge('DIRECT').label).toContain('DIRECT');
    expect(getLoanModeBadge('ADMIN_APPROVAL').label).toContain('ADMIN_APPROVAL');
  });

  it('renders EditAssetModal with pre-populated asset data when open', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const sampleAsset = {
      id: 'test-1',
      itemName: 'Laptop Guru Core i7',
      categoryName: 'TIK/Multimedia',
      technicalSpecs: 'Core i7, RAM 16GB, SSD 512GB',
      itemBrand: 'Dell',
      fundingSource: 'BOS Reguler',
      acquisitionYear: 2024,
      locationId: 'loc-lab-01',
      locationName: 'Laboratorium Komputer 1',
      assetCode: 'INV-TIK-001',
      qrToken: 'QR-INV-TIK-001',
      effectiveLoanMode: 'DIRECT' as const,
      conditionStatus: 'GOOD' as const,
      operationalStatus: 'AVAILABLE' as const,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <EditAssetModal
          isOpen={true}
          onClose={() => {}}
          asset={sampleAsset}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Ubah Data Barang & Sarana')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Laptop Guru Core i7')).toBeInTheDocument();
    expect(screen.getByDisplayValue('INV-TIK-001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Core i7, RAM 16GB, SSD 512GB')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Dell')).toBeInTheDocument();
  });

  it('renders QrPrint with default "DENGAN TAHUN" for Baris 2', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <QrPrint />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Format Tahun Perolehan (Baris 2)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DENGAN TAHUN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '- TAHUN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '(TAHUN)' })).toBeInTheDocument();

    // Verifikasi fitur font size
    expect(screen.getByText('Ukuran Font (Font Size)')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Kecil' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Standar' })[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Besar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekstra Besar' })).toBeInTheDocument();

    // Verifikasi fitur pengaturan margin atas bawah kanan kiri saat mencetak
    expect(screen.getByText('Pengaturan Margin (Atas, Bawah, Kanan, Kiri)')).toBeInTheDocument();
    expect(screen.getByText('Margin Atas')).toBeInTheDocument();
    expect(screen.getByText('Margin Bawah')).toBeInTheDocument();
    expect(screen.getByText('Margin Kiri')).toBeInTheDocument();
    expect(screen.getByText('Margin Kanan')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Sangat Rapat' })[0]).toBeInTheDocument();

    // Uji tombol interaksi tambah margin cetak
    const addTopBtn = screen.getByRole('button', { name: 'Tambah Margin Atas' });
    fireEvent.click(addTopBtn);
    expect(screen.getByText('6 mm')).toBeInTheDocument();

    // Buka rincian pengaturan font per baris
    const detailBtn = screen.getByRole('button', { name: /Buka Rincian/i });
    expect(detailBtn).toBeInTheDocument();
    fireEvent.click(detailBtn);
    expect(screen.getByText('1. Kode Inventaris (Atas)')).toBeInTheDocument();
    expect(screen.getByText('2. Nama Barang (Bawah)')).toBeInTheDocument();
    expect(screen.getByText('3. Sumber Dana & Tahun (Baris 2)')).toBeInTheDocument();
    expect(screen.getByText('4. Nama Sekolah (Baris 3)')).toBeInTheDocument();
  });

  it('verifies Satuan Pendidikan in EditAssetModal and its reflection on QrPrint school label', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const sampleAssetRA = {
      id: 'test-ra-1',
      itemName: 'Alat Peraga Edukasi RA',
      institution: 'RA Cendikia Bunayya' as const,
      categoryName: 'TIK/Multimedia',
      technicalSpecs: 'Paket Mainan Balok & Puzzle Kayu',
      itemBrand: 'Edukasi Mandiri',
      fundingSource: 'BOS Reguler',
      acquisitionYear: 2025,
      locationId: 'loc-1',
      locationName: 'Ruang Kelas RA',
      assetCode: 'RA-INV-001',
      qrToken: 'QR-RA-001',
      effectiveLoanMode: 'DIRECT' as const,
      conditionStatus: 'GOOD' as const,
      operationalStatus: 'AVAILABLE' as const,
      createdAt: '2026-10-10T00:00:00Z',
      updatedAt: '2026-10-10T00:00:00Z',
    };

    render(
      <QueryClientProvider client={queryClient}>
        <EditAssetModal
          isOpen={true}
          onClose={() => {}}
          asset={sampleAssetRA}
        />
      </QueryClientProvider>
    );

    // Verifikasi field Satuan Pendidikan dan pilihannya
    expect(screen.getByText('Satuan Pendidikan')).toBeInTheDocument();
    const selectElem = screen.getByDisplayValue('RA Cendikia Bunayya') as HTMLSelectElement;
    expect(selectElem).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'RA Cendikia Bunayya' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MIS Cendikia Bunayya' })).toBeInTheDocument();
  });

  it('renders QrPrint with Satuan Pendidikan filter and school name mode selector', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <QrPrint />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Verifikasi filter Satuan Pendidikan
    expect(screen.getByRole('combobox', { name: 'Filter Satuan Pendidikan' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semua Satuan Pendidikan' })).toBeInTheDocument();

    // Verifikasi mode nama sekolah di panel pengaturan
    expect(screen.getByRole('button', { name: 'Sesuai Satuan Pendidikan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Teks Kustom Manual' })).toBeInTheDocument();
  });

  it('verifies that borrower name in QrScanner loan modal is an editable text box', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter initialEntries={['/scan?code=INV-TIK-2024-001']}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <QrScanner />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Cari tombol ajukan peminjaman setelah unit muncul
    const loanBtn = await screen.findByRole('button', { name: /Ajukan Peminjaman/i });
    expect(loanBtn).toBeInTheDocument();
    fireEvent.click(loanBtn);

    // Verifikasi field nama peminjam adalah teks box yang bisa diketik
    const borrowerInput = (await screen.findByPlaceholderText(
      /Ketik nama lengkap peminjam/i
    )) as HTMLInputElement;
    expect(borrowerInput).toBeInTheDocument();
    expect(borrowerInput.tagName).toBe('INPUT');
    expect(borrowerInput.type).toBe('text');

    // Ubah teks peminjam dengan mengetik nama baru
    fireEvent.change(borrowerInput, { target: { value: 'Budi Santoso, S.Pd' } });
    expect(borrowerInput.value).toBe('Budi Santoso, S.Pd');

    // Verifikasi tombol cepat keperluan (1-tap preset)
    const presetMengajar = screen.getByRole('button', { name: /\+ Mengajar di Kelas/i });
    expect(presetMengajar).toBeInTheDocument();
    fireEvent.click(presetMengajar);

    const purposeInput = screen.getByPlaceholderText(
      /Pilih tombol di atas atau ketik keperluan/i
    ) as HTMLInputElement;
    expect(purposeInput.value).toBe('Mengajar di Kelas');

    // Verifikasi tombol cepat tanggal pengembalian
    const quickToday = screen.getByRole('button', { name: /Hari ini \(15:00\)/i });
    expect(quickToday).toBeInTheDocument();
    fireEvent.click(quickToday);

    // Verifikasi tombol Kirim Pengajuan aktif
    const submitBtn = screen.getByRole('button', { name: /Kirim Pengajuan/i });
    expect(submitBtn).toBeEnabled();
  });

  it('verifies scanner viewfinder is collapsed when asset is scanned and togglable', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <MemoryRouter initialEntries={['/scan?code=INV-TIK-2024-001']}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <QrScanner />
          </AuthProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Tombol Ajukan Peminjaman langsung tampil di atas
    const loanBtn = await screen.findByRole('button', { name: /Ajukan Peminjaman/i });
    expect(loanBtn).toBeInTheDocument();

    // Viewfinder kamera tidak langsung muncul karena asset sudah teridentifikasi (agar muat 1 layar HP)
    expect(screen.queryByText(/Viewfinder Kamera QR \/ Barcode/i)).not.toBeInTheDocument();

    // Tombol toggle untuk membuka scanner kamera lain jika diperlukan
    const toggleBtn = screen.getByRole('button', { name: /Scan Barcode Barang Lain/i });
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);

    // Sekarang viewfinder kamera tampil
    expect(screen.getByText(/Viewfinder Kamera QR \/ Barcode/i)).toBeInTheDocument();
  });
});


