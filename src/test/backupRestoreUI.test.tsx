import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BackupRestore } from '../pages/BackupRestore';

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

describe('Backup & Restore UI Component Tests', () => {
  it('menampilkan judul halaman dan tombol tindakan utama', async () => {
    render(<BackupRestore />, { wrapper: createWrapper() });

    expect(screen.getByText('Cadangkan & Pulihkan Seluruh Data')).toBeInTheDocument();
    expect(screen.getByText('1. Cadangkan Seluruh Data (Backup)')).toBeInTheDocument();
    expect(screen.getByText('2. Pulihkan Data dari Cadangan (Restore)')).toBeInTheDocument();
    expect(screen.getByText('Unduh Berkas Cadangan Lengkap (.json)')).toBeInTheDocument();
  });

  it('menampilkan opsi metode pemulihan Timpa Bersih dan Gabungkan', async () => {
    render(<BackupRestore />, { wrapper: createWrapper() });

    expect(screen.getByText('Timpa Bersih (Clean)')).toBeInTheDocument();
    expect(screen.getByText('Gabungkan (Merge)')).toBeInTheDocument();
  });
});

