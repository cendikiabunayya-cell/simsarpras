import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  PackageCheck,
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

export const ReturnVerification: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser, canReceiveReturns } = useAuth();

  const [activeTab, setActiveTab] = useState<'requested' | 'completed'>('requested');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected loan for verification confirmation modal
  const [selectedLoanForVerification, setSelectedLoanForVerification] = useState<LoanRequest | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Single-Step Admin Verification Mutation
  const verifyMutation = useMutation({
    mutationFn: async ({ loanId, notes }: { loanId: string; notes?: string }) => {
      return api.verifyReturn(loanId, currentUser, notes);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setSelectedLoanForVerification(null);
      setVerificationNotes('');
      setSuccessMessage(
        `Pengembalian barang "${updated.unit?.itemName || 'Barang'}" (${updated.unit?.assetCode || updated.loanNumber}) berhasil diverifikasi! Unit inventaris telah pulih menjadi Tersedia (AVAILABLE).`
      );
    },
  });

  if (!canReceiveReturns) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Halaman verifikasi penerimaan pengembalian barang hanya dapat diakses oleh Admin Sarpras yang berwenang.
        </p>
      </div>
    );
  }

  // Filter loans by tab (Requested = RETURN_REQUESTED or legacy RETURN_RECEIVED; Completed = COMPLETED)
  const filteredLoans = loans?.filter((l) => {
    const matchesTab =
      activeTab === 'requested'
        ? l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED'
        : l.status === 'COMPLETED';

    const matchesSearch =
      l.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.borrowerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.unit.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.unit.assetCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const requestedCount =
    loans?.filter((l) => l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED').length || 0;
  const completedCount = loans?.filter((l) => l.status === 'COMPLETED').length || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Verifikasi Penerimaan Pengembalian
          </h2>
          <p className="text-xs text-slate-500">
            Penerimaan dan verifikasi pengembalian barang sarana prasarana sekolah secara langsung tanpa tahap pemeriksaan terpisah.
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

      {/* Simplified Workflow Guide Banner */}
      <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-3">
        <FileCheck2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block font-bold text-emerald-900">Alur Pengembalian Barang SIMSARPRAS:</strong>
          1. <strong>Pengajuan Pengembalian</strong> (Guru membuka riwayat pinjaman / scan QR) →{' '}
          2. <strong>Verifikasi Penerimaan</strong> (Admin memeriksa kesesuaian barang & mengonfirmasi penerimaan) →{' '}
          3. <strong>Selesai</strong> (Transaksi tuntas menjadi <em>COMPLETED</em> dan ketersediaan barang otomatis pulih menjadi <em>AVAILABLE</em>).
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-start justify-between gap-2.5 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-emerald-950 mb-0.5">Verifikasi Berhasil</h5>
              <p className="text-[11px] leading-relaxed">{successMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-bold px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('requested')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'requested'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>1. Menunggu Verifikasi</span>
              {requestedCount > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                  {requestedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'completed'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>2. Selesai (Arsip)</span>
              {completedCount > 0 && (
                <span className="px-1.5 py-0.2 bg-slate-400 text-white rounded-full text-[10px]">
                  {completedCount}
                </span>
              )}
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari transaksi, guru, barang..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : filteredLoans?.length === 0 ? (
            <EmptyState
              title={
                activeTab === 'requested'
                  ? 'Tidak Ada Pengembalian yang Menunggu Verifikasi'
                  : 'Tidak Ada Riwayat Pengembalian Selesai'
              }
              description={
                activeTab === 'requested'
                  ? 'Seluruh pengembalian barang inventaris telah diverifikasi dan diselesaikan.'
                  : 'Belum ada transaksi peminjaman yang diselesaikan pada periode ini.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="px-5 py-3">No. Transaksi</th>
                    <th className="px-5 py-3">Peminjam</th>
                    <th className="px-5 py-3">Unit Barang</th>
                    <th className="px-5 py-3">Status Saat Ini</th>
                    <th className="px-5 py-3">Catatan / Waktu</th>
                    <th className="px-5 py-3 text-right">Tindakan Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans?.map((loan) => {
                    const statusBadge = getLoanStatusBadge(loan.status);

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-mono font-bold text-slate-900">{loan.loanNumber}</div>
                          <div className="text-[11px] text-slate-500">
                            Dipinjam: {formatDate(loan.requestedAt)}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{loan.borrowerName}</div>
                          <div className="text-[11px] text-slate-500">
                            NIP: {loan.borrowerEmployeeNumber || '-'}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{loan.unit.itemName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {loan.unit.assetCode} — {loan.unit.locationName}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>

                        <td className="px-5 py-4 max-w-xs">
                          {loan.returnInspection?.notes ? (
                            <p className="text-slate-700 italic">
                              "{loan.returnInspection.notes}"
                            </p>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          {loan.returnInspection?.approvedByName && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              Diverifikasi: {loan.returnInspection.approvedByName} (
                              {formatDate(loan.returnInspection.approvedAt)})
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {(loan.status === 'RETURN_REQUESTED' || loan.status === 'RETURN_RECEIVED') && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLoanForVerification(loan);
                                setVerificationNotes('');
                              }}
                              leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                            >
                              Verifikasi Penerimaan
                            </Button>
                          )}

                          {loan.status === 'COMPLETED' && (
                            <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Selesai
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

      {/* CONFIRMATION MODAL: VERIFIKASI PENERIMAAN LANGSUNG */}
      <Modal
        isOpen={Boolean(selectedLoanForVerification)}
        onClose={() => {
          if (!verifyMutation.isPending) setSelectedLoanForVerification(null);
        }}
        title="Konfirmasi Verifikasi Penerimaan Barang"
        description="Periksa kesesuaian fisik barang, kode aset, dan peminjaman sebelum menyelesaikan pengembalian."
        maxWidth="md"
      >
        {selectedLoanForVerification && (
          <div className="space-y-4 text-xs">
            {/* Identity & Loan Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px]">Identitas Peminjam:</span>
                <strong className="text-slate-900 text-sm block">
                  {selectedLoanForVerification.borrowerName}
                </strong>
                <span className="text-slate-500 font-mono text-[11px] block">
                  No: {selectedLoanForVerification.loanNumber}
                </span>
                <span className="text-slate-400 text-[10px]">
                  Dipinjam: {formatDate(selectedLoanForVerification.requestedAt)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Identitas Barang:</span>
                <strong className="text-slate-900 text-sm block">
                  {selectedLoanForVerification.unit.itemName}
                </strong>
                <span className="text-blue-700 font-mono font-bold text-[11px] block">
                  Kode: {selectedLoanForVerification.unit.assetCode}
                </span>
                <span className="text-slate-500 text-[10px]">
                  Ruangan: {selectedLoanForVerification.unit.locationName}
                </span>
              </div>
            </div>

            {/* Standard Accessories Reference (jika terdaftar) */}
            {selectedLoanForVerification.unit.standardAccessories &&
              selectedLoanForVerification.unit.standardAccessories.length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1.5">
                  <span className="font-bold text-blue-900 block text-[11px]">
                    Kelengkapan Bawaan Barang:
                  </span>
                  <ul className="space-y-1 text-blue-800 text-[11px]">
                    {selectedLoanForVerification.unit.standardAccessories.map((acc, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{acc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Verification Notice */}
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Penyelesaian Otomatis Sekali Klik
              </div>
              <p>
                Setelah diverifikasi, transaksi pinjaman akan langsung <strong>Selesai (COMPLETED)</strong> dan status barang dipulihkan menjadi <strong>Tersedia (AVAILABLE)</strong> sehingga dapat segera dipinjamkan kembali.
              </p>
            </div>

            {/* Optional Verification Notes */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Catatan Penerimaan / Verifikasi (Opsional)
              </label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Contoh: Fisik barang diterima lengkap dan dalam kondisi baik..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 text-xs"
              />
            </div>

            {/* Error Message if verification failed */}
            {verifyMutation.isError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Gagal Memverifikasi:</strong>
                  <span>{(verifyMutation.error as Error)?.message || 'Terjadi kesalahan sistem.'}</span>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLoanForVerification(null)}
                disabled={verifyMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                isLoading={verifyMutation.isPending}
                onClick={() =>
                  verifyMutation.mutate({
                    loanId: selectedLoanForVerification.id,
                    notes: verificationNotes,
                  })
                }
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                leftIcon={<PackageCheck className="w-4 h-4" />}
              >
                Konfirmasi & Selesaikan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
