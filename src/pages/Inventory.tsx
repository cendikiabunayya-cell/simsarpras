import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Building2,
  Coins,
  ExternalLink,
  Eye,
  Filter,
  Image as ImageIcon,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { isValidHttpsUrl, getOptimizedImageUrl, getDirectViewUrl } from '../lib/driveUtils';
import { useAuth } from '../context/AuthContext';
import { AssetUnit, ConditionStatus, LoanMode, OperationalStatus, SCHOOL_UNITS, SchoolUnit, UserProfile } from '../types';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { getCanonicalQrUrl } from '../services/qrUrlService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { SyncIndicator } from '../components/ui/SyncIndicator';
import { MasterDataModal } from '../components/modals/MasterDataModal';
import { EditAssetModal } from '../components/modals/EditAssetModal';
import { getAutoRefreshOptions } from '../hooks/useAutoRefreshQuery';
import {
  getConditionBadge,
  getLoanModeBadge,
  getOperationalBadge,
} from '../lib/utils';

/**
 * Helper format label kategori + nomor barang (misal: "No: 22" -> "Laptop 22")
 */
export function getCategoryAndItemNumber(item: {
  itemNumber?: string | null;
  categoryName?: string;
  itemName?: string;
}): string {
  const num = (item.itemNumber && String(item.itemNumber).trim()) || '';
  if (!num) return '';

  // Jika sudah memuat huruf/nama kategori (misal: "Laptop 22"), langsung gunakan
  if (/[a-zA-Z]/.test(num)) {
    return num;
  }

  // Tentukan label kategori atau deteksi dari nama barang
  let cat = (item.categoryName || '').trim();
  const itemLower = (item.itemName || '').toLowerCase();

  if (!cat || cat.includes('/') || cat.toLowerCase() === 'umum') {
    if (itemLower.includes('laptop')) cat = 'Laptop';
    else if (itemLower.includes('proyektor') || itemLower.includes('projector') || itemLower.includes('infocus')) cat = 'Infocus';
    else if (itemLower.includes('kamera') || itemLower.includes('camera')) cat = 'Kamera';
    else if (itemLower.includes('komputer') || itemLower.includes('pc')) cat = 'PC';
    else if (itemLower.includes('speaker') || itemLower.includes('sound')) cat = 'Speaker';
  }

  return cat ? `${cat} ${num}` : `No: ${num}`;
}

