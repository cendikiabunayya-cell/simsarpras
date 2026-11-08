import React from 'react';
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AppLayout } from './components/layout/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { QrPrint } from './pages/QrPrint';
import { QrScanner } from './pages/QrScanner';
import { LoanApproval } from './pages/LoanApproval';
import { ReturnVerification } from './pages/ReturnVerification';
import { MyLoans } from './pages/MyLoans';
import { Reports } from './pages/Reports';
import { PolicySettings } from './pages/PolicySettings';
import { AuditLogs } from './pages/AuditLogs';
import { Users } from './pages/Users';
import { MasterData } from './pages/MasterData';
import { SchoolSettings } from './pages/SchoolSettings';
import { BackupRestore } from './pages/BackupRestore';
import { Login } from './pages/Login';
import { PublicScanLoan } from './pages/PublicScanLoan';
import { UserRole } from './types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

/**
 * Komponen pelindung rute aplikasi (Route Guard)
 * Mencegah akses ke halaman terproteksi tanpa autentikasi
 * Mencegah kembali ke halaman terproteksi via tombol Back setelah logout
 */
interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, isLoading, currentUser, isMock } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  // Jika tidak dalam mode simulasi/mock dan belum login -> alihkan ke /login
  if (!isAuthenticated && !isMock) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Jika dibatasi peran tertentu dan peran pengguna tidak memenuhi -> alihkan ke /
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Halaman Khusus Peminjaman Mandiri via Scan QR Code (Tanpa Menu & Tanpa Login) */}
      <Route path="/scan" element={<PublicScanLoan />} />
      <Route path="/q/:tokenOrCode" element={<PublicScanLoan />} />
      <Route path="/b/:tokenOrCode" element={<PublicScanLoan />} />
      <Route path="/pinjam" element={<PublicScanLoan />} />

      {/* Seluruh Halaman Internal Dilindungi oleh ProtectedRoute */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/qr-print" element={<QrPrint />} />
          <Route path="/qr-scan" element={<QrScanner />} />
          <Route path="/loans/approval" element={<LoanApproval />} />
          <Route path="/loans/handover" element={<Navigate to="/loans/approval" replace />} />
          <Route path="/returns/verify" element={<ReturnVerification />} />
          <Route path="/my-loans" element={<MyLoans />} />
          <Route path="/my-history" element={<MyLoans />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/loans" element={<Reports />} />
          <Route path="/policy" element={<PolicySettings />} />
          <Route path="/audit" element={<AuditLogs />} />

          {/* Master Data & Pengaturan: Hak Akses Khusus ADMIN_SARPRAS */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN_SARPRAS']} />}>
            <Route path="/master-data" element={<MasterData />} />
            <Route path="/users" element={<Users />} />
            <Route path="/settings/school" element={<SchoolSettings />} />
            <Route path="/school-settings" element={<Navigate to="/settings/school" replace />} />
            <Route path="/settings/backup" element={<BackupRestore />} />
            <Route path="/backup" element={<Navigate to="/settings/backup" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <RealtimeProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </RealtimeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};

export default App;
