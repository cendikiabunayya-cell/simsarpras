import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  Edit2,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { Category, FundingSource, LoanMode, Location } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';

export const MasterData: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'locations' | 'categories' | 'funding'>('locations');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Notification banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    type: 'location' | 'category' | 'funding';
    data: Location | Category | FundingSource;
  } | null>(null);
  const [deletingItem, setDeletingItem] = useState<{
    type: 'location' | 'category' | 'funding';
    id: string;
    name: string;
  } | null>(null);

  // Form Fields - Location
  const [locName, setLocName] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [locActive, setLocActive] = useState(true);

  // Form Fields - Category
  const [catName, setCatName] = useState('');
  const [catMode, setCatMode] = useState<LoanMode>('DIRECT');
  const [catDesc, setCatDesc] = useState('');
  const [catActive, setCatActive] = useState(true);

  // Form Fields - Funding
  const [fundName, setFundName] = useState('');
  const [fundDesc, setFundDesc] = useState('');
  const [fundActive, setFundActive] = useState(true);

  // Data Queries
  const {
    data: locations = [],
    isLoading: isLocLoading,
    refetch: refetchLocations,
  } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.getLocations(),
  });

  const {
    data: categories = [],
    isLoading: isCatLoading,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const {
    data: fundingSources = [],
    isLoading: isFundLoading,
    refetch: refetchFunding,
  } = useQuery({
    queryKey: ['funding-sources'],
    queryFn: () => api.getFundingSources(),
  });

  const resetForms = () => {
    setLocName('');
    setLocCode('');
    setLocDesc('');
    setLocActive(true);

    setCatName('');
    setCatMode('DIRECT');
    setCatDesc('');
    setCatActive(true);

    setFundName('');
    setFundDesc('');
    setFundActive(true);

    setEditingItem(null);
    setDeletingItem(null);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
  };

  // -------------------------------------------------------------
  // MUTATIONS: RUANGAN / LOKASI
  // -------------------------------------------------------------
  const createLocationMutation = useMutation({
    mutationFn: async () => {
      if (!locName.trim()) throw new Error('Nama ruangan wajib diisi.');
      return api.createLocation(locName.trim(), locCode.trim() || undefined, locDesc.trim() || undefined);
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setIsAddModalOpen(false);
      resetForms();
      showSuccess(`Ruangan "${newItem.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan ruangan.'),
  });

  const updateLocationMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem || editingItem.type !== 'location') return;
      if (!locName.trim()) throw new Error('Nama ruangan tidak boleh kosong.');
      return api.updateLocation(editingItem.data.id, {
        name: locName.trim(),
        code: locCode.trim() || undefined,
        description: locDesc.trim() || undefined,
        isActive: locActive,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingItem(null);
      resetForms();
      showSuccess(`Data ruangan "${updated?.name}" berhasil diperbarui.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal memperbarui data ruangan.'),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteLocation(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setDeletingItem(null);
      showSuccess(res.message || 'Ruangan berhasil dihapus.');
    },
    onError: (err: any) => showError(err?.message || 'Gagal menghapus ruangan.'),
  });

  // -------------------------------------------------------------
  // MUTATIONS: KATEGORI BARANG
  // -------------------------------------------------------------
  const createCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!catName.trim()) throw new Error('Nama kategori wajib diisi.');
      return api.createCategory(catName.trim(), catMode, catDesc.trim() || undefined);
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsAddModalOpen(false);
      resetForms();
      showSuccess(`Kategori "${newItem.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan kategori.'),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem || editingItem.type !== 'category') return;
      if (!catName.trim()) throw new Error('Nama kategori tidak boleh kosong.');
      return api.updateCategory(editingItem.data.id, {
        name: catName.trim(),
        defaultLoanMode: catMode,
        description: catDesc.trim() || undefined,
        isActive: catActive,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingItem(null);
      resetForms();
      showSuccess(`Data kategori "${updated?.name}" berhasil diperbarui.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal memperbarui data kategori.'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteCategory(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeletingItem(null);
      showSuccess(res.message || 'Kategori berhasil dihapus.');
    },
    onError: (err: any) => showError(err?.message || 'Gagal menghapus kategori.'),
  });

  // -------------------------------------------------------------
  // MUTATIONS: SUMBER PENDANAAN
  // -------------------------------------------------------------
  const createFundingMutation = useMutation({
    mutationFn: async () => {
      if (!fundName.trim()) throw new Error('Nama sumber pendanaan wajib diisi.');
      return api.createFundingSource(fundName.trim(), fundDesc.trim() || undefined);
    },
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['funding-sources'] });
      setIsAddModalOpen(false);
      resetForms();
      showSuccess(`Sumber pendanaan "${newItem.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan sumber pendanaan.'),
  });

  const updateFundingMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem || editingItem.type !== 'funding') return;
      if (!fundName.trim()) throw new Error('Nama sumber pendanaan tidak boleh kosong.');
      return api.updateFundingSource(editingItem.data.id, {
        name: fundName.trim(),
        description: fundDesc.trim() || undefined,
        isActive: fundActive,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['funding-sources'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditingItem(null);
      resetForms();
      showSuccess(`Sumber pendanaan "${updated?.name}" berhasil diperbarui.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal memperbarui sumber pendanaan.'),
  });

  const deleteFundingMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteFundingSource(id);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['funding-sources'] });
      setDeletingItem(null);
      showSuccess(res.message || 'Sumber pendanaan berhasil dihapus.');
    },
    onError: (err: any) => showError(err?.message || 'Gagal menghapus sumber pendanaan.'),
  });

  // Open Edit Helper
  const handleOpenEdit = (type: 'location' | 'category' | 'funding', item: any) => {
    setEditingItem({ type, data: item });
    if (type === 'location') {
      setLocName(item.name || '');
      setLocCode(item.code || '');
      setLocDesc(item.description || '');
      setLocActive(item.isActive ?? true);
    } else if (type === 'category') {
      setCatName(item.name || '');
      setCatMode(item.defaultLoanMode || 'DIRECT');
      setCatDesc(item.description || '');
      setCatActive(item.isActive ?? true);
    } else if (type === 'funding') {
      setFundName(item.name || '');
      setFundDesc(item.description || '');
      setFundActive(item.isActive ?? true);
    }
  };

  // Filtered lists
  const filteredLocations = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (loc.code && loc.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (loc.description && loc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && loc.isActive) ||
      (statusFilter === 'INACTIVE' && !loc.isActive);
    return matchesSearch && matchesStatus;
  });

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch =
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && cat.isActive) ||
      (statusFilter === 'INACTIVE' && !cat.isActive);
    return matchesSearch && matchesStatus;
  });

  const filteredFunding = fundingSources.filter((fs) => {
    const matchesSearch =
      fs.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fs.description && fs.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && fs.isActive) ||
      (statusFilter === 'INACTIVE' && !fs.isActive);
    return matchesSearch && matchesStatus;
  });

  const isLoading = isLocLoading || isCatLoading || isFundLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Master Data Sarpras
            </h1>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
              Admin Sarpras
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pengelolaan referensi data ruangan/lokasi penempatan, kategori barang, dan sumber pendanaan inventaris sekolah.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchLocations();
              refetchCategories();
              refetchFunding();
            }}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Segarkan
          </Button>

          <Button
            size="sm"
            onClick={() => {
              resetForms();
              setIsAddModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {activeTab === 'locations' && 'Tambah Ruangan'}
            {activeTab === 'categories' && 'Tambah Kategori'}
            {activeTab === 'funding' && 'Tambah Sumber Dana'}
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => {
            setActiveTab('locations');
            setSearchTerm('');
          }}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            activeTab === 'locations'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Ruangan / Lokasi ({locations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('categories');
            setSearchTerm('');
          }}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            activeTab === 'categories'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Kategori ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('funding');
            setSearchTerm('');
          }}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
            activeTab === 'funding'
              ? 'bg-white text-blue-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Sumber Dana ({fundingSources.length})</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={`Cari nama, kode, atau keterangan...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 text-slate-700 focus:ring-2 focus:ring-blue-600"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Hanya Aktif</option>
            <option value="INACTIVE">Hanya Nonaktif</option>
          </select>
        </div>
      </div>

      {/* TAB CONTENT 1: RUANGAN / LOKASI */}
      {activeTab === 'locations' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Daftar Ruangan & Lokasi Penempatan</span>
              <span className="text-xs text-slate-500 font-normal">
                Menampilkan {filteredLocations.length} dari {locations.length} data
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Ruangan digunakan sebagai referensi penempatan barang dan tidak dapat dihapus jika masih digunakan oleh barang aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Nama Ruangan</th>
                    <th className="py-3 px-4">Kode Ruang</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLocations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Tidak ada data ruangan yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{loc.name}</td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold border border-slate-200">
                            {loc.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {loc.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={loc.isActive ? 'success' : 'default'} dot>
                            {loc.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit('location', loc)}
                              title="Ubah Ruangan"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingItem({ type: 'location', id: loc.id, name: loc.name })}
                              title="Hapus Ruangan"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 2: KATEGORI BARANG */}
      {activeTab === 'categories' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Daftar Kategori Inventaris</span>
              <span className="text-xs text-slate-500 font-normal">
                Menampilkan {filteredCategories.length} dari {categories.length} data
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Kategori menentukan mode peminjaman bawaan (Pinjam Langsung vs Persetujuan Admin) untuk aset baru.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Nama Kategori</th>
                    <th className="py-3 px-4">Default Mode Pinjam</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Tidak ada data kategori yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{cat.name}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-semibold text-[11px] px-2 py-0.5 rounded border ${
                              cat.defaultLoanMode === 'DIRECT'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {cat.defaultLoanMode === 'DIRECT' ? 'Pinjam Langsung' : 'Persetujuan Admin'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {cat.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={cat.isActive ? 'success' : 'default'} dot>
                            {cat.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit('category', cat)}
                              title="Ubah Kategori"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingItem({ type: 'category', id: cat.id, name: cat.name })}
                              title="Hapus Kategori"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB CONTENT 3: SUMBER PENDANAAN */}
      {activeTab === 'funding' && (
        <Card className="border border-slate-200 shadow-xs">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Daftar Sumber Pendanaan</span>
              <span className="text-xs text-slate-500 font-normal">
                Menampilkan {filteredFunding.length} dari {fundingSources.length} data
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Sumber pendanaan asal pengadaan barang (misal: BOS Reguler, BOS Kinerja, DAK Fisik).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Nama Sumber Pendanaan</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFunding.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Tidak ada data sumber pendanaan yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFunding.map((fs) => (
                      <tr key={fs.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-bold text-slate-900">{fs.name}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-sm truncate">
                          {fs.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={fs.isActive ? 'success' : 'default'} dot>
                            {fs.isActive ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit('funding', fs)}
                              title="Ubah Sumber Dana"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingItem({ type: 'funding', id: fs.id, name: fs.name })}
                              title="Hapus Sumber Dana"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: TAMBAH DATA MASTER */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForms();
        }}
        title={
          activeTab === 'locations'
            ? 'Tambah Ruangan / Lokasi Baru'
            : activeTab === 'categories'
            ? 'Tambah Kategori Barang Baru'
            : 'Tambah Sumber Pendanaan Baru'
        }
        description="Data yang ditambahkan akan langsung tersedia pada formulir pencatatan dan perbaruan data barang."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {activeTab === 'locations' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Ruangan / Lokasi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Lab Komputer 2 (Multimedia)"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kode Ruangan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: LAB-MM2"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-blue-600"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Kosongkan untuk pembuatan kode otomatis oleh sistem.
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Singkat
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Lantai 2 Gedung B, laboratorium komputer siswa"
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => createLocationMutation.mutate()}
                  isLoading={createLocationMutation.isPending}
                  disabled={!locName.trim()}
                >
                  Simpan Ruangan
                </Button>
              </div>
            </>
          )}

          {activeTab === 'categories' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kategori Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: TIK / Multimedia"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mode Peminjaman Bawaan
                </label>
                <select
                  value={catMode}
                  onChange={(e) => setCatMode(e.target.value as LoanMode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="DIRECT">DIRECT (Peminjaman Langsung tanpa Persetujuan)</option>
                  <option value="ADMIN_APPROVAL">ADMIN_APPROVAL (Perlu Persetujuan Staf Admin Sarpras)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Kategori
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Perangkat komputasi, proyektor, audio visual"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => createCategoryMutation.mutate()}
                  isLoading={createCategoryMutation.isPending}
                  disabled={!catName.trim()}
                >
                  Simpan Kategori
                </Button>
              </div>
            </>
          )}

          {activeTab === 'funding' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Sumber Pendanaan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BOS Reguler 2026"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Sumber Dana
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Bantuan Operasional Satuan Pendidikan Reguler APBN"
                  value={fundDesc}
                  onChange={(e) => setFundDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => createFundingMutation.mutate()}
                  isLoading={createFundingMutation.isPending}
                  disabled={!fundName.trim()}
                >
                  Simpan Sumber Dana
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* MODAL: EDIT DATA MASTER */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => {
          setEditingItem(null);
          resetForms();
        }}
        title={
          editingItem?.type === 'location'
            ? 'Ubah Data Ruangan / Lokasi'
            : editingItem?.type === 'category'
            ? 'Ubah Data Kategori Barang'
            : 'Ubah Data Sumber Pendanaan'
        }
        description="Perubahan nama akan otomatis disinkronkan ke seluruh data barang yang mereferensikan master ini."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          {editingItem?.type === 'location' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Ruangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kode Ruangan
                </label>
                <input
                  type="text"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono uppercase focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Singkat
                </label>
                <textarea
                  rows={2}
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="locActiveCheck"
                  checked={locActive}
                  onChange={(e) => setLocActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="locActiveCheck" className="text-slate-700 font-medium">
                  Status Ruangan Aktif (Dapat dipilih pada penginputan barang)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setEditingItem(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => updateLocationMutation.mutate()}
                  isLoading={updateLocationMutation.isPending}
                  disabled={!locName.trim()}
                >
                  Perbarui Ruangan
                </Button>
              </div>
            </>
          )}

          {editingItem?.type === 'category' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mode Peminjaman Bawaan
                </label>
                <select
                  value={catMode}
                  onChange={(e) => setCatMode(e.target.value as LoanMode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="DIRECT">DIRECT (Peminjaman Langsung)</option>
                  <option value="ADMIN_APPROVAL">ADMIN_APPROVAL (Persetujuan Admin)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Kategori
                </label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catActiveCheck"
                  checked={catActive}
                  onChange={(e) => setCatActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="catActiveCheck" className="text-slate-700 font-medium">
                  Status Kategori Aktif
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setEditingItem(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => updateCategoryMutation.mutate()}
                  isLoading={updateCategoryMutation.isPending}
                  disabled={!catName.trim()}
                >
                  Perbarui Kategori
                </Button>
              </div>
            </>
          )}

          {editingItem?.type === 'funding' && (
            <>
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Sumber Pendanaan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Sumber Dana
                </label>
                <textarea
                  rows={2}
                  value={fundDesc}
                  onChange={(e) => setFundDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fundActiveCheck"
                  checked={fundActive}
                  onChange={(e) => setFundActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="fundActiveCheck" className="text-slate-700 font-medium">
                  Status Sumber Dana Aktif
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setEditingItem(null)}>
                  Batal
                </Button>
                <Button
                  onClick={() => updateFundingMutation.mutate()}
                  isLoading={updateFundingMutation.isPending}
                  disabled={!fundName.trim()}
                >
                  Perbarui Sumber Dana
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* MODAL: KONFIRMASI HAPUS */}
      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        title="Konfirmasi Penghapusan Data Master"
        description="Sistem akan memeriksa keterkaitan data secara ketat. Data yang masih digunakan oleh aset tidak dapat dihapus."
        maxWidth="sm"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <p className="font-semibold">
              Apakah Anda yakin ingin menghapus{' '}
              {deletingItem?.type === 'location'
                ? 'ruangan'
                : deletingItem?.type === 'category'
                ? 'kategori'
                : 'sumber pendanaan'}{' '}
              &quot;{deletingItem?.name}&quot;?
            </p>
            <p className="mt-1 text-[11px] text-rose-700">
              Penghapusan akan ditolak otomatis jika masih ada barang yang mereferensikannya. Sebagai alternatif, Anda dapat menonaktifkan statusnya.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDeletingItem(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deletingItem) return;
                if (deletingItem.type === 'location') {
                  deleteLocationMutation.mutate(deletingItem.id);
                } else if (deletingItem.type === 'category') {
                  deleteCategoryMutation.mutate(deletingItem.id);
                } else if (deletingItem.type === 'funding') {
                  deleteFundingMutation.mutate(deletingItem.id);
                }
              }}
              isLoading={
                deleteLocationMutation.isPending ||
                deleteCategoryMutation.isPending ||
                deleteFundingMutation.isPending
              }
            >
              Hapus Sekarang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
