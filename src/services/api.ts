import {
  AssetUnit,
  AuditLog,
  BackupPayload,
  BackupSummary,
  Category,
  ConditionStatus,
  DashboardMetrics,
  FundingSource,
  LoanMode,
  LoanRequest,
  Location,
  RestoreMode,
  RestoreResult,
  SchoolSettings,
  UserProfile,
  UserRole,
} from '../types';
import { MockStorageService } from './mockStorage';

const isTestEnv = import.meta.env.MODE === 'test';
const rawEnvUrl = isTestEnv && !import.meta.env.VITE_TEST_LIVE_API
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || '');

export const getApiBaseUrl = (): string => {
  if (rawEnvUrl) {
    if (
      typeof window !== 'undefined' &&
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      rawEnvUrl.includes('localhost')
    ) {
      return rawEnvUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
    }
    return rawEnvUrl;
  }
  // Jika di Vercel / hosting cloud dan rawEnvUrl belum diset, otomatis sambungkan ke backend terintegrasi /api/v1
  if (
    !isTestEnv &&
    typeof window !== 'undefined' &&
    window.location.hostname &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
  ) {
    return '/api/v1';
  }
  return '';
};

const API_BASE_URL = getApiBaseUrl();
export const IS_MOCK_MODE =
  !rawEnvUrl &&
  (typeof window === 'undefined' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    isTestEnv);

export const MOCK_NOTICE_MESSAGE =
  'Aplikasi sedang menggunakan Mock Data / Mode Simulasi Lokal. Transaksi belum disimpan ke backend server Express.';

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

const storage = MockStorageService.getInstance();

const TOKEN_STORAGE_KEY = 'simsarpras_auth_token';

export const getStoredToken = (): string | null => {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string): void => {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (e) {
    console.error('Gagal menyimpan token ke sessionStorage', e);
  }
};

export const removeStoredToken = (): void => {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    console.error('Gagal menghapus token dari sessionStorage', e);
  }
};

/**
 * Helper terpusat untuk pemanggilan API yang memerlukan token otorisasi Bearer.
 * Secara otomatis menyematkan header Authorization jika token tersedia di sessionStorage.
 * Menangani respon 401 dengan membersihkan token lokal jika sesi kedaluwarsa.
 */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && !IS_MOCK_MODE) {
    removeStoredToken();
  }
  return res;
}