export const Inventory: React.FC = () => {
  const queryClient = useQueryClient();
  const { canManageAssets, currentUser, allUsers } = useAuth();

  // Filters state (kontrol input/dropdown)
  const [searchTerm, setSearchTerm] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [itemNumberFilter, setItemNumberFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [fundingFilter, setFundingFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Applied filter state (dikirim ke backend query dan aktif pada tabel)
  const [appliedFilters, setAppliedFilters] = useState({
    institution: '',
    category: '',
    itemNumber: '',
    location: '',
    funding: '',
    year: '',
    status: '',
  });

  const handleApplyFilter = () => {
    setAppliedFilters({
      institution: institutionFilter,
      category: categoryFilter,
      itemNumber: itemNumberFilter,
      location: locationFilter,
      funding: fundingFilter,
      year: yearFilter,
      status: statusFilter,
    });
  };

  const handleResetFilter = () => {
    setSearchTerm('');
    setInstitutionFilter('');
    setCategoryFilter('');
    setItemNumberFilter('');
    setLocationFilter('');
    setFundingFilter('');
    setYearFilter('');
    setStatusFilter('');
    setAppliedFilters({
      institution: '',
      category: '',
      itemNumber: '',
      location: '',
      funding: '',
      year: '',
      status: '',
    });
  };

  const isFilterActive = Boolean(
    searchTerm.trim() ||
    appliedFilters.institution ||
    appliedFilters.category ||
    appliedFilters.itemNumber ||
    appliedFilters.location ||
    appliedFilters.funding ||
    appliedFilters.year ||
    appliedFilters.status
  );

  // Modals state
  const [selectedAsset, setSelectedAsset] = useState<AssetUnit | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetUnit | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [masterModalTab, setMasterModalTab] = useState<'funding' | 'location' | 'category' | null>(null);

  // Loan Request state for instant borrowing from catalog
  const [loanBorrowerName, setLoanBorrowerName] = useState(currentUser?.fullName || '');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16)
  );
  const [loanSuccessMessage, setLoanSuccessMessage] = useState<string | null>(null);

  // Asset Deletion state
  const [deletingAsset, setDeletingAsset] = useState<AssetUnit | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  // Asset Deletion Mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return api.deleteAsset(id, reason);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setDeleteSuccessMessage(res.message);
      setDeletingAsset(null);
      setDeleteReason('');
      setDeleteError(null);
      if (selectedAsset && deletingAsset && selectedAsset.id === deletingAsset.id) {
        setSelectedAsset(null);
      }
      setTimeout(() => setDeleteSuccessMessage(null), 6000);
    },
    onError: (err: any) => {
      setDeleteError(err?.message || 'Gagal memproses penghapusan data barang.');
    },
  });

  // Queries
  const {
    data: assets,
    isLoading,
    isFetching,
    dataUpdatedAt,
    error,
    refetch,
  } = useQuery<AssetUnit[]>({
    queryKey: [
      'assets',
      appliedFilters.funding,
      appliedFilters.year,
      appliedFilters.institution,
      appliedFilters.category,
      appliedFilters.itemNumber,
      appliedFilters.location,
      appliedFilters.status,
    ],
    queryFn: ({ signal }) =>
      api.getAssets({
        signal,
        fundingSource: appliedFilters.funding || undefined,
        acquisitionYear: appliedFilters.year || undefined,
        institution: appliedFilters.institution || undefined,
        itemNumber: appliedFilters.itemNumber || undefined,
        locationId: appliedFilters.location || undefined,
        operationalStatus: appliedFilters.status || undefined,
      }),
    ...getAutoRefreshOptions(),
  });

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

  const { data: yearsData } = useQuery<number[]>({
    queryKey: ['asset-years'],
    queryFn: () => api.getAcquisitionYears(),
  });

  // Daftar tahun perolehan unik diurutkan dari terbaru ke terlama (DESC)
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    if (Array.isArray(yearsData)) {
      yearsData.forEach((y) => {
        const num = Number(y);
        if (!isNaN(num) && num > 1900) set.add(num);
      });
    }
    if (Array.isArray(assets)) {
      assets.forEach((a) => {
        if (a.acquisitionYear !== undefined && a.acquisitionYear !== null && a.acquisitionYear !== '') {
          const num = Number(a.acquisitionYear);
          if (!isNaN(num) && num > 1900) set.add(num);
        }
      });
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [yearsData, assets]);

  // Daftar nomor barang unik yang tersedia (otomatis disaring sesuai kategori yang dipilih)
  const availableItemNumbers = useMemo(() => {
    const set = new Set<string>();
    if (Array.isArray(assets)) {
      assets.forEach((a) => {
        // Jika sedang memilih kategori tertentu, tampilkan nomor barang untuk kategori tersebut
        if (categoryFilter && a.categoryName !== categoryFilter) {
          return;
        }
        const num = (a.itemNumber && String(a.itemNumber).trim()) || '';
        if (num) {
          set.add(num);
        }
      });
    }
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [assets, categoryFilter]);

  // Add Asset Form State (Updated with Satuan Pendidikan)
  const [itemName, setItemName] = useState('');
  const [institution, setInstitution] = useState<SchoolUnit | string>('MIS Cendikia Bunayya');
  const [categoryName, setCategoryName] = useState('TIK/Multimedia');
  const [technicalSpecs, setTechnicalSpecs] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [fundingSource, setFundingSource] = useState('BOS Reguler');
  const [acquisitionYear, setAcquisitionYear] = useState<number>(new Date().getFullYear());
  const [locationId, setLocationId] = useState('');
  const [assetCode, setAssetCode] = useState(() => `INV-${Math.floor(100000 + Math.random() * 900000)}`);
  const [itemNumber, setItemNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [loanMode, setLoanMode] = useState<LoanMode>('DIRECT');
  const [conditionStatus, setConditionStatus] = useState<ConditionStatus>('GOOD');
  const [addOperationalStatus, setAddOperationalStatus] = useState<OperationalStatus>('AVAILABLE');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreviewFailed, setPhotoPreviewFailed] = useState(false);
  const [detailPhotoFailed, setDetailPhotoFailed] = useState(false);
  const [notes, setNotes] = useState('');

  // Add Asset Mutation
  const addAssetMutation = useMutation({
    mutationFn: async () => {
      const loc = locations?.find((l) => l.id === locationId);
      if (!loc) throw new Error('Silakan pilih ruangan / lokasi penempatan');
      if (!itemName.trim()) throw new Error('Nama barang/sarana wajib diisi');
      if (!technicalSpecs.trim()) throw new Error('Spesifikasi teknis / ukuran wajib diisi');

      if (photoUrl.trim() && !isValidHttpsUrl(photoUrl.trim())) {
        throw new Error('Tautan foto harus menggunakan protokol aman HTTPS (https://).');
      }

      const generatedCode = assetCode.trim() || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const qrToken = `QR-${generatedCode}`;

      return api.createAsset({
        itemName: itemName.trim(),
        institution,
        categoryName: categoryName || 'TIK/Multimedia',
        technicalSpecs: technicalSpecs.trim(),
        itemBrand: itemBrand.trim() || 'Standar',
        fundingSource: fundingSource || 'BOS Reguler',
        acquisitionYear: acquisitionYear || new Date().getFullYear(),
        locationId: loc.id,
        locationName: loc.name,
        assetCode: generatedCode,
        itemNumber: itemNumber.trim() || undefined,
        qrToken,
        serialNumber: serialNumber.trim() || undefined,
        effectiveLoanMode: loanMode,
        conditionStatus,
        operationalStatus: addOperationalStatus,
        photoUrl: photoUrl.trim() || undefined,
        photoPath: photoUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      setIsAddModalOpen(false);
      resetAddForm();
    },
  });

  // Loan Request Mutation
  const loanMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAsset) throw new Error('Unit belum dipilih');
      const trimmedName = loanBorrowerName.trim() || currentUser.fullName;
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
            email: 'peminjam@sekolah.sch.id',
            role: 'GURU_PEGAWAI',
            isActive: true,
            department: 'Guru / Pegawai',
          };

      return api.createLoanRequest({
        assetUnitId: selectedAsset.id,
        purpose: loanPurpose,
        expectedReturnAt: new Date(expectedReturnDate).toISOString(),
        borrower: borrowerUser,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      const modeText =
        res.loanModeSnapshot === 'DIRECT'
          ? 'Mode DIRECT: Peminjaman langsung berstatus AKTIF.'
          : 'Mode ADMIN_APPROVAL: Pengajuan berstatus MENUNGGU PERSETUJUAN ADMIN.';
      setLoanSuccessMessage(`Pengajuan nomor ${res.loanNumber} berhasil dibuat! ${modeText}`);
      setTimeout(() => {
        setIsLoanModalOpen(false);
        setLoanSuccessMessage(null);
        setSelectedAsset(null);
        setLoanPurpose('');
      }, 2000);
    },
  });

  const resetAddForm = () => {
    setItemName('');
    setInstitution('MIS Cendikia Bunayya');
    setCategoryName(categories?.[0]?.name || 'TIK/Multimedia');
    setTechnicalSpecs('');
    setItemBrand('');
    setFundingSource(fundingSources?.[0]?.name || 'BOS Reguler');
    setAcquisitionYear(new Date().getFullYear());
    setLocationId(locations?.[0]?.id || '');
    setAssetCode(`INV-${Math.floor(100000 + Math.random() * 900000)}`);
    setItemNumber('');
    setSerialNumber('');
    setLoanMode('DIRECT');
    setConditionStatus('GOOD');
    setAddOperationalStatus('AVAILABLE');
    setPhotoUrl('');
    setPhotoPreviewFailed(false);
    setNotes('');
  };

  // Filter logic (AND kombinasi sumber pendanaan & tahun perolehan dan filter lainnya)
  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    return assets.filter((asset) => {
      // Pencarian teks
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSearch =
          (asset.itemName && asset.itemName.toLowerCase().includes(q)) ||
          (asset.assetCode && asset.assetCode.toLowerCase().includes(q)) ||
          (asset.itemBrand && asset.itemBrand.toLowerCase().includes(q)) ||
          (asset.technicalSpecs && asset.technicalSpecs.toLowerCase().includes(q)) ||
          (asset.institution && asset.institution.toLowerCase().includes(q)) ||
          (asset.itemNumber && asset.itemNumber.toLowerCase().includes(q)) ||
          (asset.serialNumber && asset.serialNumber.toLowerCase().includes(q));
        if (!matchSearch) return false;
      }

      // Filter Satuan Pendidikan
      if (appliedFilters.institution && asset.institution !== appliedFilters.institution) {
        return false;
      }

      // Filter Kategori
      if (appliedFilters.category && asset.categoryName !== appliedFilters.category) {
        return false;
      }

      // Filter Nomor Barang (Kecocokan langsung atau tanpa leading zero)
      if (appliedFilters.itemNumber) {
        const itemNum = (asset.itemNumber && String(asset.itemNumber).trim()) || '';
        const targetNum = appliedFilters.itemNumber.trim();
        if (
          itemNum !== targetNum &&
          itemNum.replace(/^0+/, '') !== targetNum.replace(/^0+/, '')
        ) {
          return false;
        }
      }

      // Filter Ruangan
      if (appliedFilters.location && asset.locationId !== appliedFilters.location) {
        return false;
      }

      // Filter Sumber Pendanaan (AND logic, aman menangani null/kosong)
      if (appliedFilters.funding) {
        if (!asset.fundingSource || asset.fundingSource.toLowerCase() !== appliedFilters.funding.toLowerCase()) {
          return false;
        }
      }

      // Filter Tahun Perolehan (AND logic, aman menangani null/kosong)
      if (appliedFilters.year) {
        if (asset.acquisitionYear === undefined || asset.acquisitionYear === null || String(asset.acquisitionYear) !== String(appliedFilters.year)) {
          return false;
        }
      }

      // Filter Status Operasional
      if (appliedFilters.status && asset.operationalStatus !== appliedFilters.status) {
        return false;
      }

      return true;
    });
  }, [assets, searchTerm, appliedFilters]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Data Barang & Sarana Prasarana
            </h2>
            <SyncIndicator
              isFetching={isFetching}
              isLoading={isLoading}
              dataUpdatedAt={dataUpdatedAt}
              isError={Boolean(error)}
              onRefresh={() => refetch()}
            />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan sarana sekolah lengkap dengan spesifikasi teknis, merek, sumber pendanaan, tahun perolehan, dan QR Code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageAssets && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMasterModalTab('funding')}
                leftIcon={<Coins className="w-3.5 h-3.5 text-amber-600" />}
                className="text-xs"
              >
                Sumber Dana
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMasterModalTab('location')}
                leftIcon={<Building2 className="w-3.5 h-3.5 text-blue-600" />}
                className="text-xs"
              >
                Ruangan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMasterModalTab('category')}
                leftIcon={<Layers className="w-3.5 h-3.5 text-purple-600" />}
                className="text-xs"
              >
                Kategori
              </Button>
            </div>
          )}

          <Link to="/qr-print">
            <Button variant="outline" size="sm" leftIcon={<Printer className="w-4 h-4" />}>
              Cetak Label
            </Button>
          </Link>

          {canManageAssets && (
            <Button
              size="sm"
              onClick={() => {
                resetAddForm();
                setIsAddModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Tambah Barang
            </Button>
          )}
        </div>
      </div>

      {/* Notifikasi Sukses Hapus / Pengarsipan */}
      {deleteSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold">✓ Berhasil:</span>
            <span>{deleteSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 text-sm leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Panel */}
      {/* Filter and Search Panel */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Baris 1: Pencarian dan Pengelompokan Umum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="filter-search-term"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilter();
                }}
                placeholder="Cari nama barang, kode, merek..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              />
            </div>

            {/* Satuan Pendidikan Filter */}
            <div className="lg:col-span-2">
              <select
                id="filter-institution"
                value={institutionFilter}
                onChange={(e) => setInstitutionFilter(e.target.value)}
                aria-label="Filter satuan pendidikan"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium text-blue-900"
              >
                <option value="">Semua Satuan Pendidikan</option>
                {SCHOOL_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="lg:col-span-2">
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter kategori"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium text-slate-800"
              >
                <option value="">Semua Kategori</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Nomor Barang Filter (Pilihan Nomor Barang Tepat di Sebelah Kategori) */}
            <div className="lg:col-span-2">
              <select
                id="filter-item-number"
                value={itemNumberFilter}
                onChange={(e) => setItemNumberFilter(e.target.value)}
                aria-label="Filter nomor barang"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium text-slate-800"
              >
                <option value="">Semua No. Barang</option>
                {availableItemNumbers.map((num) => (
                  <option key={num} value={num}>
                    {num.toLowerCase().startsWith('no') ? num : `No. ${num}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div className="lg:col-span-2">
              <select
                id="filter-location"
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="Filter ruangan"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="">Semua Ruangan</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Operasional Filter */}
            <div className="lg:col-span-2">
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter status operasional"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
              >
                <option value="">Semua Status</option>
                <option value="AVAILABLE">Tersedia</option>
                <option value="UNAVAILABLE">Tidak Tersedia</option>
                <option value="ON_LOAN">Dipinjam</option>
                <option value="MAINTENANCE">Perbaikan</option>
                <option value="INACTIVE">Non-aktif</option>
                <option value="LOST">Hilang</option>
              </select>
            </div>
          </div>

          {/* Baris 2: Filter Sumber Pendanaan, Tahun Perolehan, dan Tombol Aksi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2.5 border-t border-slate-100 items-end">
            {/* Sumber Pendanaan Filter */}
            <div className="lg:col-span-2">
              <label htmlFor="filter-funding-source" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Sumber Pendanaan
              </label>
              <select
                id="filter-funding-source"
                value={fundingFilter}
                onChange={(e) => setFundingFilter(e.target.value)}
                aria-label="Filter sumber pendanaan"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium text-slate-800"
              >
                <option value="">Semua Sumber Pendanaan</option>
                {fundingSources?.map((fs) => (
                  <option key={fs.id} value={fs.name}>
                    {fs.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tahun Perolehan Filter */}
            <div className="lg:col-span-2">
              <label htmlFor="filter-acquisition-year" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tahun Perolehan
              </label>
              <select
                id="filter-acquisition-year"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter tahun perolehan"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white font-medium text-slate-800"
              >
                <option value="">Semua Tahun</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Tombol Terapkan Filter & Reset Filter */}
            <div className="lg:col-span-2 flex items-center gap-2">
              <Button
                id="btn-apply-filter"
                type="button"
                onClick={handleApplyFilter}
                className="flex-1 text-xs py-2 h-9"
                leftIcon={<Filter className="w-3.5 h-3.5" />}
              >
                Terapkan Filter
              </Button>
              <Button
                id="btn-reset-filter"
                type="button"
                variant="outline"
                onClick={handleResetFilter}
                className="text-xs py-2 h-9 text-slate-600 hover:text-slate-900"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader className="py-3 px-6 bg-slate-50/50">
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">
                Menampilkan {filteredAssets?.length ?? 0} dari {assets?.length ?? 0} unit terdaftar
              </span>
              {isFilterActive && (
                <Badge variant="info" className="text-[10px] font-semibold">
                  Filter Aktif: {filteredAssets?.length ?? 0} barang
                </Badge>
              )}
            </div>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="text-xs text-blue-700 hover:underline font-medium inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Semua Filter
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} columns={9} />
          ) : error ? (
            <ErrorMessage message={(error as Error).message} onRetry={() => refetch()} />
          ) : filteredAssets?.length === 0 ? (
            <EmptyState
              title={isFilterActive ? 'Tidak ada barang yang sesuai dengan filter' : 'Tidak Ada Data Barang'}
              description={
                isFilterActive
                  ? 'Tidak ditemukan barang yang memenuhi kombinasi filter sumber pendanaan, tahun perolehan, atau kata kunci pencarian yang dipilih.'
                  : 'Belum ada data barang atau sarana prasarana yang terdaftar di inventaris.'
              }
              actionLabel={isFilterActive ? 'Reset Filter' : undefined}
              onAction={isFilterActive ? handleResetFilter : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Kode Barang & QR</th>
                    <th className="px-4 py-3">Nama Barang & Spesifikasi Teknis</th>
                    <th className="px-4 py-3">Kategori & Ruangan</th>
                    <th className="px-4 py-3">Merek & Sumber Pendanaan</th>
                    <th className="px-4 py-3">Tahun</th>
                    <th className="px-4 py-3">Foto</th>
                    <th className="px-4 py-3">Kondisi</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets?.map((asset) => {
                    const cond = getConditionBadge(asset.conditionStatus);
                    const oper = getOperationalBadge(asset.operationalStatus);
                    const mode = getLoanModeBadge(asset.effectiveLoanMode);
                    const isAvailable = asset.operationalStatus === 'AVAILABLE';

                    return (
                      <tr key={asset.id} className="hover:bg-blue-50/30 transition-colors group">
                        {/* Kode & QR Preview */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-white border border-slate-200 rounded shadow-xs shrink-0">
                              <QRCodeSVG value={getCanonicalQrUrl(asset)} size={32} />
                            </div>
                            <div>
                              <div className="font-mono font-bold text-slate-900">
                                {asset.assetCode}
                              </div>
                              {asset.itemNumber && (
                                <span className="inline-block font-sans text-[10px] font-bold text-blue-800 bg-blue-100/70 px-1.5 py-0.2 rounded border border-blue-200">
                                  {getCategoryAndItemNumber(asset)}
                                </span>
                              )}
                              <div>
                                <span
                                  className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded font-semibold border ${mode.bg} ${mode.text} ${mode.border}`}
                                >
                                  {asset.effectiveLoanMode}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Nama Barang & Spesifikasi Teknis / Ukuran */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 text-xs group-hover:text-blue-700 transition-colors">
                              {asset.itemName}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                asset.institution === 'RA Cendikia Bunayya'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {asset.institution || 'MIS Cendikia Bunayya'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                            {asset.technicalSpecs}
                          </div>
                        </td>

                        {/* Kategori & Ruangan */}
                        <td className="px-4 py-3">
                          <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {asset.categoryName}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{asset.locationName}</span>
                          </div>
                        </td>

                        {/* Merek & Sumber Pendanaan */}
                        <td className="px-4 py-3">
                          <div className="text-slate-900 font-medium">{asset.itemBrand}</div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded mt-0.5">
                            <Coins className="w-2.5 h-2.5" />
                            {asset.fundingSource}
                          </span>
                        </td>

                        {/* Tahun Perolehan */}
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-slate-700">
                            {asset.acquisitionYear}
                          </span>
                        </td>

                        {/* Foto Google Drive */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(() => {
                            const rawUrl = (asset.photoUrl || asset.photoPath || '').trim();
                            if (rawUrl && isValidHttpsUrl(rawUrl)) {
                              return (
                                <a
                                  href={rawUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Buka foto di Google Drive"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:text-blue-800 transition-colors shadow-2xs"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>Lihat Foto</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                                </a>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 italic">
                                <ImageIcon className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                <span>Belum ada foto</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Kondisi Fisik */}
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              asset.conditionStatus === 'GOOD'
                                ? 'success'
                                : asset.conditionStatus === 'LOST'
                                ? 'default'
                                : 'warning'
                            }
                            dot
                          >
                            {cond.label}
                          </Badge>
                        </td>

                        {/* Status Operasional */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border w-fit ${oper.bg} ${oper.text} ${oper.border}`}
                            >
                              {oper.label}
                            </span>
                            {asset.operationalStatus === 'UNAVAILABLE' && asset.notes && (
                              <span
                                className="text-[10px] text-rose-700 font-medium line-clamp-1 italic max-w-[160px]"
                                title={`Keterangan: ${asset.notes}`}
                              >
                                Ket: {asset.notes}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedAsset(asset)}
                              title="Lihat Rincian Unit"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                            </Button>

                            {canManageAssets && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingAsset(asset)}
                                  title="Ubah Data Barang"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>

                                {asset.operationalStatus === 'INACTIVE' || asset.isDecommissioned ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setDeletingAsset(asset);
                                      setDeleteError(null);
                                      setDeleteReason('');
                                    }}
                                    title="Hapus Data Barang"
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled
                                    title="Barang aktif tidak dapat dihapus. Nonaktifkan barang terlebih dahulu."
                                    className="text-slate-300 cursor-not-allowed opacity-40 hover:bg-transparent"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </>
                            )}

                            {isAvailable && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedAsset(asset);
                                  setIsLoanModalOpen(true);
                                }}
                                className="text-xs"
                              >
                                Pinjam
                              </Button>
                            )}
                          </div>
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

      {/* DETAIL ASSET MODAL */}
      <Modal
        isOpen={Boolean(selectedAsset) && !isLoanModalOpen}
        onClose={() => setSelectedAsset(null)}
        title="Detail Barang / Sarana Sekolah"
        description="Informasi spesifikasi teknis, identitas QR Code, sumber pendanaan, dan status operasional."
        maxWidth="2xl"
      >
        {selectedAsset && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col items-center">
                  <QRCodeSVG
                    value={getCanonicalQrUrl(selectedAsset)}
                    size={110}
                  />
                  <span className="text-[10px] font-mono font-bold text-slate-600 mt-2">
                    {selectedAsset.assetCode}
                  </span>
                </div>
              </div>

              {(selectedAsset.photoUrl || selectedAsset.photoPath) && (
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div className="w-28 h-28 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden">
                    {!detailPhotoFailed ? (
                      <img
                        src={getOptimizedImageUrl(selectedAsset.photoUrl || selectedAsset.photoPath)}
                        alt={selectedAsset.itemName}
                        className="w-full h-full object-cover"
                        onError={() => setDetailPhotoFailed(true)}
                      />
                    ) : (
                      <div className="p-2 text-center">
                        <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                        <span className="text-[10px] text-slate-400 block mt-1">Google Drive</span>
                      </div>
                    )}
                  </div>
                  <a
                    href={getDirectViewUrl(selectedAsset.photoUrl || selectedAsset.photoPath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Buka foto di Google Drive
                  </a>
                </div>
              )}

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge variant={selectedAsset.conditionStatus === 'GOOD' ? 'success' : 'warning'}>
                    Kondisi: {getConditionBadge(selectedAsset.conditionStatus).label}
                  </Badge>
                  <span
                    className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      getOperationalBadge(selectedAsset.operationalStatus).bg
                    } ${getOperationalBadge(selectedAsset.operationalStatus).text} ${
                      getOperationalBadge(selectedAsset.operationalStatus).border
                    }`}
                  >
                    Status: {getOperationalBadge(selectedAsset.operationalStatus).label}
                  </span>
                </div>
                {selectedAsset.operationalStatus === 'UNAVAILABLE' && selectedAsset.notes && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 text-left">
                    <strong className="block font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Keterangan Tidak Tersedia:</span>
                    </strong>
                    <p className="mt-0.5 text-rose-800 font-medium">{selectedAsset.notes}</p>
                  </div>
                )}
                <h3 className="text-lg font-bold text-slate-900">{selectedAsset.itemName}</h3>
                <p className="text-xs text-slate-600 font-medium">
                  Merek / Pabrikan: <span className="text-slate-900 font-bold">{selectedAsset.itemBrand}</span>
                </p>
                <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200/80">
                  <strong>Spesifikasi Teknis / Ukuran:</strong>
                  <p className="mt-0.5 text-slate-600">{selectedAsset.technicalSpecs}</p>
                </div>
              </div>
            </div>

            {/* Spec grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="text-slate-500 font-semibold block mb-1">Kode Barang</span>
                <span className="font-mono font-bold text-slate-900">{selectedAsset.assetCode}</span>
              </div>
              {selectedAsset.itemNumber && (
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/70">
                  <span className="text-blue-700 font-semibold block mb-1">Nomor Barang</span>
                  <span className="font-bold text-blue-950">{getCategoryAndItemNumber(selectedAsset)}</span>
                </div>
              )}
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                <span className="text-blue-700 font-semibold block mb-1">Satuan Pendidikan</span>
                <span className="font-bold text-blue-950">{selectedAsset.institution || 'MIS Cendikia Bunayya'}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <span className="text-slate-400 block mb-1">Kategori</span>
                <span className="font-semibold text-slate-800">{selectedAsset.categoryName}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <span className="text-slate-400 block mb-1">Ruangan / Lokasi</span>
                <span className="font-semibold text-slate-800">{selectedAsset.locationName}</span>
              </div>
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/40">
                <span className="text-amber-800 font-semibold block mb-1">Sumber Pendanaan</span>
                <span className="font-bold text-amber-950">{selectedAsset.fundingSource}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <span className="text-slate-400 block mb-1">Tahun Perolehan</span>
                <span className="font-mono font-bold text-slate-800">{selectedAsset.acquisitionYear}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <span className="text-slate-400 block mb-1">Mode Peminjaman</span>
                <span className="font-semibold text-blue-700">{selectedAsset.effectiveLoanMode}</span>
              </div>
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <span className="text-slate-400 block mb-1">Nomor Seri (SN)</span>
                <span className="font-mono text-slate-800">{selectedAsset.serialNumber || '-'}</span>
              </div>
            </div>

            {/* Notes */}
            {selectedAsset.notes && (
              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800 block mb-0.5">Catatan Unit:</span>
                {selectedAsset.notes}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setSelectedAsset(null)}>
                Tutup
              </Button>
              <Link to={`/qr-print?select=${selectedAsset.id}`}>
                <Button variant="outline" leftIcon={<Printer className="w-4 h-4" />}>
                  Cetak Label
                </Button>
              </Link>
              {canManageAssets && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingAsset(selectedAsset);
                  }}
                  leftIcon={<Pencil className="w-4 h-4 text-blue-600" />}
                  className="text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  Ubah Data
                </Button>
              )}
              {canManageAssets && selectedAsset.operationalStatus !== 'INACTIVE' && !selectedAsset.isDecommissioned && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    const reason = window.prompt(
                      `Alasan menonaktifkan/menghapus logis "${selectedAsset.itemName}" (${selectedAsset.assetCode})?\nContoh: Rusak total tidak dapat diperbaiki / Dihibahkan / Dilelang:`,
                      'Rusak berat tidak dapat diperbaiki'
                    );
                    if (reason !== null && reason.trim()) {
                      await api.decommissionAsset(selectedAsset.id, reason.trim());
                      queryClient.invalidateQueries({ queryKey: ['assets'] });
                      setSelectedAsset(null);
                    }
                  }}
                  leftIcon={<Archive className="w-4 h-4 text-slate-500" />}
                  className="text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Nonaktifkan Aset
                </Button>
              )}
              {canManageAssets && (selectedAsset.operationalStatus === 'INACTIVE' || selectedAsset.isDecommissioned) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeletingAsset(selectedAsset);
                    setDeleteError(null);
                    setDeleteReason('');
                  }}
                  leftIcon={<Trash2 className="w-4 h-4 text-rose-600" />}
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                >
                  Hapus Barang
                </Button>
              )}
              {selectedAsset.operationalStatus === 'AVAILABLE' && (
                <Button
                  onClick={() => setIsLoanModalOpen(true)}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                >
                  Ajukan Peminjaman
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* TAMBAH BARANG MODAL (ADMIN ONLY) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Barang / Sarana Baru"
        description="Daftarkan barang/sarana sekolah lengkap dengan spesifikasi teknis, sumber pendanaan, dan tahun perolehan."
        maxWidth="xl"
      >
        <div className="space-y-4">
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
                placeholder="Contoh: Laptop Guru ASUS ExpertBook, Meja Siswa Kayu Jati, Proyektor Epson..."
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
                  Mempengaruhi nama sekolah pada label stiker inventaris
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

            {/* Kategori (Sinkron) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalTab('category')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold"
                >
                  + Kelola Kategori
                </button>
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
                placeholder="Contoh: ASUS, Olympic, Molten, Daikin, Epson..."
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
                placeholder="Contoh: Core i5-1235U, RAM 16GB, SSD 512GB ATAU Ukuran: 120 x 60 x 75 cm Kayu Jati..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            {/* Sumber Pendanaan (Sinkron) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">
                  Sumber Pendanaan <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalTab('funding')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold"
                >
                  + Kelola Sumber Dana
                </button>
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

            {/* Ruangan / Lokasi (Sinkron) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-medium">
                  Ruangan / Lokasi <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMasterModalTab('location')}
                  className="text-[10px] text-blue-700 hover:underline font-semibold"
                >
                  + Kelola Ruangan
                </button>
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
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Nomor urut barang yang dicetak pada label QR (kombinasi: Kategori + Nomor Barang, misal: <em>Laptop 01</em>).
              </p>
            </div>

            {/* Kode Inventaris (Otomatis) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-medium">
                  Kode Inventaris Unit <span className="text-emerald-600 font-semibold text-[11px]">(Otomatis)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setAssetCode(`INV-${Math.floor(100000 + Math.random() * 900000)}`)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  Acak Ulang Kode
                </button>
              </div>
              <input
                type="text"
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
                placeholder="Dihasilkan otomatis oleh sistem"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600 uppercase text-xs"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Kode unik inventaris terisi otomatis ({assetCode || 'INV-381052'}). Anda tetap dapat mengubahnya bila diperlukan.
              </p>
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

            {/* Kondisi Fisik Awal */}
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
              </select>
            </div>

            {/* Status Operasional */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Status Operasional</label>
              <select
                value={addOperationalStatus}
                onChange={(e) => setAddOperationalStatus(e.target.value as OperationalStatus)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="AVAILABLE">Tersedia (Siap Dipinjam)</option>
                <option value="UNAVAILABLE">Tidak Tersedia</option>
                <option value="MAINTENANCE">Perbaikan / Rusak</option>
              </select>
            </div>
          </div>

          {/* Keterangan Status Tidak Tersedia */}
          {addOperationalStatus === 'UNAVAILABLE' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5">
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

          {/* Tautan Foto Google Drive */}
          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="add-asset-photo-url" className="block text-slate-700 font-medium">
                Link Foto Google Drive
              </label>
              <span className="text-[10px] text-slate-400 font-normal">(opsional)</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="add-asset-photo-url"
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
              Tempelkan link Google Drive foto barang (format HTTPS). File tetap tersimpan di Google Drive Anda.
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
              placeholder="Keterangan kelengkapan atau kondisi khusus..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={addAssetMutation.isPending}
            >
              Batal
            </Button>
            <Button
              disabled={!itemName.trim() || !technicalSpecs.trim() || !locationId || addAssetMutation.isPending}
              isLoading={addAssetMutation.isPending}
              onClick={() => addAssetMutation.mutate()}
            >
              Simpan Barang Baru
            </Button>
          </div>
        </div>
      </Modal>

      {/* FORM MODAL PINJAM DARI KATALOG */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setLoanSuccessMessage(null);
        }}
        title="Form Pengajuan Peminjaman"
        description="Peminjaman sarana sekolah tercatat dengan pelacakan QR Code."
        maxWidth="lg"
      >
        {selectedAsset && (
          <div className="space-y-4">
            {loanSuccessMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {loanSuccessMessage}
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">Barang yang Diajukan:</span>
                <span className="font-bold text-slate-900">{selectedAsset.itemName}</span>
                <span className="text-slate-500 font-mono block text-[11px]">
                  {selectedAsset.assetCode} — {selectedAsset.locationName}
                </span>
                <span className="text-amber-800 font-semibold block text-[11px]">
                  Sumber: {selectedAsset.fundingSource} ({selectedAsset.acquisitionYear})
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Mode Peminjaman:</span>
                <Badge variant={selectedAsset.effectiveLoanMode === 'DIRECT' ? 'success' : 'info'}>
                  {selectedAsset.effectiveLoanMode}
                </Badge>
              </div>
            </div>

            <div className="text-xs">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-medium">
                  Nama Peminjam (Guru / Pegawai) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  Bisa Diketik Bebas
                </span>
              </div>
              <input
                type="text"
                autoComplete="off"
                value={loanBorrowerName}
                onChange={(e) => setLoanBorrowerName(e.target.value)}
                placeholder="Ketik nama lengkap peminjam..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                required
              />

              {/* Rekomendasi Cepat */}
              <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                <span className="text-slate-400 text-[10px]">Pilihan cepat:</span>
                <button
                  type="button"
                  onClick={() => setLoanBorrowerName(currentUser.fullName)}
                  className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${
                    loanBorrowerName === currentUser.fullName
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Saya Sendiri ({currentUser.fullName.split(' ')[0]})
                </button>
                {allUsers
                  .filter((u) => u.id !== currentUser.id)
                  .slice(0, 3)
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setLoanBorrowerName(u.fullName)}
                      className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${
                        loanBorrowerName === u.fullName
                          ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {u.fullName}
                    </button>
                  ))}
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-slate-700 font-medium mb-1">
                Keperluan / Tujuan Peminjaman <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={loanPurpose}
                onChange={(e) => setLoanPurpose(e.target.value)}
                placeholder="Contoh: Mengajar praktikum kelas X di lab TIK 1..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            <div className="text-xs">
              <label className="block text-slate-700 font-medium mb-1">
                Rencana Tanggal & Jam Pengembalian <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setIsLoanModalOpen(false)}
                disabled={loanMutation.isPending}
              >
                Batal
              </Button>
              <Button
                disabled={!loanBorrowerName.trim() || !loanPurpose.trim() || loanMutation.isPending}
                isLoading={loanMutation.isPending}
                onClick={() => loanMutation.mutate()}
              >
                Kirim Pengajuan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MASTER DATA MODAL (SUMBER DANA, RUANGAN, KATEGORI) */}
      <MasterDataModal
        isOpen={Boolean(masterModalTab)}
        defaultTab={masterModalTab || 'funding'}
        onClose={() => setMasterModalTab(null)}
      />

      {/* EDIT ASSET MODAL */}
      <EditAssetModal
        isOpen={Boolean(editingAsset)}
        asset={editingAsset}
        onClose={() => setEditingAsset(null)}
        onOpenMasterModal={(tab) => setMasterModalTab(tab)}
        onSuccess={(updated) => {
          if (selectedAsset?.id === updated.id) {
            setSelectedAsset(updated);
          }
        }}
      />

      {/* MODAL KONFIRMASI HAPUS BARANG */}
      <Modal
        isOpen={Boolean(deletingAsset)}
        onClose={() => {
          if (!deleteAssetMutation.isPending) {
            setDeletingAsset(null);
            setDeleteError(null);
            setDeleteReason('');
          }
        }}
        title="Konfirmasi Penghapusan Barang"
        description="Pastikan keabsahan identitas barang inventaris yang akan dihapus."
        maxWidth="md"
      >
        {deletingAsset && (
          <div className="space-y-4 text-xs">
            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">Penghapusan Ditolak Sistem</span>
                  <p className="text-[11px] text-rose-700">{deleteError}</p>
                </div>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">Aturan Integritas Data & Audit</p>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  Jika barang memiliki riwayat transaksi peminjaman, data akan <strong>diarsipkan secara aman</strong> untuk menjaga keutuhan laporan audit dan riwayat peminjam. Jika belum pernah ada transaksi, data akan <strong>dihapus permanen</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Nama Barang:</span>
                <span className="font-bold text-slate-900">{deletingAsset.itemName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Kode Barang / Inventaris:</span>
                <span className="font-mono font-bold text-blue-700">{deletingAsset.assetCode}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Satuan Pendidikan:</span>
                <span className="font-medium text-slate-800">{deletingAsset.institution || 'MIS Cendikia Bunayya'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500 font-medium">Ruangan & Kategori:</span>
                <span className="text-slate-800">{deletingAsset.locationName} • {deletingAsset.categoryName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Status Operasional:</span>
                <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {deletingAsset.operationalStatus} {deletingAsset.isDecommissioned ? '(Diarsipkan)' : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Alasan Penghapusan / Pengarsipan <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Rusak total tidak dapat diperbaiki / Dihibahkan / Afkir..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={deleteAssetMutation.isPending}
                onClick={() => {
                  setDeletingAsset(null);
                  setDeleteError(null);
                  setDeleteReason('');
                }}
              >
                Batal
              </Button>

              <Button
                type="button"
                isLoading={deleteAssetMutation.isPending}
                onClick={() => {
                  if (!deleteReason.trim()) {
                    setDeleteError('Alasan penghapusan wajib diisi.');
                    return;
                  }
                  deleteAssetMutation.mutate({
                    id: deletingAsset.id,
                    reason: deleteReason.trim(),
                  });
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                Ya, Hapus / Arsipkan Barang
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
