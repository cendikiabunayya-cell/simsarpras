import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  FileCheck2,
  Plus,
  Printer,
  QrCode,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CardSkeleton, TableSkeleton } from '../components/ui/LoadingSkeleton';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { SyncIndicator } from '../components/ui/SyncIndicator';
import { getAutoRefreshOptions } from '../hooks/useAutoRefreshQuery';
import { DashboardMetrics, LoanRequest } from '../types';
import { formatDate, getConditionBadge } from '../lib/utils';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const role = currentUser.role;

  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isFetching: isMetricsFetching,
    dataUpdatedAt: metricsUpdatedAt,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: ({ signal }) => api.getDashboardMetrics({ signal }),
    ...getAutoRefreshOptions(),
  });

  const {
    data: loans,
    isLoading: isLoansLoading,
    isFetching: isLoansFetching,
    dataUpdatedAt: loansUpdatedAt,
    refetch: refetchLoans,
  } = useQuery<LoanRequest[]>({
    queryKey: ['loans'],
    queryFn: ({ signal }) => api.getLoans({ signal }),
    ...getAutoRefreshOptions(),
  });

  const {
    data: auditLogs,
    isLoading: isAuditLoading,
  } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.getAuditLogs(),
  });

  // Only show blocking error screen if initial load failed and there is no cached data
  if (metricsError && !metrics) {
    return (
      <ErrorMessage
        title="Gagal Memuat Dashboard"
        message={(metricsError as Error).message}
        onRetry={refetchMetrics}
      />
    );
  }

  // 1. GURU / PEGAWAI DASHBOARD VIEW
  if (role === 'GURU_PEGAWAI') {
    const myLoans = loans?.filter((l) => l.borrowerId === currentUser.id) || [];
    const myActiveLoans = myLoans.filter((l) => l.status === 'ACTIVE');
    const myPendingApprovals = myLoans.filter((l) => l.status === 'PENDING_APPROVAL');
    const myInVerification = myLoans.filter(
      (l) => l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED'
    );

    return (
      <div className="space-y-6">
        {/* Welcome Hero Banner with Primary Scan Action */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-6 sm:p-8 text-white shadow-lg">
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-700/60 text-blue-100 text-xs font-semibold backdrop-blur-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
                Portal Guru & Pegawai
              </div>
              <SyncIndicator
                className="bg-blue-950/70 text-blue-200 border-blue-700/60"
                isFetching={isMetricsFetching || isLoansFetching}
                isLoading={isMetricsLoading && isLoansLoading}
                dataUpdatedAt={Math.max(metricsUpdatedAt || 0, loansUpdatedAt || 0)}
                isError={Boolean(metricsError)}
                onRefresh={() => {
                  refetchMetrics();
                  refetchLoans();
                }}
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Selamat datang, {currentUser.fullName}!
            </h2>
            <p className="mt-2 text-sm text-blue-100 leading-relaxed">
              Gunakan kamera HP atau laptop Anda untuk memindai QR Code pada unit inventaris. Ajukan peminjaman atau pengembalian barang langsung di tempat.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/qr-scan">
                <Button
                  size="lg"
                  className="bg-white text-blue-900 hover:bg-blue-50 font-bold shadow-md"
                  leftIcon={<QrCode className="w-5 h-5 text-blue-700" />}
                >
                  Scan QR Sekarang
                </Button>
              </Link>
              <Link to="/inventory">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-blue-800/40 text-white border-blue-400/40 hover:bg-blue-800/80"
                  leftIcon={<Boxes className="w-5 h-5" />}
                >
                  Katalog Barang
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Tracker Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Pinjaman Aktif Saya"
            value={myActiveLoans.length}
            icon={<Clock className="w-5 h-5" />}
            color="indigo"
            subtitle="Barang sedang Anda gunakan"
          />
          <StatCard
            title="Menunggu Persetujuan"
            value={myPendingApprovals.length}
            icon={<AlertTriangle className="w-5 h-5" />}
            color="amber"
            subtitle="Menunggu persetujuan admin"
          />
          <StatCard
            title="Menunggu Verifikasi"
            value={myInVerification.length}
            icon={<FileCheck2 className="w-5 h-5" />}
            color="blue"
            subtitle="Pengembalian menunggu verifikasi admin"
          />
        </div>

        {/* My Active Loans Quick Table */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Barang Sedang Anda Pinjam</CardTitle>
              <CardDescription>
                Segera ajukan pengembalian sebelum batas waktu jatuh tempo berakhir.
              </CardDescription>
            </div>
            <Link to="/my-loans">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Lihat Semua
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoansLoading ? (
              <TableSkeleton rows={3} columns={4} />
            ) : myActiveLoans.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-700">Tidak ada pinjaman aktif</p>
                <p className="text-xs text-slate-500 mt-1">
                  Anda tidak memiliki tanggungan inventaris saat ini. Silakan scan QR jika ingin meminjam barang.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold border-b">
                    <tr>
                      <th className="px-6 py-3">Barang & Kode</th>
                      <th className="px-6 py-3">Tanggal Pinjam</th>
                      <th className="px-6 py-3">Jatuh Tempo</th>
                      <th className="px-6 py-3 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myActiveLoans.map((loan) => {
                      const isOverdue = new Date(loan.expectedReturnAt).getTime() < Date.now();
                      return (
                        <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900">{loan.unit.itemName}</div>
                            <div className="text-xs text-slate-500 font-mono">{loan.unit.assetCode}</div>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            {formatDate(loan.handover?.handedOverAt || loan.requestedAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-slate-700 font-medium">
                              {formatDate(loan.expectedReturnAt)}
                            </div>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 mt-0.5">
                                <AlertTriangle className="w-3 h-3" />
                                Terlambat
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link to="/qr-scan">
                              <Button size="sm" variant="outline" leftIcon={<QrCode className="w-3.5 h-3.5" />}>
                                Kembalikan via QR
                              </Button>
                            </Link>
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
      </div>
    );
  }

  // 2. ADMIN SARPRAS & KEPALA SEKOLAH DASHBOARD VIEW
  return (
    <div className="space-y-6">
      {/* Quick Action Bar for Admin */}
      {role === 'ADMIN_SARPRAS' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pintasan Cepat Admin:
            </span>
            <SyncIndicator
              isFetching={isMetricsFetching || isLoansFetching}
              isLoading={isMetricsLoading && isLoansLoading}
              dataUpdatedAt={Math.max(metricsUpdatedAt || 0, loansUpdatedAt || 0)}
              isError={Boolean(metricsError)}
              onRefresh={() => {
                refetchMetrics();
                refetchLoans();
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/inventory">
              <Button size="sm" variant="outline" leftIcon={<Plus className="w-4 h-4" />}>
                Tambah Barang
              </Button>
            </Link>
            <Link to="/qr-print">
              <Button size="sm" variant="outline" leftIcon={<Printer className="w-4 h-4" />}>
                Cetak Label QR
              </Button>
            </Link>
            <Link to="/loans/approval">
              <Button
                size="sm"
                className="bg-blue-800 text-white"
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Persetujuan ({metrics?.pendingApprovalsCount ?? 0})
              </Button>
            </Link>
            <Link to="/returns/verify">
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<FileCheck2 className="w-4 h-4" />}
              >
                Verifikasi Pengembalian ({metrics?.pendingReturnsCount ?? 0})
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Monitoring Sarana & Prasarana
          </span>
          <SyncIndicator
            isFetching={isMetricsFetching || isLoansFetching}
            isLoading={isMetricsLoading && isLoansLoading}
            dataUpdatedAt={Math.max(metricsUpdatedAt || 0, loansUpdatedAt || 0)}
            isError={Boolean(metricsError)}
            onRefresh={() => {
              refetchMetrics();
              refetchLoans();
            }}
          />
        </div>
      )}

      {/* Primary KPI Grid */}
      {isMetricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Unit Inventaris"
            value={metrics?.totalAssets ?? 0}
            icon={<Boxes className="w-5 h-5" />}
            color="blue"
            subtitle="Seluruh unit terlacak individual"
          />
          <StatCard
            title="Unit Tersedia"
            value={metrics?.availableAssets ?? 0}
            icon={<CheckCircle2 className="w-5 h-5" />}
            color="emerald"
            subtitle="Siap untuk dipinjamkan"
          />
          <StatCard
            title="Sedang Dipinjam"
            value={metrics?.onLoanAssets ?? 0}
            icon={<Clock className="w-5 h-5" />}
            color="indigo"
            subtitle={`${metrics?.overdueLoansCount ?? 0} pinjaman melewati jatuh tempo`}
          />
          <StatCard
            title="Dalam Perbaikan / Rusak"
            value={metrics?.maintenanceAssets ?? 0}
            icon={<Wrench className="w-5 h-5" />}
            color="rose"
            subtitle="Perlu penanganan teknisi"
          />
        </div>
      )}

      {/* Secondary Metrics Row for Approvals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Menunggu Persetujuan Admin"
          value={metrics?.pendingApprovalsCount ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          subtitle="Mode ADMIN_APPROVAL yang pending"
        />
        <StatCard
          title="Menunggu Verifikasi Pengembalian"
          value={metrics?.pendingReturnsCount ?? 0}
          icon={<FileCheck2 className="w-5 h-5" />}
          color="blue"
          subtitle="Verifikasi penerimaan oleh admin"
        />
        <StatCard
          title="Keterlambatan Pengembalian"
          value={metrics?.overdueLoansCount ?? 0}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="rose"
          subtitle="Melewati estimasi tanggal kembali"
        />
      </div>

      {/* Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Distribusi Inventaris Berdasarkan Kategori</CardTitle>
              <CardDescription>Rasio unit tersedia dibandingkan total inventaris</CardDescription>
            </div>
            <Link to="/reports">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Lihat Rekap
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics?.byCategory?.map((cat) => {
              const total = cat.count || 1;
              const percent = Math.round((cat.available / total) * 100);
              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800">{cat.name}</span>
                    <span className="text-slate-500">
                      {cat.available} tersedia / {cat.count} total ({percent}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-blue-600 transition-all duration-500 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Condition Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status Kondisi Fisik</CardTitle>
            <CardDescription>Berdasarkan audit pemeriksaan terakhir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics?.byCondition?.map((cond) => {
              const badge = getConditionBadge(cond.status);
              return (
                <div
                  key={cond.status}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={cond.status === 'GOOD' ? 'success' : 'danger'}>
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="text-base font-bold text-slate-800">{cond.count} unit</div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities / Audit Trail */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Aktivitas & Log Audit Terkini</CardTitle>
            <CardDescription>
              Catatan kronologis perubahan status peminjaman dan inventaris
            </CardDescription>
          </div>
          <Link to="/audit">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Buka Semua Log
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isAuditLoading ? (
            <TableSkeleton rows={4} columns={3} />
          ) : (
            <div className="divide-y divide-slate-100">
              {(Array.isArray(auditLogs) ? auditLogs : []).slice(0, 5).map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900">{log.userName}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{log.details}</p>
                    {log.entityName && (
                      <p className="text-[11px] text-blue-700 font-medium">{log.entityName}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
