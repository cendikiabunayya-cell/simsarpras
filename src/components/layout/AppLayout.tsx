import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MockNoticeBanner } from '../ui/MockNoticeBanner';
import { MobileBottomNav } from './MobileBottomNav';
import { ErrorBoundary } from '../ui/ErrorBoundary';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = (pathname: string): string => {
    if (pathname === '/') return 'Dashboard';
    if (pathname.startsWith('/inventory')) return 'Data Inventaris';
    if (pathname.startsWith('/qr-print')) return 'Cetak Label QR';
    if (pathname.startsWith('/qr-scan')) return 'Scan QR Code';
    if (pathname.startsWith('/loans/approval')) return 'Persetujuan Penerimaan';
    if (pathname.startsWith('/returns/verify')) return 'Verifikasi Pengembalian';
    if (pathname.startsWith('/my-loans')) return 'Peminjaman Saya';
    if (pathname.startsWith('/my-history')) return 'Riwayat Transaksi';
    if (pathname.startsWith('/reports/loans')) return 'Laporan Peminjaman';
    if (pathname.startsWith('/reports')) return 'Laporan & Rekapitulasi';
    if (pathname.startsWith('/policy')) return 'Kebijakan Peminjaman';
    if (pathname.startsWith('/audit')) return 'Audit Aktivitas';
    if (pathname.startsWith('/users')) return 'Master Data Pengguna';
    return 'SI-SARPRAS';
  };

  const title = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mock Notice Bar */}
      <MockNoticeBanner />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 lg:pb-0">
          <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} pageTitle={title} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile Navigation */}
      <MobileBottomNav />
    </div>
  );
};
