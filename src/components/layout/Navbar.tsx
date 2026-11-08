import React, { useState } from 'react';
import {
  Bell,
  Menu,
  QrCode,
  User,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSettings } from '../../hooks/useSchoolSettings';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface NavbarProps {
  onToggleSidebar: () => void;
  pageTitle: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, pageTitle }) => {
  const { currentUser, logout } = useAuth();
  const { schoolName } = useSchoolSettings();
  const navigate = useNavigate();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const getRoleBadge = () => {
    switch (currentUser?.role) {
      case 'ADMIN_SARPRAS':
        return { label: 'Admin Sarpras', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'GURU_PEGAWAI':
        return { label: 'Guru / Pegawai', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'KEPALA_SEKOLAH':
        return { label: 'Kepala Sekolah', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      default:
        return { label: 'User', color: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleInfo = getRoleBadge();

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', {
        replace: true,
        state: { notice: 'Anda telah berhasil keluar dari akun.' },
      });
    } finally {
      setIsLoggingOut(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Mobile hamburger & Page Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle menu navigasi"
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:ring-2 focus:ring-blue-600"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {pageTitle}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Sistem Informasi Sarana & Prasarana Sekolah — {schoolName}
              </p>
            </div>
          </div>

          {/* Right: Quick actions, notifications, user profile, logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Scan QR Button for all users */}
            <Link
              to="/qr-scan"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors"
            >
              <QrCode className="w-4 h-4 text-blue-700" />
              <span>Scan QR</span>
            </Link>

            {/* Notification icon */}
            <button
              type="button"
              aria-label="Notifikasi sistem"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 relative transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
            </button>

            {/* User Profile Chip */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.fullName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shadow-xs"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {currentUser.fullName}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${roleInfo.color}`}
                  >
                    {roleInfo.label}
                  </span>
                  <span className="text-[11px] text-slate-400">NIP: {currentUser.employeeNumber}</span>
                </div>
              </div>
            </div>

            {/* Tombol Logout Nyata (Desktop & Mobile) */}
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              title="Keluar dari akun"
              aria-label="Tombol Keluar / Logout"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200/80 text-xs font-semibold transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Modal Konfirmasi Logout */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => !isLoggingOut && setIsConfirmOpen(false)}
        title="Konfirmasi Keluar Akun"
        description="Apakah Anda yakin ingin keluar dari sistem SIMSARPRAS?"
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="text-slate-600 leading-relaxed">
              Sesi login Anda sebagai <strong className="text-slate-900">{currentUser.fullName}</strong> ({roleInfo.label}) akan dihentikan dan token otorisasi akan dibersihkan dari peramban.
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              disabled={isLoggingOut}
              onClick={() => setIsConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              isLoading={isLoggingOut}
              onClick={handleConfirmLogout}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Ya, Keluar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
