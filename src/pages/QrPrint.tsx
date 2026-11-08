import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Coins,
  Globe,
  Layers,
  Minus,
  Move,
  Plus,
  Printer,
  QrCode,
  Settings,
  Square,
  Type,
  Wifi,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { Barcode1D } from '../components/ui/Barcode1D';
import { SCHOOL_UNITS } from '../types';
import {
  getCanonicalQrUrl,
  getEffectiveBaseUrl,
  getPublicQrConfig,
} from '../services/qrUrlService';
import { DomainMigrationModal } from '../components/modals/DomainMigrationModal';
import { useSchoolSettings } from '../hooks/useSchoolSettings';

export const QrPrint: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('select');
  const { schoolName } = useSchoolSettings();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.getAssets(),
  });

  // Selected asset IDs for printing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Filter seleksi barang untuk cetak
  const [institutionFilter, setInstitutionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [itemNumberFilter, setItemNumberFilter] = useState('');

  // Domain & Migration Modal state
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [qrConfigVersion, setQrConfigVersion] = useState(0);
  const publicQrConfig = useMemo(() => getPublicQrConfig(), [qrConfigVersion]);

  // Label configuration based on the user's latest sketch:
  // Kiri: Kotak BARKODE (QR Code / Barcode)
  // Kanan:
  // Bagian 1: [kode
  //            nama] (Atas Bawah)
  // Bagian 2: [Sumber Pendanaan & Tahun Perolehan] (HURUF KAPITAL & Ukuran Lebih Besar)
  // Bagian 3: [NAMA SEKOLAH] (Otomatis mengikuti Satuan Pendidikan masing-masing barang)
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'badge'>('standard');
  const [columns, setColumns] = useState<'1' | '2' | '3'>('2');
  const [barcodeType, setBarcodeType] = useState<'QR' | 'BARCODE_1D'>('QR');
  const [boxStyle, setBoxStyle] = useState<'clean' | 'boxed'>('clean');
  const [showFundingPrefix, setShowFundingPrefix] = useState(false);
  const [yearSeparator, setYearSeparator] = useState<
    'with_year' | 'dash_year' | 'parentheses_year' | 'dash' | 'parentheses' | 'slash'
  >('with_year');
  const [textSpacing, setTextSpacing] = useState<'tight' | 'compact' | 'normal'>('tight');
  const [borderStyle, setBorderStyle] = useState<'solid' | 'dashed' | 'none'>('solid');
  const [showCategoryItemNumber, setShowCategoryItemNumber] = useState<boolean>(true);

  // Sumber Nama Sekolah: 'auto_unit' (Otomatis sesuai Satuan Pendidikan barang) atau 'custom' (Teks kustom manual)
  const [schoolNameSource, setSchoolNameSource] = useState<'auto_unit' | 'custom'>('auto_unit');
  const [customSchoolName, setCustomSchoolName] = useState('');

  // Helper untuk mendapatkan nama sekolah pada label suatu aset
  const getSchoolNameForAsset = (assetInstitution?: string) => {
    if (schoolNameSource === 'custom' && customSchoolName.trim()) {
      return customSchoolName.trim().toUpperCase();
    }
    // Default otomatis: Ikuti Satuan Pendidikan masing-masing barang atau Pengaturan Sekolah
    return (assetInstitution || schoolName || 'MIS Cendikia Bunayya').toUpperCase();
  };

  // Font Size States
  const [globalFontScale, setGlobalFontScale] = useState<
    'small' | 'normal' | 'large' | 'xlarge' | 'custom'
  >('normal');
  const [codeFontSize, setCodeFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [nameFontSize, setNameFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [categoryItemNumberFontSize, setCategoryItemNumberFontSize] = useState<
    'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge'
  >('large');
  const [fundingFontSize, setFundingFontSize] = useState<'medium' | 'large' | 'xlarge'>('large');
  const [schoolFontSize, setSchoolFontSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [showAdvancedFont, setShowAdvancedFont] = useState(false);

  // Pengaturan Margin Kertas Saat Mencetak (Print Page Margins) dalam mm
  const [printMarginTop, setPrintMarginTop] = useState<number>(5);
  const [printMarginBottom, setPrintMarginBottom] = useState<number>(5);
  const [printMarginLeft, setPrintMarginLeft] = useState<number>(5);
  const [printMarginRight, setPrintMarginRight] = useState<number>(5);
  const [printMarginPreset, setPrintMarginPreset] = useState<
    'minimal' | 'compact' | 'normal' | 'loose' | 'custom'
  >('compact');

  const applyPrintMarginPreset = (preset: 'minimal' | 'compact' | 'normal' | 'loose') => {
    setPrintMarginPreset(preset);
    switch (preset) {
      case 'minimal':
        setPrintMarginTop(0);
        setPrintMarginBottom(0);
        setPrintMarginLeft(0);
        setPrintMarginRight(0);
        break;
      case 'compact':
        setPrintMarginTop(5);
        setPrintMarginBottom(5);
        setPrintMarginLeft(5);
        setPrintMarginRight(5);
        break;
      case 'normal':
        setPrintMarginTop(10);
        setPrintMarginBottom(10);
        setPrintMarginLeft(10);
        setPrintMarginRight(10);
        break;
      case 'loose':
        setPrintMarginTop(15);
        setPrintMarginBottom(15);
        setPrintMarginLeft(15);
        setPrintMarginRight(15);
        break;
    }
  };

  // State untuk accordion pengaturan jarak dalam kotak stiker
  const [showInnerPadding, setShowInnerPadding] = useState(false);

  // Pengaturan Padding / Kerapatan Dalam Kotak Stiker Label (mm)
  const [marginTop, setMarginTop] = useState<number>(2);
  const [marginBottom, setMarginBottom] = useState<number>(2);
  const [marginLeft, setMarginLeft] = useState<number>(3);
  const [marginRight, setMarginRight] = useState<number>(3);
  const [marginPreset, setMarginPreset] = useState<'minimal' | 'compact' | 'normal' | 'loose' | 'custom'>('compact');

  const applyMarginPreset = (preset: 'minimal' | 'compact' | 'normal' | 'loose') => {
    setMarginPreset(preset);
    switch (preset) {
      case 'minimal':
        setMarginTop(1);
        setMarginBottom(1);
        setMarginLeft(2);
        setMarginRight(2);
        break;
      case 'compact':
        setMarginTop(2);
        setMarginBottom(2);
        setMarginLeft(3);
        setMarginRight(3);
        break;
      case 'normal':
        setMarginTop(4);
        setMarginBottom(4);
        setMarginLeft(6);
        setMarginRight(6);
        break;
      case 'loose':
        setMarginTop(6);
        setMarginBottom(6);
        setMarginLeft(8);
        setMarginRight(8);
        break;
    }
  };

  const getBoxedPaddingClass = () => {
    if (marginLeft <= 2) return 'px-1';
    if (marginLeft <= 4) return 'px-1.5';
    return 'px-2';
  };

  const handleGlobalScaleChange = (scale: 'small' | 'normal' | 'large' | 'xlarge') => {
    setGlobalFontScale(scale);
    switch (scale) {
      case 'small':
        setCodeFontSize('small');
        setNameFontSize('small');
        setCategoryItemNumberFontSize('small');
        setFundingFontSize('medium');
        setSchoolFontSize('small');
        break;
      case 'normal':
        setCodeFontSize('medium');
        setNameFontSize('medium');
        setCategoryItemNumberFontSize('large');
        setFundingFontSize('large');
        setSchoolFontSize('medium');
        break;
      case 'large':
        setCodeFontSize('large');
        setNameFontSize('large');
        setCategoryItemNumberFontSize('xlarge');
        setFundingFontSize('xlarge');
        setSchoolFontSize('large');
        break;
      case 'xlarge':
        setCodeFontSize('large');
        setNameFontSize('xlarge');
        setCategoryItemNumberFontSize('xxlarge');
        setFundingFontSize('xlarge');
        setSchoolFontSize('large');
        break;
    }
  };

  const stepFontScale = (direction: 'up' | 'down') => {
    const scales: Array<'small' | 'normal' | 'large' | 'xlarge'> = ['small', 'normal', 'large', 'xlarge'];
    const currentIdx = scales.indexOf(globalFontScale as any);
    if (direction === 'up') {
      const nextIdx = currentIdx === -1 ? 2 : Math.min(scales.length - 1, currentIdx + 1);
      handleGlobalScaleChange(scales[nextIdx]);
    } else {
      const prevIdx = currentIdx === -1 ? 0 : Math.max(0, currentIdx - 1);
      handleGlobalScaleChange(scales[prevIdx]);
    }
  };

  // Format Sumber Pendanaan & Tahun Perolehan (Selalu HURUF KAPITAL sesuai instruksi)
  const formatFundingAndYear = (funding?: string, year?: number | string) => {
    const f = (funding || '').trim();
    const y = year !== undefined && year !== null && String(year).trim() !== '' ? String(year).trim() : '';

    let combined = '';
    if (f && y) {
      if (f.endsWith(y)) {
        combined = f;
      } else {
        const hasTahunWord = f.toUpperCase().includes('TAHUN');
        switch (yearSeparator) {
          case 'with_year':
            combined = hasTahunWord ? `${f} ${y}` : `${f} TAHUN ${y}`;
            break;
          case 'dash_year':
            combined = hasTahunWord ? `${f} - ${y}` : `${f} - TAHUN ${y}`;
            break;
          case 'parentheses_year':
            combined = hasTahunWord ? `${f} (${y})` : `${f} (TAHUN ${y})`;
            break;
          case 'parentheses':
            combined = `${f} (${y})`;
            break;
          case 'slash':
            combined = `${f} / ${y}`;
            break;
          case 'dash':
          default:
            combined = `${f} - ${y}`;
            break;
        }
      }
    } else if (y) {
      combined = ['with_year', 'dash_year', 'parentheses_year'].includes(yearSeparator)
        ? `TAHUN ${y}`
        : y;
    } else {
      combined = f || '-';
    }

    if (showFundingPrefix) {
      return `SUMBER PENDANAAN: ${combined}`.toUpperCase();
    }
    return combined.toUpperCase();
  };

  // Helper kelas ukuran font untuk Kategori + Nomor Barang (Pojok Kanan Atas, misal: "Laptop 01")
  const getCategoryItemNumberFontSizeClass = (isCompact: boolean, isBadge: boolean) => {
    switch (categoryItemNumberFontSize) {
      case 'small':
        if (isCompact) return 'text-[10px] font-black';
        if (isBadge) return 'text-xs font-black';
        return 'text-[11px] font-black';
      case 'medium':
        if (isCompact) return 'text-[11px] font-black';
        if (isBadge) return 'text-sm font-black';
        return 'text-xs sm:text-[13px] font-black';
      case 'large':
        if (isCompact) return 'text-xs font-black';
        if (isBadge) return 'text-base sm:text-lg font-black';
        return 'text-sm sm:text-base font-black';
      case 'xlarge':
        if (isCompact) return 'text-[13px] sm:text-sm font-black';
        if (isBadge) return 'text-lg sm:text-xl font-black';
        return 'text-base sm:text-lg font-black';
      case 'xxlarge':
        if (isCompact) return 'text-sm sm:text-base font-black';
        if (isBadge) return 'text-xl sm:text-2xl font-black';
        return 'text-lg sm:text-xl font-black';
      default:
        if (isCompact) return 'text-xs font-black';
        if (isBadge) return 'text-base sm:text-lg font-black';
        return 'text-sm sm:text-base font-black';
    }
  };

  // Helper kelas ukuran font untuk Kode Inventaris
  const getCodeFontSizeClass = (isCompact: boolean, isBadge: boolean) => {
    switch (codeFontSize) {
      case 'small':
        if (isCompact) return 'text-[9px]';
        if (isBadge) return 'text-[11px]';
        return 'text-[10px]';
      case 'large':
        if (isCompact) return 'text-[11px] font-bold';
        if (isBadge) return 'text-sm font-bold';
        return 'text-xs font-bold';
      case 'medium':
      default:
        if (isCompact) return 'text-[10px]';
        if (isBadge) return 'text-xs';
        return 'text-[11px]';
    }
  };

  // Helper kelas ukuran font untuk Nama Barang
  const getNameFontSizeClass = (isCompact: boolean, isBadge: boolean) => {
    switch (nameFontSize) {
      case 'small':
        if (isCompact) return 'text-[10px]';
        if (isBadge) return 'text-xs';
        return 'text-[11px]';
      case 'large':
        if (isCompact) return 'text-xs sm:text-[13px]';
        if (isBadge) return 'text-base font-extrabold';
        return 'text-[13px] sm:text-sm font-extrabold';
      case 'xlarge':
        if (isCompact) return 'text-[13px] sm:text-sm font-black';
        if (isBadge) return 'text-lg font-black';
        return 'text-sm sm:text-base font-black';
      case 'medium':
      default:
        if (isCompact) return 'text-[11px]';
        if (isBadge) return 'text-sm';
        return 'text-xs';
    }
  };

  // Helper kelas ukuran font untuk Sumber Pendanaan & Tahun Perolehan (Ukuran Lebih Besar)
  const getFundingFontSizeClass = (isCompact: boolean, isBadge: boolean) => {
    if (fundingFontSize === 'xlarge') {
      if (isCompact) return 'text-xs sm:text-[13px] font-black';
      if (isBadge) return 'text-lg sm:text-xl font-black';
      return 'text-base sm:text-[17px] font-black';
    }
    if (fundingFontSize === 'medium') {
      if (isCompact) return 'text-[10px] font-bold';
      if (isBadge) return 'text-sm font-bold';
      return 'text-xs font-bold';
    }
    // 'large' (Default: Ukuran Lebih Besar)
    if (isCompact) return 'text-[11px] sm:text-xs font-black';
    if (isBadge) return 'text-base sm:text-lg font-black';
    return 'text-sm sm:text-[15px] font-black';
  };

  // Helper kelas ukuran font untuk Nama Sekolah
  const getSchoolFontSizeClass = (isCompact: boolean, isBadge: boolean) => {
    switch (schoolFontSize) {
      case 'small':
        if (isCompact) return 'text-[9px]';
        if (isBadge) return 'text-[11px]';
        return 'text-[10px]';
      case 'large':
        if (isCompact) return 'text-[11px] font-extrabold';
        if (isBadge) return 'text-sm font-extrabold';
        return 'text-xs font-extrabold';
      case 'medium':
      default:
        if (isCompact) return 'text-[10px] font-bold';
        if (isBadge) return 'text-xs font-bold';
        return 'text-[11px] font-bold';
    }
  };

  // Helper title case untuk label kategori
  const toCategoryTitleCase = (str: string): string => {
    if (!str) return '';
    if (str.toUpperCase() === 'TIK' || str.toUpperCase() === 'PC') return str.toUpperCase();
    return str
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Helper kombinasi kategori + nomor barang (misal: "Laptop 01") sesuai instruksi sketsa label
  const getCombinedCategoryAndNumber = (asset: {
    id?: string;
    itemNumber?: string | null;
    categoryName?: string;
    itemName?: string;
    assetCode?: string;
  }): string => {
    // 1. Tentukan nomor barang
    let num = (asset.itemNumber && String(asset.itemNumber).trim()) || '';

    // Jika belum diisi nomor barang, cari nomor urut otomatis berdasarkan urutan barang sejenis
    if (!num && assets && asset.id) {
      const sameCategory = assets.filter(
        (a) => (a.categoryName || 'Umum') === (asset.categoryName || 'Umum')
      );
      const idx = sameCategory.findIndex((a) => a.id === asset.id);
      if (idx !== -1) {
        num = String(idx + 1).padStart(2, '0');
      } else {
        const match = (asset.assetCode || '').match(/(\d{1,3})$/);
        num = match ? match[1].padStart(2, '0') : '01';
      }
    }

    if (!num) num = '01';

    // Format angka jika murni digit agar rapi minimal 2 digit (misal: '1' -> '01')
    if (/^\d+$/.test(num)) {
      num = num.padStart(2, '0');
    }

    // Jika pengguna sudah mengetikkan teks kombinasi lengkap (misal: "Laptop 01"), langsung gunakan
    if (/[a-zA-Z]/.test(num)) {
      return num;
    }

    // 2. Tentukan label kategori
    let cat = (asset.categoryName || '').trim();
    const itemLower = (asset.itemName || '').toLowerCase();

    // Jika kategori berupa format gabungan seperti "TIK/Multimedia", ambil kata kunci nama barang agar presisi
    if (cat.includes('/') || cat.toLowerCase() === 'umum' || !cat) {
      if (itemLower.includes('laptop')) cat = 'Laptop';
      else if (itemLower.includes('proyektor') || itemLower.includes('projector') || itemLower.includes('infocus')) cat = 'Infocus';
      else if (itemLower.includes('kamera') || itemLower.includes('camera')) cat = 'Kamera';
      else if (itemLower.includes('komputer') || itemLower.includes('pc')) cat = 'PC';
      else if (itemLower.includes('printer')) cat = 'Printer';
      else if (itemLower.includes('speaker') || itemLower.includes('sound')) cat = 'Speaker';
      else if (cat.includes('/')) cat = cat.split('/')[0].trim();
    }

    const formattedCat = toCategoryTitleCase(cat);
    return formattedCat ? `${formattedCat} ${num}` : `Barang ${num}`;
  };

  // Preselect if query param provided
  useEffect(() => {
    if (preselectedId && assets) {
      if (assets.some((a) => a.id === preselectedId)) {
        setSelectedIds([preselectedId]);
      }
    } else if (assets && selectedIds.length === 0) {
      // Default select first 4 items for preview
      setSelectedIds(assets.slice(0, 4).map((a) => a.id));
    }
  }, [preselectedId, assets]);

  const uniqueCategories = useMemo(() => {
    if (!assets) return [];
    const set = new Set<string>();
    assets.forEach((a) => {
      if (a.categoryName) set.add(a.categoryName);
    });
    return Array.from(set).sort();
  }, [assets]);

  const availableItemNumbers = useMemo(() => {
    if (!assets) return [];
    const set = new Set<string>();
    assets.forEach((a) => {
      if (categoryFilter && a.categoryName !== categoryFilter) return;
      const num = (a.itemNumber && String(a.itemNumber).trim()) || '';
      if (num) set.add(num);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [assets, categoryFilter]);

  const displayedAssets =
    assets?.filter((a) => {
      if (institutionFilter && a.institution !== institutionFilter) return false;
      if (categoryFilter && a.categoryName !== categoryFilter) return false;
      if (itemNumberFilter) {
        const itemNum = (a.itemNumber && String(a.itemNumber).trim()) || '';
        const targetNum = itemNumberFilter.trim();
        if (
          itemNum !== targetNum &&
          itemNum.replace(/^0+/, '') !== targetNum.replace(/^0+/, '')
        ) {
          return false;
        }
      }
      return true;
    }) || [];

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (displayedAssets.length > 0) {
      setSelectedIds(Array.from(new Set([...selectedIds, ...displayedAssets.map((a) => a.id)])));
    }
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const selectedAssets = assets?.filter((a) => selectedIds.includes(a.id)) || [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header and Print Actions (Hidden on Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-700" />
            Cetak Label Stiker Inventaris
          </h2>
          <p className="text-xs text-slate-500">
            Format stiker horizontal: Sisi Kiri Kotak <strong>BARKODE</strong> (scan HP/Google Lens), Sisi Kanan: Baris Atas <strong>[kode]</strong>, Baris Bawah <strong>[nama]</strong>, <strong>[Sumber Pendanaan &amp; Tahun Perolehan]</strong> (huruf kapital &amp; ukuran lebih besar), dan <strong>[NAMA SEKOLAH]</strong> (otomatis mengikuti Satuan Pendidikan masing-masing barang).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="md"
            disabled={selectedIds.length === 0}
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="shadow-md bg-blue-800 hover:bg-blue-900"
          >
            Cetak Sekarang ({selectedIds.length} Label)
          </Button>
        </div>
      </div>

      {/* Google Lens / Direct Scanner Compatibility Note (Hidden on Print) */}
      <div className="p-3.5 bg-gradient-to-r from-blue-50 via-teal-50 to-emerald-50 border border-blue-200 rounded-xl text-xs text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print shadow-xs">
        <div className="flex items-start gap-2.5">
          {publicQrConfig.mode === 'ip' ? (
            <Wifi className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <Globe className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">
            <strong className="block text-emerald-950 font-bold">
              {publicQrConfig.mode === 'ip'
                ? 'Link QR Code Menggunakan Alamat IP Wi-Fi Lokal (Aktif):'
                : 'Link QR Code Menggunakan Domain Publik Resmi (Aktif):'}
            </strong>
            <span className="text-[11px] text-slate-700">
              Stiker fisik dicetak dengan link:{' '}
              <code className="font-bold text-blue-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                {getEffectiveBaseUrl(publicQrConfig)}
              </code>
              .{' '}
              {publicQrConfig.mode === 'ip'
                ? 'Guru dan staf dapat langsung memindai QR code via kamera HP / Google Lens di jaringan Wi-Fi sekolah untuk membuka form barang.'
                : 'QR code siap diakses di internet melalui domain resmi sekolah.'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsDomainModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 font-semibold text-xs shrink-0 shadow-2xs transition-colors"
        >
          <Settings className="w-3.5 h-3.5 text-blue-700" />
          Ubah IP / Domain Link QR
        </button>
      </div>

      {/* Configuration & Selection Grid (Hidden on Print) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Unit Selector List */}
        <Card className="lg:col-span-2">
          <CardHeader className="py-3 px-5 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 w-full">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Pilih Barang yang Akan Dicetak</CardTitle>
                <span className="text-[11px] text-slate-500">
                  ({displayedAssets.length} unit)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Filter Satuan Pendidikan */}
                <select
                  value={institutionFilter}
                  onChange={(e) => setInstitutionFilter(e.target.value)}
                  aria-label="Filter Satuan Pendidikan"
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-blue-900 bg-white focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Semua Satuan Pendidikan</option>
                  {SCHOOL_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>

                {/* Filter Kategori */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter Kategori"
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Semua Kategori</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Filter Nomor Barang (Pilihan Nomor Barang Tepat di Sebelah Kategori) */}
                <select
                  value={itemNumberFilter}
                  onChange={(e) => setItemNumberFilter(e.target.value)}
                  aria-label="Filter Nomor Barang"
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Semua No. Barang</option>
                  {availableItemNumbers.map((num) => (
                    <option key={num} value={num}>
                      {num.toLowerCase().startsWith('no') ? num : `No. ${num}`}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-blue-700 hover:underline font-semibold text-xs"
                  >
                    Pilih Semua
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-slate-500 hover:underline font-medium text-xs"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 max-h-96 overflow-y-auto">
            {isLoading ? (
              <TableSkeleton rows={5} columns={3} />
            ) : displayedAssets.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Tidak ada barang pada Satuan Pendidikan yang dipilih.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {displayedAssets.map((asset) => {
                  const isChecked = selectedIds.includes(asset.id);
                  const labelSchool = getSchoolNameForAsset(asset.institution);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => toggleSelect(asset.id)}
                      className={`p-3 px-5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition-colors ${isChecked ? 'bg-blue-50/40' : ''
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          aria-label={`Pilih ${asset.itemName}`}
                          className="text-blue-700 focus:outline-none"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-blue-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">
                              {asset.assetCode} — {asset.itemName}
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
                          <div className="text-[11px] text-slate-500 font-mono">
                            Merek: <strong>{asset.itemBrand}</strong> • {asset.locationName}
                          </div>
                          <div className="text-[10px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5">
                            <Coins className="w-3 h-3" />
                            <span>SUMBER: {asset.fundingSource} ({asset.acquisitionYear})</span>
                            <span className="text-slate-300 mx-1">•</span>
                            <span className="text-blue-800 font-bold">
                              Label: {labelSchool}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {asset.categoryName}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print Configuration Controls */}
        <Card>
          <CardHeader className="py-3 px-5 bg-slate-50/60">
            <CardTitle className="text-sm">Pengaturan Layout Stiker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* School Name (Bottom Row) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-slate-700 font-bold">
                  Nama Sekolah (Baris Terbawah)
                </label>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {schoolNameSource === 'auto_unit' ? 'Otomatis Satuan Pendidikan' : 'Teks Kustom'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSchoolNameSource('auto_unit')}
                  className={`py-1.5 px-2 text-center rounded-lg border text-[11px] font-semibold transition-all ${
                    schoolNameSource === 'auto_unit'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Sesuai Satuan Pendidikan
                </button>
                <button
                  type="button"
                  onClick={() => setSchoolNameSource('custom')}
                  className={`py-1.5 px-2 text-center rounded-lg border text-[11px] font-semibold transition-all ${
                    schoolNameSource === 'custom'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Teks Kustom Manual
                </button>
              </div>

              {schoolNameSource === 'auto_unit' ? (
                <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                  Nama sekolah di setiap label stiker otomatis mengikuti <strong>Satuan Pendidikan</strong> masing-masing barang (<strong>RA CENDIKIA BUNAYYA</strong> atau <strong>MIS CENDIKIA BUNAYYA</strong>).
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={customSchoolName}
                    onChange={(e) => setCustomSchoolName(e.target.value)}
                    placeholder="Contoh: RA CENDIKIA BUNAYYA / NAMA SEKOLAH"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-blue-600 uppercase"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Semua label akan dicetak dengan teks sekolah di atas.
                  </span>
                </div>
              )}
            </div>

            {/* Barcode Type */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Tipe Barcode (Kotak Kiri)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBarcodeType('QR')}
                  className={`py-2 px-2 text-center rounded-lg border font-medium text-xs transition-all ${barcodeType === 'QR'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  QR Code (HP/Lens)
                </button>
                <button
                  type="button"
                  onClick={() => setBarcodeType('BARCODE_1D')}
                  className={`py-2 px-2 text-center rounded-lg border font-medium text-xs transition-all ${barcodeType === 'BARCODE_1D'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Barcode 1D (Garis)
                </button>
              </div>
            </div>

            {/* Row Box Style */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Gaya Tampilan Baris Kanan
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBoxStyle('clean')}
                  className={`py-1.5 px-2 text-center rounded-lg border text-xs transition-all ${boxStyle === 'clean'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Teks Bersih (Sketsa)
                </button>
                <button
                  type="button"
                  onClick={() => setBoxStyle('boxed')}
                  className={`py-1.5 px-2 text-center rounded-lg border text-xs transition-all ${boxStyle === 'boxed'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Dengan Kotak Garis
                </button>
              </div>
            </div>

            {/* Opsi Tampilan Kategori + Nomor Barang (Sesuai Sketsa) */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCategoryItemNumber}
                    onChange={(e) => setShowCategoryItemNumber(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span>Kategori + Nomor Barang</span>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Sesuai Sketsa
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Menampilkan identitas cepat (contoh: <strong className="text-slate-800 font-black">Laptop 01</strong>) di pojok kanan atas stiker label stiker sesuai petunjuk sketsa.
              </p>
            </div>

            {/* Format Sumber Pendanaan & Tahun Perolehan */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-700 font-bold">
                  Format Tahun Perolehan (Baris 2)
                </label>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {yearSeparator === 'with_year'
                    ? 'DENGAN TAHUN'
                    : yearSeparator === 'dash_year'
                    ? 'STRIP + TAHUN'
                    : yearSeparator === 'parentheses_year'
                    ? 'KURUNG + TAHUN'
                    : yearSeparator === 'dash'
                    ? 'STRIP (-)'
                    : yearSeparator === 'parentheses'
                    ? 'KURUNG ( )'
                    : 'GARIS MIRING (/)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setYearSeparator('with_year')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'with_year'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER TAHUN 2024"
                >
                  DENGAN TAHUN
                </button>
                <button
                  type="button"
                  onClick={() => setYearSeparator('dash_year')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'dash_year'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER - TAHUN 2024"
                >
                  - TAHUN
                </button>
                <button
                  type="button"
                  onClick={() => setYearSeparator('parentheses_year')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'parentheses_year'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER (TAHUN 2024)"
                >
                  (TAHUN)
                </button>
                <button
                  type="button"
                  onClick={() => setYearSeparator('dash')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'dash'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER - 2024"
                >
                  Strip (-)
                </button>
                <button
                  type="button"
                  onClick={() => setYearSeparator('parentheses')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'parentheses'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER (2024)"
                >
                  Kurung ( )
                </button>
                <button
                  type="button"
                  onClick={() => setYearSeparator('slash')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${
                    yearSeparator === 'slash'
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Format: BOS REGULER / 2024"
                >
                  Garis Miring (/)
                </button>
              </div>
              <div className="text-[10px] text-slate-500 mt-1.5 bg-slate-50 p-1.5 rounded border border-slate-200 flex items-center justify-between">
                <span>Contoh tampilan Baris 2:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatFundingAndYear('BOS REGULER', 2024)}
                </span>
              </div>
            </div>

            {/* PENGATURAN UKURAN FONT (FONT SIZE) */}
            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-slate-900 font-bold flex items-center gap-1.5 text-xs">
                  <Type className="w-4 h-4 text-blue-700" />
                  <span>Ukuran Font (Font Size)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepFontScale('down')}
                    className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-blue-700 shadow-2xs"
                    title="Perkecil Ukuran Font Keseluruhan"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepFontScale('up')}
                    className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-blue-700 shadow-2xs"
                    title="Perbesar Ukuran Font Keseluruhan"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-blue-800 font-bold bg-white px-2 py-0.5 rounded border border-blue-200">
                    {globalFontScale === 'small'
                      ? 'KECIL'
                      : globalFontScale === 'normal'
                      ? 'STANDAR'
                      : globalFontScale === 'large'
                      ? 'BESAR'
                      : globalFontScale === 'xlarge'
                      ? 'EKSTRA BESAR'
                      : 'KUSTOM'}
                  </span>
                </div>
              </div>

              {/* Skala Cepat Keseluruhan */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Preset Skala Keseluruhan:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => handleGlobalScaleChange('small')}
                    className={`py-1.5 px-1 text-center rounded-lg border text-[10px] transition-all ${
                      globalFontScale === 'small'
                        ? 'border-blue-700 bg-blue-700 text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Kecil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGlobalScaleChange('normal')}
                    className={`py-1.5 px-1 text-center rounded-lg border text-[10px] transition-all ${
                      globalFontScale === 'normal'
                        ? 'border-blue-700 bg-blue-700 text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGlobalScaleChange('large')}
                    className={`py-1.5 px-1 text-center rounded-lg border text-[10px] transition-all ${
                      globalFontScale === 'large'
                        ? 'border-blue-700 bg-blue-700 text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Besar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGlobalScaleChange('xlarge')}
                    className={`py-1.5 px-1 text-center rounded-lg border text-[10px] transition-all ${
                      globalFontScale === 'xlarge'
                        ? 'border-blue-700 bg-blue-700 text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Ekstra Besar
                  </button>
                </div>
              </div>

              {/* Kontrol Rinci Per Elemen */}
              <div className="pt-2 border-t border-blue-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    Atur Ukuran Per Elemen Baris Teks:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFont(!showAdvancedFont)}
                    className="text-[10px] text-blue-700 hover:underline font-semibold"
                  >
                    {showAdvancedFont ? 'Tutup Rincian ▲' : 'Buka Rincian ▼'}
                  </button>
                </div>

                {showAdvancedFont && (
                  <div className="space-y-2.5 pt-1 animate-in fade-in">
                    {/* 1. Baris Kiri Atas: Kode Inventaris */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] mb-1 text-slate-700 font-semibold">
                        <span>1. Kode Inventaris (Atas)</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {codeFontSize.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setCodeFontSize(s);
                              setGlobalFontScale('custom');
                            }}
                            className={`py-1 text-[10px] rounded border transition-all ${
                              codeFontSize === s
                                ? 'bg-blue-700 text-white font-bold border-blue-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s === 'small' ? 'Kecil' : s === 'medium' ? 'Sedang' : 'Besar'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Baris Atas: Nama Barang (Bawah) */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] mb-1 text-slate-700 font-semibold">
                        <span>2. Nama Barang (Bawah)</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {nameFontSize.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {(['small', 'medium', 'large', 'xlarge'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setNameFontSize(s);
                              setGlobalFontScale('custom');
                            }}
                            className={`py-1 text-[10px] rounded border transition-all ${
                              nameFontSize === s
                                ? 'bg-blue-700 text-white font-bold border-blue-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s === 'small' ? 'Kecil' : s === 'medium' ? 'Sedang' : s === 'large' ? 'Besar' : 'XL'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Baris 2: Sumber Dana & Tahun */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] mb-1 text-slate-700 font-semibold">
                        <span>3. Sumber Dana & Tahun (Baris 2)</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {fundingFontSize.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['medium', 'large', 'xlarge'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setFundingFontSize(s);
                              setGlobalFontScale('custom');
                            }}
                            className={`py-1 text-[10px] rounded border transition-all ${
                              fundingFontSize === s
                                ? 'bg-blue-700 text-white font-bold border-blue-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s === 'medium' ? 'Sedang' : s === 'large' ? 'Besar' : 'Ekstra Besar'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Baris 3: Nama Sekolah */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] mb-1 text-slate-700 font-semibold">
                        <span>4. Nama Sekolah (Baris 3)</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {schoolFontSize.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setSchoolFontSize(s);
                              setGlobalFontScale('custom');
                            }}
                            className={`py-1 text-[10px] rounded border transition-all ${
                              schoolFontSize === s
                                ? 'bg-blue-700 text-white font-bold border-blue-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s === 'small' ? 'Kecil' : s === 'medium' ? 'Sedang' : 'Besar'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 5. Baris Kanan Atas: Kategori + Nomor Barang (Laptop 01) */}
                    <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] mb-1 text-slate-700 font-semibold">
                        <span>5. Kategori + No. Barang (Pojok Kanan Atas)</span>
                        <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                          {categoryItemNumberFontSize.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(['small', 'medium', 'large', 'xlarge', 'xxlarge'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setCategoryItemNumberFontSize(s);
                              setGlobalFontScale('custom');
                            }}
                            className={`py-1 text-[9px] rounded border transition-all ${
                              categoryItemNumberFontSize === s
                                ? 'bg-blue-700 text-white font-bold border-blue-700 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {s === 'small'
                              ? 'Kecil'
                              : s === 'medium'
                              ? 'Sedang'
                              : s === 'large'
                              ? 'Besar'
                              : s === 'xlarge'
                              ? 'Ekstra'
                              : 'Super'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pengaturan Margin Kertas Saat Mencetak (Atas, Bawah, Kanan, Kiri) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-700 font-bold flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-blue-700" />
                    Pengaturan Margin (Atas, Bawah, Kanan, Kiri)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Margin batas tepi kertas halaman saat mencetak (@page)
                  </span>
                </div>
                <span className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 uppercase">
                  {printMarginPreset === 'minimal'
                    ? 'Sangat Rapat'
                    : printMarginPreset === 'compact'
                    ? 'Kecil'
                    : printMarginPreset === 'normal'
                    ? 'Standar'
                    : printMarginPreset === 'loose'
                    ? 'Longgar'
                    : 'Kustom'}
                </span>
              </div>

              {/* Preset Cepat Margin Cetak */}
              <div>
                <span className="text-[11px] text-slate-500 font-medium block mb-1">
                  Preset Cepat Margin Cetak:
                </span>
                <div className="grid grid-cols-4 gap-1">
                  <button
                    type="button"
                    onClick={() => applyPrintMarginPreset('minimal')}
                    className={`py-1 px-1 text-center rounded border text-[10px] transition-all ${
                      printMarginPreset === 'minimal'
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Sangat Rapat
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPrintMarginPreset('compact')}
                    className={`py-1 px-1 text-center rounded border text-[10px] transition-all ${
                      printMarginPreset === 'compact'
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Kecil
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPrintMarginPreset('normal')}
                    className={`py-1 px-1 text-center rounded border text-[10px] transition-all ${
                      printMarginPreset === 'normal'
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPrintMarginPreset('loose')}
                    className={`py-1 px-1 text-center rounded border text-[10px] transition-all ${
                      printMarginPreset === 'loose'
                        ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Longgar
                  </button>
                </div>
              </div>

              {/* Kontrol 4 Sisi Margin Kertas Saat Nyetak */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700">
                    Atur Margin Kertas Cetak Per Sisi (Satuan mm):
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    T:{printMarginTop} B:{printMarginBottom} L:{printMarginLeft} R:{printMarginRight}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Margin Atas (Top) */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">Margin Atas</span>
                      <span className="font-mono font-bold text-blue-700">{printMarginTop} mm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginTop((v) => Math.max(0, v - 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Kurangi Margin Atas"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={printMarginTop}
                        onChange={(e) => {
                          setPrintMarginTop(Number(e.target.value));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Slider Margin Atas"
                        className="flex-1 accent-blue-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginTop((v) => Math.min(40, v + 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Tambah Margin Atas"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Margin Bawah (Bottom) */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">Margin Bawah</span>
                      <span className="font-mono font-bold text-blue-700">{printMarginBottom} mm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginBottom((v) => Math.max(0, v - 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Kurangi Margin Bawah"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={printMarginBottom}
                        onChange={(e) => {
                          setPrintMarginBottom(Number(e.target.value));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Slider Margin Bawah"
                        className="flex-1 accent-blue-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginBottom((v) => Math.min(40, v + 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Tambah Margin Bawah"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Margin Kiri (Left) */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">Margin Kiri</span>
                      <span className="font-mono font-bold text-blue-700">{printMarginLeft} mm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginLeft((v) => Math.max(0, v - 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Kurangi Margin Kiri"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={printMarginLeft}
                        onChange={(e) => {
                          setPrintMarginLeft(Number(e.target.value));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Slider Margin Kiri"
                        className="flex-1 accent-blue-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginLeft((v) => Math.min(40, v + 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Tambah Margin Kiri"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Margin Kanan (Right) */}
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-700">Margin Kanan</span>
                      <span className="font-mono font-bold text-blue-700">{printMarginRight} mm</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginRight((v) => Math.max(0, v - 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Kurangi Margin Kanan"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="40"
                        value={printMarginRight}
                        onChange={(e) => {
                          setPrintMarginRight(Number(e.target.value));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Slider Margin Kanan"
                        className="flex-1 accent-blue-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPrintMarginRight((v) => Math.min(40, v + 1));
                          setPrintMarginPreset('custom');
                        }}
                        aria-label="Tambah Margin Kanan"
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tombol Cepat: Samakan Sisi */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                  <span className="text-slate-500 font-medium">Samakan Sisi:</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPrintMarginBottom(printMarginTop);
                        setPrintMarginPreset('custom');
                      }}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                    >
                      Bawah = Atas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintMarginRight(printMarginLeft);
                        setPrintMarginPreset('custom');
                      }}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                    >
                      Kanan = Kiri
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintMarginTop(0);
                        setPrintMarginBottom(0);
                        setPrintMarginLeft(0);
                        setPrintMarginRight(0);
                        setPrintMarginPreset('minimal');
                      }}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                    >
                      Semua 0 mm
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPrintMarginTop(5);
                        setPrintMarginBottom(5);
                        setPrintMarginLeft(5);
                        setPrintMarginRight(5);
                        setPrintMarginPreset('compact');
                      }}
                      className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium"
                    >
                      Semua 5 mm
                    </button>
                  </div>
                </div>
              </div>

              {/* Rincian Kerapatan Dalam Kotak Stiker (Accordion Opsional) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowInnerPadding((prev) => !prev)}
                  className="w-full flex items-center justify-between text-[11px] text-slate-600 hover:text-blue-700 py-1 px-2 rounded-lg bg-slate-50 border border-slate-200 transition-colors"
                >
                  <span className="font-semibold flex items-center gap-1">
                    📐 Jarak Tepi Dalam Label (Padding Kotak Stiker)
                  </span>
                  <span className="text-[10px] text-blue-700 font-bold">
                    {showInnerPadding ? 'Tutup ▲' : 'Buka ▼'}
                  </span>
                </button>

                {showInnerPadding && (
                  <div className="mt-1.5 p-2 bg-slate-50/70 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <span className="text-[10px] text-slate-500 block">
                      Mengatur kerapatan tulisan dari batas dalam stiker (mm):
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        type="button"
                        onClick={() => applyMarginPreset('minimal')}
                        className={`py-1 text-center rounded border text-[10px] ${
                          marginPreset === 'minimal'
                            ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                            : 'border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        1-2 mm (Rapat)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarginPreset('compact')}
                        className={`py-1 text-center rounded border text-[10px] ${
                          marginPreset === 'compact'
                            ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                            : 'border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        2-3 mm (Kecil)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarginPreset('normal')}
                        className={`py-1 text-center rounded border text-[10px] ${
                          marginPreset === 'normal'
                            ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                            : 'border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        4-6 mm (Standar)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyMarginPreset('loose')}
                        className={`py-1 text-center rounded border text-[10px] ${
                          marginPreset === 'loose'
                            ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                            : 'border-slate-200 text-slate-600 bg-white'
                        }`}
                      >
                        6 mm (Longgar)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Jarak Antar Tulisan (Kerapatan) */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Jarak Antar Tulisan (Kerapatan)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTextSpacing('tight')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${textSpacing === 'tight'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Rapat (Dekat)
                </button>
                <button
                  type="button"
                  onClick={() => setTextSpacing('compact')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${textSpacing === 'compact'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Sangat Rapat
                </button>
                <button
                  type="button"
                  onClick={() => setTextSpacing('normal')}
                  className={`py-1.5 px-1 text-center rounded-lg border text-[11px] transition-all ${textSpacing === 'normal'
                    ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Renggang
                </button>
              </div>
            </div>

            {/* Label Size */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Ukuran Stiker Label</label>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                aria-label="Ukuran Stiker Label"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-600"
              >
                <option value="standard">Standar (85 mm x 42 mm) — Sesuai Sketsa</option>
                <option value="compact">Ringkas (70 mm x 35 mm)</option>
                <option value="badge">Besar (100 mm x 50 mm)</option>
              </select>
            </div>

            {/* Grid Columns */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Susunan Kolom Kertas Cetak</label>
              <div className="grid grid-cols-3 gap-2">
                {(['1', '2', '3'] as const).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColumns(col)}
                    className={`py-1.5 text-center font-medium rounded-lg border transition-all ${columns === col
                      ? 'border-blue-700 bg-blue-50 text-blue-800 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {col} Kolom
                  </button>
                ))}
              </div>
            </div>

            {/* Border Options */}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Garis Bingkai Luar</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setBorderStyle('solid')}
                  className={`py-1 text-center rounded border text-[11px] ${borderStyle === 'solid'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Garis Tebal
                </button>
                <button
                  type="button"
                  onClick={() => setBorderStyle('dashed')}
                  className={`py-1 text-center rounded border text-[11px] ${borderStyle === 'dashed'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Putus-Putus
                </button>
                <button
                  type="button"
                  onClick={() => setBorderStyle('none')}
                  className={`py-1 text-center rounded border text-[11px] ${borderStyle === 'none'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  Tanpa Garis
                </button>
              </div>
            </div>

            {/* Options Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={showFundingPrefix}
                  onChange={(e) => setShowFundingPrefix(e.target.checked)}
                  className="rounded text-blue-700 focus:ring-blue-600"
                />
                <span>Gunakan awalan "SUMBER PENDANAAN:" di Baris 2</span>
              </label>
            </div>

            {/* Summary */}
            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              Total <strong className="text-slate-800">{selectedIds.length} label</strong> siap dicetak.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LIVE LABEL PREVIEW & PRINTABLE DOM CONTAINER */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 no-print">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-800" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Pratinjau Lembar Stiker Label (Format Sesuai Sketsa)
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-mono hidden sm:inline-block">
              Margin Kertas Cetak: Atas {printMarginTop}mm · Bawah {printMarginBottom}mm · Kiri {printMarginLeft}mm · Kanan {printMarginRight}mm
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {selectedAssets.length} unit terpilih
            </span>
          </div>
        </div>

        {/* Dynamic Page Margin style for print media */}
        <style>{`
          @media print {
            @page {
              size: auto;
              margin-top: ${printMarginTop}mm !important;
              margin-bottom: ${printMarginBottom}mm !important;
              margin-left: ${printMarginLeft}mm !important;
              margin-right: ${printMarginRight}mm !important;
              margin: ${printMarginTop}mm ${printMarginRight}mm ${printMarginBottom}mm ${printMarginLeft}mm !important;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            #printable-labels {
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
          }
        `}</style>

        {/* Printable Area with ID for @media print styles */}
        <div
          id="printable-labels"
          style={{
            paddingTop: `${printMarginTop}mm`,
            paddingBottom: `${printMarginBottom}mm`,
            paddingLeft: `${printMarginLeft}mm`,
            paddingRight: `${printMarginRight}mm`,
          }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm print:border-none print:p-0 print:shadow-none transition-all"
        >
          {selectedAssets.length === 0 ? (
            <div className="p-8 text-center text-slate-400 no-print">
              Belum ada label yang dipilih. Centang barang inventaris di atas untuk melihat pratinjau.
            </div>
          ) : (
            <div
              className={`grid gap-3 sm:gap-3.5 ${columns === '1'
                ? 'grid-cols-1'
                : columns === '2'
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
            >
              {selectedAssets.map((asset) => {
                const isCompact = labelSize === 'compact';
                const isBadge = labelSize === 'badge';

                // QR Code scan canonical permanent public link for Google Lens & smartphone cameras
                const qrUrl = getCanonicalQrUrl(asset);

                return (
                  <div
                    key={asset.id}
                    style={{
                      paddingTop: `${marginTop}mm`,
                      paddingBottom: `${marginBottom}mm`,
                      paddingLeft: `${marginLeft}mm`,
                      paddingRight: `${marginRight}mm`,
                    }}
                    className={`bg-white text-black transition-all print:bg-white print:text-black flex items-center ${
                      marginLeft <= 2 ? 'gap-1.5' : marginLeft <= 4 ? 'gap-2' : 'gap-2.5'
                    } ${borderStyle === 'solid'
                      ? 'border-2 border-slate-900 rounded-2xl print:border-2 print:border-black'
                      : borderStyle === 'dashed'
                        ? 'border-2 border-dashed border-slate-500 rounded-2xl print:border-2 print:border-dashed print:border-black'
                        : 'border border-transparent'
                      } ${isCompact
                        ? 'min-h-[115px]'
                        : isBadge
                          ? 'min-h-[165px]'
                          : 'min-h-[140px]'
                      }`}
                  >
                    {/* SISI KIRI: Panel Melengkung dengan Kotak BARKODE di Dalamnya */}
                    <div
                      className={`shrink-0 flex flex-col items-center justify-center rounded-xl border-2 border-slate-900 print:border-2 print:border-black bg-white ${isCompact ? 'p-1' : isBadge ? 'p-2' : 'p-1.5'
                        }`}
                    >
                      <div
                        className={`border-2 border-slate-900 print:border-2 print:border-black rounded-lg flex flex-col items-center justify-center bg-white ${isCompact ? 'p-1' : isBadge ? 'p-1.5' : 'p-1'
                          }`}
                      >
                        {barcodeType === 'BARCODE_1D' ? (
                          <div className="p-1 flex flex-col items-center">
                            <Barcode1D
                              value={asset.assetCode}
                              height={isCompact ? 42 : isBadge ? 65 : 54}
                              showText={false}
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <QRCodeSVG
                              value={qrUrl}
                              size={isCompact ? 68 : isBadge ? 96 : 82}
                              level="M"
                            />
                          </div>
                        )}

                        {/* Tulisan BARKODE Sesuai Sketsa Pengguna */}
                        <div className="text-[9px] font-mono font-black tracking-widest text-black mt-1 uppercase text-center">

                        </div>
                      </div>
                    </div>

                    {/* SISI KANAN: 3 BLOK UTAMA SESUAI SKETSA TERBARU PENGGUNA */}
                    <div
                      className={`flex-1 min-w-0 flex flex-col justify-center py-0.5 ${textSpacing === 'compact'
                        ? 'gap-0.5'
                        : textSpacing === 'normal'
                          ? 'gap-2'
                          : 'gap-1'
                        }`}
                    >
                      {/* BLOK 1: [kode \n nama] (Atas Bawah Rapat Sesuai Permintaan) */}
                      <div
                        className={
                          boxStyle === 'boxed'
                            ? `border border-slate-900 print:border-black rounded-sm ${getBoxedPaddingClass()} bg-white flex flex-col justify-center ${textSpacing === 'compact' ? 'py-0.5 gap-0' : textSpacing === 'normal' ? 'py-1 gap-0.5' : 'py-0.5 gap-0'
                            }`
                            : `flex flex-col justify-center ${textSpacing === 'normal' ? 'gap-0.5' : 'gap-0'
                            }`
                        }
                      >
                        {/* Baris Atas: Kode di Kiri, Kombinasi Kategori + Nomor Barang di Kanan (Sesuai Sketsa Pengguna) */}
                        <div className="flex items-baseline justify-between gap-2 leading-none mb-0.5">
                          <span
                            className={`font-mono font-black text-slate-900 print:text-black tracking-tight truncate ${getCodeFontSizeClass(
                              isCompact,
                              isBadge
                            )}`}
                            title={asset.assetCode}
                          >
                            {asset.assetCode}
                          </span>
                          {showCategoryItemNumber && getCombinedCategoryAndNumber(asset) && (
                            <span
                              className={`font-black text-slate-950 print:text-black tracking-tight shrink-0 whitespace-nowrap text-right ${getCategoryItemNumberFontSizeClass(
                                isCompact,
                                isBadge
                              )}`}
                              title={getCombinedCategoryAndNumber(asset)}
                            >
                              {getCombinedCategoryAndNumber(asset)}
                            </span>
                          )}
                        </div>

                        {/* Baris Bawah: Nama */}
                        <div
                          className={`font-bold text-slate-950 print:text-black uppercase leading-tight truncate ${getNameFontSizeClass(
                            isCompact,
                            isBadge
                          )}`}
                          title={asset.itemName}
                        >
                          {asset.itemName}
                        </div>
                      </div>

                      {/* BLOK 2: [Sumber Pendanaan & Tahun Perolehan] (HURUF KAPITAL & UKURAN LEBIH BESAR) */}
                      <div
                        className={
                          boxStyle === 'boxed'
                            ? `border border-slate-900 print:border-black rounded-sm ${getBoxedPaddingClass()} bg-white ${textSpacing === 'compact' ? 'py-0.5' : textSpacing === 'normal' ? 'py-1' : 'py-0.5'
                            }`
                            : ''
                        }
                      >
                        <div
                          className={`text-slate-950 print:text-black uppercase tracking-tight truncate leading-tight ${getFundingFontSizeClass(
                            isCompact,
                            isBadge
                          )}`}
                          title={formatFundingAndYear(asset.fundingSource, asset.acquisitionYear)}
                        >
                          {formatFundingAndYear(asset.fundingSource, asset.acquisitionYear)}
                        </div>
                      </div>

                      {/* BLOK 3: [NAMA SEKOLAH] */}
                      <div
                        className={
                          boxStyle === 'boxed'
                            ? `border border-slate-900 print:border-black rounded-sm ${getBoxedPaddingClass()} bg-white ${textSpacing === 'compact' ? 'py-0.5' : textSpacing === 'normal' ? 'py-1' : 'py-0.5'
                            }`
                            : ''
                        }
                      >
                        <div
                          className={`font-bold text-slate-900 print:text-black uppercase tracking-wider truncate leading-none ${getSchoolFontSizeClass(
                            isCompact,
                            isBadge
                          )}`}
                        >
                          {getSchoolNameForAsset(asset.institution)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Modal Pengaturan Domain Publik & Migrasi Redirect QR */}
      <DomainMigrationModal
        isOpen={isDomainModalOpen}
        onClose={() => setIsDomainModalOpen(false)}
        onConfigChanged={() => setQrConfigVersion((v) => v + 1)}
      />
    </div>
  );
};
