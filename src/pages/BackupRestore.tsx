import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck,
  HardDrive,
  Info,
  RefreshCw,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { BackupPayload, RestoreMode, BackupSummary } from '../types';

export const BackupRestore: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk restore
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<BackupPayload | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('clean');
  const [confirmAgreement, setConfirmAgreement] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // State feedback pesan
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Ambil ringkasan database saat ini
  const {
    data: summary,
    isLoading: isLoadingSummary,
    isRefetching: isRefetchingSummary,
    refetch: refetchSummary,
  } = useQuery<BackupSummary>({
    queryKey: ['backup-summary'],
    queryFn: () => api.getBackupSummary(),
  });

  // Mutasi Ekspor Cadangan
  const exportMutation = useMutation({
    mutationFn: async () => {
      setExportSuccess(null);
      setActionError(null);
      return await api.exportBackup();
    },
    onSuccess: (data) => {
      // Buat file Blob dan unduh otomatis ke komputer pengguna
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `backup-simsarpras-${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const totalItems =
        (data.counts?.assets || 0) +
        (data.counts?.users || 0) +
        (data.counts?.loans || 0);

      setExportSuccess(
        `Berkas cadangan "${filename}" berhasil diunduh (${totalItems} total entitas data tersimpan aman).`
      );
      refetchSummary();
    },
    onError: (err: any) => {
      setActionError(err?.message || 'Gagal membuat berkas cadangan data.');
    },
  });

  // Mutasi Pemulihan Cadangan (Restore)
  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!parsedBackup) {
        throw new Error('Belum ada berkas cadangan valid yang dipilih.');
      }
      return await api.restoreBackup(parsedBackup, restoreMode);
    },
    onSuccess: (res) => {
      setShowConfirmModal(false);
      setSelectedFile(null);
      setParsedBackup(null);
      setConfirmAgreement(false);
      setFileError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setRestoreSuccess(
        `Basis data SIMSARPRAS berhasil dipulihkan secara penuh (Mode: ${restoreMode === 'clean' ? 'Timpa Bersih Total' : 'Gabung/Upsert'}). ${res.message || ''}`
      );
      // Invalidate semua query cache agar UI di halaman lain langsung terupdate
      queryClient.invalidateQueries();
      refetchSummary();
    },
    onError: (err: any) => {
      setShowConfirmModal(false);
      setActionError(err?.message || 'Gagal memulihkan basis data.');
    },
  });

  // Penanganan pembacaan berkas JSON yang diunggah
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    setRestoreSuccess(null);
    setActionError(null);

    if (!file) {
      setSelectedFile(null);
      setParsedBackup(null);
      return;
    }

    if (!file.name.endsWith('.json')) {
      setFileError('Format berkas harus berupa file JSON (.json).');
      setSelectedFile(null);
      setParsedBackup(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as BackupPayload;

        // Validasi struktur berkas SIMSARPRAS
        if (
          parsed.signature !== 'SIMSARPRAS_BACKUP_V2' &&
          parsed.system !== 'SIMSARPRAS_SMART_CAMPUS' &&
          !parsed.data?.assets
        ) {
          setFileError(
            'Berkas ini bukan berkas cadangan resmi SIMSARPRAS atau strukturnya tidak cocok.'
          );
          setParsedBackup(null);
          return;
        }

        setParsedBackup(parsed);
      } catch (err: any) {
        setFileError(`Gagal membaca berkas JSON: ${err.message || 'Format JSON rusak'}`);
        setParsedBackup(null);
      }
    };
    reader.onerror = () => {
      setFileError('Terjadi kesalahan saat membaca berkas.');
      setParsedBackup(null);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Cadangkan & Pulihkan Seluruh Data
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Pencadangan (backup) dan pemulihan (restore) komprehensif basis data SIMSARPRAS
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchSummary()}
          disabled={isLoadingSummary || isRefetchingSummary}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${isLoadingSummary || isRefetchingSummary ? 'animate-spin text-blue-600' : ''}`}
          />
          Segarkan Ringkasan
        </Button>
      </div>

      {/* Pesan Sukses / Error Umum */}
      {exportSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">Cadangan Berhasil: </span>
            {exportSuccess}
          </div>
        </div>
      )}

      {restoreSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm text-emerald-900">
            <span className="font-semibold">Pemulihan Sukses: </span>
            {restoreSuccess}
          </div>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fadeIn">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <span className="font-semibold">Terjadi Kesalahan: </span>
            {actionError}
          </div>
        </div>
      )}

      {/* Ringkasan Data Saat Ini */}
      <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-slate-50 to-white">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base text-slate-800">
                Status & Ringkasan Entitas Data Aktif
              </CardTitle>
            </div>
            <span className="text-xs px-2.5 py-1 bg-blue-100/70 text-blue-800 font-medium rounded-full">
              PostgreSQL Terkoneksi
            </span>
          </div>
          <CardDescription>
            Jumlah seluruh rekaman data yang tersimpan di dalam sistem saat ini dan siap dicadangkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Data Barang/Aset</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.assets ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Pengguna</p>
              <p className="text-xl font-bold text-blue-600 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.users ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Peminjaman</p>
              <p className="text-xl font-bold text-amber-600 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.loans ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Kategori</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.categories ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Ruang/Lokasi</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.locations ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Sumber Dana</p>
              <p className="text-xl font-bold text-slate-700 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.fundingSources ?? 0}
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs text-center">
              <p className="text-xs text-slate-500 font-medium">Audit Aktivitas</p>
              <p className="text-xl font-bold text-indigo-600 mt-1">
                {isLoadingSummary ? '...' : summary?.counts.auditLogs ?? 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid 2 Kolom: Card Backup & Card Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ======================================================== */}
        {/* CARD 1: CADANGKAN DATA (BACKUP / EXPORT) */}
        {/* ======================================================== */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900">
                    1. Cadangkan Seluruh Data (Backup)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Ekspor seluruh basis data ke dalam satu berkas terenkripsi aman (.json)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-medium text-slate-800 text-xs">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  Isi Cakupan Berkas Cadangan:
                </div>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pl-1">
                  <li>Data Seluruh Barang / Aset Sarpras beserta nomor barang & status</li>
                  <li>Data Pengguna, Guru, dan Akun Administrator</li>
                  <li>Riwayat Siklus Peminjaman & Bukti Berita Acara</li>
                  <li>Master Data (Kategori, Lokasi/Ruangan, Sumber Pendanaan BOS)</li>
                  <li>Pengaturan Profil Lembaga / Madrasah & Jejak Rekam Audit</li>
                </ul>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Berkas cadangan dapat disimpan pada Google Drive, hard disk eksternal, atau flashdisk
                madrasah sebagai jaminan kesinambungan operasional saat pergantian perangkat server.
              </p>
            </CardContent>
          </div>

          <div className="p-6 pt-0 border-t border-slate-100 mt-4">
            <Button
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 shadow-sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sedang Menyiapkan Berkas Cadangan...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Unduh Berkas Cadangan Lengkap (.json)
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ======================================================== */}
        {/* CARD 2: PULIHKAN DATA (RESTORE / IMPORT) */}
        {/* ======================================================== */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-slate-900">
                    2. Pulihkan Data dari Cadangan (Restore)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Unggah berkas cadangan SIMSARPRAS (.json) untuk memulihkan sistem
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Dropzone / File Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Berkas Cadangan (.json)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    selectedFile
                      ? 'border-blue-400 bg-blue-50/40'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-slate-800">
                      <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium truncate max-w-xs">{selectedFile.name}</span>
                      <span className="text-2xs text-slate-400">
                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-2">
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <p className="text-xs font-medium text-slate-700">
                        Klik untuk memilih berkas cadangan JSON
                      </p>
                      <p className="text-2xs text-slate-400 mt-0.5">
                        Mendukung berkas resmi backup-simsarpras-*.json
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Error format berkas jika ada */}
              {fileError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{fileError}</span>
                </div>
              )}

              {/* Pratinjau Metadata Berkas yang Diunggah */}
              {parsedBackup && (
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-blue-900 border-b border-blue-200/60 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      Validasi Berkas: Berhasil Dikenali
                    </span>
                    <span className="text-2xs bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded">
                      v{parsedBackup.version || '2.1.0'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600">
                    <div>
                      <span className="text-slate-400">Tanggal Ekspor:</span>{' '}
                      <span className="font-medium text-slate-800">
                        {new Date(parsedBackup.exportedAt).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Dibuat Oleh:</span>{' '}
                      <span className="font-medium text-slate-800">
                        {parsedBackup.exportedBy?.name || 'Admin'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Jumlah Aset:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {parsedBackup.counts?.assets ?? parsedBackup.data?.assets?.length ?? 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Jumlah Peminjaman:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {parsedBackup.counts?.loans ?? parsedBackup.data?.loans?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pilihan Metode Pemulihan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Metode Pemulihan Data
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setRestoreMode('clean')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      restoreMode === 'clean'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-medium ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs">Timpa Bersih (Clean)</div>
                    <div className="text-2xs text-slate-500 mt-0.5">
                      Ganti seluruh data dengan isi berkas cadangan (Disarankan).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRestoreMode('merge')}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      restoreMode === 'merge'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-medium ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-semibold text-xs">Gabungkan (Merge)</div>
                    <div className="text-2xs text-slate-500 mt-0.5">
                      Perbarui rekaman yang ada & sisipkan yang baru tanpa menghapus.
                    </div>
                  </button>
                </div>
              </div>

              {/* Checkbox Konfirmasi Pemahaman Risiko */}
              {parsedBackup && (
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmAgreement}
                      onChange={(e) => setConfirmAgreement(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-700 leading-snug">
                      Saya mengerti bahwa proses pemulihan akan memperbarui database sistem dan tidak
                      dapat dibatalkan setelah dimulai.
                    </span>
                  </label>
                </div>
              )}
            </CardContent>
          </div>

          <div className="p-6 pt-0 border-t border-slate-100 mt-4">
            <Button
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 shadow-sm"
              disabled={!parsedBackup || !confirmAgreement || restoreMutation.isPending}
              onClick={() => setShowConfirmModal(true)}
            >
              {restoreMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sedang Memulihkan Basis Data...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Pulihkan Basis Data Sekarang
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal Konfirmasi Eksekusi Restore */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 animate-scaleUp">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="p-2.5 bg-amber-100 rounded-full">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Konfirmasi Pemulihan Data
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Anda akan memulihkan data SIMSARPRAS dari berkas{' '}
              <strong className="text-slate-800">{selectedFile?.name}</strong> menggunakan metode{' '}
              <strong className="text-slate-800">
                {restoreMode === 'clean' ? 'Timpa Bersih Total (Clean)' : 'Gabung (Merge)'}
              </strong>
              .
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-5">
              Seluruh transaksi berjalan akan disinkronkan secara atomik dalam satu transaksi basis
              data. Lanjutkan proses ini?
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={restoreMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                onClick={() => restoreMutation.mutate()}
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memulihkan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Ya, Jalankan Pemulihan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BackupRestore;
