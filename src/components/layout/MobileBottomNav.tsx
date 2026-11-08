import React from 'react';
import { NavLink } from 'react-router-dom';
import { Boxes, Clock, History, LayoutDashboard, QrCode } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export const MobileBottomNav: React.FC = () => {
  const { currentUser } = useAuth();

  // Show bottom bar primarily on small screens
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 lg:hidden px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
              isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
            )
          }
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Beranda</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
              isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
            )
          }
        >
          <Boxes className="w-5 h-5 mb-0.5" />
          <span>Katalog</span>
        </NavLink>

        {/* Center Prominent Scan QR Button */}
        <NavLink
          to="/qr-scan"
          className="flex flex-col items-center -top-4 relative group"
        >
          <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 group-active:scale-95 transition-transform">
            <QrCode className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-semibold text-blue-800 mt-1">Scan QR</span>
        </NavLink>

        {currentUser.role === 'GURU_PEGAWAI' ? (
          <>
            <NavLink
              to="/my-loans"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              <Clock className="w-5 h-5 mb-0.5" />
              <span>Pinjaman</span>
            </NavLink>

            <NavLink
              to="/my-history"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              <History className="w-5 h-5 mb-0.5" />
              <span>Riwayat</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/loans/approval"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              <Clock className="w-5 h-5 mb-0.5" />
              <span>Persetujuan</span>
            </NavLink>

            <NavLink
              to="/reports"
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center py-1 px-3 text-[10px] font-medium transition-colors',
                  isActive ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                )
              }
            >
              <History className="w-5 h-5 mb-0.5" />
              <span>Laporan</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
};
