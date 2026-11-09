import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Printer,
  Wrench,
} from 'lucide-react';
import { api } from '../services/api';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { useSchoolSettings } from '../hooks/useSchoolSettings';
import {
  formatDate,
  formatDateOnly,
  getConditionBadge,
  getLoanStatusBadge,
  getOperationalBadge,
} from '../lib/utils';

export const Reports: React.FC = () => {
  const [reportType, setReportType] = useState<'inventory' | 'loans' | 'returns' | 'maintenance'>('inventory');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const { schoolName, address, logoUrl } = useSchoolSettings();

  const { data: assets, isLoading: isAssetsLoading } = useQuery({
    queryKey: ['assets'],
    queryFn: () => api.getAssets(),
  });

  const { data: loans, isLoading: isLoansLoading } = useQuery({
    queryKey: ['loans'],
    queryFn: () => api.getLoans(),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories(),
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.getLocations(),
  });

  // Filtered Assets
  const filteredAssets = assets?.filter((a) => {
    const matchCat = !categoryFilter || a.categoryName === categoryFilter;
    const matchLoc = !locationFilter || a.locationId === locationFilter;
    if (reportType === 'maintenance') {
      return matchCat && matchLoc && a.operationalStatus === 'MAINTENANCE';
    }
    return matchCat && matchLoc;
  });

  // Filtered Loans
  const filteredLoans = loans?.filter((l) => {
    if (reportType === 'loans') {
      return l.status === 'ACTIVE' || l.status === 'READY_FOR_HANDOVER' || l.status === 'PENDING_APPROVAL';
    }
    if (reportType === 'returns') {
      return l.status === 'COMPLETED' || l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED';
    }
    return true;
  });

  // Export to CSV helper
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'inventory' || reportType === 'maintenance') {
      csvContent += 'Kode Inventaris,Nama Barang,Kategori,Spesifikasi/Ukuran,Merek,Tahun,Sumber Pendanaan,Ruangan,Kondisi,Status\n';
      filteredAssets?.forEach((a) => {
        csvContent += `"${a.assetCode}","${a.itemName}","${a.categoryName}","${(a.technicalSpecs || '').replace(/"/g, '""')}","${a.itemBrand}","${a.acquisitionYear || ''}","${a.fundingSource}","${a.locationName}","${a.conditionStatus}","${a.operationalStatus}"\n`;
      });
    } else {
      csvContent += 'No Transaksi,Peminjam,NIP,Barang,Kode Unit,Status,Tanggal Pinjam,Jatuh Tempo,Keperluan\n';
      filteredLoans?.forEach((l) => {
        csvContent += `"${l.loanNumber}","${l.borrowerName}","${l.borrowerEmployeeNumber}","${l.unit.itemName}","${l.unit.assetCode}","${l.status}","${l.requestedAt}","${l.expectedReturnAt}","${l.purpose.replace(/"/g, '""')}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laporan-sisarpras-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header (No print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Laporan & Rekapitulasi Sarpras
          </h2>
          <p className="text-xs text-slate-500">
            Ekspor data inventaris dan rekap transaksi peminjaman ke format resmi PDF dan Excel/CSV.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
          >
            Ekspor CSV (Excel)
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="bg-blue-800 hover:bg-blue-900"
          >
            Cetak Laporan Resmi
          </Button>
        </div>
      </div>

      {/* Tabs and Filter Controls (No print) */}
      <Card className="no-print">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setReportType('inventory')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  reportType === 'inventory' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Daftar Inventaris</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('loans')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  reportType === 'loans' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Peminjaman Aktif</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('returns')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  reportType === 'returns' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pengembalian & Kondisi</span>
              </button>

              <button
                type="button"
                onClick={() => setReportType('maintenance')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  reportType === 'maintenance' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Perbaikan / Rusak</span>
              </button>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter kategori laporan"
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="">Semua Kategori</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                aria-label="Filter lokasi laporan"
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
              >
                <option value="">Semua Ruangan</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OFFICIAL REPORT CONTAINER (PRINTABLE) */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Official School Header Kop Surat */}
        <div className="border-b-4 border-double border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-center gap-5 sm:gap-8 mb-3">
            <img
              src={logoUrl || '/logo-cendikia.png'}
              alt="Logo Cendikia Bunayya"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/logo-cendikia.png')) {
                  target.src = '/logo-cendikia.png';
                }
              }}
            />
            <div className="text-center font-serif">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-wide leading-tight">
                YAYASAN PENDIDIKAN CENDIKIA BUNAYYA
              </h1>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 uppercase tracking-normal mt-1 leading-tight">
                {schoolName ? schoolName.toUpperCase() : 'MADRASAH IBTIDAIYAH SWASTA CENDIKIA BUNAYYA'}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 uppercase tracking-wider mt-1.5 leading-snug">
                {address ? address.toUpperCase() : 'JALAN TERUS JAYA NO. 2 KEC. KABANJAHE KAB. KARO SUMUT'}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-300 text-center">
            <h3 className="text-sm font-bold uppercase text-slate-900 tracking-wide">
              {reportType === 'inventory' && 'REKAPITULASI BUKU INDUK INVENTARIS SARANA DAN PRASARANA'}
              {reportType === 'loans' && 'LAPORAN REKAPITULASI TRANSAKSI PEMINJAMAN SARANA DAN PRASARANA'}
              {reportType === 'returns' && 'LAPORAN PENGEMBALIAN DAN VERIFIKASI KONDISI AKHIR BARANG'}
              {reportType === 'maintenance' && 'LAPORAN DAFTAR BARANG DALAM PERBAIKAN DAN PERAWATAN'}
            </h3>
            <span className="text-[11px] text-slate-500">
              Periode Cetak: {formatDate(new Date().toISOString())}
            </span>
          </div>
        </div>

        {/* Report Content Table */}
        {isAssetsLoading || isLoansLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <div className="overflow-x-auto">
            {reportType === 'inventory' || reportType === 'maintenance' ? (
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 border-r border-slate-300 w-10 text-center">No</th>
                    <th className="p-2.5 border-r border-slate-300">Kode Inventaris</th>
                    <th className="p-2.5 border-r border-slate-300">Nama Barang & Merek</th>
                    <th className="p-2.5 border-r border-slate-300">Kategori</th>
                    <th className="p-2.5 border-r border-slate-300">Spesifikasi / Ukuran</th>
                    <th className="p-2.5 border-r border-slate-300 text-center">Tahun</th>
                    <th className="p-2.5 border-r border-slate-300">Sumber Pendanaan</th>
                    <th className="p-2.5 border-r border-slate-300">Ruangan/Lokasi</th>
                    <th className="p-2.5 border-r border-slate-300">Kondisi</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAssets?.map((asset, index) => {
                    const cond = getConditionBadge(asset.conditionStatus);
                    const oper = getOperationalBadge(asset.operationalStatus);
                    return (
                      <tr key={asset.id} className="hover:bg-slate-50">
                        <td className="p-2.5 border-r border-slate-200 text-center font-mono">{index + 1}</td>
                        <td className="p-2.5 border-r border-slate-200 font-mono font-bold">{asset.assetCode}</td>
                        <td className="p-2.5 border-r border-slate-200 font-medium">
                          {asset.itemName} <span className="text-slate-500 font-normal">({asset.itemBrand})</span>
                        </td>
                        <td className="p-2.5 border-r border-slate-200">{asset.categoryName}</td>
                        <td className="p-2.5 border-r border-slate-200 text-slate-600 max-w-xs">{asset.technicalSpecs}</td>
                        <td className="p-2.5 border-r border-slate-200 text-center font-mono">{asset.acquisitionYear}</td>
                        <td className="p-2.5 border-r border-slate-200 font-semibold text-blue-900">{asset.fundingSource}</td>
                        <td className="p-2.5 border-r border-slate-200">{asset.locationName}</td>
                        <td className="p-2.5 border-r border-slate-200">{cond.label}</td>
                        <td className="p-2.5 text-center">{oper.label}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-300">
                  <tr>
                    <th className="p-2.5 border-r border-slate-300 w-10 text-center">No</th>
                    <th className="p-2.5 border-r border-slate-300">No. Pinjaman</th>
                    <th className="p-2.5 border-r border-slate-300">Nama Peminjam</th>
                    <th className="p-2.5 border-r border-slate-300">Barang & Kode</th>
                    <th className="p-2.5 border-r border-slate-300">Tgl Pinjam</th>
                    <th className="p-2.5 border-r border-slate-300">Jatuh Tempo</th>
                    <th className="p-2.5 border-r border-slate-300">Status</th>
                    <th className="p-2.5">Keperluan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredLoans?.map((loan, index) => {
                    const status = getLoanStatusBadge(loan.status);
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50">
                        <td className="p-2.5 border-r border-slate-200 text-center font-mono">{index + 1}</td>
                        <td className="p-2.5 border-r border-slate-200 font-mono font-bold">{loan.loanNumber}</td>
                        <td className="p-2.5 border-r border-slate-200">
                          {loan.borrowerName} ({loan.borrowerEmployeeNumber})
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-medium">
                          {loan.unit.itemName} ({loan.unit.assetCode})
                        </td>
                        <td className="p-2.5 border-r border-slate-200">{formatDateOnly(loan.requestedAt)}</td>
                        <td className="p-2.5 border-r border-slate-200">{formatDateOnly(loan.expectedReturnAt)}</td>
                        <td className="p-2.5 border-r border-slate-200">{status.label}</td>
                        <td className="p-2.5">{loan.purpose}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Official Signatures Footer (Print Ready) */}
        <div className="mt-12 pt-6 grid grid-cols-2 gap-8 text-center text-xs text-slate-800">
          <div>
            <p className="text-slate-500">Mengetahui,</p>
            <p className="font-bold text-slate-900 mt-0.5">Kepala {schoolName}</p>
            <div className="h-20" /> {/* Space for signature */}
            <p className="font-bold text-slate-900 underline">Drs. H. Ahmad Sudirman, M.Pd.</p>
            <p className="text-slate-500 text-[11px]">NIP. 196811121994031002</p>
          </div>

          <div>
            <p className="text-slate-500">Kabanjahe, {formatDateOnly(new Date().toISOString())}</p>
            <p className="font-bold text-slate-900 mt-0.5">Pengelola Sarana & Prasarana</p>
            <div className="h-20" /> {/* Space for signature */}
            <p className="font-bold text-slate-900 underline">Bambang Hermawan, S.Kom.</p>
            <p className="text-slate-500 text-[11px]">NIP. 198204152008011005</p>
          </div>
        </div>
      </div>
    </div>
  );
};
