import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Save,
} from 'lucide-react';
import { api } from '../../services/api';
import { isValidHttpsUrl, getOptimizedImageUrl, getDirectViewUrl } from '../../lib/driveUtils';
import {
  AssetUnit,
  ConditionStatus,
  LoanMode,
  OperationalStatus,
  SCHOOL_UNITS,
  SchoolUnit,
} from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: AssetUnit | null;
  onOpenMasterModal?: (tab: 'funding' | 'location' | 'category') => void;
  onSuccess?: (updatedAsset: AssetUnit) => void;
}

export const EditAssetModal: React.FC<EditAssetModalProps> = ({
  isOpen,
  onClose,
  asset,
  onOpenMasterModal,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Form states
  const [itemName, setItemName] = useState('');
  const [institution, setInstitution] = useState<SchoolUnit | string>('MIS Cendikia Bunayya');
  const [categoryName, setCategoryName] = useState('');
  const [technicalSpecs, setTechnicalSpecs] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [fundingSource, setFundingSource] = useState('');
  const [acquisitionYear, setAcquisitionYear] = useState<number>(new Date().getFullYear());
  const [locationId, setLocationId] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [itemNumber, setItemNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [loanMode, setLoanMode] = useState<LoanMode>('DIRECT');
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('GOOD');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('AVAILABLE');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState(false);
  const [notes, setNotes] = useState('');

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Queries for select options
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.getLocations(),
  });

  const { data: fundingSources } = useQuery({
    queryKey: ['funding-sources'],
    queryFn: () => api.getFundingSources(),
  });

  // Populate form when asset is provided or changes
  useEffect(() => {
    if (asset) {
      setItemName(asset.itemName || '');
      setInstitution(asset.institution || 'MIS Cendikia Bunayya');
      setCategoryName(asset.categoryName || '');
      setTechnicalSpecs(asset.technicalSpecs || '');
      setItemBrand(asset.itemBrand || '');
      setFundingSource(asset.fundingSource || '');
      setAcquisitionYear(Number(asset.acquisitionYear) || new Date().getFullYear());
      setLocationId(asset.locationId || '');
      setAssetCode(asset.assetCode || '');
      setItemNumber(asset.itemNumber || '');
      setSerialNumber(asset.serialNumber || '');
      setLoanMode(asset.effectiveLoanMode || 'DIRECT');
      setConditionStatus(asset.conditionStatus || 'GOOD');
      setOperationalStatus(asset.operationalStatus || 'AVAILABLE');
      setPhotoUrl(asset.photoUrl || asset.photoPath || '');
      setPhotoPreviewFailed(false);
      setNotes(asset.notes || '');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [asset, isOpen]);

  // Update Asset Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!asset) throw new Error('Unit barang belum dipilih');
      if (!itemName.trim()) throw new Error('Nama barang/sarana wajib diisi');
      if (!technicalSpecs.trim()) throw new Error('Spesifikasi teknis / ukuran wajib diisi');
      if (!assetCode.trim()) throw new Error('Kode barang / inventaris wajib diisi');

      const loc = locations?.find((l) => l.id === locationId);
      if (!loc) throw new Error('Silakan pilih ruangan / lokasi penempatan');

      if (photoUrl.trim() && !isValidHttpsUrl(photoUrl.trim())) {
        throw new Error('Tautan foto harus menggunakan protokol aman HTTPS (https://).');
      }

      const trimmedCode = assetCode.trim().toUpperCase();
      // Menjaga permanentId dan qrToken barang yang sudah ada agar identitas QR fisik tidak rusak
      const finalQrToken =
        asset.assetCode && trimmedCode === asset.assetCode.toUpperCase() && asset.qrToken
          ? asset.qrToken
          : `QR-${trimmedCode}`;

      return api.updateAsset(asset.id, {
        itemName: itemName.trim(),
        institution,
        categoryName: categoryName || 'TIK/Multimedia',
        technicalSpecs: technicalSpecs.trim(),
        itemBrand: itemBrand.trim() || 'Standar',
        fundingSource: fundingSource || 'BOS Reguler',
        acquisitionYear: acquisitionYear || new Date().getFullYear(),
        locationId: loc.id,
        locationName: loc.name,
        assetCode: trimmedCode,
        itemNumber: itemNumber.trim() || null,
        qrToken: finalQrToken,
        permanentId: asset.permanentId,
        serialNumber: serialNumber.trim() || undefined,
        effectiveLoanMode: loanMode,
        conditionStatus,
        operationalStatus,
        photoUrl: photoUrl.trim() ? photoUrl.trim() : null,
        photoPath: photoUrl.trim() ? photoUrl.trim() : null,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSuccessMessage('Data barang berhasil diperbarui!');
      if (onSuccess) {
        onSuccess(updated);
      }
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 900);
    },
    onError: (err) => {
      setErrorMessage((err as Error).message || 'Gagal memperbarui data barang');
    },
  });

  const isFormValid =
    itemName.trim().length > 0 &&
    technicalSpecs.trim().length > 0 &&
    assetCode.trim().length > 0 &&
    locationId.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ubah Data Barang & Sarana"
      description={`Perbarui rincian spesifikasi, lokasi penempatan, kondisi, atau status inventaris unit ${asset?.assetCode || ''}.`}
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold">Gagal Menyimpan Perubahan</strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Warning if asset is currently ON_LOAN or RESERVED */}
        {asset && (asset.operationalStatus === 'ON_LOAN' || asset.operationalStatus === 'RESERVED') && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Unit Sedang Dalam Transaksi Aktif:</span>
              <span>
                Barang ini berstatus <strong>{asset.operationalStatus}</strong>. Mengubah status operasional
                secara manual dapat memengaruhi catatan peminjaman yang sedang berlangsung.
              </span>
            </div>
          </div>
        )}

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Nama Barang / Sarana */}
          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-medium mb-1">
              Nama Barang / Sarana <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Contoh: Laptop Guru ASUS ExpertBook, Proyektor Epson..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Satuan Pendidikan (Pilihan: RA Cendikia Bunayya & MIS Cendikia Bunayya) */}
          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-medium mb-1 flex items-center justify-between">
              <span>
                Satuan Pendidikan <span className="text-rose-500">*</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Menentukan nama sekolah di label stiker
              </span>
            </label>
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold text-blue-900 bg-blue-50/20"
            >
              {SCHOOL_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          {/* Kategori */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-medium">
                Kategori <span className="text-rose-500">*</span>
              </label>
              {onOpenMasterModal && (
                <button
                  type="button"
                  onClick={() => onOpenMasterModal('category')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Layers className="w-2.5 h-2.5" />
                  + Kelola Kategori
                </button>
              )}
            </div>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Merek / Pabrikan */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Merek / Pabrikan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={itemBrand}
              onChange={(e) => setItemBrand(e.target.value)}
              placeholder="Contoh: ASUS, Epson, Olympic..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Spesifikasi Teknis / Ukuran */}
          <div className="sm:col-span-2">
            <label className="block text-slate-700 font-medium mb-1">
              Spesifikasi Teknis / Ukuran <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={technicalSpecs}
              onChange={(e) => setTechnicalSpecs(e.target.value)}
              placeholder="Contoh: Core i5-1235U, RAM 16GB, SSD 512GB atau Ukuran: 120 x 60 x 75 cm..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
            />
          </div>

          {/* Sumber Pendanaan */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-medium">
                Sumber Pendanaan <span className="text-rose-500">*</span>
              </label>
              {onOpenMasterModal && (
                <button
                  type="button"
                  onClick={() => onOpenMasterModal('funding')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Coins className="w-2.5 h-2.5" />
                  + Kelola Sumber Dana
                </button>
              )}
            </div>
            <select
              value={fundingSource}
              onChange={(e) => setFundingSource(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium text-amber-900"
            >
              {fundingSources?.map((fs) => (
                <option key={fs.id} value={fs.name}>
                  {fs.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tahun Perolehan */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Tahun Perolehan <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="2000"
              max="2035"
              value={acquisitionYear}
              onChange={(e) => setAcquisitionYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Ruangan / Lokasi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-700 font-medium">
                Ruangan / Lokasi <span className="text-rose-500">*</span>
              </label>
              {onOpenMasterModal && (
                <button
                  type="button"
                  onClick={() => onOpenMasterModal('location')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Building2 className="w-2.5 h-2.5" />
                  + Kelola Ruangan
                </button>
              )}
            </div>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Pilih ruangan...</option>
              {locations?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          {/* Kode Barang / Kode Inventaris */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Kode Barang / Kode Inventaris Unit <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
              placeholder="Contoh: INV-TIK-2024-001 / KD-BRG-001"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Kode barang / inventaris unit wajib unik. Mengubah kode tetap mempertahankan token QR dan riwayat barang.
            </p>
          </div>

          {/* Nomor Barang (Ketik Manual) */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Nomor Barang <span className="text-slate-400 font-normal text-xs">(Ketik Manual, contoh: 01, 02)</span>
            </label>
            <input
              type="text"
              value={itemNumber}
              onChange={(e) => setItemNumber(e.target.value)}
              placeholder="Contoh: 01, 02, atau Laptop 01"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Nomor urut barang yang dicetak di pojok kanan atas label QR (kombinasi: Kategori + Nomor Barang, misal: <em>Laptop 01</em>).
            </p>
          </div>

          {/* Nomor Seri (SN) */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Nomor Seri / Serial Number (SN)</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Contoh: SN-88492031-X (opsional)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Mode Peminjaman */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Mode Peminjaman</label>
            <select
              value={loanMode}
              onChange={(e) => setLoanMode(e.target.value as LoanMode)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="DIRECT">DIRECT (Peminjaman Langsung)</option>
              <option value="ADMIN_APPROVAL">ADMIN_APPROVAL (Wajib Persetujuan Admin)</option>
            </select>
          </div>

          {/* Kondisi Fisik */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Kondisi Fisik</label>
            <select
              value={conditionStatus}
              onChange={(e) => setConditionStatus(e.target.value as ConditionStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="GOOD">Baik (Siap Pakai)</option>
              <option value="MINOR_DAMAGE">Rusak Ringan</option>
              <option value="MAJOR_DAMAGE">Rusak Berat</option>
              <option value="LOST">Hilang</option>
            </select>
          </div>

          {/* Status Operasional */}
          <div>
            <label className="block text-slate-700 font-medium mb-1">Status Operasional</label>
            <select
              value={operationalStatus}
              onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
            >
              <option value="AVAILABLE">AVAILABLE (Tersedia / Siap Dipinjam)</option>
              <option value="UNAVAILABLE">UNAVAILABLE (Tidak Tersedia)</option>
              <option value="MAINTENANCE">MAINTENANCE (Dalam Perawatan / Rusak)</option>
              <option value="ON_LOAN">ON_LOAN (Sedang Dipinjam)</option>
              <option value="RESERVED">RESERVED (Menunggu Persetujuan)</option>
              <option value="INACTIVE">INACTIVE (Nonaktif / Afkir)</option>
              <option value="LOST">LOST (Hilang)</option>
            </select>
          </div>

          {/* Keterangan Status Tidak Tersedia */}
          {operationalStatus === 'UNAVAILABLE' && (
            <div className="sm:col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
              <label className="block text-rose-950 font-bold text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Keterangan Status Tidak Tersedia <span className="text-rose-600">*</span></span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Sedang digunakan untuk kegiatan ujian / Dipakai rapat guru / Menunggu suku cadang..."
                className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium text-xs text-slate-800"
              />
              <p className="text-[11px] text-rose-700">
                Keterangan ini otomatis tersimpan pada data barang dan akan tampil saat barcode / QR Code dipindai.
              </p>
            </div>
          )}
        </div>

        {/* Tautan Foto Google Drive */}
        <div className="text-xs space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="edit-asset-photo-url" className="block text-slate-700 font-medium">
              Link Foto Google Drive
            </label>
            <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="edit-asset-photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => {
                setPhotoUrl(e.target.value);
                setPhotoPreviewFailed(false);
              }}
              placeholder="Tempel link Google Drive foto barang"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
            />
            {photoUrl.trim() && (
              <>
                {isValidHttpsUrl(photoUrl.trim()) && (
                  <a
                    href={photoUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 shrink-0 transition-colors"
                    title="Buka link di tab baru untuk menguji"
                  >
                    <span>Tes Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPhotoUrl('');
                    setPhotoPreviewFailed(false);
                  }}
                  className="px-2.5 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs hover:bg-slate-200 shrink-0 transition-colors"
                  title="Hapus atau kosongkan link foto"
                >
                  Kosongkan Link
                </button>
              </>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Tempelkan link Google Drive foto barang (format HTTPS). Anda dapat mengubah atau mengosongkan link ini kapan saja.
          </p>

          {photoUrl.trim() && !isValidHttpsUrl(photoUrl.trim()) && (
            <p className="text-[11px] text-rose-600 font-medium">
              Tautan foto harus menggunakan protokol aman HTTPS (https://) dan tidak menggunakan skema berbahaya.
            </p>
          )}

          {photoUrl.trim() && isValidHttpsUrl(photoUrl.trim()) && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center gap-3">
              <div className="w-20 h-20 rounded-md bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                {!photoPreviewFailed ? (
                  <img
                    src={getOptimizedImageUrl(photoUrl)}
                    alt="Pratinjau Foto Barang"
                    className="w-full h-full object-cover"
                    onError={() => setPhotoPreviewFailed(true)}
                  />
                ) : (
                  <div className="p-1 text-center">
                    <ImageIcon className="w-6 h-6 text-slate-400 mx-auto" />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Google Drive</span>
                  </div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-1">
                <span className="font-semibold text-slate-800 text-[11px] block">
                  Foto Unit Inventaris
                </span>
                <p className="text-[10px] text-slate-500">
                  {photoPreviewFailed
                    ? 'Pratinjau langsung tidak dapat dimuat (berkas privat/akses terbatas Google Drive). Klik tombol untuk membuka langsung.'
                    : 'Pratinjau tautan foto berhasil diverifikasi.'}
                </p>
                <a
                  href={getDirectViewUrl(photoUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Buka foto di Google Drive
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Catatan Tambahan */}
        <div className="text-xs">
          <label className="block text-slate-700 font-medium mb-1">Catatan Tambahan</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Keterangan kelengkapan atau kondisi khusus barang..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            Batal
          </Button>
          <Button
            disabled={!isFormValid || updateMutation.isPending}
            isLoading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Simpan Perubahan
          </Button>
        </div>
      </div>
    </Modal>
  );
};
