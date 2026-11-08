import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LoanRequest } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { SyncIndicator } from '../components/ui/SyncIndicator';
import { getAutoRefreshOptions } from '../hooks/useAutoRefreshQuery';
import { formatDate, getLoanStatusBadge } from '../lib/utils';

export const LoanApproval: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser, canApproveLoans } = useAuth();

  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'rejected'>('pending');
  const [rejectingLoan, setRejectingLoan] = useState<LoanRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: loans,
    isLoading,
    isFetching,
    dataUpdatedAt,
    isError,
    refetch,
  } = useQuery<LoanRequest[]>({
    queryKey: ['loans'],
    queryFn: ({ signal }) => api.getLoans({ signal }),
    ...getAutoRefreshOptions(),
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async (loanId: string) => {
      return api.approveLoanRequest(loanId, currentUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectingLoan || !rejectionReason.trim()) {
        throw new Error('Alasan penolakan wajib diisi');
      }
      return api.rejectLoanRequest(rejectingLoan.id, rejectionReason, currentUser);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setRejectingLoan(null);
      setRejectionReason('');
    },
  });

  // Filter list by tab & search query
  // Note: DIRECT loans do NOT require admin approval and go straight to ACTIVE
  const filteredLoans = loans?.filter((l) => {
    // Only display ADMIN_APPROVAL mode loans in the approval queue!
    const matchesTab =
      activeTab === 'pending'
        ? l.status === 'PENDING_APPROVAL'
        : activeTab === 'rejected'
        ? l.status === 'REJECTED'
        : true;

    const matchesSearch =
      l.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.unit.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.unit.assetCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const pendingCount = loans?.filter((l) => l.status === 'PENDING_APPROVAL').length || 0;

  if (!canApproveLoans) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Halaman persetujuan peminjaman hanya dapat diakses oleh Admin Sarpras.
          Guru/Pegawai tidak memiliki hak untuk menyetujui transaksi peminjaman.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Persetujuan Penerimaan / Peminjaman
          </h2>
          <p className="text-xs text-slate-500">
            Evaluasi dan setujui permohonan peminjaman inventaris. Setelah disetujui, status peminjaman langsung aktif (ON_LOAN) dan barang dapat langsung digunakan.
          </p>
        </div>
        <SyncIndicator
          isFetching={isFetching}
          isLoading={isLoading}
          dataUpdatedAt={dataUpdatedAt}
          isError={isError}
          onRefresh={() => refetch()}
        />
      </div>

      {/* Tabs & Search Filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === 'pending'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Menunggu Persetujuan</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'all'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Riwayat
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rejected')}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'rejected'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ditolak
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari peminjam, barang, nomor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan Requests Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : filteredLoans?.length === 0 ? (
            <EmptyState
              title={
                activeTab === 'pending'
                  ? 'Tidak Ada Pengajuan yang Menunggu Persetujuan'
                  : 'Tidak Ada Transaksi yang Cocok'
              }
              description={
                activeTab === 'pending'
                  ? 'Seluruh permohonan peminjaman mode ADMIN_APPROVAL telah diproses.'
                  : 'Coba ubah kata kunci pencarian Anda.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="px-5 py-3">No. Pinjaman & Waktu</th>
                    <th className="px-5 py-3">Peminjam</th>
                    <th className="px-5 py-3">Barang & Unit</th>
                    <th className="px-5 py-3">Tujuan & Rencana Kembali</th>
                    <th className="px-5 py-3">Status Transaksi</th>
                    <th className="px-5 py-3 text-right">Keputusan Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans?.map((loan) => {
                    const statusBadge = getLoanStatusBadge(loan.status);
                    const isPending = loan.status === 'PENDING_APPROVAL';

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* No Pinjaman */}
                        <td className="px-5 py-4">
                          <div className="font-mono font-bold text-slate-900">
                            {loan.loanNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(loan.requestedAt)}
                          </div>
                          <span className="inline-block mt-1 text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                            {loan.loanModeSnapshot}
                          </span>
                        </td>

                        {/* Peminjam */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{loan.borrowerName}</div>
                          <div className="text-[11px] text-slate-500">
                            NIP: {loan.borrowerEmployeeNumber}
                          </div>
                          <span className="text-[10px] text-slate-400">{loan.borrowerRole}</span>
                        </td>

                        {/* Unit Barang */}
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {loan.unit.itemName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {loan.unit.assetCode} — {loan.unit.locationName}
                          </div>
                        </td>

                        {/* Tujuan & Rencana Kembali */}
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-slate-800 line-clamp-2">{loan.purpose}</p>
                          <div className="text-[11px] text-blue-700 font-medium mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Kembali: {formatDate(loan.expectedReturnAt)}</span>
                          </div>
                        </td>

                        {/* Status Transaksi */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                          >
                            {statusBadge.label}
                          </span>

                          {loan.rejectionReason && (
                            <div className="text-[10px] text-rose-700 mt-1 max-w-xs italic">
                              Alasan tolak: {loan.rejectionReason}
                            </div>
                          )}
                        </td>

                        {/* Keputusan Admin */}
                        <td className="px-5 py-4 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectingLoan(loan)}
                                className="text-rose-700 border-rose-200 hover:bg-rose-50"
                              >
                                Tolak
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(loan.id)}
                                isLoading={approveMutation.isPending}
                                className="bg-emerald-700 hover:bg-emerald-800"
                              >
                                Setujui
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {loan.approvedByName ? `Oleh: ${loan.approvedByName}` : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG ALASAN PENOLAKAN */}
      <Modal
        isOpen={Boolean(rejectingLoan)}
        onClose={() => setRejectingLoan(null)}
        title="Konfirmasi Penolakan Peminjaman"
        description="Sebutkan alasan penolakan secara jelas. Unit barang akan dibebaskan kembali ke status tersedia."
        maxWidth="md"
      >
        {rejectingLoan && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
              <span className="block font-semibold">
                Menolak Transaksi {rejectingLoan.loanNumber}
              </span>
              <span>
                Peminjam: {rejectingLoan.borrowerName} ({rejectingLoan.unit.itemName})
              </span>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Unit barang telah dijadwalkan untuk ujian akreditasi sekolah pada tanggal tersebut..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setRejectingLoan(null)}
                disabled={rejectMutation.isPending}
              >
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                isLoading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                Tolak Peminjaman
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
