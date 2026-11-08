import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Boxes,
  Building,
  CheckSquare,
  Clock,
  Database,
  FileCheck2,
  FileText,
  HardDrive,
  History,
  LayoutDashboard,
  Printer,
  QrCode,
  ShieldCheck,
  Sliders,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSchoolSettings } from '../../hooks/useSchoolSettings';
import { cn } from '../../lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { schoolName, logoUrl } = useSchoolSettings();
  const role = currentUser?.role || 'ADMIN_SARPRAS';

  // Menus filtered strictly by role matrix (PRD Section 11 & 14)
  const getNavSections = () => {
    if (role === 'ADMIN_SARPRAS') {
      return [
        {
          title: 'Utama',
          items: [
            { to: '/', label: 'Dashboard Sarpras', icon: LayoutDashboard },
            { to: '/inventory', label: 'Data Inventaris', icon: Boxes },
            { to: '/qr-scan', label: 'Scan QR Code', icon: QrCode },
            { to: '/qr-print', label: 'Cetak Label QR', icon: Printer },
          ],
        },
        {
          title: 'Siklus Peminjaman',
          items: [
            { to: '/loans/approval', label: 'Persetujuan Penerimaan', icon: CheckSquare },
            { to: '/returns/verify', label: 'Verifikasi Pengembalian', icon: FileCheck2 },
          ],
        },
        {
          title: 'Master Data & Pengaturan',
          items: [
            { to: '/master-data', label: 'Master Data Sarpras', icon: Database },
            { to: '/users', label: 'Data Pengguna', icon: Users },
            { to: '/settings/school', label: 'Pengaturan Sekolah', icon: Building },
            { to: '/settings/backup', label: 'Backup & Restore Data', icon: HardDrive },
            { to: '/policy', label: 'Kebijakan Peminjaman', icon: Sliders },
            { to: '/reports', label: 'Laporan & Rekapitulasi', icon: FileText },
            { to: '/audit', label: 'Audit Aktivitas', icon: History },
          ],
        },
      ];
    }

    if (role === 'GURU_PEGAWAI') {
      return [
        {
          title: 'Menu Guru',
          items: [
            { to: '/', label: 'Beranda Guru', icon: LayoutDashboard },
            { to: '/qr-scan', label: 'Scan QR Pinjam / Kembali', icon: QrCode },
            { to: '/inventory', label: 'Katalog Barang Tersedia', icon: Boxes },
            { to: '/my-loans', label: 'Peminjaman Saya', icon: Clock },
            { to: '/my-history', label: 'Riwayat Transaksi', icon: History },
          ],
        },
      ];
    }

    // KEPALA_SEKOLAH
    return [
      {
        title: 'Eksekutif',
        items: [
          { to: '/', label: 'Dashboard Eksekutif', icon: LayoutDashboard },
          { to: '/reports', label: 'Laporan Inventaris', icon: FileText },
          { to: '/reports/loans', label: 'Laporan Peminjaman', icon: Clock },
          { to: '/inventory', label: 'Katalog Barang', icon: Boxes },
          { to: '/audit', label: 'Audit Aktivitas', icon: History },
        ],
      },
    ];
  };

  const sections = getNavSections();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shadow-xl lg:shadow-none',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0 bg-slate-950/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-md shadow-blue-500/20 shrink-0 overflow-hidden relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={schoolName}
                  className="w-full h-full object-contain p-0.5"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.brand-fallback-icon');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <Boxes className={cn("w-5 h-5", logoUrl ? "hidden brand-fallback-icon" : "")} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold tracking-tight text-white leading-tight truncate">
                SI-SARPRAS
              </div>
              <div
                className="text-[10px] text-blue-400 font-medium tracking-wide truncate max-w-[145px]"
                title={schoolName}
              >
                {schoolName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup sidebar"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {sections.map((sec, idx) => (
            <div key={idx}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
                {sec.title}
              </div>
              <nav className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => onClose()}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group',
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                        )
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/40">
          <div className="flex items-center gap-2 text-slate-300 font-medium mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Versi Baseline 1.2</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Pemisahan Hak Akses & Integritas State
          </div>
        </div>
      </aside>
    </>
  );
};
