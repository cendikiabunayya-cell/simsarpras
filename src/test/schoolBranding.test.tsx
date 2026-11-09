import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';
import { Login } from '../pages/Login';
import { Reports } from '../pages/Reports';
import { PublicScanLoan } from '../pages/PublicScanLoan';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('Verifikasi Dinamisasi Branding dan Identitas Sekolah (Peniadaan Hardcode Teladan)', () => {
  it('Sidebar: Menampilkan nama sekolah dinamis dan tidak lagi memuat string hardcode SMKN 1 TELADAN', () => {
    const Wrapper = createWrapper();
    render(<Sidebar isOpen={true} onClose={() => {}} />, { wrapper: Wrapper });

    // Verifikasi SMKN 1 TELADAN tidak ada
    expect(screen.queryByText(/SMKN 1 TELADAN/i)).toBeNull();
    // Verifikasi branding container ada
    expect(screen.getByText('SI-SARPRAS')).toBeInTheDocument();
  });

  it('Navbar: Menampilkan nama sekolah dinamis pada subheader', () => {
    const Wrapper = createWrapper();
    render(<Navbar onToggleSidebar={() => {}} pageTitle="Dashboard" />, { wrapper: Wrapper });

    expect(screen.queryByText(/SMKN 1 Teladan/i)).toBeNull();
    expect(screen.getByText(/Sistem Informasi Sarana & Prasarana Sekolah/i)).toBeInTheDocument();
  });

  it('Login: Menampilkan identitas sekolah dinamis dan meniadakan SMK NEGERI 1 TELADAN JAKARTA', () => {
    const Wrapper = createWrapper();
    render(<Login />, { wrapper: Wrapper });

    // Memastikan string hardcode lama sama sekali tidak ada di DOM
    expect(screen.queryByText(/SMK NEGERI 1 TELADAN JAKARTA/i)).toBeNull();
    expect(screen.queryByText(/SMKN 1 TELADAN/i)).toBeNull();
    // Memastikan judul SI-SARPRAS dan form login tampil
    expect(screen.getByText('SI-SARPRAS')).toBeInTheDocument();
    expect(screen.getByText('Masuk ke Sistem')).toBeInTheDocument();
  });

  it('Reports: Menampilkan kop surat resmi dinamis dan meniadakan teks hardcode Teladan', () => {
    const Wrapper = createWrapper();
    render(<Reports />, { wrapper: Wrapper });

    expect(screen.queryByText(/DINAS PENDIDIKAN — SMK NEGERI 1 TELADAN/i)).toBeNull();
    expect(screen.queryByText(/info@smkn1teladan\.sch\.id/i)).toBeNull();
    expect(screen.queryByText(/Kepala SMKN 1 Teladan Jakarta/i)).toBeNull();
    expect(screen.getByText(/YAYASAN PENDIDIKAN CENDIKIA BUNAYYA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/MADRASAH IBTIDAIYAH SWASTA CENDIKIA BUNAYYA/i).length).toBeGreaterThanOrEqual(1);
  });

  it('PublicScanLoan: Menampilkan identitas sekolah dinamis', () => {
    const Wrapper = createWrapper();
    render(<PublicScanLoan />, { wrapper: Wrapper });

    expect(screen.queryByText(/SMKN 1 TELADAN/i)).toBeNull();
    expect(screen.getByText('Peminjaman Mandiri')).toBeInTheDocument();
  });
});
