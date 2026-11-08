import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, QrCode, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { SyncIndicator } from '../components/ui/SyncIndicator';
import { getAutoRefreshOptions } from '../hooks/useAutoRefreshQuery';
import { LoanRequest } from '../types';
import { formatDate, getLoanStatusBadge } from '../lib/utils';

export const MyLoans: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const [filterTab, setFilterTab] = useState<'active' | 'pending' | 'completed' | 'all'>('active');

  // Return modal state
  const [returningLoan, setReturningLoan] = useState<LoanRequest | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  const {
    data: allLoans,
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

  // Submit return mutation
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returningLoan) throw new Error('Data peminjaman belum dipilih');
      return api.submitReturnRequest({
        loanId: returningLoan.id,
        borrowerUser: currentUser,
        notes: returnNotes,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setReturningLoan(null);
      setReturnNotes('');
      setFeedbackSuccess(
        `Pengajuan pengembalian untuk barang "${res.unit.itemName}" (${res.loanNumber}) berhasil dikirim! Silakan serahkan barang fisik ke Admin Sarpras untuk verifikasi penerimaan.`
      );
    },
  });

  // Strict Rule: Teacher can only view their own transactions (PRD Rule 2 & Section 11)
  const myLoans = allLoans?.filter((l) => l.borrowerId === currentUser.id) || [];

  const filteredLoans = myLoans.filter((l) => {
    if (filterTab === 'active') return l.status === 'ACTIVE' || l.status === 'READY_FOR_HANDOVER';
    if (filterTab === 'pending') return l.status === 'PENDING_APPROVAL' || l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED';
    if (filterTab === 'completed') return l.status === 'COMPLETED' || l.status === 'REJECTED' || l.status === 'CANCELLED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Peminjaman Saya
            </h2>
            <SyncIndicator
              isFetching={isFetching}
              isLoading={isLoading}
              dataUpdatedAt={dataUpdatedAt}
              isError={isError}
              onRefresh={() => refetch()}
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar seluruh transaksi sarana dan prasarana yang dipinjam oleh Anda.
          </p>
        </div>

        <Link to="/qr-scan">
          <Button
            size="md"
            leftIcon={<QrCode className="w-4 h-4" />}
            className="bg-blue-800 hover:bg-blue-900 shadow-sm"
          >
            Scan QR Pinjam / Kembali
          </Button>
        </Link>
      </div>

      {/* Success Notification Alert */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-start justify-between gap-2.5 shadow-xs animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-emerald-950 mb-0.5">Pengajuan Terkirim</h5>
              <p className="text-[11px] leading-relaxed">{feedbackSuccess}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccess(null)}
            className="text-xs text-emerald-700 hover:text-emerald-950 font-bold px-1.5 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-xl w-fit text-xs font-semibold">
        <button
          type="button"
          onClick={() => setFilterTab('active')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filterTab === 'active'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Pinjaman Aktif
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('pending')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filterTab === 'pending'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Menunggu Proses
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('completed')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filterTab === 'completed'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Riwayat Selesai
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            filterTab === 'all'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Semua
        </button>
      </div>

      {/* Loan Cards Grid */}
      {isLoading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : filteredLoans.length === 0 ? (
        <EmptyState
          title="Tidak Ada Data Peminjaman"
          description={
            filterTab === 'active'
              ? 'Anda tidak sedang meminjam unit inventaris sekolah saat ini.'
              : 'Tidak ditemukan transaksi pada kategori ini.'
          }
          actionLabel="Scan QR Barang Sekarang"
          onAction={() => (window.location.href = '/qr-scan')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLoans.map((loan) => {
            const statusBadge = getLoanStatusBadge(loan.status);
            const isOverdue =
              loan.status === 'ACTIVE' &&
              new Date(loan.expectedReturnAt).getTime() < Date.now();
            const isActive = loan.status === 'ACTIVE';

            return (
              <Card
                key={loan.id}
                className={`overflow-hidden border transition-all hover:shadow-md ${
                  isOverdue ? 'border-rose-300' : 'border-slate-200'
                }`}
              >
                {/* Header */}
                <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-800">
                      {loan.loanNumber}
                    </span>
                    <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                      Mode: {loan.loanModeSnapshot}
                    </span>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Content */}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {loan.unit.itemName}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Kode: {loan.unit.assetCode} — Lokasi Asal: {loan.unit.locationName}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">
                    <strong>Tujuan:</strong> {loan.purpose}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tanggal Pinjam:</span>
                      <span className="font-medium text-slate-700">
                        {formatDate(loan.handover?.handedOverAt || loan.requestedAt)}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[11px]">Jatuh Tempo:</span>
                      <span
                        className={`font-semibold ${
                          isOverdue ? 'text-rose-600' : 'text-slate-800'
                        }`}
                      >
                        {formatDate(loan.expectedReturnAt)}
                      </span>
                      {isOverdue && (
                        <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                          ⚠️ Melewati Batas Waktu
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Serah Terima Notes if available */}
                  {loan.handover && (
                    <div className="p-2.5 rounded-lg bg-blue-50/50 border border-blue-100 text-[11px] text-blue-900">
                      <strong>Diserahkan oleh:</strong> {loan.handover.handedOverByName} pada{' '}
                      {formatDate(loan.handover.handedOverAt)}
                    </div>
                  )}

                  {/* Return Requested Status Banner */}
                  {(loan.status === 'RETURN_REQUESTED' || loan.status === 'RETURN_RECEIVED') && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Menunggu Verifikasi:</strong> Pengembalian barang telah diajukan. Silakan serahkan barang fisik ke Admin Sarpras untuk verifikasi penerimaan.
                      </div>
                    </div>
                  )}

                  {/* Return Completed Summary */}
                  {loan.status === 'COMPLETED' && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Pengembalian Selesai:</strong> Transaksi telah diverifikasi oleh Admin Sarpras. Barang telah kembali tersedia.
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Token QR: {loan.unit.qrToken}
                    </span>

                    {isActive && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setReturningLoan(loan);
                            setReturnNotes('');
                          }}
                          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                          className="text-xs bg-blue-800 hover:bg-blue-900 text-white font-semibold"
                        >
                          Ajukan Pengembalian
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: AJUKAN PENGEMBALIAN DARI RIWAYAT PINJAMAN */}
      <Modal
        isOpen={Boolean(returningLoan)}
        onClose={() => {
          if (!returnMutation.isPending) setReturningLoan(null);
        }}
        title="Ajukan Pengembalian Barang"
        description="Konfirmasi bahwa Anda akan mengembalikan fisik unit barang ke Sarpras."
        maxWidth="md"
      >
        {returningLoan && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Transaksi:</span>
                <span className="font-mono font-bold text-slate-900">{returningLoan.loanNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Barang:</span>
                <span className="font-semibold text-slate-900">{returningLoan.unit.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kode Inventaris:</span>
                <span className="font-mono text-slate-800">{returningLoan.unit.assetCode}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
              <strong>Informasi Alur:</strong> Setelah mengajukan pengembalian, status transaksi menjadi <strong>Menunggu Verifikasi</strong>. Transaksi akan langsung selesai saat Admin Sarpras memverifikasi penerimaan barang fisik.
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Catatan Kondisi Barang Saat Pengembalian (Opsional)
              </label>
              <textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Contoh: Kondisi baik, charger dan tas lengkap..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            {returnMutation.isError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{(returnMutation.error as Error)?.message || 'Gagal mengajukan pengembalian.'}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setReturningLoan(null)}
                disabled={returnMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                isLoading={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
                className="bg-blue-800 hover:bg-blue-900 text-white font-semibold"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Konfirmasi Ajukan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
