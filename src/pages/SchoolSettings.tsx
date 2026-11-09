import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const SchoolSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const [schoolName, setSchoolName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [headmasterName, setHeadmasterName] = useState('');
  const [headmasterNip, setHeadmasterNip] = useState('');
  const [sarprasManagerName, setSarprasManagerName] = useState('');
  const [sarprasManagerNip, setSarprasManagerNip] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [logoPreviewFailed, setLogoPreviewFailed] = useState(false);

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ['school-settings'],
    queryFn: () => api.getSchoolSettings(),
  });

  useEffect(() => {
    if (settings) {
      setSchoolName(settings.schoolName || '');
      setAddress(settings.address || '');
      setPhone(settings.phone || '');
      setEmail(settings.email || '');
      setLogoUrl(settings.logoUrl || '');
      setHeadmasterName(settings.headmasterName || 'Drs. H. Ahmad Sudirman, M.Pd.');
      setHeadmasterNip(settings.headmasterNip || '196811121994031002');
      setSarprasManagerName(settings.sarprasManagerName || 'Bambang Hermawan, S.Kom.');
      setSarprasManagerNip(settings.sarprasManagerNip || '198204152008011005');
      setLogoPreviewFailed(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!schoolName.trim()) {
        throw new Error('Nama sekolah wajib diisi.');
      }
      if (
        logoUrl.trim() &&
        !logoUrl.trim().startsWith('https://') &&
        !logoUrl.trim().startsWith('/')
      ) {
        throw new Error('Tautan logo harus menggunakan protokol HTTPS (https://) atau path lokal (contoh: /logo-cendikia.png).');
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error('Format email sekolah tidak valid.');
      }

      return api.updateSchoolSettings({
        schoolName: schoolName.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logoUrl: logoUrl.trim(),
        headmasterName: headmasterName.trim(),
        headmasterNip: headmasterNip.trim(),
        sarprasManagerName: sarprasManagerName.trim(),
        sarprasManagerNip: sarprasManagerNip.trim(),
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['school-settings'], updated);
      queryClient.invalidateQueries({ queryKey: ['school-settings'] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      setSuccessMsg('Pengaturan identitas sekolah berhasil disimpan.');
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Gagal menyimpan pengaturan sekolah.');
      setSuccessMsg(null);
    },
  });

  const canEdit = currentUser.role === 'ADMIN_SARPRAS';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Pengaturan Identitas Sekolah
            </h1>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
              Admin Sarpras
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Konfigurasi nama instansi, alamat, kontak, dan logo resmi yang digunakan pada kop laporan inventaris dan aplikasi SIMSARPRAS.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Muat Ulang
        </Button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isError && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>Gagal menyinkronkan data dari server. Memuat preferensi cache lokal.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Formulir Pengaturan Identitas */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-600" />
                <span>Identitas & Kontak Lembaga</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Perubahan pada data ini akan langsung mempengaruhi identitas resmi aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Nama Sekolah */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Resmi Sekolah / Lembaga <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canEdit || isLoading}
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Contoh: MIS Cendikia Bunayya"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 transition"
                />
              </div>

              {/* Alamat Lengkap */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Lengkap Satuan Pendidikan
                </label>
                <textarea
                  rows={3}
                  disabled={!canEdit || isLoading}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Contoh: Jl. Pendidikan No. 123, Kel. Suka Maju, Kec. Medan Amplas, Kota Medan"
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 transition resize-none"
                />
              </div>

              {/* Kontak: Telepon & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Telepon / Kontak
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      disabled={!canEdit || isLoading}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Kedinasan
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      disabled={!canEdit || isLoading}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarpras@cendikiabunayya.sch.id"
                      className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Tautan Logo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tautan URL Logo Sekolah (HTTPS atau Path Lokal)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    disabled={!canEdit || isLoading}
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setLogoPreviewFailed(false);
                    }}
                    placeholder="https://example.com/logo.png atau /logo-cendikia.png"
                    className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-50 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Masukkan link langsung ke gambar (PNG/SVG/WebP) berprotokol HTTPS atau path lokal publik seperti <code>/logo-cendikia.png</code>.
                </p>
              </div>

              {/* Bagian Pejabat Penandatangan Laporan */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Pejabat Penandatangan Laporan (Pengesahan)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 -mt-2">
                  Pejabat ini akan otomatis tercantum pada bagian tanda tangan bawah di semua lembar cetak Laporan & Rekapitulasi Sarpras.
                </p>

                {/* Grid Kepala Madrasah & Pengelola Sarpras */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Kepala Madrasah */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                      Kepala Madrasah
                    </span>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Lengkap Kepala Madrasah
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit || isLoading}
                        value={headmasterName}
                        onChange={(e) => setHeadmasterName(e.target.value)}
                        placeholder="Contoh: Drs. H. Ahmad Sudirman, M.Pd."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        NIP / Identitas Pegawai
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit || isLoading}
                        value={headmasterNip}
                        onChange={(e) => setHeadmasterNip(e.target.value)}
                        placeholder="Contoh: 196811121994031002"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-100 transition"
                      />
                    </div>
                  </div>

                  {/* Pengelola Sarana & Prasarana */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Pengelola Sarana & Prasarana
                    </span>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Nama Lengkap Pengelola Sarpras
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit || isLoading}
                        value={sarprasManagerName}
                        onChange={(e) => setSarprasManagerName(e.target.value)}
                        placeholder="Contoh: Bambang Hermawan, S.Kom."
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-100 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        NIP / Identitas Pegawai
                      </label>
                      <input
                        type="text"
                        disabled={!canEdit || isLoading}
                        value={sarprasManagerNip}
                        onChange={(e) => setSarprasManagerNip(e.target.value)}
                        placeholder="Contoh: 198204152008011005"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:bg-slate-100 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    isLoading={saveMutation.isPending}
                    disabled={saveMutation.isPending || !schoolName.trim()}
                    leftIcon={<Save className="w-4 h-4" />}
                    className="px-6"
                  >
                    Simpan Pengaturan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Preview & Metadata */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card Kop Surat / Preview Lembaga */}
          <Card className="border border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>Pratinjau Kop Laporan</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Tampilan header identitas yang akan tercantum pada kop cetak laporan inventaris.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="p-4 bg-white border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  {/* Logo Container */}
                  <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPreviewFailed ? (
                      <Building className="w-7 h-7 text-slate-400" />
                    ) : (
                      <img
                        src={logoUrl || '/logo-cendikia.png'}
                        alt="Logo Sekolah"
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          const target = e.currentTarget;
                          if (!target.src.endsWith('/logo-cendikia.png')) {
                            target.src = '/logo-cendikia.png';
                          } else {
                            setLogoPreviewFailed(true);
                          }
                        }}
                      />
                    )}
                  </div>

                  {/* School Name & Meta */}
                  <div className="flex-1 min-w-0 font-serif">
                    <h4 className="font-extrabold text-slate-900 text-xs uppercase leading-tight truncate">
                      YAYASAN PENDIDIKAN CENDIKIA BUNAYYA
                    </h4>
                    <h3 className="font-bold text-slate-800 text-xs uppercase leading-tight truncate mt-0.5">
                      {schoolName || 'Madrasah Ibtidaiyah Swasta Cendikia Bunayya'}
                    </h3>
                  </div>
                </div>

                <div className="pt-2 border-b-2 border-double border-slate-800 pb-2 space-y-1 text-xs text-slate-600 font-serif">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-relaxed">
                      {address || 'Alamat sekolah belum diisi'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
                    {phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {phone}
                      </span>
                    )}
                    {email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pratinjau Pejabat Penandatangan Laporan */}
                <div className="pt-1 grid grid-cols-2 gap-2 text-center text-[10px]">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-slate-400 font-medium text-[9px]">Kepala Madrasah</p>
                    <div className="h-4" />
                    <p className="font-bold text-slate-800 underline truncate">{headmasterName || 'Drs. H. Ahmad Sudirman, M.Pd.'}</p>
                    <p className="text-slate-500 text-[9px]">{headmasterNip ? `NIP. ${headmasterNip}` : '-'}</p>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-slate-400 font-medium text-[9px]">Pengelola Sarpras</p>
                    <div className="h-4" />
                    <p className="font-bold text-slate-800 underline truncate">{sarprasManagerName || 'Bambang Hermawan, S.Kom.'}</p>
                    <p className="text-slate-500 text-[9px]">{sarprasManagerNip ? `NIP. ${sarprasManagerNip}` : '-'}</p>
                  </div>
                </div>
              </div>

              {settings?.updatedAt && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    Terakhir diperbarui:
                  </span>
                  <span className="font-medium text-slate-700">
                    {new Date(settings.updatedAt).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips Keamanan & Penggunaan */}
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2 text-xs text-blue-900">
            <span className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              Integritas Data Master
            </span>
            <p className="text-blue-800 leading-relaxed text-[11px]">
              Pengaturan ini disimpan secara persisten di backend server SIMSARPRAS. Setiap perubahan dicatat ke dalam log audit aktivitas demi akuntabilitas pengelolaan aset sekolah.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
