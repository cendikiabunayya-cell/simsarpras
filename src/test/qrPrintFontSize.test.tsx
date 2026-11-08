import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { QrPrint } from '../pages/QrPrint';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Label Print Font Size Settings Suite', () => {
  it('1. Menampilkan panel pengaturan font size lengkap dengan preset dan tombol perbesar/perkecil', () => {
    render(<QrPrint />, { wrapper: createWrapper() });

    expect(screen.getByText('Ukuran Font (Font Size)')).toBeInTheDocument();
    expect(screen.getByTitle('Perkecil Ukuran Font Keseluruhan')).toBeInTheDocument();
    expect(screen.getByTitle('Perbesar Ukuran Font Keseluruhan')).toBeInTheDocument();
    expect(screen.getByText('Preset Skala Keseluruhan:')).toBeInTheDocument();
  });

  it('2. Menampilkan rincian pengaturan ukuran font per elemen baris saat tombol rincian diklik', () => {
    render(<QrPrint />, { wrapper: createWrapper() });

    const detailBtn = screen.getByRole('button', { name: /Buka Rincian ▼/i });
    fireEvent.click(detailBtn);

    // Verifikasi seluruh 5 baris elemen teks label stiker
    expect(screen.getByText('1. Kode Inventaris (Atas)')).toBeInTheDocument();
    expect(screen.getByText('2. Nama Barang (Bawah)')).toBeInTheDocument();
    expect(screen.getByText('3. Sumber Dana & Tahun (Baris 2)')).toBeInTheDocument();
    expect(screen.getByText('4. Nama Sekolah (Baris 3)')).toBeInTheDocument();
    expect(screen.getByText('5. Kategori + No. Barang (Pojok Kanan Atas)')).toBeInTheDocument();
  });

  it('3. Tombol perbesar dan perkecil font mengubah preset status font', () => {
    render(<QrPrint />, { wrapper: createWrapper() });

    const zoomInBtn = screen.getByTitle('Perbesar Ukuran Font Keseluruhan');
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('BESAR')).toBeInTheDocument();

    const zoomOutBtn = screen.getByTitle('Perkecil Ukuran Font Keseluruhan');
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('STANDAR')).toBeInTheDocument();
  });
});

