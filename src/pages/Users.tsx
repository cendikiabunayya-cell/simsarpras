import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  Search,
  UserPlus,
  Pencil,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  AlertTriangle,
  Lock,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorMessage } from '../components/ui/ErrorMessage';

export const Users: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const isAdmin = currentUser.role === 'ADMIN_SARPRAS';

  // State pencarian & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // State modal form tambah
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    fullName: '',
    employeeNumber: '',
    email: '',
    role: 'GURU_PEGAWAI' as UserRole,
    password: '',
    department: 'Guru / Pegawai',
    isActive: true,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // State modal form edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    employeeNumber: '',
    email: '',
    role: 'GURU_PEGAWAI' as UserRole,
    password: '',
    department: '',
    isActive: true,
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

  // State modal konfirmasi ubah status aktif/nonaktif
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatusUser, setTargetStatusUser] = useState<UserProfile | null>(null);

  // State modal konfirmasi hapus pengguna
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [targetDeleteUser, setTargetDeleteUser] = useState<UserProfile | null>(null);

  // State notifikasi banner
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Query: Ambil seluruh daftar pengguna
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.getAllUsers(),
    enabled: isAdmin,
  });

  // Mutasi: Tambah Pengguna Baru
  const createMutation = useMutation({
    mutationFn: (payload: typeof createFormData) => api.createUser(payload),
    onSuccess: (newUser) => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setIsCreateModalOpen(false);
      setCreateFormData({
        fullName: '',
        employeeNumber: '',
        email: '',
        role: 'GURU_PEGAWAI',
        password: '',
        department: 'Guru / Pegawai',
        isActive: true,
      });
      setNotification({
        type: 'success',
        message: `Akun pengguna "${newUser.fullName}" berhasil ditambahkan.`,
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err?.message || 'Gagal menambahkan akun pengguna.',
      });
    },
  });

  // Mutasi: Update Pengguna
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: typeof editFormData }) =>
      api.updateUser(id, payload),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      setNotification({
        type: 'success',
        message: `Data pengguna "${updatedUser.fullName}" berhasil diperbarui.`,
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err?.message || 'Gagal memperbarui data pengguna.',
      });
    },
  });

  // Mutasi: Toggle Status Pengguna
  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateUserStatus(id, isActive),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setIsStatusModalOpen(false);
      setTargetStatusUser(null);
      setNotification({
        type: 'success',
        message: updated.isActive
          ? `Akun "${updated.fullName}" berhasil diaktifkan kembali.`
          : `Akun "${updated.fullName}" telah dinonaktifkan.`,
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err?.message || 'Gagal mengubah status akun pengguna.',
      });
    },
  });

  // Mutasi: Hapus Pengguna Secara Permanen
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.deleteUser(userId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
      setIsDeleteModalOpen(false);
      setTargetDeleteUser(null);
      setNotification({
        type: 'success',
        message: res.message || 'Akun pengguna berhasil dihapus.',
      });
    },
    onError: (err: any) => {
      setNotification({
        type: 'error',
        message: err?.message || 'Gagal menghapus akun pengguna.',
      });
    },
  });

  // Handler buka modal edit
  const handleOpenEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditFormData({
      fullName: user.fullName,
      employeeNumber: user.employeeNumber || '',
      email: user.email,
      role: user.role,
      password: '',
      department: user.department || 'Guru / Pegawai',
      isActive: user.isActive,
    });
    setIsEditModalOpen(true);
  };

  // Handler buka modal status
  const handleOpenStatusConfirm = (user: UserProfile) => {
    setTargetStatusUser(user);
    setIsStatusModalOpen(true);
  };

  // Handler buka modal hapus
  const handleOpenDeleteConfirm = (user: UserProfile) => {
    if (user.id === currentUser.id) {
      setNotification({
        type: 'error',
        message: 'Anda tidak dapat menghapus akun Anda sendiri saat sedang masuk.',
      });
      return;
    }
    setTargetDeleteUser(user);
    setIsDeleteModalOpen(true);
  };

  // Filter list pengguna di frontend
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.employeeNumber && u.employeeNumber.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q));

    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchQuery && matchRole && matchStatus;
  });

  // Metrik ringkasan
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === 'ADMIN_SARPRAS').length;
  const guruCount = users.filter((u) => u.role === 'GURU_PEGAWAI').length;
  const kepsekCount = users.filter((u) => u.role === 'KEPALA_SEKOLAH').length;
  const activeCount = users.filter((u) => u.isActive).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN_SARPRAS':
        return {
          label: 'Admin Sarpras',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'GURU_PEGAWAI':
        return {
          label: 'Guru / Pegawai',
          className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      case 'KEPALA_SEKOLAH':
        return {
          label: 'Kepala Sekolah',
          className: 'bg-purple-100 text-purple-800 border-purple-200',
        };
      default:
        return {
          label: role,
          className: 'bg-slate-100 text-slate-800 border-slate-200',
        };
    }
  };

  // Tampilan penolakan akses jika bukan admin
  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Akses Dibatasi</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Halaman Master Data Pengguna hanya dapat diakses oleh akun dengan peran{' '}
              <span className="font-semibold text-blue-700">ADMIN_SARPRAS</span>. Peran akun Anda (
              <span className="font-mono text-xs">{currentUser.role}</span>) tidak memiliki izin
              pengelolaan akun.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Master Data Pengguna
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola data akun staf, dewan guru, dan pimpinan sekolah dengan kebijakan keamanan berbasis peran.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setNotification(null);
            setIsCreateModalOpen(true);
          }}
          className="bg-blue-700 hover:bg-blue-800 font-semibold shadow-sm text-xs"
          leftIcon={<UserPlus className="w-4 h-4" />}
        >
          Tambah Pengguna
        </Button>
      </div>

      {/* Banner Notifikasi Sukses / Gagal */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs animate-in fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ringkasan Statistik Pengguna */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Akun Terdaftar"
          value={totalUsers}
          subtitle={`${activeCount} akun aktif operasional`}
          icon={<UsersIcon className="w-4 h-4 text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Admin Sarpras"
          value={adminCount}
          subtitle="Akses penuh sistem & persetujuan"
          icon={<ShieldCheck className="w-4 h-4 text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Guru / Pegawai"
          value={guruCount}
          subtitle="Peminjaman mandiri & katalog"
          icon={<UserCheck className="w-4 h-4 text-emerald-600" />}
          color="emerald"
        />
        <StatCard
          title="Kepala Sekolah"
          value={kepsekCount}
          subtitle="Akses laporan & eksekutif"
          icon={<UsersIcon className="w-4 h-4 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Tabel Data Pengguna */}
      <Card>
        <CardHeader className="py-3 px-5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
          <CardTitle className="text-sm">Daftar Akun Pengguna</CardTitle>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Input Pencarian */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIP, atau email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Filter Peran */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Semua Peran</option>
              <option value="ADMIN_SARPRAS">Admin Sarpras</option>
              <option value="GURU_PEGAWAI">Guru / Pegawai</option>
              <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
            </select>

            {/* Filter Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif Saja</option>
              <option value="INACTIVE">Nonaktif Saja</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={5} columns={6} />
          ) : isError ? (
            <div className="p-6">
              <ErrorMessage
                message={(error as any)?.message || 'Gagal memuat data pengguna dari server.'}
                onRetry={() => refetch()}
              />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12">
              <EmptyState
                title="Tidak Ada Pengguna"
                description={
                  searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? 'Tidak ditemukan pengguna yang sesuai dengan kriteria filter Anda.'
                    : 'Belum ada data pengguna yang tersimpan.'
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3">Pengguna</th>
                    <th className="px-5 py-3">NIP / No. Pegawai</th>
                    <th className="px-5 py-3">Peran (Role)</th>
                    <th className="px-5 py-3">Departemen / Unit</th>
                    <th className="px-5 py-3 text-center">Status Akun</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const roleBadge = getRoleBadge(u.role);
                    const isSelf = u.id === currentUser.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Nama & Email */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{u.fullName}</span>
                                {isSelf && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* NIP */}
                        <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-600">
                          {u.employeeNumber && u.employeeNumber !== '-' ? (
                            u.employeeNumber
                          ) : (
                            <span className="text-slate-400 italic">Tidak ada</span>
                          )}
                        </td>

                        {/* Role Badge */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                        </td>

                        {/* Departemen */}
                        <td className="px-5 py-3.5 text-slate-600">
                          {u.department || 'Guru / Pegawai'}
                        </td>

                        {/* Status Aktif / Nonaktif */}
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Nonaktif
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1">
                          {/* Tombol Edit */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="Ubah data pengguna"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Tombol Toggle Status */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatusConfirm(u)}
                            title={u.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              u.isActive
                                ? 'text-amber-600 hover:bg-amber-50 border-amber-200'
                                : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200'
                            }`}
                          >
                            {u.isActive ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Tombol Hapus Pengguna */}
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteConfirm(u)}
                            title="Hapus akun pengguna secara permanen"
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* MODAL 1: TAMBAH PENGGUNA BARU */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tambah Akun Pengguna Baru"
        description="Buat akun pengguna baru dengan kata sandi ter-enkripsi bcrypt."
        maxWidth="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createFormData);
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Nama Lengkap & Gelar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={createFormData.fullName}
              onChange={(e) =>
                setCreateFormData((prev) => ({ ...prev, fullName: e.target.value }))
              }
              placeholder="Contoh: Rina Melati, S.Pd."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                NIP / Nomor Pegawai
              </label>
              <input
                type="text"
                value={createFormData.employeeNumber}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, employeeNumber: e.target.value }))
                }
                placeholder="Contoh: 199304122020122005"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Email Kedinasan <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={createFormData.email}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="nama@sekolah.sch.id"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Peran Pengguna (Role) <span className="text-rose-500">*</span>
              </label>
              <select
                value={createFormData.role}
                onChange={(e) =>
                  setCreateFormData((prev) => ({
                    ...prev,
                    role: e.target.value as UserRole,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="GURU_PEGAWAI">Guru / Pegawai</option>
                <option value="ADMIN_SARPRAS">Admin Sarpras</option>
                <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Departemen / Unit Kerja
              </label>
              <input
                type="text"
                value={createFormData.department}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, department: e.target.value }))
                }
                placeholder="Contoh: Jurusan Rekayasa Perangkat Lunak"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Kata Sandi Awal <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCreatePassword ? 'text' : 'password'}
                required
                minLength={6}
                value={createFormData.password}
                onChange={(e) =>
                  setCreateFormData((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Minimal 6 karakter"
                className="w-full pl-3 pr-9 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowCreatePassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Kata sandi akan otomatis di-hash menggunakan algoritma bcrypt (salt 10 rounds).
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="create_is_active"
              checked={createFormData.isActive}
              onChange={(e) =>
                setCreateFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="create_is_active" className="text-xs text-slate-700 select-none">
              Akun langsung aktif dan dapat digunakan untuk masuk
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending}
              className="bg-blue-700 hover:bg-blue-800"
            >
              Simpan Pengguna
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: UBAH DATA PENGGUNA */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        }}
        title="Ubah Data Pengguna"
        description="Perbarui profil atau kata sandi akun pengguna terpilih."
        maxWidth="md"
      >
        {selectedUser && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                id: selectedUser.id,
                payload: editFormData,
              });
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Nama Lengkap & Gelar <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editFormData.fullName}
                onChange={(e) =>
                  setEditFormData((prev) => ({ ...prev, fullName: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  NIP / Nomor Pegawai
                </label>
                <input
                  type="text"
                  value={editFormData.employeeNumber}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, employeeNumber: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email Kedinasan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Peran Pengguna (Role)
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="GURU_PEGAWAI">Guru / Pegawai</option>
                  <option value="ADMIN_SARPRAS">Admin Sarpras</option>
                  <option value="KEPALA_SEKOLAH">Kepala Sekolah</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Departemen / Unit Kerja
                </label>
                <input
                  type="text"
                  value={editFormData.department}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, department: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Bagian Ubah Kata Sandi (Opsional) */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Ganti Kata Sandi (Opsional)</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Biarkan kolom ini kosong jika tidak ingin mengubah kata sandi pengguna saat ini.
              </p>
              <div className="relative pt-1">
                <input
                  type={showEditPassword ? 'text' : 'password'}
                  minLength={6}
                  value={editFormData.password}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                  placeholder="Masukkan kata sandi baru (minimal 6 karakter)"
                  className="w-full pl-3 pr-9 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((prev) => !prev)}
                  className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                isLoading={updateMutation.isPending}
                className="bg-blue-700 hover:bg-blue-800"
              >
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: KONFIRMASI UBAH STATUS AKUN */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setTargetStatusUser(null);
        }}
        title={targetStatusUser?.isActive ? 'Nonaktifkan Akun Pengguna' : 'Aktifkan Akun Pengguna'}
        description="Konfirmasi perubahan status akses akun pengguna."
        maxWidth="sm"
      >
        {targetStatusUser && (
          <div className="space-y-4 text-xs">
            {targetStatusUser.id === currentUser.id && targetStatusUser.isActive ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Tindakan Ditolak</span>
                </div>
                <p>Anda tidak dapat menonaktifkan akun Anda sendiri saat sedang masuk ke sistem.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin{' '}
                  <span className="font-bold">
                    {targetStatusUser.isActive ? 'menonaktifkan' : 'mengaktifkan kembali'}
                  </span>{' '}
                  akun berikut?
                </p>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="font-bold text-slate-900">{targetStatusUser.fullName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    NIP: {targetStatusUser.employeeNumber} • {targetStatusUser.email}
                  </div>
                  <div className="text-[10px] text-blue-700 font-semibold mt-1">
                    Peran: {targetStatusUser.role}
                  </div>
                </div>

                {targetStatusUser.isActive && (
                  <p className="text-slate-500 text-[11px]">
                    Akun yang dinonaktifkan tidak akan dapat masuk (login) ke sistem, namun riwayat
                    peminjaman dan audit log transaksi tetap tersimpan utuh.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsStatusModalOpen(false);
                  setTargetStatusUser(null);
                }}
              >
                Batal
              </Button>

              {!(targetStatusUser.id === currentUser.id && targetStatusUser.isActive) && (
                <Button
                  type="button"
                  isLoading={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({
                      id: targetStatusUser.id,
                      isActive: !targetStatusUser.isActive,
                    })
                  }
                  className={
                    targetStatusUser.isActive
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }
                >
                  {targetStatusUser.isActive ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan Kembali'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 4: KONFIRMASI HAPUS PENGGUNA */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setIsDeleteModalOpen(false);
            setTargetDeleteUser(null);
          }
        }}
        title="Hapus Akun Pengguna Secara Permanen"
        description="Tindakan ini akan menghapus akun pengguna secara permanen dari basis data."
        maxWidth="sm"
      >
        {targetDeleteUser && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-950">Konfirmasi Penghapusan</p>
                <p className="text-rose-700 leading-relaxed">
                  Apakah Anda yakin ingin menghapus akun <strong>{targetDeleteUser.fullName}</strong>? Data yang dihapus tidak dapat dipulihkan kembali.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Lengkap:</span>
                <span className="font-bold text-slate-900">{targetDeleteUser.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email Kedinasan:</span>
                <span className="font-mono text-slate-700">{targetDeleteUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIP / ID:</span>
                <span className="font-mono text-slate-700">{targetDeleteUser.employeeNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Peran Sistem:</span>
                <span className="font-semibold text-blue-700">{targetDeleteUser.role}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setTargetDeleteUser(null);
                }}
              >
                Batal
              </Button>

              <Button
                type="button"
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(targetDeleteUser.id)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                Ya, Hapus Permanen
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
