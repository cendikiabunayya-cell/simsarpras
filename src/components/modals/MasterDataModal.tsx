import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Coins, Layers, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { LoanMode } from '../../types';

interface MasterDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'funding' | 'location' | 'category';
}

export const MasterDataModal: React.FC<MasterDataModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'funding',
}) => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'funding' | 'location' | 'category'>(defaultTab);

  // Form states
  const [fundingName, setFundingName] = useState('');
  const [fundingDesc, setFundingDesc] = useState('');

  const [locationName, setLocationName] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationDesc, setLocationDesc] = useState('');

  const [categoryName, setCategoryName] = useState('');
  const [categoryMode, setCategoryMode] = useState<LoanMode>('DIRECT');
  const [categoryDesc, setCategoryDesc] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Queries
  const { data: fundingSources } = useQuery({
    queryKey: ['funding-sources'],
    queryFn: () => api.getFundingSources(),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.getLocations(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setSuccessMessage(null);
  };

  // Mutations
  const addFundingMutation = useMutation({
    mutationFn: async () => {
      return api.createFundingSource(fundingName, fundingDesc);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funding-sources'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setFundingName('');
      setFundingDesc('');
      showSuccess(`Sumber pendanaan "${data.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan sumber pendanaan.'),
  });

  const addLocationMutation = useMutation({
    mutationFn: async () => {
      return api.createLocation(locationName, locationCode, locationDesc);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setLocationName('');
      setLocationCode('');
      setLocationDesc('');
      showSuccess(`Ruangan "${data.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan ruangan.'),
  });

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      return api.createCategory(categoryName, categoryMode, categoryDesc);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setCategoryName('');
      setCategoryDesc('');
      showSuccess(`Kategori "${data.name}" berhasil ditambahkan.`);
    },
    onError: (err: any) => showError(err?.message || 'Gagal menambahkan kategori.'),
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setErrorMessage(null);
        setSuccessMessage(null);
        onClose();
      }}
      title="Kelola Master Data (Sinkronisasi Otomatis)"
      description="Data yang ditambahkan di sini akan langsung sinkron dengan formulir input/edit data barang."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
            {errorMessage}
          </div>
        )}
        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('funding')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'funding'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Sumber Pendanaan</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('location')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'location'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Ruangan / Lokasi</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('category')}
            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'category'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kategori Barang</span>
          </button>
        </div>

        {/* TAB 1: SUMBER PENDANAAN */}
        {tab === 'funding' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 block text-xs">
                + Tambah Sumber Pendanaan Baru
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nama Sumber Dana (misal: BOS Reguler 2026)"
                  value={fundingName}
                  onChange={(e) => setFundingName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="text"
                  placeholder="Keterangan singkat (opsional)"
                  value={fundingDesc}
                  onChange={(e) => setFundingDesc(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <Button
                size="sm"
                disabled={!fundingName.trim() || addFundingMutation.isPending}
                isLoading={addFundingMutation.isPending}
                onClick={() => addFundingMutation.mutate()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Simpan Sumber Pendanaan
              </Button>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1.5">
                Daftar Sumber Pendanaan Aktif:
              </span>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                {fundingSources?.map((fs) => (
                  <div key={fs.id} className="p-2.5 px-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800">{fs.name}</span>
                      {fs.description && (
                        <p className="text-[11px] text-slate-500">{fs.description}</p>
                      )}
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                      Aktif
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: RUANGAN / LOKASI */}
        {tab === 'location' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 block text-xs">
                + Tambah Ruangan / Lokasi Baru
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Nama Ruangan (misal: Ruang Kelas X RPL 2)"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className="sm:col-span-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
                <input
                  type="text"
                  placeholder="Kode (misal: KLS-RPL2)"
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600 uppercase font-mono"
                />
              </div>
              <Button
                size="sm"
                disabled={!locationName.trim() || addLocationMutation.isPending}
                isLoading={addLocationMutation.isPending}
                onClick={() => addLocationMutation.mutate()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Simpan Ruangan
              </Button>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1.5">
                Daftar Ruangan / Lokasi Aktif:
              </span>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                {locations?.map((loc) => (
                  <div key={loc.id} className="p-2.5 px-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800">{loc.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({loc.code})</span>
                    </div>
                    <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded border border-blue-200">
                      Tersedia
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KATEGORI BARANG */}
        {tab === 'category' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-slate-800 block text-xs">
                + Tambah Kategori Baru
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nama Kategori (misal: Elektronik)"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                />
                <select
                  value={categoryMode}
                  onChange={(e) => setCategoryMode(e.target.value as LoanMode)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
                >
                  <option value="DIRECT">Default DIRECT (Pinjam Langsung)</option>
                  <option value="ADMIN_APPROVAL">Default ADMIN_APPROVAL (Persetujuan Admin)</option>
                </select>
              </div>
              <Button
                size="sm"
                disabled={!categoryName.trim() || addCategoryMutation.isPending}
                isLoading={addCategoryMutation.isPending}
                onClick={() => addCategoryMutation.mutate()}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Simpan Kategori
              </Button>
            </div>

            <div>
              <span className="font-semibold text-slate-700 block mb-1.5">
                Daftar Kategori Terdaftar:
              </span>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                {categories?.map((cat) => (
                  <div key={cat.id} className="p-2.5 px-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="text-[10px] text-purple-700 font-semibold ml-2">
                        [{cat.defaultLoanMode}]
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded">
                      Kategori
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}>
            Selesai
          </Button>
        </div>
      </div>
    </Modal>
  );
};
