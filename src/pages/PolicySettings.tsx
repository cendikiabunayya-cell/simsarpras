import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Globe,
  ShieldAlert,
  Sliders,
  Wifi,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { AssetUnit, LoanMode } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { DomainMigrationModal } from '../components/modals/DomainMigrationModal';
import { getEffectiveBaseUrl, getPublicQrConfig } from '../services/qrUrlService';

export const PolicySettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { canManageAssets } = useAuth();

  const [selectedAsset, setSelectedAsset] = useState<AssetUnit | null>(null);
  const [newMode, setNewMode] = useState<LoanMode>('DIRECT');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);
  const publicQrConfig = useMemo(() => getPublicQrConfig(), [configVersion]);

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.getAssets(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const policyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAsset) return;
      return api.updateAssetLoanMode(selectedAsset.id, newMode);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSelectedAsset(null);
    },
  });

  if (!canManageAssets) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-800">Akses Terbatas</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          Hanya Admin Sarpras yang memiliki wewenang untuk mengubah kebijakan peminjaman barang inventaris sekolah.
        </p>
      </div>
    );
  }

  const filteredAssets = assets?.filter((a) =>
    filterCategory ? a.categoryName === filterCategory : true
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Kebijakan & Konfigurasi Sistem Sarpras
          </h2>
          <p className="text-xs text-slate-500">
            Atur mode peminjaman aset (DIRECT / APPROVAL) dan domain publik kanonikal stiker QR code.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsDomainModalOpen(true)}
          leftIcon={
            publicQrConfig.mode === 'ip' ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <Globe className="w-4 h-4 text-blue-600" />
            )
          }
          className="text-xs font-semibold text-slate-700 bg-white shadow-2xs hover:bg-emerald-50 shrink-0"
        >
          {publicQrConfig.mode === 'ip'
            ? `Link QR: IP Wi-Fi (${getEffectiveBaseUrl(publicQrConfig).replace('http://', '')})`
            : `Link QR: Domain (${publicQrConfig.publicBaseUrl.replace('https://', '')})`}
        </Button>
      </div>

      {/* Explanatory Rule Box */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-3">
        <Sliders className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block font-bold">Aturan Penentuan Kebijakan Peminjaman:</strong>
          Barang dengan mode <strong>DIRECT</strong> dapat langsung diambil/diserahterimakan segera setelah guru memindai QR code via smartphone atau membuat permohonan. Barang dengan mode <strong>ADMIN_APPROVAL</strong> (seperti proyektor mahal, kamera DSLR, drone) wajib disetujui petugas Sarpras terlebih dahulu demi keamanan aset sekolah.
        </div>
      </div>

      {/* Assets Policy Table */}
      <Card>
        <CardHeader className="py-3 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm">Data Barang & Mode Peminjaman Aktif</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label="Filter kategori kebijakan"
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
            >
              <option value="">Semua Kategori</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b">
                  <tr>
                    <th className="px-5 py-3">Nama Barang / Sarana</th>
                    <th className="px-5 py-3">Kode Inventaris</th>
                    <th className="px-5 py-3">Kategori</th>
                    <th className="px-5 py-3">Sumber Pendanaan</th>
                    <th className="px-5 py-3">Mode Peminjaman</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets?.map((asset) => {
                    const isDirect = asset.effectiveLoanMode === 'DIRECT';

                    return (
                      <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{asset.itemName}</div>
                          <div className="text-[11px] text-slate-500">
                            {asset.itemBrand} • Thn {asset.acquisitionYear}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono font-semibold text-slate-700">
                          {asset.assetCode}
                        </td>

                        <td className="px-5 py-4 text-slate-700 font-medium">
                          {asset.categoryName}
                        </td>

                        <td className="px-5 py-4 text-slate-700 font-semibold">
                          {asset.fundingSource}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              isDirect
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {isDirect ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                DIRECT (Langsung)
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3 text-purple-600" />
                                PERLU PERSETUJUAN
                              </>
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAsset(asset);
                              setNewMode(asset.effectiveLoanMode);
                            }}
                          >
                            Ubah Mode
                          </Button>
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

      {/* POLICY EDIT MODAL */}
      <Modal
        isOpen={Boolean(selectedAsset)}
        onClose={() => setSelectedAsset(null)}
        title="Ubah Mode Peminjaman Barang"
        description="Pembaruan ini akan menentukan alur kerja peminjaman saat guru memindai barcode atau mengajukan pinjaman."
        maxWidth="md"
      >
        {selectedAsset && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-400 block text-[11px]">Barang Terpilih:</span>
              <strong className="text-slate-900 text-sm block">{selectedAsset.itemName}</strong>
              <div className="text-slate-600 font-mono mt-0.5">
                {selectedAsset.assetCode} • {selectedAsset.categoryName}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">
                Pilih Alur Kebijakan Peminjaman
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    newMode === 'DIRECT'
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="loanMode"
                    value="DIRECT"
                    checked={newMode === 'DIRECT'}
                    onChange={() => setNewMode('DIRECT')}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <strong className="block text-slate-900 font-bold">
                      DIRECT (Peminjaman Cepat Tanpa Approval)
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Langsung berstatus Aktif dipinjam segera setelah di-scan dengan HP atau diajukan. Cocok untuk barang rutin/habis pakai (kabel, proyektor kelas, pointer, bola olahraga).
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    newMode === 'ADMIN_APPROVAL'
                      ? 'border-purple-500 bg-purple-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="loanMode"
                    value="ADMIN_APPROVAL"
                    checked={newMode === 'ADMIN_APPROVAL'}
                    onChange={() => setNewMode('ADMIN_APPROVAL')}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <strong className="block text-slate-900 font-bold">
                      ADMIN_APPROVAL (Wajib Disetujui Petugas Sarpras)
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Wajib menunggu persetujuan admin sarpras di sistem sebelum barang diserahterimakan. Wajib untuk aset berharga tinggi (kamera DSLR studio, sound system aula, laptop inventaris).
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 leading-relaxed text-[11px]">
              <strong>Konfirmasi Audit:</strong> Perubahan kebijakan ini langsung tersinkronisasi ke sistem dan dicatat ke log audit aktivitas.
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setSelectedAsset(null)}
                disabled={policyMutation.isPending}
              >
                Batal
              </Button>
              <Button
                isLoading={policyMutation.isPending}
                onClick={() => policyMutation.mutate()}
                className="bg-blue-800 hover:bg-blue-900"
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal Pengaturan Domain Publik & Migrasi Redirect QR */}
      <DomainMigrationModal
        isOpen={isDomainModalOpen}
        onClose={() => setIsDomainModalOpen(false)}
        onConfigChanged={() => setConfigVersion((v) => v + 1)}
      />
    </div>
  );
};
