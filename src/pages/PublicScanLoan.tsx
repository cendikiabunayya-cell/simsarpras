import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  LogIn,
  MapPin,
  QrCode,
  RotateCcw,
  Search,
  Smartphone,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSchoolSettings } from '../hooks/useSchoolSettings';
import { AssetUnit, LoanRequest, UserProfile } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
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

export const PublicScanLoan: React.FC = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ tokenOrCode?: string }>();
  const codeFromUrl = searchParams.get('code') || searchParams.get('token') || params.tokenOrCode;

  const queryClient = useQueryClient();
  const { allUsers } = useAuth();
  const { schoolName, logoUrl } = useSchoolSettings();

  // Scanner & Asset lookup state
  const [manualCode, setManualCode] = useState(codeFromUrl || '');
  const [isScanningActive, setIsScanningActive] = useState(!codeFromUrl);
  const [scannedAsset, setScannedAsset] = useState<AssetUnit | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [associatedLoan, setAssociatedLoan] = useState<LoanRequest | null>(null);

  // Form Peminjaman Mandiri (Tanpa Login)
  const [borrowerName, setBorrowerName] = useState<string>('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(getDefaultReturnDate);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);

  // Return modal state (jika barang sedang dipinjam)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');

  // UI state
  const [showFullSpecs, setShowFullSpecs] = useState(false);
  const [showOtherScanner, setShowOtherScanner] = useState(!codeFromUrl);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [lastSubmittedLoan, setLastSubmittedLoan] = useState<LoanRequest | null>(null);

  const PURPOSE_PRESETS = [
    'Mengajar di Kelas',
    'Praktikum Lab TIK',
    'Ujian / Asesmen',
    'Rapat / Kegiatan',
  ];

  const handleQuickReturnDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(15, 0, 0, 0);
    setExpectedReturnDate(getLocalDateTimeString(d));
  };

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

  // Handle Lookup
  const handleLookup = async (codeOrToken: string, preserveFeedback = false) => {
    if (!codeOrToken.trim()) return;
    setScanError(null);
    if (!preserveFeedback) {
      setFeedbackSuccess(null);
      setLastSubmittedLoan(null);
    }

    try {
      const asset = await api.getAssetByCodeOrQr(codeOrToken.trim());
      setScannedAsset(asset);
      setShowOtherScanner(false);

      // Prioritas 1: Ambil data pinjaman aktif langsung dari payload asset (dukungan scan publik tanpa login)
      const activeLoanFromAsset = (asset as any)?.activeLoan;
      if (activeLoanFromAsset) {
        setAssociatedLoan(activeLoanFromAsset);
      } else {
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
      }
    } catch (err) {
      setScannedAsset(null);
      setAssociatedLoan(null);
      setScanError((err as Error).message);
    }
  };

  useEffect(() => {
    if (codeFromUrl) {
      setManualCode(codeFromUrl);
      handleLookup(codeFromUrl, true);
    }
  }, [codeFromUrl, allLoans]);

  // Submit Loan Mutation (Publik / Mandiri tanpa perlu login)
  const loanMutation = useMutation({
    mutationFn: async () => {
      if (!scannedAsset) throw new Error('Unit belum terpilih');
      const trimmedName = borrowerName.trim();
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
            id: `user-guest-${Date.now()}`,
            fullName: trimmedName,
            employeeNumber: '-',
            email: `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@sekolah.sch.id`,
            role: 'GURU_PEGAWAI',
            isActive: true,
            department: 'Guru / Pegawai',
          };

      return api.createLoanRequest({
        assetUnitId: scannedAsset.id,
        purpose: loanPurpose.trim() || 'Mengajar / Tugas Sekolah',
        expectedReturnAt: new Date(expectedReturnDate).toISOString(),
        borrower: borrowerUser,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setIsLoanModalOpen(false);
      setLastSubmittedLoan(res);

      const msg =
        res.loanModeSnapshot === 'DIRECT'
          ? `Peminjaman Berhasil Aktif (${res.loanNumber})! Mode DIRECT: Barang siap diambil dan langsung digunakan.`
          : `Pengajuan Peminjaman Terkirim (${res.loanNumber})! Mode ADMIN_APPROVAL: Menunggu persetujuan Admin Sarpras.`;
      setFeedbackSuccess(msg);
      handleLookup(scannedAsset!.assetCode, true);
    },
    onError: (err) => {
      setScanError((err as Error).message);
    },
  });

  // Submit Return Mutation
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!associatedLoan) throw new Error('Transaksi pinjaman aktif tidak ditemukan');
      const borrowerUser: UserProfile = {
        id: associatedLoan.borrowerId || 'guest',
        fullName: associatedLoan.borrowerName || 'Guru / Pegawai',
        employeeNumber: associatedLoan.borrowerEmployeeNumber || '-',
        email: 'guru@sekolah.sch.id',
        role: associatedLoan.borrowerRole || 'GURU_PEGAWAI',
        isActive: true,
      };

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
        `Pengembalian barang telah diajukan! Silakan serahkan barang fisik beserta kelengkapannya ke Admin Sarpras.`
      );
      handleLookup(scannedAsset!.assetCode, true);
    },
    onError: (err) => {
      setScanError((err as Error).message);
    },
  });

  const handleResetForNextScan = () => {
    setScannedAsset(null);
    setAssociatedLoan(null);
    setFeedbackSuccess(null);
    setLastSubmittedLoan(null);
    setScanError(null);
    setManualCode('');
    setShowOtherScanner(true);
    setIsScanningActive(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col justify-between text-slate-800 antialiased">
      {/* 1. HEADER KHUSUS STANDALONE (ISOLASI LENGKAP: TANPA MENU SISTEM & TANPA LOGIN) */}
      <header className="bg-white border-b border-slate-200/80 shadow-xs sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden relative">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={schoolName}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.scan-fallback-icon');
                    if (fallback) fallback.classList.remove('hidden');
                  }}
                />
              ) : null}
              <QrCode className={`w-5 h-5 ${logoUrl ? 'hidden scan-fallback-icon' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight leading-tight">
                  SI-SARPRAS
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Peminjaman Mandiri
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
                {schoolName}
              </p>
            </div>
          </div>

          {/* Badge Mode Publik */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tanpa Login</span>
          </div>
        </div>
      </header>

      {/* 2. KONTEN UTAMA: OPTIMAL UNTUK LAYAR SMARTPHONE (1 SCREEN VIEW) */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Banner Instruksi Singkat */}
        <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-blue-50 border border-emerald-200/70 rounded-xl p-3 sm:p-3.5 text-xs text-slate-700 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-[11px] sm:text-xs text-slate-700">
              Halaman khusus pemindaian QR code untuk guru & pegawai tanpa harus masuk ke menu admin.
            </span>
          </div>
          {scannedAsset && (
            <button
              onClick={handleResetForNextScan}
              className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-200 shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" /> Scan Lain
            </button>
          )}
        </div>

        {/* FEEDBACK SUKSES SETELAH PENGAJUAN */}
        {feedbackSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs shadow-sm animate-in fade-in space-y-2">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold text-emerald-950 text-sm">
                  Pengajuan Berhasil Disimpan!
                </h5>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {feedbackSuccess}
                </p>
                {lastSubmittedLoan && (
                  <div className="mt-2 p-2.5 bg-white/80 rounded-lg border border-emerald-200 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Nomor Transaksi:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {lastSubmittedLoan.loanNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Peminjam:</span>
                      <span className="font-semibold text-slate-900">
                        {lastSubmittedLoan.borrowerName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rencana Kembali:</span>
                      <span className="font-semibold text-slate-900">
                        {formatDate(lastSubmittedLoan.expectedReturnAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-emerald-200/60">
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetForNextScan}
                className="text-xs bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100/50"
              >
                Scan / Pinjam Barang Lain
              </Button>
            </div>
          </div>
        )}

        {/* ERROR LOOKUP */}
        {scanError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <strong className="block font-semibold">Data Tidak Ditemukan</strong>
              <p className="text-[11px]">{scanError}</p>
              <button
                onClick={() => {
                  setScanError(null);
                  setShowOtherScanner(true);
                }}
                className="mt-1 text-[11px] font-bold text-rose-700 underline"
              >
                Coba cari atau ketik kode barang lain
              </button>
            </div>
          </div>
        )}

        {/* KARTU BARANG HASIL SCAN */}
        {scannedAsset && (
          <Card className="border-blue-300 shadow-md overflow-hidden animate-in slide-in-from-top-2">
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

                {/* Status Operasional Pill */}
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
                </div>
              </div>

              {/* ACTION SECTION LANGSUNG DI KARTU (RINGKAS UNTUK 1 LAYAR HP) */}
              <div className="mt-3.5 pt-3 border-t border-slate-200/60">
                {/* 1. TERSEDIA -> TOMBOL AJUKAN PEMINJAMAN LANGSUNG */}
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
                          ? 'Siap langsung diserahterimakan'
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

                {/* 2. SEDANG DIPINJAM */}
                {(scannedAsset.operationalStatus === 'ON_LOAN' ||
                  scannedAsset.operationalStatus === 'RETURN_PENDING' ||
                  scannedAsset.operationalStatus === 'RETURN_INSPECTION' ||
                  Boolean(associatedLoan)) && (
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-xl p-3.5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-200 shrink-0" />
                        Unit Sedang Dipinjam{associatedLoan?.borrowerName ? `: ${associatedLoan.borrowerName}` : ''}
                      </div>
                      <p className="text-[11px] text-blue-100 mt-0.5">
                        {associatedLoan?.loanNumber ? `Nomor: ${associatedLoan.loanNumber} • ` : ''}
                        {associatedLoan?.expectedReturnAt
                          ? `Jatuh tempo: ${formatDate(associatedLoan.expectedReturnAt)}`
                          : 'Selesai menggunakan barang? Ajukan pengembalian langsung di sini.'}
                      </p>
                    </div>
                    {associatedLoan?.status === 'RETURN_REQUESTED' ? (
                      <span className="text-[11px] bg-amber-400 text-amber-950 font-bold px-3 py-1.5 rounded-lg shrink-0 shadow-2xs">
                        Menunggu Verifikasi Admin
                      </span>
                    ) : (
                      <Button
                        size="md"
                        onClick={() => setIsReturnModalOpen(true)}
                        className="w-full sm:w-auto bg-white text-blue-900 hover:bg-blue-50 font-bold px-5 py-2.5 text-xs shrink-0 rounded-lg shadow-sm"
                        leftIcon={<ArrowRight className="w-4 h-4 text-blue-700" />}
                      >
                        Ajukan Pengembalian
                      </Button>
                    )}
                  </div>
                )}

                {/* 3. DALAM PERBAIKAN / RUSAK */}
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

                {/* 3B. TIDAK TERSEDIA (DENGAN KETERANGAN) */}
                {scannedAsset.operationalStatus === 'UNAVAILABLE' && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-rose-950">
                        Unit Saat Ini Tidak Tersedia untuk Dipinjam
                      </strong>
                      {scannedAsset.notes ? (
                        <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                          Keterangan: <span className="font-semibold text-rose-950">{scannedAsset.notes}</span>
                        </p>
                      ) : (
                        <span className="text-[11px] text-rose-800">
                          Unit ini sedang ditandai sebagai tidak tersedia untuk penggunaan/peminjaman.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. DINONAKTIFKAN / DIHAPUS SECARA LOGIS */}
                {(scannedAsset.operationalStatus === 'INACTIVE' || scannedAsset.isDecommissioned) && (
                  <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs flex items-start gap-2.5">
                    <Archive className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="block font-bold text-slate-900">
                        Barang Telah Dinonaktifkan / Dihapus Secara Logis
                      </strong>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Unit ini memiliki identitas permanen sah di sistem, namun saat ini berstatus{' '}
                        <strong>Tidak Aktif / Diarsipkan</strong>.
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

            {/* Accordion Rincian Teknis & QR Code */}
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
                      <span className="font-semibold text-slate-700 block mb-0.5">
                        Spesifikasi / Ukuran:
                      </span>
                      <p className="text-slate-600 text-[11px]">{scannedAsset.technicalSpecs}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Satuan Pendidikan</span>
                      <span className="font-bold text-slate-800">
                        {scannedAsset.institution || 'MIS Cendikia Bunayya'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Merek / Pabrikan</span>
                      <span className="font-semibold text-slate-800">
                        {scannedAsset.itemBrand || '-'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Sumber Pendanaan</span>
                      <span className="font-bold text-amber-900">
                        {scannedAsset.fundingSource || '-'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Tahun Perolehan</span>
                      <span className="font-mono font-bold text-slate-800">
                        {scannedAsset.acquisitionYear || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg">
                    <QRCodeSVG value={getCanonicalQrUrl(scannedAsset)} size={48} />
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

        {/* TOGGLE SCANNER KAMERA LAIN (Jika sudah ada unit yang terbuka) */}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg shadow-2xs transition-colors"
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

        {/* 3. KAMERA SCANNER & INPUT MANUAL (Jika belum ada barang atau dibuka) */}
        {(!scannedAsset || showOtherScanner) && (
          <div className="space-y-4 animate-in fade-in">
            {/* Viewfinder Kamera */}
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="py-2.5 px-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <CardTitle className="text-xs text-white">
                    Pemindai Kamera Barcode / QR Code
                  </CardTitle>
                </div>
                <button
                  onClick={() => setIsScanningActive((prev) => !prev)}
                  className="text-[11px] text-slate-300 hover:text-white"
                >
                  {isScanningActive ? 'Jeda Kamera' : 'Aktifkan Kamera'}
                </button>
              </CardHeader>

              <CardContent className="p-0 bg-slate-950 flex flex-col items-center justify-center relative min-h-[220px]">
                {isScanningActive ? (
                  <div className="relative w-full h-[220px] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                    <div className="relative w-44 h-44 border-2 border-emerald-400 rounded-2xl flex items-center justify-center overflow-hidden shadow-2xl">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white" />

                      <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399] animate-bounce" />

                      <QrCode className="w-16 h-16 text-slate-700/60" />
                    </div>

                    <div className="absolute bottom-2 text-center text-[10px] text-slate-300 bg-slate-900/80 px-3 py-0.5 rounded-full backdrop-blur-sm">
                      Arahkan barcode / QR ke dalam kotak
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400">
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-500" />
                    <p className="text-xs">Kamera dijeda</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsScanningActive(true)}
                      className="mt-2 text-xs"
                    >
                      Nyalakan Kamera
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Input Manual Kode Barang */}
            <Card className="shadow-xs">
              <CardContent className="p-3.5 space-y-2.5">
                <div className="space-y-1 text-xs">
                  <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-500" />
                    Ketik Kode Inventaris / Nomor Barcode
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
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-emerald-600 uppercase"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleLookup(manualCode)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white"
                      leftIcon={<Search className="w-3.5 h-3.5" />}
                    >
                      Cari
                    </Button>
                  </div>
                </div>

                {/* Pil Contoh Cepat untuk Uji Coba (Hanya tampil jika data inventaris berupa array valid) */}
                {safeAssetsList.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Pilihan Cepat Contoh Barang:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {safeAssetsList.slice(0, 5).map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setManualCode(asset.assetCode);
                            handleLookup(asset.assetCode);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-mono text-[10px] border border-slate-200 transition-colors"
                        >
                          {asset.assetCode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* 4. MODAL PENGAJUAN PEMINJAMAN (RINGKAS & MUDAH DI HP) */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title="Ajukan Peminjaman Barang"
        maxWidth="md"
      >
        {scannedAsset && (
          <div className="space-y-3.5 text-xs">
            {/* Unit Info Ringkas */}
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-xs block truncate">
                  {scannedAsset.itemName}
                </span>
                <span className="text-slate-500 font-mono text-[11px] block truncate">
                  {scannedAsset.assetCode} • {scannedAsset.locationName}
                </span>
              </div>
              <Badge
                variant={scannedAsset.effectiveLoanMode === 'DIRECT' ? 'success' : 'info'}
                className="shrink-0 text-[10px]"
              >
                Mode: {scannedAsset.effectiveLoanMode}
              </Badge>
            </div>

            {/* NAMA PEMINJAM (TEKS BOX BEBAS KETIK / PILIH DARI DAFTAR GURU) */}
            <div>
              <label
                htmlFor="borrower-name-input"
                className="block text-slate-700 font-semibold flex items-center gap-1.5 text-xs mb-1"
              >
                <User className="w-3.5 h-3.5 text-emerald-700" />
                Nama Peminjam (Guru / Pegawai) <span className="text-rose-500">*</span>
              </label>
              <input
                id="borrower-name-input"
                type="text"
                autoComplete="off"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                placeholder="Ketik nama lengkap peminjam..."
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                required
              />
            </div>

            {/* KEPERLUAN DENGAN 1-TAP CHIPS */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1 text-xs">
                Keperluan / Tujuan Pinjam <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {PURPOSE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLoanPurpose(preset)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors ${
                      loanPurpose === preset
                        ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-2xs'
                        : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 border-slate-200'
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
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                required
              />
            </div>

            {/* RENCANA PENGEMBALIAN */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold text-xs">
                  Rencana Waktu Pengembalian <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(0)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200"
                  >
                    Hari ini (15:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(1)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200"
                  >
                    Besok
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickReturnDate(2)}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200"
                  >
                    2 Hari
                  </button>
                </div>
              </div>
              <input
                type="datetime-local"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
              />
            </div>

            {/* TOMBOL AKSI */}
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

      {/* 5. MODAL PENGAJUAN PENGEMBALIAN */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Konfirmasi Pengembalian Barang"
        description="Serahkan unit fisik barang ke Admin Sarpras setelah mengajukan pengembalian."
        maxWidth="md"
      >
        {scannedAsset && associatedLoan && (
          <div className="space-y-3.5 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 leading-relaxed">
              <strong>Pemberitahuan:</strong> Harap serahkan unit fisik beserta kelengkapannya ke Admin Sarpras untuk verifikasi pengembalian.
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Nomor Transaksi:</span>
                <span className="font-mono font-bold text-slate-900">
                  {associatedLoan.loanNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Barang:</span>
                <span className="font-semibold text-slate-900">{scannedAsset.itemName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Peminjam:</span>
                <span className="font-semibold text-slate-900">{associatedLoan.borrowerName}</span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Catatan Pengembalian (Opsional)
              </label>
              <textarea
                rows={2}
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Contoh: Kondisi baik, charger dan tas lengkap..."
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsReturnModalOpen(false)}
                disabled={returnMutation.isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                isLoading={returnMutation.isPending}
                onClick={() => returnMutation.mutate()}
                className="bg-blue-800 hover:bg-blue-900 text-white"
              >
                Konfirmasi Pengembalian
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. FOOTER KHUSUS STANDALONE (ISOLASI DARI MENU ADMIN) */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-4 text-center text-xs text-slate-500 space-y-1.5">
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} SI-SARPRAS {schoolName} • Layanan Scan Peminjaman Mandiri
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 hover:underline transition-colors"
          >
            <LogIn className="w-3 h-3" />
            <span>Login Petugas / Admin Sarpras</span>
          </Link>
        </div>
      </footer>
    </div>
  );
};
