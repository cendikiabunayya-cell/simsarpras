import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ConditionStatus, LoanMode, LoanStatus, OperationalStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(date) + ' WIB';
  } catch {
    return dateString;
  }
}

export function formatDateOnly(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatRupiah(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formatCurrency = formatRupiah;

export function getConditionBadge(status: ConditionStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'GOOD':
      return { label: 'Baik', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'MINOR_DAMAGE':
      return { label: 'Rusak Ringan', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'MAJOR_DAMAGE':
      return { label: 'Rusak Berat', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'LOST':
      return { label: 'Hilang', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' };
    default:
      return { label: status, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export function getOperationalBadge(status: OperationalStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'AVAILABLE':
      return { label: 'Tersedia', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'UNAVAILABLE':
      return { label: 'Tidak Tersedia', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'RESERVED':
      return { label: 'Dipesan', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'ON_LOAN':
      return { label: 'Sedang Dipinjam', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'RETURN_PENDING':
      return { label: 'Menunggu Pengembalian', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'RETURN_INSPECTION':
      return { label: 'Dalam Pemeriksaan', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
    case 'MAINTENANCE':
      return { label: 'Perbaikan / Rusak', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'INACTIVE':
      return { label: 'Non-aktif', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' };
    case 'LOST':
      return { label: 'Hilang', bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-300' };
    default:
      return { label: status, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export function getLoanStatusBadge(status: LoanStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'PENDING_APPROVAL':
      return { label: 'Menunggu Persetujuan Admin', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'APPROVED':
      return { label: 'Disetujui (Menunggu Penyiapan)', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'READY_FOR_HANDOVER':
      return { label: 'Siap Serah Terima', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' };
    case 'ACTIVE':
      return { label: 'Pinjaman Aktif', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'RETURN_REQUESTED':
      return { label: 'Menunggu Verifikasi', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'RETURN_RECEIVED':
      return { label: 'Menunggu Verifikasi', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'RETURN_ISSUE':
      return { label: 'Kendala Pengembalian', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'COMPLETED':
      return { label: 'Selesai', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'REJECTED':
      return { label: 'Ditolak', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    case 'CANCELLED':
      return { label: 'Dibatalkan', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    default:
      return { label: status, bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
  }
}

export function getLoanModeBadge(mode: LoanMode): {
  label: string;
  bg: string;
  text: string;
  border: string;
  description: string;
} {
  if (mode === 'DIRECT') {
    return {
      label: 'Langsung (DIRECT)',
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      description: 'Langsung siap serah terima tanpa perlu persetujuan admin.',
    };
  }
  return {
    label: 'Persetujuan (ADMIN_APPROVAL)',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    description: 'Wajib disetujui Admin Sarpras sebelum barang diserahkan.',
  };
}

/**
 * Helper format label kategori + nomor barang (misal: "No: 22" -> "Laptop 22")
 */
export function getCategoryAndItemNumber(item?: {
  itemNumber?: string | null;
  categoryName?: string;
  itemName?: string;
} | null): string {
  if (!item) return '';
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
