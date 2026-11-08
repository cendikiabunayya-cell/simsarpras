import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  HelpCircle,
  Layers,
  RotateCcw,
  Server,
  Wifi,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  DEFAULT_LOCAL_IP_BASE,
  DEFAULT_PUBLIC_QR_DOMAIN,
  generateDomainMigrationSnippets,
  getPublicQrConfig,
  savePublicQrConfig,
  validateQrBaseUrl,
} from '../../services/qrUrlService';

interface DomainMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const DomainMigrationModal: React.FC<DomainMigrationModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const currentConfig = getPublicQrConfig();

  const [activeTab, setActiveTab] = useState<'config' | 'migration'>('config');

  // Form states
  const [mode, setMode] = useState<'ip' | 'custom'>(currentConfig.mode || 'ip');
  const [ipBaseUrl, setIpBaseUrl] = useState(currentConfig.ipBaseUrl || DEFAULT_LOCAL_IP_BASE);
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    currentConfig.publicBaseUrl || DEFAULT_PUBLIC_QR_DOMAIN
  );
  const [urlPattern, setUrlPattern] = useState<'query' | 'path'>(currentConfig.urlPattern);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Migration states
  const [oldDomain, setOldDomain] = useState('http://192.168.100.45:5173');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeUrl = mode === 'ip' ? ipBaseUrl : publicBaseUrl;
  const validation = validateQrBaseUrl(activeUrl, mode);
  const snippets = generateDomainMigrationSnippets(oldDomain, activeUrl);

  const detectedBrowserOrigin =
    typeof window !== 'undefined' &&
    window.location.origin &&
    window.location.origin !== 'null' &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? window.location.origin
      : null;

  const handleSave = () => {
    savePublicQrConfig({
      mode,
      ipBaseUrl: ipBaseUrl.trim(),
      publicBaseUrl: publicBaseUrl.trim(),
      urlPattern,
    });
    setSavedSuccess(true);
    if (onConfigChanged) onConfigChanged();
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const previewTargetUrl = `${(mode === 'ip' ? ipBaseUrl : publicBaseUrl).replace(/\/+$/, '')}${
    urlPattern === 'path' ? '/q/' : '/scan?code='
  }INV-TIK-2024-001`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pengaturan Link QR Code (IP Jaringan / Domain)"
      description="Tentukan apakah QR code yang dicetak menggunakan alamat IP jaringan Wi-Fi lokal atau domain internet resmi."
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            Pengaturan Link QR Code
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('migration')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'migration'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Prosedur Migrasi &amp; Redirect
          </button>
        </div>

        {/* TAB 1: KONFIGURASI LINK QR */}
        {activeTab === 'config' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Pilihan Mode Link QR */}
            <div className="space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                Pilih Mode Link QR Code yang Dicetak:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Opsi 1: Mode IP Lokal */}
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    mode === 'ip'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="radio"
                        name="qrMode"
                        value="ip"
                        checked={mode === 'ip'}
                        onChange={() => setMode('ip')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <Wifi className="w-4 h-4 text-emerald-600" />
                        <strong className="text-slate-900 text-xs">
                          Alamat IP Wi-Fi Lokal (Aktif)
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Sangat cocok untuk pemakaian saat ini. Guru dapat langsung scan via kamera
                      HP / Google Lens saat terhubung ke Wi-Fi sekolah.
                    </p>
                  </div>
                  <span className="mt-2.5 inline-block text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded w-fit">
                    Rekomendasi Saat Ini
                  </span>
                </label>

                {/* Opsi 2: Mode Domain Publik */}
                <label
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    mode === 'custom'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500 shadow-2xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="radio"
                        name="qrMode"
                        value="custom"
                        checked={mode === 'custom'}
                        onChange={() => setMode('custom')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <strong className="text-slate-900 text-xs">
                          Domain Publik Resmi Internet
                        </strong>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Gunakan jika SIMSARPRAS sudah diunggah ke hosting atau VPS dengan domain resmi
                      sekolah (misal: https://sarpras.sekolah.sch.id).
                    </p>
                  </div>
                  <span className="mt-2.5 inline-block text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded w-fit">
                    Untuk Hosting Online
                  </span>
                </label>
              </div>
            </div>

            {/* Input URL Sesuai Mode Terpilih */}
            {mode === 'ip' ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    Alamat IP &amp; Port Komputer Server:
                  </label>
                  <span className="text-[10px] text-slate-500">Wi-Fi Sekolah</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={ipBaseUrl}
                    onChange={(e) => setIpBaseUrl(e.target.value)}
                    placeholder="http://192.168.100.45:5173"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-600 bg-white outline-none font-bold text-blue-900"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIpBaseUrl(DEFAULT_LOCAL_IP_BASE)}
                    className="text-[11px] shrink-0"
                    title="Kembalikan ke IP 192.168.100.45:5173"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    IP Default
                  </Button>
                </div>

                {detectedBrowserOrigin && (
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-500">
                      Terdeteksi akses via: <strong className="font-mono text-slate-700">{detectedBrowserOrigin}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIpBaseUrl(detectedBrowserOrigin)}
                      className="text-blue-700 font-semibold hover:underline"
                    >
                      Gunakan IP ini
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    URL Domain Publik Resmi:
                  </label>
                  <span className="text-[10px] text-slate-500">Protokol HTTPS</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={publicBaseUrl}
                    onChange={(e) => setPublicBaseUrl(e.target.value)}
                    placeholder="https://sarpras.cendikiabunayya.sch.id"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-600 bg-white outline-none font-bold text-blue-900"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPublicBaseUrl(DEFAULT_PUBLIC_QR_DOMAIN)}
                    className="text-[11px] shrink-0"
                  >
                    Reset Domain
                  </Button>
                </div>
              </div>
            )}

            {/* Validation Message */}
            {validation.isWarning && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>{validation.message}</div>
              </div>
            )}

            {!validation.isValid && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>{validation.message}</div>
              </div>
            )}

            {/* Pilihan Format URL */}
            <div>
              <label className="block font-semibold text-slate-800 mb-1.5 text-xs">
                Format Jalur Link QR:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    urlPattern === 'query'
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="urlPattern"
                      value="query"
                      checked={urlPattern === 'query'}
                      onChange={() => setUrlPattern('query')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <strong className="text-slate-900 text-xs">
                      Format Parameter /scan?code=... (Standar)
                    </strong>
                  </div>
                  <code className="text-[10px] text-blue-700 font-mono break-all mt-1 bg-white p-1 rounded border border-slate-200">
                    {(mode === 'ip' ? ipBaseUrl : publicBaseUrl).replace(/\/+$/, '')}
                    /scan?code=INV-TIK-2024-001
                  </code>
                </label>

                <label
                  className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    urlPattern === 'path'
                      ? 'border-blue-600 bg-blue-50/60 ring-1 ring-blue-600'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="urlPattern"
                      value="path"
                      checked={urlPattern === 'path'}
                      onChange={() => setUrlPattern('path')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <strong className="text-slate-900 text-xs">
                      Permalink Singkat /q/...
                    </strong>
                  </div>
                  <code className="text-[10px] text-blue-700 font-mono break-all mt-1 bg-white p-1 rounded border border-slate-200">
                    {(mode === 'ip' ? ipBaseUrl : publicBaseUrl).replace(/\/+$/, '')}
                    /q/INV-TIK-2024-001
                  </code>
                </label>
              </div>
            </div>

            {/* Simulasi Preview Link QR Code yang Dicetak */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-semibold uppercase tracking-wider">
                <span>Simulasi Hasil Link Pada Barcode QR:</span>
                <span className="text-emerald-400 font-bold">● Siap Di-scan Google Lens &amp; Kamera HP</span>
              </div>
              <div className="font-mono text-xs text-emerald-300 font-bold break-all bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
                {previewTargetUrl}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Saat guru memindai stiker ini dengan kamera smartphone di jaringan Wi-Fi sekolah, HP akan langsung membuka detail barang dan form peminjaman.
              </p>
            </div>

            {savedSuccess && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pengaturan link QR code berhasil disimpan! Label cetak sekarang otomatis menggunakan link ini.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Tutup
              </Button>
              <Button size="sm" onClick={handleSave} className="bg-blue-800 hover:bg-blue-900">
                Simpan &amp; Terapkan ke Label QR
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: PROSEDUR MIGRASI & REDIRECT DOMAIN */}
        {activeTab === 'migration' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-950">
              <strong className="block font-bold flex items-center gap-1.5 text-xs">
                <HelpCircle className="w-4 h-4 text-amber-700" />
                Bagaimana Jika IP atau Domain Berubah di Kemudian Hari?
              </strong>
              <p className="text-[11px] leading-relaxed text-amber-900">
                Jika IP komputer atau domain sekolah berganti, <strong>stiker fisik yang sudah tertempel tidak perlu dicetak ulang</strong>. Anda cukup memasang aturan redirect (pengalihan otomatis) pada server lama ke server baru. Barcode lama yang sudah dicetak akan otomatis dialihkan ke alamat baru!
              </p>
            </div>

            {/* Input Domain/IP Lama untuk Generator Snippet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Alamat / IP Lama yang Pernah Dicetak:
                </label>
                <input
                  type="text"
                  value={oldDomain}
                  onChange={(e) => setOldDomain(e.target.value)}
                  placeholder="http://192.168.100.45:5173"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                  Alamat / Domain Tujuan Baru (Aktif):
                </label>
                <input
                  type="text"
                  value={activeUrl}
                  disabled
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono text-xs bg-slate-100 text-slate-600"
                />
              </div>
            </div>

            {/* Generator Snippet Code Blocks */}
            <div className="space-y-3">
              {/* 1. Nginx */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
                <div className="px-3 py-2 bg-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-400" />
                    1. Konfigurasi Nginx Server Block (301 Permanent Redirect)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(snippets.nginxSnippet, 'nginx')}
                    className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-white"
                  >
                    {copiedKey === 'nginx' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'nginx' ? 'Tersalin' : 'Salin Nginx'}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono overflow-x-auto text-emerald-300">
                  {snippets.nginxSnippet}
                </pre>
              </div>

              {/* 2. Apache .htaccess */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
                <div className="px-3 py-2 bg-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    2. Konfigurasi Apache .htaccess (cPanel / Shared Hosting)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(snippets.apacheSnippet, 'apache')}
                    className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-white"
                  >
                    {copiedKey === 'apache' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'apache' ? 'Tersalin' : 'Salin .htaccess'}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono overflow-x-auto text-amber-300">
                  {snippets.apacheSnippet}
                </pre>
              </div>

              {/* 3. Universal HTML Redirector */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
                <div className="px-3 py-2 bg-slate-800 flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    3. Script Universal HTML (File index.html Mandiri di Server Lama)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(snippets.htmlRedirectScript, 'html')}
                    className="flex items-center gap-1 text-[10px] text-blue-300 hover:text-white"
                  >
                    {copiedKey === 'html' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'html' ? 'Tersalin' : 'Salin index.html'}
                  </button>
                </div>
                <pre className="p-3 text-[11px] font-mono overflow-x-auto text-cyan-300 max-h-36">
                  {snippets.htmlRedirectScript}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
