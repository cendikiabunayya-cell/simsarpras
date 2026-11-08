import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Pencil,
  QrCode,
  Search,
  Smartphone,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AssetUnit, LoanRequest, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EditAssetModal } from '../components/modals/EditAssetModal';
import { getCanonicalQrUrl } from '../services/qrUrlService';
import {
  formatDate,
  getConditionBadge,
  getOperationalBadge,
} from '../lib/utils';

const getLocalDateTimeString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultReturnDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(15, 0, 0, 0);
  return getLocalDateTimeString(d);
};

export const QrScanner: React.FC = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ tokenOrCode?: string }>();
  const codeFromUrl = searchParams.get('code') || searchParams.get('token') || params.tokenOrCode;

  const queryClient = useQueryClient();
  const { currentUser, allUsers } = useAuth();

  // Scanner state
  const [manualCode, setManualCode] = useState(codeFromUrl || '');
  const [isScanningActive, setIsScanningActive] = useState(!codeFromUrl);
  const [scannedAsset, setScannedAsset] = useState<AssetUnit | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Active loan lookup for the scanned unit (if on loan)
  const [associatedLoan, setAssociatedLoan] = useState<LoanRequest | null>(null);

  // Nama peminjam yang dapat diketik bebas (text box) atau dipilih dari daftar Guru / Pegawai
  const [borrowerName, setBorrowerName] = useState<string>(currentUser?.fullName || '');

  // Pilihan cepat keperluan untuk 1-klik di HP tanpa perlu mengetik panjang
  const PURPOSE_PRESETS = [
    'Mengajar di Kelas',
    'Praktikum Lab TIK',
    'Ujian / Asesmen',
    'Rapat / Kegiatan',
  ];

  // State untuk tata letak ringkas 1 layar HP
  const [showFullSpecs, setShowFullSpecs] = useState(false);
  const [showOtherScanner, setShowOtherScanner] = useState(!codeFromUrl);

  // Loan Request Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanPurpose, setLoanPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(getDefaultReturnDate);

  const handleQuickReturnDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(15, 0, 0, 0);
    setExpectedReturnDate(getLocalDateTimeString(d));
  };

  // Return Request Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');

  // Edit Asset Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Success Feedback
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Queries
  const { data: allAssets } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.getAssets(),
    retry: false,
  });

  const { data: allLoans } = useQuery({
    queryKey: ['loans'],
    queryFn: () => api.getLoans(),
    retry: false,
  });

  const safeAssetsList: AssetUnit[] = Array.isArray(allAssets)
    ? allAssets
    : Array.isArray((allAssets as any)?.data)
    ? (allAssets as any).data
    : [];

  // Handle Scanning or Code Lookup
  const handleLookup = async (codeOrToken: string) => {
    if (!codeOrToken.trim()) return;
    setScanError(null);
    setFeedbackSuccess(null);

    try {
      const asset = await api.getAssetByCodeOrQr(codeOrToken.trim());
      setScannedAsset(asset);
      setShowOtherScanner(false); // Otomatis fokus ke kartu peminjaman ringkas agar muat di 1 layar HP

      // Find any active loan related to this unit
      const safeLoansList: LoanRequest[] = Array.isArray(allLoans)
        ? allLoans
        : Array.isArray((allLoans as any)?.data)
        ? (allLoans as any).data
        : [];

      if (safeLoansList.length > 0) {
        const foundLoan = safeLoansList.find(
          (l) =>
            l.unit?.id === asset.id &&
            (l.status === 'ACTIVE' ||
              l.status === 'READY_FOR_HANDOVER' ||
              l.status === 'RETURN_REQUESTED' ||
              l.status === 'RETURN_RECEIVED')
        );
        setAssociatedLoan(foundLoan || null);
      } else {
        setAssociatedLoan(null);
      }
    } catch (err) {
      setScannedAsset(null);
      setAssociatedLoan(null);
      setScanError((err as Error).message);
    }
  };

  // Auto-lookup if opened directly via Google Lens / Camera HP URL
  useEffect(() => {
    if (codeFromUrl) {
      setManualCode(codeFromUrl);
      handleLookup(codeFromUrl);
    }
  }, [codeFromUrl, allLoans]);

  // Submit Loan Mutation
  const loanMutation = useMutation({
    mutationFn: async () => {
      if (!scannedAsset) throw new Error('Unit belum terpilih');
      const trimmedName = borrowerName.trim() || currentUser.fullName;
      if (!trimmedName) throw new Error('Nama peminjam wajib diisi');

      // Cari apakah nama cocok dengan salah satu guru/pegawai yang sudah terdaftar
      const matchedUser = allUsers.find(
        (u) =>
          u.fullName.toLowerCase() === trimmedName.toLowerCase() ||
          `${u.fullName} (NIP: ${u.employeeNumber})`.toLowerCase() === trimmedName.toLowerCase() ||
          trimmedName.toLowerCase().startsWith(u.fullName.toLowerCase())
      );

      const borrowerUser: UserProfile = matchedUser
        ? { ...matchedUser, fullName: trimmedName }
        : {
            id: `user-custom-${Date.now()}`,
            fullName: trimmedName,
            employeeNumber: '-',
            email: `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@sekolah.sch.id`,
            role: 'GURU_PEGAWAI',
            isActive: true,
            department: 'Guru / Pegawai',
          };

      return api.createLoanRequest({
        assetUnitId: scannedAsset.id,
        purpose: loanPurpose,
        expectedReturnAt: new Date(expectedReturnDate).toISOString(),
        borrower: borrowerUser,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setIsLoanModalOpen(false);
      setLoanPurpose('');

      const msg =
        res.loanModeSnapshot === 'DIRECT'
          ? `Pengajuan berhasil (${res.loanNumber}). Mode DIRECT: Peminjaman langsung aktif dan barang siap digunakan.`
          : `Pengajuan berhasil (${res.loanNumber}). Mode ADMIN_APPROVAL: Menunggu persetujuan Admin Sarpras.`;
      setFeedbackSuccess(msg);
      handleLookup(scannedAsset!.assetCode);
    },
    onError: (err) => {
      setScanError((err as Error).message);
    },
  });

  // Submit Return Mutation (Guru initiates return)
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!associatedLoan) throw new Error('Transaksi pinjaman aktif tidak ditemukan');
      const borrowerUser = currentUser;

      return api.submitReturnRequest({
        loanId: associatedLoan.id,
        borrowerUser,
        notes: returnNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setIsReturnModalOpen(false);
      setReturnNotes('');
      setFeedbackSuccess(
        `Pengembalian barang telah diajukan! Silakan serahkan barang fisik ke Admin Sarpras untuk verifikasi penerimaan.`
      );
      handleLookup(scannedAsset!.assetCode);
    },
    onError: (err) => {
      setScanError((err as Error).message);
    },
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 1. Header Ringkas (Hemat Ruang Vertikal untuk Layar HP) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Peminjaman via Barcode
          </h2>
          <p className="text-[11px] text-slate-500">
            Scan langsung dengan kamera HP / Google Lens tanpa perlu install aplikasi.
          </p>
        </div>
        {codeFromUrl && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shrink-0">
            <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
            Scan HP: <span className="font-mono">{codeFromUrl}</span>
          </span>
        )}
      </div>

      {/* Success Notification Alert */}
      {feedbackSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <h5 className="font-bold text-emerald-950 mb-0.5">Status Berhasil Disimpan</h5>
            <p className="text-[11px]">{feedbackSuccess}</p>
          </div>
        </div>
      )}

      {/* 2. KARTU BARANG HASIL SCAN & TOMBOL AJUAN PINJAM LANGSUNG DI ATAS (RINGKAS 1 LAYAR HP) */}
      {scannedAsset && (
        <Card className="border-blue-300 shadow-md overflow-hidden animate-in slide-in-from-top-2">
          {/* Card Top: Asset Info & Status */}
          <div className="p-4 bg-gradient-to-r from-blue-50/70 via-white to-slate-50 border-b border-blue-100">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono font-bold text-xs text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded">
                    {scannedAsset.assetCode}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      scannedAsset.institution === 'RA Cendikia Bunayya'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {scannedAsset.institution || 'MIS Cendikia Bunayya'}
                  </span>
                  <Badge
                    variant={
                      scannedAsset.conditionStatus === 'GOOD' ? 'success' : 'warning'
                    }
                  >
                    {getConditionBadge(scannedAsset.conditionStatus).label}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {scannedAsset.itemName}
                </h3>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{scannedAsset.locationName}</span>
                  {scannedAsset.itemBrand && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{scannedAsset.itemBrand}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status Pill & Edit Button */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                    getOperationalBadge(scannedAsset.operationalStatus).bg
                  } ${getOperationalBadge(scannedAsset.operationalStatus).text} ${
                    getOperationalBadge(scannedAsset.operationalStatus).border
                  }`}
                >
                  {getOperationalBadge(scannedAsset.operationalStatus).label}
                </span>
                {currentUser.role === 'ADMIN_SARPRAS' && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="text-[11px] text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium mt-0.5"
                  >
                    <Pencil className="w-3 h-3" /> Ubah Data
                  </button>
                )}
              </div>
            </div>

            {/* TOMBOL AKSI UTAMA DI ATAS - LANGSUNG TERLIHAT TANPA PERLU SCROLL */}
            <div className="mt-3.5 pt-3 border-t border-slate-200/60">
              {/* CASE 1: AVAILABLE -> Tombol Hijau Besar 'Ajukan Peminjaman' Langsung Terlihat */}
              {scannedAsset.operationalStatus === 'AVAILABLE' && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-xl p-3.5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                      Unit Tersedia untuk Dipinjam
                    </div>
                    <p className="text-[11px] text-emerald-100 mt-0.5">
                      Mode: <strong>{scannedAsset.effectiveLoanMode}</strong>{' '}
                      ({scannedAsset.effectiveLoanMode === 'DIRECT'
                        ? 'Siap diserahterimakan langsung'
                        : 'Perlu persetujuan Admin Sarpras'})
                    </p>
                  </div>
                  <Button
                    size="md"
                    onClick={() => setIsLoanModalOpen(true)}
                    className="w-full sm:w-auto bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-5 py-2.5 shadow-sm text-xs shrink-0 rounded-lg"
                    leftIcon={<Sparkles className="w-4 h-4 text-emerald-700" />}
                  >
                    Ajukan Peminjaman
                  </Button>
                </div>
              )}

              {/* CASE 2: ON_LOAN by CURRENT USER */}
              {scannedAsset.operationalStatus === 'ON_LOAN' &&
                associatedLoan &&
                (associatedLoan.borrowerId === currentUser.id ||
                  currentUser.role === 'ADMIN_SARPRAS') && (
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-xl p-3.5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-200 shrink-0" />
                        Unit Sedang Anda Pinjam ({associatedLoan.loanNumber})
                      </div>
                      <p className="text-[11px] text-blue-100 mt-0.5">
                        Jatuh tempo: {formatDate(associatedLoan.expectedReturnAt)}. Kembalikan ke petugas sarpras jika selesai.
                      </p>
                    </div>
                    <Button
                      size="md"
                      onClick={() => setIsReturnModalOpen(true)}
                      className="w-full sm:w-auto bg-white text-blue-900 hover:bg-blue-50 font-bold px-5 py-2.5 text-xs shrink-0 rounded-lg"
                      leftIcon={<ArrowRight className="w-4 h-4 text-blue-700" />}
                    >
                      Ajukan Pengembalian
                    </Button>
                  </div>
                )}

              {/* CASE 3: ON_LOAN by SOMEONE ELSE */}
              {scannedAsset.operationalStatus === 'ON_LOAN' &&
                associatedLoan &&
                associatedLoan.borrowerId !== currentUser.id &&
                currentUser.role !== 'ADMIN_SARPRAS' && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-amber-950">
                        Unit Sedang Dipinjam: {associatedLoan.borrowerName}
                      </strong>
                      <span className="text-[11px] text-amber-800">
                        Jatuh tempo: {formatDate(associatedLoan.expectedReturnAt)}. Barang ini belum dapat dipinjam.
                      </span>
                    </div>
                  </div>
                )}

              {/* CASE 4: MAINTENANCE */}
              {scannedAsset.operationalStatus === 'MAINTENANCE' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-rose-950">
                      Unit Dalam Perbaikan / Rusak
                    </strong>
                    <span className="text-[11px] text-rose-800">
                      Unit ini sedang dalam perawatan teknis dan tidak dapat dipinjam.
                    </span>
                  </div>
                </div>
              )}

              {/* CASE 4B: UNAVAILABLE (TIDAK TERSEDIA DENGAN KETERANGAN) */}
              {scannedAsset.operationalStatus === 'UNAVAILABLE' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold text-rose-950">
                      Unit Saat Ini Tidak Tersedia untuk Dipinjam
                    </strong>
                    {scannedAsset.notes ? (
                      <p className="text-[11px] text-rose-800 font-medium">
                        Keterangan: <span className="font-semibold text-rose-950">{scannedAsset.notes}</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-rose-800">
                        Barang ini ditandai sebagai tidak tersedia oleh pengelola sarpras.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* CASE 5: INACTIVE / DECOMMISSIONED (BARANG DINONAKTIFKAN / DIHAPUS SECARA LOGIS) */}
              {(scannedAsset.operationalStatus === 'INACTIVE' || scannedAsset.isDecommissioned) && (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-start gap-2.5">
                  <Archive className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold text-slate-900">
                      Barang Telah Dinonaktifkan / Dihapus Secara Logis
                    </strong>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Unit ini memiliki identitas permanen sah di sistem, namun saat ini berstatus <strong>Tidak Aktif / Diarsipkan</strong>.
                      {scannedAsset.decommissionedReason && (
                        <span className="block mt-1 font-medium text-slate-800">
                          Alasan: {scannedAsset.decommissionedReason}
                        </span>
                      )}
                      {scannedAsset.decommissionedAt && (
                        <span className="block text-slate-500 text-[10px]">
                          Waktu Penonaktifan: {formatDate(scannedAsset.decommissionedAt)}
                        </span>
                      )}
                    </p>
                    <span className="inline-block text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 mt-1">
                      🛡️ QR Code ini tetap permanen merujuk ke data historis unit ini dan tidak akan dialihkan ke barang lain.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Accordion untuk Spesifikasi Teknis */}
          <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowFullSpecs((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                {showFullSpecs ? 'Sembunyikan Rincian Teknis' : 'Lihat Rincian Teknis & Kode QR'}
              </span>
              {showFullSpecs ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showFullSpecs && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-3 animate-in fade-in text-xs">
                {scannedAsset.technicalSpecs && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <span className="font-semibold text-slate-700 block mb-0.5">Spesifikasi / Ukuran:</span>
                    <p className="text-slate-600 text-[11px]">{scannedAsset.technicalSpecs}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Satuan Pendidikan</span>
                    <span className="font-bold text-slate-800">{scannedAsset.institution || 'MIS Cendikia Bunayya'}</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Merek / Pabrikan</span>
                    <span className="font-semibold text-slate-800">{scannedAsset.itemBrand}</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Sumber Pendanaan</span>
                    <span className="font-bold text-amber-900">{scannedAsset.fundingSource}</span>
                  </div>
                  <div className="p-2 rounded bg-white border border-slate-200">
                    <span className="text-slate-400 block text-[10px]">Tahun Perolehan</span>
                    <span className="font-mono font-bold text-slate-800">{scannedAsset.acquisitionYear}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                  <QRCodeSVG
                    value={getCanonicalQrUrl(scannedAsset)}
                    size={48}
                  />
                  <div className="text-[11px] text-slate-500">
                    <strong className="block text-slate-800">Link Pemindaian QR Code</strong>
                    <code className="text-[10px] text-blue-700 break-all">
                      {getCanonicalQrUrl(scannedAsset)}
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tombol Toggle Buka/Tutup Scanner Kamera Lain */}
      {scannedAsset && (
        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => {
              setShowOtherScanner((prev) => !prev);
              if (!showOtherScanner) {
                setIsScanningActive(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg shadow-xs transition-colors"
          >
            <Camera className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {showOtherScanner
                ? 'Tutup Scanner Kamera'
                : '📷 Scan Barcode Barang Lain / Input Manual'}
            </span>
          </button>
        </div>
      )}

      {/* 3. SCANNER KAMERA & PENCARIAN MANUAL (Tampil jika belum ada barang discan atau dibuka lewat toggle) */}
      {(!scannedAsset || showOtherScanner) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-in fade-in">
          {/* Camera Viewfinder Mock */}
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-400" />
                <CardTitle className="text-xs text-white">Viewfinder Kamera QR / Barcode</CardTitle>
              </div>
              <button
                onClick={() => setIsScanningActive((prev) => !prev)}
                className="text-[11px] text-slate-300 hover:text-white"
              >
                {isScanningActive ? 'Jeda Kamera' : 'Aktifkan Kamera'}
              </button>
            </CardHeader>

            <CardContent className="p-0 bg-slate-950 flex flex-col items-center justify-center relative min-h-[280px]">
              {isScanningActive ? (
                <div className="relative w-full h-[280px] flex items-center justify-center p-6">
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                  {/* Focus Target Frame */}
                  <div className="relative w-48 h-48 border-2 border-blue-400 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white" />

                    {/* Animated Laser Scanning Line */}
                    <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_#38bdf8] animate-bounce" />

                    <QrCode className="w-20 h-20 text-slate-700/60" />
                  </div>

                  <div className="absolute bottom-3 text-center text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-sm">
                    Posisikan Barcode / QR di dalam kotak
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Camera className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="text-xs">Kamera dalam mode jeda</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsScanningActive(true)}
                    className="mt-3 text-xs"
                  >
                    Nyalakan Kamera
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual Input Fallback & Fast Demo Buttons */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs">Input Manual Kode Inventaris / Barcode</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1 text-xs">
                  <label className="text-slate-600 font-medium">
                    Kode Barang atau Nomor Barcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLookup(manualCode);
                      }}
                      placeholder="Contoh: INV-TIK-2024-001"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-600 uppercase"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleLookup(manualCode)}
                      leftIcon={<Search className="w-3.5 h-3.5" />}
                    >
                      Cari
                    </Button>
                  </div>
                </div>

                {/* Fast click pills for quick demonstration (Hanya tampil jika data inventaris berupa array valid) */}
                {safeAssetsList.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                      Klik Cepat Contoh Barang untuk Uji Coba:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {safeAssetsList.slice(0, 6).map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setManualCode(asset.assetCode);
                            handleLookup(asset.assetCode);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-mono text-[10px] border border-slate-200 transition-colors"
                        >
                          {asset.assetCode} ({asset.operationalStatus})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Message if lookup failed */}
            {scanError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Tidak Ditemukan</strong>
                  <span>{scanError}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. FORM MODAL: AJUKAN PEMINJAMAN DARI SCAN (RINGKAS 1 LAYAR HP TANPA PERLU SCROLL) */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title="Ajukan Peminjaman Barang"
        maxWidth="md"
      >
        {scannedAsset && (
          <div className="space-y-3 text-xs">
            {/* Unit Snapshot Ringkas 1 Baris */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-xs block truncate">
                  {scannedAsset.itemName}
                </span>
                <span className="text-slate-500 font-mono text-[11px] block truncate">
                  {scannedAsset.assetCode} • {scannedAsset.locationName}
                </span>
              </div>
              <Badge variant={scannedAsset.effectiveLoanMode === 'DIRECT' ? 'success' : 'info'} className="shrink-0 text-[10px]">
                Mode: {scannedAsset.effectiveLoanMode}
              </Badge>
            </div>

            {/* Borrower Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="borrower-name-input" className="block text-slate-700 font-semibold flex items-center gap-1.5 text-xs">
                  <User className="w-3.5 h-3.5 text-blue-700" />
                  Nama Peminjam <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setBorrowerName(currentUser.fullName)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    borrowerName === currentUser.fullName
                      ? 'bg-blue-600 text-white border-blue-600 font-bold'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  Saya Sendiri ({currentUser.fullName.split(' ')[0]})
                </button>
              </div>
              <input
                id="borrower-name-input"
                type="text"
                list="borrower-datalist"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Ketik nama lengkap peminjam (contoh: Ibu Sarah, S.Pd)..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                required
              />
              <datalist id="borrower-datalist">
                {allUsers.map((u) => (
                  <option key={u.id} value={u.fullName}>
                    {u.fullName} (NIP: {u.employeeNumber}) — {u.department || u.role}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Purpose with 1-Tap Chips */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1 text-xs">
                Keperluan / Tujuan Pinjam <span className="text-rose-500">*</span>
              </label>
              {/* 1-Tap Quick Purpose Chips */}
              <div className="flex flex-wrap gap-1 mb-1.5">
                {PURPOSE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLoanPurpose(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      loanPurpose === preset
                        ? 'bg-blue-700 text-white border-blue-700 font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border-slate-200'
                    }`}
                  >
                    + {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={loanPurpose}
                onChange={(e) => setLoanPurpose(e.target.value)}
                placeholder="Pilih tombol di atas atau ketik keperluan..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
                required
              />
            </div>

            {/* Expected Return with 1-Tap Chips */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold text-xs">
                  Rencana Waktu Pengembalian <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(0)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200"
                  >
                    Hari ini (15:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(1)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200"
                  >
                    Besok
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(2)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200"
                  >
                    2 Hari
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsLoanModalOpen(false)}
                disabled={loanMutation.isPending}
                className="text-xs px-3 py-1.5"
              >
                Batal
              </Button>
              <Button
                size="sm"
                disabled={!borrowerName.trim() || !loanPurpose.trim() || loanMutation.isPending}
                isLoading={loanMutation.isPending}
                onClick={() => loanMutation.mutate()}
                className="bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold px-4 py-1.5 text-white"
              >
                Kirim Pengajuan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* FORM MODAL: AJUKAN PENGEMBALIAN DARI SCAN */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Form Pengajuan Pengembalian Barang"
        description="Konfirmasi bahwa Anda akan mengembalikan fisik unit barang ke Sarpras."
        maxWidth="lg"
      >
        {scannedAsset && associatedLoan && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 leading-relaxed">
              <strong>Pemberitahuan:</strong> Transaksi akan selesai setelah Admin Sarpras memverifikasi penerimaan fisik barang.
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Transaksi:</span>
                <span className="font-mono font-bold text-slate-900">
                  {associatedLoan.loanNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Barang:</span>
                <span className="font-semibold text-slate-900">{scannedAsset.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kode Inventaris:</span>
                <span className="font-mono text-slate-800">{scannedAsset.assetCode}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Catatan Kondisi Barang Saat Pengembalian (Opsional)
              </label>
              <textarea
                rows={3}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Contoh: Barang dalam kondisi baik, semua kelengkapan charger dan tas lengkap..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsReturnModalOpen(false)}
                disabled={returnMutation.isPending}
              >
                Batal
              </Button>
              <Button
                isLoading={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
                className="bg-blue-800 hover:bg-blue-900"
              >
                Konfirmasi Ajukan Pengembalian
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT ASSET MODAL */}
      <EditAssetModal
        isOpen={isEditModalOpen}
        asset={scannedAsset}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updated) => {
          setScannedAsset(updated);
        }}
      />
    </div>
  );
};
