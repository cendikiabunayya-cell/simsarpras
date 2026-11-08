import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inventory } from '../pages/Inventory';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../services/api';
import { AssetUnit } from '../types';

const mockAssets: AssetUnit[] = [
  {
    id: 'asset-1',
    permanentId: 'PERM-001',
    qrToken: 'QR-001',
    assetCode: 'INV-2024-001',
    itemNumber: '01',
    itemName: 'Laptop ASUS ExpertBook',
    institution: 'MIS Cendikia Bunayya',
    categoryName: 'TIK/Multimedia',
    locationId: 'loc-1',
    locationName: 'Lab Komputer 1',
    itemBrand: 'ASUS',
    fundingSource: 'BOS Reguler',
    acquisitionYear: 2024,
    technicalSpecs: 'Core i5 RAM 16GB',
    effectiveLoanMode: 'DIRECT',
    conditionStatus: 'GOOD',
    operationalStatus: 'AVAILABLE',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'asset-2',
    permanentId: 'PERM-002',
    qrToken: 'QR-002',
    assetCode: 'INV-2023-002',
    itemNumber: '02',
    itemName: 'Proyektor Epson EB-E01',
    institution: 'RA Cendikia Bunayya',
    categoryName: 'TIK/Multimedia',
    locationId: 'loc-2',
    locationName: 'Ruang Guru',
    itemBrand: 'Epson',
    fundingSource: 'DAK Fisik',
    acquisitionYear: 2023,
    technicalSpecs: '3300 Lumens',
    effectiveLoanMode: 'ADMIN_APPROVAL',
    conditionStatus: 'GOOD',
    operationalStatus: 'AVAILABLE',
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
  },
];

const mockFundingSources = [
  { id: 'fs-1', name: 'BOS Reguler', description: '', isActive: true },
  { id: 'fs-2', name: 'DAK Fisik', description: '', isActive: true },
];

describe('Inventory Filter UI Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    vi.spyOn(api, 'getAssets').mockImplementation(async (options) => {
      let filtered = [...mockAssets];
      if (options?.fundingSource) {
        filtered = filtered.filter((a) => a.fundingSource === options.fundingSource);
      }
      if (options?.acquisitionYear) {
        filtered = filtered.filter((a) => String(a.acquisitionYear) === String(options.acquisitionYear));
      }
      if (options?.itemNumber) {
        filtered = filtered.filter((a) => a.itemNumber === options.itemNumber);
      }
      return filtered;
    });

    vi.spyOn(api, 'getFundingSources').mockResolvedValue(mockFundingSources);
    vi.spyOn(api, 'getAcquisitionYears').mockResolvedValue([2024, 2023]);
    vi.spyOn(api, 'getCategories').mockResolvedValue([]);
    vi.spyOn(api, 'getLocations').mockResolvedValue([]);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <Inventory />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

  it('menampilkan dropdown Sumber Pendanaan dengan opsi "Semua Sumber Pendanaan"', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText(/filter sumber pendanaan/i)).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Semua Sumber Pendanaan' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'BOS Reguler' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'DAK Fisik' })).toBeInTheDocument();
    });
  });

  it('menampilkan dropdown Tahun Perolehan dengan opsi "Semua Tahun" terurut dari terbaru ke terlama', async () => {
    renderComponent();

    const yearSelect = (await screen.findByLabelText(/filter tahun perolehan/i)) as HTMLSelectElement;
    expect(yearSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Semua Tahun' })).toBeInTheDocument();

    await waitFor(() => {
      expect(yearSelect.options.length).toBeGreaterThan(1);
    });

    const options = Array.from(yearSelect.options).map((o) => o.text);
    // [ 'Semua Tahun', '2024', '2023' ]
    expect(options).toContain('2024');
    expect(options).toContain('2023');
    // Verifikasi urutan DESC
    const numericYears = options.slice(1).map(Number);
    for (let i = 0; i < numericYears.length - 1; i++) {
      expect(numericYears[i]).toBeGreaterThanOrEqual(numericYears[i + 1]);
    }
  });

  it('tombol Terapkan Filter dan Reset Filter tersedia dan berfungsi menyaring data', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
      expect(screen.getByText('Proyektor Epson EB-E01')).toBeInTheDocument();
    });

    const fundingSelect = screen.getByLabelText(/filter sumber pendanaan/i);
    const applyBtn = screen.getByRole('button', { name: /terapkan filter/i });

    // Pilih BOS Reguler dan terapkan
    fireEvent.change(fundingSelect, { target: { value: 'BOS Reguler' } });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
      expect(screen.queryByText('Proyektor Epson EB-E01')).not.toBeInTheDocument();
    });

    // Reset filter
    const resetBtn = screen.getByRole('button', { name: /reset filter/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
      expect(screen.getByText('Proyektor Epson EB-E01')).toBeInTheDocument();
    });
  });

  it('menampilkan pesan "Tidak ada barang yang sesuai dengan filter" saat filter tidak menghasilkan data', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
    });

    const fundingSelect = screen.getByLabelText(/filter sumber pendanaan/i);
    const yearSelect = screen.getByLabelText(/filter tahun perolehan/i);
    const applyBtn = screen.getByRole('button', { name: /terapkan filter/i });

    // Kombinasi yang tidak ada (BOS Reguler + 2023)
    fireEvent.change(fundingSelect, { target: { value: 'BOS Reguler' } });
    fireEvent.change(yearSelect, { target: { value: '2023' } });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText('Tidak ada barang yang sesuai dengan filter')).toBeInTheDocument();
    });
  });

  it('menampilkan dropdown nomor barang tepat di sebelah kategori dan dapat menyaring barang', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
      expect(screen.getByText('Proyektor Epson EB-E01')).toBeInTheDocument();
    });

    // Periksa bahwa dropdown nomor barang ada
    const categorySelect = screen.getByLabelText(/filter kategori/i);
    const itemNumberSelect = screen.getByLabelText(/filter nomor barang/i);

    expect(categorySelect).toBeInTheDocument();
    expect(itemNumberSelect).toBeInTheDocument();

    // Verifikasi bahwa elemen nomor barang berada tepat setelah elemen kategori di DOM
    expect(categorySelect.parentElement?.nextElementSibling).toBe(itemNumberSelect.parentElement);

    // Opsi 'Semua No. Barang' dan opsi nomor barang tersedia
    expect(screen.getByRole('option', { name: 'Semua No. Barang' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No. 01' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No. 02' })).toBeInTheDocument();

    // Filter nomor barang 01
    const applyBtn = screen.getByRole('button', { name: /terapkan filter/i });
    fireEvent.change(itemNumberSelect, { target: { value: '01' } });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText('Laptop ASUS ExpertBook')).toBeInTheDocument();
      expect(screen.queryByText('Proyektor Epson EB-E01')).not.toBeInTheDocument();
    });
  });
});
