import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { formatDate } from '../lib/utils';

export const AuditLogs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(),
  });

  const getActionBadgeClass = (action: string) => {
    const upper = action.toUpperCase();
    if (upper.startsWith('TAMBAH') || upper.includes('CREATE') || upper === 'PINJAM_LANGSUNG' || upper === 'AKTIFKAN_PENGGUNA') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (upper.startsWith('UBAH') || upper.includes('UPDATE')) {
      return 'bg-blue-50 text-blue-800 border-blue-200';
    }
    if (upper.startsWith('SETUJUI') || upper.includes('APPROVE') || upper.startsWith('SERAH') || upper.includes('VERIFIKASI')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-200';
    }
    if (upper.startsWith('HAPUS') || upper.startsWith('TOLAK') || upper.includes('NONAKTIF') || upper.includes('DELETE') || upper.includes('REJECT') || upper.includes('ARSIP')) {
      return 'bg-rose-50 text-rose-800 border-rose-200';
    }
    if (upper.includes('BACKUP')) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const filteredLogs = logs?.filter((log) => {
    const q = searchQuery.toLowerCase();
    return (
      log.userName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      (log.entityName && log.entityName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Audit Aktivitas & Rekam Jejak
        </h2>
        <p className="text-xs text-slate-500">
          Riwayat kronologis mutasi status inventaris, persetujuan peminjaman, dan tindakan pengguna (Read-Only).
        </p>
      </div>

      <Card>
        <CardHeader className="py-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm">Riwayat Aktivitas Tercatat</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pelaku, aksi, entitas..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="px-5 py-3">Waktu</th>
                    <th className="px-5 py-3">Pelaku / Aktor</th>
                    <th className="px-5 py-3">Jenis Aksi</th>
                    <th className="px-5 py-3">Rincian Perubahan & Entitas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs?.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{log.userName}</div>
                        <span className="text-[10px] text-slate-400">{log.userRole}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-md">
                        {log.entityName && (
                          <div className="font-semibold text-blue-800 text-[11px] mb-0.5">
                            {log.entityName}
                          </div>
                        )}
                        <p className="text-slate-600 leading-relaxed">{log.details}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
