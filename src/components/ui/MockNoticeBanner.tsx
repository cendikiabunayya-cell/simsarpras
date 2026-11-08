import React from 'react';
import { AlertTriangle, Database, RotateCcw, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

export const MockNoticeBanner: React.FC = () => {
  const { isMock, currentUser, allUsers, switchUser, resetAllMockData } = useAuth();

  if (!isMock) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-300/40 text-amber-950 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 z-40">
      <div className="flex items-center gap-2 font-medium">
        <span className="inline-flex items-center gap-1 bg-amber-500 text-amber-950 px-2 py-0.5 rounded font-semibold text-[11px] shadow-sm">
          <Database className="w-3 h-3" />
          MODE MOCK / SIMULASI
        </span>
        <span className="hidden sm:inline">
          Transaksi disimpan di browser lokal untuk pengujian prototipe. Belum tersambung ke backend Express.
        </span>
        <span className="inline sm:hidden flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Simulasi Lokal
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-amber-200 shadow-xs">
          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-600 font-medium">Simulasi Peran:</span>
          <select
            value={currentUser.id}
            onChange={(e) => {
              const selected = allUsers.find((u) => u.id === e.target.value);
              if (selected) switchUser(selected);
            }}
            aria-label="Pilih peran simulasi"
            className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
          >
            {allUsers.map((u) => {
              const roleLabel: Record<UserRole, string> = {
                ADMIN_SARPRAS: 'Admin Sarpras',
                GURU_PEGAWAI: 'Guru/Pegawai',
                KEPALA_SEKOLAH: 'Kepala Sekolah',
              };
              return (
                <option key={u.id} value={u.id}>
                  {roleLabel[u.role]} — {u.fullName}
                </option>
              );
            })}
          </select>
        </div>

        <button
          onClick={() => {
            if (confirm('Reset seluruh data simulasi kembali ke set awal?')) {
              resetAllMockData();
            }
          }}
          title="Kembalikan semua data mock ke kondisi awal"
          className="flex items-center gap-1 text-[11px] text-amber-900/80 hover:text-amber-950 hover:bg-amber-200/50 px-2 py-1 rounded transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset Data</span>
        </button>
      </div>
    </div>
  );
};