export interface GetAssetsFilterOptions {
  signal?: AbortSignal;
  fundingSourceId?: string;
  fundingSource?: string;
  acquisitionYear?: number | string;
  categoryId?: string;
  locationId?: string;
  operationalStatus?: string;
  institution?: string;
  itemNumber?: string;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export const api = {
  isMock: IS_MOCK_MODE,

  // Auth & Profile
  async getCurrentUser(): Promise<UserProfile> {
    if (IS_MOCK_MODE) {
      await delay(80);
      return storage.getActiveUser();
    }
    const res = await authFetch(`${API_BASE_URL}/auth/me`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Gagal memuat profil pengguna');
    }
    const json = await res.json();
    return json.user || json;
  },

  async login(identifier: string, password: string): Promise<{ token: string; user: UserProfile }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      const allUsers = storage.getAllUsers();
      const matched = allUsers.find(
        (u) =>
          u.employeeNumber === identifier.trim() ||
          u.email.toLowerCase() === identifier.trim().toLowerCase()
      );
      if (!matched) {
        throw new Error('NIP atau Email tidak terdaftar dalam basis data sistem sarpras sekolah.');
      }
      storage.setActiveUser(matched);
      return { token: 'mock-session-token', user: matched };
    }

    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.message || 'Login gagal. Silakan periksa kredensial Anda.');
    }

    if (json.token) {
      setStoredToken(json.token);
    }
    const userProfile: UserProfile = {
      id: json.user.id,
      fullName: json.user.fullName,
      employeeNumber: json.user.employeeNumber || '-',
      email: json.user.email,
      role: json.user.role,
      isActive: json.user.isActive ?? true,
      department: json.user.department,
      avatarUrl: json.user.avatarUrl,
    };
    return { token: json.token, user: userProfile };
  },

  async logout(): Promise<void> {
    if (IS_MOCK_MODE) {
      await delay(50);
      return;
    }
    try {
      await authFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
    } finally {
      removeStoredToken();
    }
  },

  async switchUser(user: UserProfile): Promise<UserProfile> {
    if (IS_MOCK_MODE) {
      await delay(80);
      storage.setActiveUser(user);
      return user;
    }
    return user;
  },

  async getAllUsers(search?: string, role?: string, isActive?: boolean): Promise<UserProfile[]> {
    if (IS_MOCK_MODE) {
      await delay(80);
      let list = storage.getAllUsers();
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter(
          (u) =>
            u.fullName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.employeeNumber && u.employeeNumber.includes(q))
        );
      }
      if (role && role.trim()) {
        list = list.filter((u) => u.role === role);
      }
      if (isActive !== undefined) {
        list = list.filter((u) => u.isActive === isActive);
      }
      return list;
    }

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    if (isActive !== undefined) params.append('isActive', String(isActive));

    const res = await authFetch(`${API_BASE_URL}/users?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memuat daftar pengguna.');
    }
    return Array.isArray(json) ? json : json.data || [];
  },

  async createUser(payload: {
    fullName: string;
    employeeNumber?: string;
    email: string;
    role: UserRole;
    password: string;
    department?: string;
    isActive?: boolean;
  }): Promise<UserProfile> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.addUser({
        fullName: payload.fullName,
        employeeNumber: payload.employeeNumber || '-',
        email: payload.email,
        role: payload.role,
        department: payload.department || 'Guru / Pegawai',
        isActive: payload.isActive ?? true,
      });
    }

    const res = await authFetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menambahkan akun pengguna.');
    }
    return json.data || json;
  },

  async updateUser(
    id: string,
    payload: {
      fullName?: string;
      employeeNumber?: string;
      email?: string;
      role?: UserRole;
      password?: string;
      department?: string;
      isActive?: boolean;
    }
  ): Promise<UserProfile> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateUser(id, payload);
    }

    const res = await authFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui data pengguna.');
    }
    return json.data || json;
  },

  async updateUserStatus(id: string, isActive: boolean): Promise<UserProfile> {
    if (IS_MOCK_MODE) {
      await delay(100);
      return storage.setUserStatus(id, isActive);
    }

    const res = await authFetch(`${API_BASE_URL}/users/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui status akun pengguna.');
    }
    return json.data || json;
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      storage.deleteUser(id);
      return { success: true, message: 'Akun pengguna berhasil dihapus.' };
    }

    const res = await authFetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.message || 'Gagal menghapus akun pengguna.');
    }
    return json || { success: true, message: 'Akun pengguna berhasil dihapus.' };
  },

  // MASTER DATA: SUMBER PENDANAAN
  async getFundingSources(isActive?: boolean): Promise<FundingSource[]> {
    if (IS_MOCK_MODE) {
      await delay(100);
      let list = storage.getFundingSources();
      if (isActive !== undefined) list = list.filter((f) => f.isActive === isActive);
      return list;
    }
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const url = `${API_BASE_URL}/funding-sources${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Gagal memuat daftar sumber pendanaan');
    }
    return res.json();
  },

  async createFundingSource(name: string, description?: string): Promise<FundingSource> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.addFundingSource(name, description);
    }
    const res = await authFetch(`${API_BASE_URL}/funding-sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menambahkan sumber pendanaan');
    }
    return json;
  },

  async updateFundingSource(
    id: string,
    updates: { name?: string; description?: string; isActive?: boolean }
  ): Promise<FundingSource> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateFundingSource(id, updates);
    }
    const res = await authFetch(`${API_BASE_URL}/funding-sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui sumber pendanaan');
    }
    return json;
  },

  async deleteFundingSource(id: string): Promise<{ success: boolean; message: string }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      storage.deleteFundingSource(id);
      return { success: true, message: 'Sumber pendanaan berhasil dihapus.' };
    }
    const res = await authFetch(`${API_BASE_URL}/funding-sources/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menghapus sumber pendanaan');
    }
    return json;
  },

  // MASTER DATA: KATEGORI
  async getCategories(isActive?: boolean): Promise<Category[]> {
    if (IS_MOCK_MODE) {
      await delay(100);
      let list = storage.getCategories();
      if (isActive !== undefined) list = list.filter((c) => c.isActive === isActive);
      return list;
    }
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const url = `${API_BASE_URL}/categories${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Gagal memuat daftar kategori');
    }
    return res.json();
  },

  async createCategory(
    name: string,
    defaultLoanMode: LoanMode = 'DIRECT',
    description?: string
  ): Promise<Category> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.addCategory(name, defaultLoanMode, description);
    }
    const res = await authFetch(`${API_BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, defaultLoanMode, description }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menambahkan kategori');
    }
    return json;
  },

  async updateCategory(
    id: string,
    updates: { name?: string; defaultLoanMode?: LoanMode; description?: string; isActive?: boolean }
  ): Promise<Category> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateCategory(id, updates);
    }
    const res = await authFetch(`${API_BASE_URL}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui kategori');
    }
    return json;
  },

  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      storage.deleteCategory(id);
      return { success: true, message: 'Kategori berhasil dihapus.' };
    }
    const res = await authFetch(`${API_BASE_URL}/categories/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menghapus kategori');
    }
    return json;
  },

  // MASTER DATA: RUANGAN / LOKASI
  async getLocations(isActive?: boolean): Promise<Location[]> {
    if (IS_MOCK_MODE) {
      await delay(100);
      let list = storage.getLocations();
      if (isActive !== undefined) list = list.filter((l) => l.isActive === isActive);
      return list;
    }
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const url = `${API_BASE_URL}/locations${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await authFetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Gagal memuat daftar ruangan/lokasi');
    }
    return res.json();
  },

  async createLocation(name: string, code?: string, description?: string): Promise<Location> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.addLocation(name, code, description);
    }
    const res = await authFetch(`${API_BASE_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, description }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menambahkan ruangan');
    }
    return json;
  },

  async updateLocation(
    id: string,
    updates: { name?: string; code?: string; description?: string; isActive?: boolean }
  ): Promise<Location> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateLocation(id, updates);
    }
    const res = await authFetch(`${API_BASE_URL}/locations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui data ruangan');
    }
    return json;
  },

  async deleteLocation(id: string): Promise<{ success: boolean; message: string }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      storage.deleteLocation(id);
      return { success: true, message: 'Ruangan berhasil dihapus.' };
    }
    const res = await authFetch(`${API_BASE_URL}/locations/${id}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menghapus ruangan');
    }
    return json;
  },

  // PENGATURAN IDENTITAS SEKOLAH
  async getSchoolSettings(): Promise<SchoolSettings> {
    if (IS_MOCK_MODE) {
      await delay(100);
      return storage.getSchoolSettings();
    }
    const res = await authFetch(`${API_BASE_URL}/school-settings`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || 'Gagal memuat pengaturan identitas sekolah');
    }
    return res.json();
  },

  async updateSchoolSettings(data: Partial<SchoolSettings>): Promise<SchoolSettings> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateSchoolSettings(data);
    }
    const res = await authFetch(`${API_BASE_URL}/school-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui pengaturan sekolah');
    }
    return json;
  },

  // DATA BARANG / SARANA
  async getAssets(options?: GetAssetsFilterOptions): Promise<AssetUnit[]> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.getAssets(options);
    }
    const queryParams = new URLSearchParams();
    if (options?.fundingSourceId) queryParams.append('fundingSourceId', options.fundingSourceId);
    if (options?.fundingSource) queryParams.append('fundingSource', options.fundingSource);
    if (options?.acquisitionYear !== undefined && options?.acquisitionYear !== '' && options?.acquisitionYear !== null) {
      queryParams.append('acquisitionYear', String(options.acquisitionYear));
    }
    if (options?.categoryId) queryParams.append('categoryId', options.categoryId);
    if (options?.locationId) queryParams.append('locationId', options.locationId);
    if (options?.operationalStatus) queryParams.append('operationalStatus', options.operationalStatus);
    if (options?.institution) queryParams.append('institution', options.institution);
    if (options?.itemNumber) queryParams.append('itemNumber', options.itemNumber);
    if (options?.search) queryParams.append('search', options.search);
    if (options?.limit !== undefined) queryParams.append('limit', String(options.limit));
    if (options?.offset !== undefined) queryParams.append('offset', String(options.offset));
    if (options?.page !== undefined) queryParams.append('page', String(options.page));

    const qs = queryParams.toString();
    const url = `${API_BASE_URL}/assets${qs ? `?${qs}` : ''}`;
    const res = await authFetch(url, { signal: options?.signal });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memuat inventaris');
    }
    return Array.isArray(json) ? json : json.data || [];
  },

  async getAcquisitionYears(): Promise<number[]> {
    if (IS_MOCK_MODE) {
      await delay(80);
      return storage.getAcquisitionYears();
    }
    try {
      const res = await authFetch(`${API_BASE_URL}/assets/years`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    } catch {
      return [];
    }
  },

  async getAssetById(id: string): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(100);
      const asset = storage.getAssetById(id);
      if (!asset) throw new Error('Unit inventaris tidak ditemukan');
      return asset;
    }
    const res = await fetch(`${API_BASE_URL}/assets/${id}`);
    if (!res.ok) throw new Error('Unit tidak ditemukan');
    return res.json();
  },

  async getAssetByCodeOrQr(codeOrQr: string): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(150);
      const asset = storage.getAssetByCodeOrQr(codeOrQr);
      if (!asset) throw new Error(`Barang dengan kode atau token QR "${codeOrQr}" tidak ditemukan`);
      return asset;
    }
    const res = await fetch(`${API_BASE_URL}/assets/scan?query=${encodeURIComponent(codeOrQr)}`);
    if (!res.ok) throw new Error('Barang tidak ditemukan di database');
    return res.json();
  },

  async createAsset(data: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'>): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.addAsset(data);
    }
    const res = await authFetch(`${API_BASE_URL}/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal menambahkan data barang');
    }
    return json.data || json;
  },

  async updateAsset(id: string, data: Partial<AssetUnit>): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.updateAsset(id, data);
    }
    const res = await authFetch(`${API_BASE_URL}/assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memperbarui data barang');
    }
    return json.data || json;
  },

  async decommissionAsset(id: string, reason: string): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.decommissionAsset(id, reason);
    }
    const res = await authFetch(`${API_BASE_URL}/assets/${id}/decommission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.message || 'Gagal menonaktifkan data barang.');
    }
    return json.data || json;
  },

  async deleteAsset(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; mode: 'DELETED' | 'ARCHIVED'; message: string; data?: any }> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.deleteAsset(id, reason);
    }
    const res = await authFetch(`${API_BASE_URL}/assets/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMsg = json?.message || 'Gagal memproses penghapusan data barang.';
      const customErr: any = new Error(errorMsg);
      customErr.status = res.status;
      customErr.code = json?.error;
      throw customErr;
    }
    return json;
  },

  async updateAssetLoanMode(id: string, newMode: LoanMode): Promise<AssetUnit> {
    if (IS_MOCK_MODE) {
      await delay(150);
      return storage.updateAssetLoanMode(id, newMode);
    }
    const res = await fetch(`${API_BASE_URL}/assets/${id}/loan-policy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanMode: newMode }),
    });
    return res.json();
  },

  // LOANS
  async getLoans(options?: { status?: string; signal?: AbortSignal }): Promise<LoanRequest[]> {
    if (IS_MOCK_MODE) {
      await delay(150);
      let list = storage.getLoans();
      if (options?.status) {
        list = list.filter((l) => l.status === options.status);
      }
      return list;
    }
    const url = options?.status
      ? `${API_BASE_URL}/loan-requests?status=${encodeURIComponent(options.status)}`
      : `${API_BASE_URL}/loan-requests`;
    const res = await authFetch(url, { signal: options?.signal });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memuat riwayat peminjaman');
    }
    return Array.isArray(json) ? json : json.data || [];
  },

  async getLoanById(id: string): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(100);
      const loan = storage.getLoanById(id);
      if (!loan) throw new Error('Data peminjaman tidak ditemukan');
      return loan;
    }
    const res = await fetch(`${API_BASE_URL}/loan-requests/${id}`);
    return res.json();
  },

  async createLoanRequest(payload: {
    assetUnitId: string;
    purpose: string;
    expectedReturnAt: string;
    borrower?: UserProfile;
  }): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(250);
      return storage.createLoanRequest(payload);
    }
    const res = await fetch(`${API_BASE_URL}/loan-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengajukan peminjaman');
    }
    return res.json();
  },

  async approveLoanRequest(loanId: string, adminUser: UserProfile): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.approveLoanRequest(loanId, adminUser);
    }
    const res = await authFetch(`${API_BASE_URL}/loan-requests/${loanId}/approve`, {
      method: 'POST',
    });
    return res.json();
  },

  async rejectLoanRequest(loanId: string, reason: string, adminUser: UserProfile): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.rejectLoanRequest(loanId, reason, adminUser);
    }
    const res = await authFetch(`${API_BASE_URL}/loan-requests/${loanId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  async confirmHandover(payload: {
    loanId: string;
    conditionAtHandover: ConditionStatus;
    accessoriesVerified: boolean;
    notes?: string;
    staffUser: UserProfile;
  }): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(250);
      return storage.confirmHandover(payload);
    }
    const res = await authFetch(`${API_BASE_URL}/loans/${payload.loanId}/handover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async submitReturnRequest(payload: {
    loanId: string;
    borrowerUser: UserProfile;
    notes?: string;
  }): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(250);
      return storage.submitReturnRequest(payload);
    }
    const res = await authFetch(`${API_BASE_URL}/returns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async receiveReturnPhysical(loanId: string, adminUser: UserProfile): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.receiveReturnPhysical(loanId, adminUser);
    }
    const res = await authFetch(`${API_BASE_URL}/returns/${loanId}/receive`, {
      method: 'POST',
    });
    return res.json();
  },

  async completeReturnInspection(payload: {
    loanId: string;
    conditionAtReturn: ConditionStatus;
    accessoriesComplete: boolean;
    issueDescription?: string;
    notes?: string;
    photoPath?: string;
    adminUser: UserProfile;
  }): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(250);
      return storage.completeReturnInspection(payload);
    }
    const res = await authFetch(`${API_BASE_URL}/returns/${payload.loanId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async verifyReturn(
    loanId: string,
    adminUser?: UserProfile,
    notes?: string
  ): Promise<LoanRequest> {
    if (IS_MOCK_MODE) {
      await delay(200);
      return storage.verifyReturn(loanId, adminUser, notes);
    }
    const res = await authFetch(`${API_BASE_URL}/returns/${loanId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || 'Gagal memverifikasi pengembalian barang');
    }
    return json;
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    if (IS_MOCK_MODE) {
      await delay(100);
      return storage.getAuditLogs();
    }
    try {
      const res = await authFetch(`${API_BASE_URL}/audit-logs`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    } catch {
      return [];
    }
  },

  // Dashboard Aggregation
  async getDashboardMetrics(options?: { signal?: AbortSignal }): Promise<DashboardMetrics> {
    if (IS_MOCK_MODE) {
      await delay(150);
      const assets = storage.getAssets();
      const loans = storage.getLoans();
      const categories = storage.getCategories();
      const locations = storage.getLocations();
      const fundingSources = storage.getFundingSources();

      const totalAssets = assets.length;
      const availableAssets = assets.filter((a) => a.operationalStatus === 'AVAILABLE').length;
      const onLoanAssets = assets.filter((a) => a.operationalStatus === 'ON_LOAN').length;
      const maintenanceAssets = assets.filter((a) => a.operationalStatus === 'MAINTENANCE').length;

      const pendingApprovalsCount = loans.filter((l) => l.status === 'PENDING_APPROVAL').length;
      const pendingReturnsCount = loans.filter(
        (l) => l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED'
      ).length;

      const now = new Date().getTime();
      const overdueLoansCount = loans.filter((l) => {
        if (l.status !== 'ACTIVE') return false;
        return new Date(l.expectedReturnAt).getTime() < now;
      }).length;

      const byCategory = categories.map((c) => {
        const catAssets = assets.filter((a) => a.categoryName === c.name);
        return {
          name: c.name,
          count: catAssets.length,
          available: catAssets.filter((a) => a.operationalStatus === 'AVAILABLE').length,
        };
      });

      const conditions: { status: ConditionStatus; label: string }[] = [
        { status: 'GOOD', label: 'Baik' },
        { status: 'MINOR_DAMAGE', label: 'Rusak Ringan' },
        { status: 'MAJOR_DAMAGE', label: 'Rusak Berat' },
        { status: 'LOST', label: 'Hilang' },
      ];

      const byCondition = conditions.map((cond) => ({
        status: cond.status,
        label: cond.label,
        count: assets.filter((a) => a.conditionStatus === cond.status).length,
      }));

      const byLocation = locations.map((loc) => ({
        name: loc.name,
        count: assets.filter((a) => a.locationId === loc.id).length,
      }));

      const byFundingSource = fundingSources.map((fs) => ({
        name: fs.name,
        count: assets.filter((a) => a.fundingSource === fs.name).length,
      }));

      return {
        totalAssets,
        availableAssets,
        onLoanAssets,
        maintenanceAssets,
        pendingApprovalsCount,
        pendingReturnsCount,
        overdueLoansCount,
        byCategory,
        byCondition,
        byLocation,
        byFundingSource,
      };
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/dashboard`, { signal: options?.signal });
      if (res.ok) return res.json();
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
    }

    // Fallback: hitung metrik dari data lokal / mock
    const assets = storage.getAssets();
    const loans = storage.getLoans();
    const categories = storage.getCategories();
    const locations = storage.getLocations();
    const fundingSources = storage.getFundingSources();

    return {
      totalAssets: assets.length,
      availableAssets: assets.filter((a) => a.operationalStatus === 'AVAILABLE').length,
      onLoanAssets: assets.filter((a) => a.operationalStatus === 'ON_LOAN').length,
      maintenanceAssets: assets.filter((a) => a.operationalStatus === 'MAINTENANCE').length,
      pendingApprovalsCount: loans.filter((l) => l.status === 'PENDING_APPROVAL').length,
      pendingReturnsCount: loans.filter((l) => l.status === 'RETURN_REQUESTED' || l.status === 'RETURN_RECEIVED').length,
      overdueLoansCount: 0,
      byCategory: categories.map((c) => ({
        name: c.name,
        count: assets.filter((a) => a.categoryName === c.name).length,
        available: assets.filter((a) => a.categoryName === c.name && a.operationalStatus === 'AVAILABLE').length,
      })),
      byCondition: [
        { status: 'GOOD' as ConditionStatus, label: 'Baik', count: assets.filter((a) => a.conditionStatus === 'GOOD').length },
        { status: 'MINOR_DAMAGE' as ConditionStatus, label: 'Rusak Ringan', count: assets.filter((a) => a.conditionStatus === 'MINOR_DAMAGE').length },
        { status: 'MAJOR_DAMAGE' as ConditionStatus, label: 'Rusak Berat', count: assets.filter((a) => a.conditionStatus === 'MAJOR_DAMAGE').length },
        { status: 'LOST' as ConditionStatus, label: 'Hilang', count: assets.filter((a) => a.conditionStatus === 'LOST').length },
      ],
      byLocation: locations.map((loc) => ({
        name: loc.name,
        count: assets.filter((a) => a.locationId === loc.id).length,
      })),
      byFundingSource: fundingSources.map((fs) => ({
        name: fs.name,
        count: assets.filter((a) => a.fundingSource === fs.name).length,
      })),
    };
  },

  // ==========================================
  // BACKUP & RESTORE
  // ==========================================

  async getBackupSummary(): Promise<BackupSummary> {
    if (API_BASE_URL) {
      const response = await authFetch(`${API_BASE_URL}/backup/summary`);
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Gagal mengambil ringkasan data');
      }
      return response.json();
    }
    await delay(150);
    return storage.getBackupSummary();
  },

  async exportBackup(): Promise<BackupPayload> {
    if (API_BASE_URL) {
      const response = await authFetch(`${API_BASE_URL}/backup/export`);
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Gagal mengekspor data cadangan');
      }
      return response.json();
    }
    await delay(300);
    return storage.exportBackup();
  },

  async restoreBackup(backupData: BackupPayload, mode: RestoreMode = 'clean'): Promise<RestoreResult> {
    if (API_BASE_URL) {
      const response = await authFetch(`${API_BASE_URL}/backup/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupData, mode }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || 'Gagal memulihkan basis data');
      }
      return response.json();
    }
    await delay(500);
    return storage.restoreBackup(backupData, mode);
  },

  resetMockData() {
    storage.resetToDefaults();
  },
};
