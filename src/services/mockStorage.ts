import {
  AssetUnit,
  AuditLog,
  BackupPayload,
  BackupSummary,
  Category,
  ConditionStatus,
  FundingSource,
  LoanMode,
  LoanRequest,
  LoanStatus,
  Location,
  OperationalStatus,
  RestoreMode,
  RestoreResult,
  SchoolSettings,
  UserProfile,
} from '../types';
import {
  MOCK_ASSET_UNITS,
  MOCK_AUDIT_LOGS,
  MOCK_CATEGORIES,
  MOCK_FUNDING_SOURCES,
  MOCK_LOAN_REQUESTS,
  MOCK_LOCATIONS,
  MOCK_USERS,
} from '../data/mockData';

const STORAGE_KEYS = {
  ASSETS: 'sisarpras_assets_v2',
  CATEGORIES: 'sisarpras_categories_v2',
  LOCATIONS: 'sisarpras_locations_v2',
  FUNDING_SOURCES: 'sisarpras_funding_v2',
  LOANS: 'sisarpras_loans_v2',
  AUDIT: 'sisarpras_audit_v2',
  ACTIVE_USER: 'sisarpras_active_user_v2',
  USERS: 'sisarpras_users_v2',
  SCHOOL_SETTINGS: 'sisarpras_school_settings_v2',
};

function getStored<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch {
    return defaultData;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

export class MockStorageService {
  private static instance: MockStorageService;

  private constructor() {
    this.ensureInitialized();
  }

  public static getInstance(): MockStorageService {
    if (!MockStorageService.instance) {
      MockStorageService.instance = new MockStorageService();
    }
    return MockStorageService.instance;
  }

  public ensureInitialized(): void {
    if (!localStorage.getItem(STORAGE_KEYS.ASSETS)) {
      this.resetToDefaults();
    }
  }

  public resetToDefaults(): void {
    setStored(STORAGE_KEYS.ASSETS, MOCK_ASSET_UNITS);
    setStored(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    setStored(STORAGE_KEYS.LOCATIONS, MOCK_LOCATIONS);
    setStored(STORAGE_KEYS.FUNDING_SOURCES, MOCK_FUNDING_SOURCES);
    setStored(STORAGE_KEYS.LOANS, MOCK_LOAN_REQUESTS);
    setStored(STORAGE_KEYS.AUDIT, MOCK_AUDIT_LOGS);
    setStored(STORAGE_KEYS.ACTIVE_USER, MOCK_USERS[0]);
    setStored(STORAGE_KEYS.USERS, MOCK_USERS);
  }

  // Active User / Session
  public getActiveUser(): UserProfile {
    return getStored<UserProfile>(STORAGE_KEYS.ACTIVE_USER, MOCK_USERS[0]);
  }

  public setActiveUser(user: UserProfile): void {
    setStored(STORAGE_KEYS.ACTIVE_USER, user);
  }

  public getAllUsers(): UserProfile[] {
    return getStored<UserProfile[]>(STORAGE_KEYS.USERS, MOCK_USERS);
  }

  public addUser(user: Omit<UserProfile, 'id'>): UserProfile {
    const list = this.getAllUsers();
    const cleanEmail = user.email.trim().toLowerCase();
    if (list.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error(`Email "${user.email}" sudah digunakan oleh akun lain.`);
    }
    if (user.employeeNumber && user.employeeNumber !== '-' && list.some((u) => u.employeeNumber === user.employeeNumber)) {
      throw new Error(`NIP/Nomor pegawai "${user.employeeNumber}" sudah digunakan.`);
    }

    const newUser: UserProfile = {
      ...user,
      id: `usr-${Date.now()}`,
    };
    list.push(newUser);
    setStored(STORAGE_KEYS.USERS, list);
    return newUser;
  }

  public updateUser(id: string, updates: Partial<UserProfile>): UserProfile {
    const list = this.getAllUsers();
    const idx = list.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error('Pengguna tidak ditemukan');

    const updated = { ...list[idx], ...updates };
    list[idx] = updated;
    setStored(STORAGE_KEYS.USERS, list);
    return updated;
  }

  public setUserStatus(id: string, isActive: boolean): UserProfile {
    return this.updateUser(id, { isActive });
  }

  public deleteUser(id: string): void {
    const list = this.getAllUsers();
    const updated = list.filter((u) => u.id !== id);
    setStored(STORAGE_KEYS.USERS, updated);
  }

  // MASTER DATA: SUMBER PENDANAAN
  public getFundingSources(): FundingSource[] {
    return getStored<FundingSource[]>(STORAGE_KEYS.FUNDING_SOURCES, MOCK_FUNDING_SOURCES);
  }

  public addFundingSource(name: string, description?: string): FundingSource {
    const list = this.getFundingSources();
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama sumber pendanaan tidak boleh kosong');

    const existing = list.find((f) => f.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newFs: FundingSource = {
      id: `fs-${Date.now()}`,
      name: cleanName,
      description: description?.trim() || undefined,
      isActive: true,
    };
    list.push(newFs);
    setStored(STORAGE_KEYS.FUNDING_SOURCES, list);

    this.addAuditLog(
      'TAMBAH_SUMBER_PENDANAAN',
      'MASTER_DATA',
      newFs.id,
      newFs.name,
      `Menambahkan master sumber pendanaan: ${newFs.name}`
    );

    return newFs;
  }

  public updateFundingSource(id: string, updates: Partial<FundingSource>): FundingSource {
    const list = this.getFundingSources();
    const idx = list.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error('Sumber pendanaan tidak ditemukan');

    const current = list[idx];
    if (updates.name && updates.name.trim() !== current.name) {
      const cleanName = updates.name.trim();
      if (list.some((f) => f.id !== id && f.name.toLowerCase() === cleanName.toLowerCase())) {
        throw new Error(`Sumber pendanaan "${cleanName}" sudah terdaftar.`);
      }
      // Sinkronisasi data barang jika nama sumber dana diubah
      const assets = this.getAssets();
      let changed = false;
      assets.forEach((a) => {
        if (a.fundingSource === current.name) {
          a.fundingSource = cleanName;
          changed = true;
        }
      });
      if (changed) setStored(STORAGE_KEYS.ASSETS, assets);
      updates.name = cleanName;
    }

    const updated = { ...current, ...updates };
    list[idx] = updated;
    setStored(STORAGE_KEYS.FUNDING_SOURCES, list);
    return updated;
  }

  public deleteFundingSource(id: string): void {
    const list = this.getFundingSources();
    const existing = list.find((f) => f.id === id);
    if (!existing) throw new Error('Sumber pendanaan tidak ditemukan');

    // Cek apakah masih digunakan barang
    const assets = this.getAssets();
    const count = assets.filter((a) => a.fundingSource === existing.name).length;
    if (count > 0) {
      throw new Error(
        `Sumber pendanaan "${existing.name}" tidak dapat dihapus karena masih digunakan oleh ${count} unit barang. Alihkan sumber dana terlebih dahulu atau nonaktifkan.`
      );
    }

    const filtered = list.filter((f) => f.id !== id);
    setStored(STORAGE_KEYS.FUNDING_SOURCES, filtered);
  }

  // MASTER DATA: RUANGAN / LOKASI
  public getLocations(): Location[] {
    return getStored<Location[]>(STORAGE_KEYS.LOCATIONS, MOCK_LOCATIONS);
  }

  public addLocation(name: string, code?: string, description?: string): Location {
    const list = this.getLocations();
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama ruangan tidak boleh kosong');

    const cleanCode = (code || cleanName.slice(0, 4).toUpperCase()).trim();
    const newLoc: Location = {
      id: `loc-${Date.now()}`,
      name: cleanName,
      code: cleanCode,
      description: description?.trim() || undefined,
      isActive: true,
    };
    list.push(newLoc);
    setStored(STORAGE_KEYS.LOCATIONS, list);

    this.addAuditLog(
      'TAMBAH_RUANGAN',
      'MASTER_DATA',
      newLoc.id,
      newLoc.name,
      `Menambahkan master ruangan: ${newLoc.name} (${newLoc.code})`
    );

    return newLoc;
  }

  public updateLocation(id: string, updates: Partial<Location>): Location {
    const list = this.getLocations();
    const idx = list.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error('Ruangan/lokasi tidak ditemukan');

    const current = list[idx];
    if (updates.name && updates.name.trim() !== current.name) {
      const cleanName = updates.name.trim();
      if (list.some((l) => l.id !== id && l.name.toLowerCase() === cleanName.toLowerCase())) {
        throw new Error(`Ruangan "${cleanName}" sudah terdaftar.`);
      }
      // Sinkronisasi data barang jika nama ruangan diubah
      const assets = this.getAssets();
      let changed = false;
      assets.forEach((a) => {
        if (a.locationId === id) {
          a.locationName = cleanName;
          changed = true;
        }
      });
      if (changed) setStored(STORAGE_KEYS.ASSETS, assets);
      updates.name = cleanName;
    }

    const updated = { ...current, ...updates };
    list[idx] = updated;
    setStored(STORAGE_KEYS.LOCATIONS, list);
    return updated;
  }

  public deleteLocation(id: string): void {
    const list = this.getLocations();
    const existing = list.find((l) => l.id === id);
    if (!existing) throw new Error('Ruangan/lokasi tidak ditemukan');

    // Cek apakah masih digunakan barang
    const assets = this.getAssets();
    const count = assets.filter((a) => a.locationId === id).length;
    if (count > 0) {
      throw new Error(
        `Ruangan "${existing.name}" tidak dapat dihapus karena masih digunakan oleh ${count} unit barang. Pindahkan barang terlebih dahulu atau nonaktifkan ruangan.`
      );
    }

    const filtered = list.filter((l) => l.id !== id);
    setStored(STORAGE_KEYS.LOCATIONS, filtered);
  }

  // MASTER DATA: KATEGORI
  public getCategories(): Category[] {
    return getStored<Category[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
  }

  public addCategory(name: string, defaultLoanMode: LoanMode = 'DIRECT', description?: string): Category {
    const list = this.getCategories();
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Nama kategori tidak boleh kosong');

    const existing = list.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: cleanName,
      defaultLoanMode,
      description: description?.trim() || undefined,
      isActive: true,
    };
    list.push(newCat);
    setStored(STORAGE_KEYS.CATEGORIES, list);

    this.addAuditLog(
      'TAMBAH_KATEGORI',
      'MASTER_DATA',
      newCat.id,
      newCat.name,
      `Menambahkan master kategori: ${newCat.name} (Default: ${defaultLoanMode})`
    );

    return newCat;
  }

  public updateCategory(id: string, updates: Partial<Category>): Category {
    const list = this.getCategories();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Kategori barang tidak ditemukan');

    const current = list[idx];
    if (updates.name && updates.name.trim() !== current.name) {
      const cleanName = updates.name.trim();
      if (list.some((c) => c.id !== id && c.name.toLowerCase() === cleanName.toLowerCase())) {
        throw new Error(`Kategori "${cleanName}" sudah terdaftar.`);
      }
      // Sinkronisasi data barang jika nama kategori diubah
      const assets = this.getAssets();
      let changed = false;
      assets.forEach((a) => {
        if (a.categoryName === current.name) {
          a.categoryName = cleanName;
          changed = true;
        }
      });
      if (changed) setStored(STORAGE_KEYS.ASSETS, assets);
      updates.name = cleanName;
    }

    const updated = { ...current, ...updates };
    list[idx] = updated;
    setStored(STORAGE_KEYS.CATEGORIES, list);
    return updated;
  }

  public deleteCategory(id: string): void {
    const list = this.getCategories();
    const existing = list.find((c) => c.id === id);
    if (!existing) throw new Error('Kategori tidak ditemukan');

    // Cek apakah masih digunakan barang
    const assets = this.getAssets();
    const count = assets.filter((a) => a.categoryName === existing.name).length;
    if (count > 0) {
      throw new Error(
        `Kategori "${existing.name}" tidak dapat dihapus karena masih digunakan oleh ${count} unit barang. Alihkan kategori barang terlebih dahulu atau nonaktifkan kategori.`
      );
    }

    const filtered = list.filter((c) => c.id !== id);
    setStored(STORAGE_KEYS.CATEGORIES, filtered);
  }

  // PENGATURAN IDENTITAS SEKOLAH
  public getSchoolSettings(): SchoolSettings {
    const defaultSettings: SchoolSettings = {
      schoolName: 'MIS Cendikia Bunayya',
      address: 'Jl. Pendidikan No. 123, Medan, Sumatera Utara',
      phone: '081234567890',
      email: 'sarpras@cendikiabunayya.sch.id',
      logoUrl: '',
    };
    return getStored<SchoolSettings>(STORAGE_KEYS.SCHOOL_SETTINGS, defaultSettings);
  }

  public updateSchoolSettings(updates: Partial<SchoolSettings>): SchoolSettings {
    const current = this.getSchoolSettings();
    const updated: SchoolSettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: this.getActiveUser().fullName,
    };
    setStored(STORAGE_KEYS.SCHOOL_SETTINGS, updated);

    this.addAuditLog(
      'UPDATE_PENGATURAN_SEKOLAH',
      'POLICY',
      'settings-school',
      updated.schoolName,
      `Memperbarui identitas sekolah: ${updated.schoolName}`
    );

    return updated;
  }

  // DATA BARANG / SARANA FISIK (ASSET UNITS)
  public getAssets(options?: {
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
  }): AssetUnit[] {
    const raw = getStored<AssetUnit[]>(STORAGE_KEYS.ASSETS, MOCK_ASSET_UNITS);
    let changed = false;
    const mapped = raw.map((item) => {
      let itemChanged = false;
      let institution = item.institution;
      if (!institution) {
        const def = MOCK_ASSET_UNITS.find((m) => m.id === item.id);
        institution = def?.institution || 'MIS Cendikia Bunayya';
        itemChanged = true;
      }
      let permanentId = item.permanentId;
      const def = MOCK_ASSET_UNITS.find((m) => m.id === item.id || m.assetCode === item.assetCode);
      if (!permanentId || (def && def.permanentId && permanentId === item.id)) {
        permanentId = def?.permanentId || permanentId || item.id;
        itemChanged = true;
      }
      let assetCode = item.assetCode;
      if (assetCode && assetCode.includes('SARPRAS-')) {
        assetCode = assetCode.replace(/SARPRAS-/g, 'INV-');
        itemChanged = true;
      }
      let qrToken = item.qrToken;
      if (qrToken && qrToken.includes('SARPRAS-')) {
        qrToken = qrToken.replace(/SARPRAS-/g, 'INV-');
        itemChanged = true;
      }
      if (itemChanged) {
        changed = true;
        return {
          ...item,
          institution,
          permanentId,
          assetCode,
          qrToken,
        };
      }
      return item;
    });
    if (changed) {
      setStored(STORAGE_KEYS.ASSETS, mapped);
    }

    if (!options) return mapped;

    let filtered = mapped.filter((a) => !a.isDecommissioned);

    const fundingParam = options.fundingSourceId || options.fundingSource;
    if (fundingParam && fundingParam.trim() !== '') {
      const fsList = this.getFundingSources();
      const matchedFs = fsList.find((f) => f.id === fundingParam || f.name.toLowerCase() === fundingParam.toLowerCase());
      const expectedName = matchedFs ? matchedFs.name : fundingParam;
      filtered = filtered.filter((a) => a.fundingSource && a.fundingSource.toLowerCase() === expectedName.toLowerCase());
    }

    if (options.acquisitionYear !== undefined && options.acquisitionYear !== '' && options.acquisitionYear !== null) {
      const yr = Number(options.acquisitionYear);
      if (!isNaN(yr)) {
        filtered = filtered.filter((a) => a.acquisitionYear !== undefined && Number(a.acquisitionYear) === yr);
      }
    }

    if (options.institution && options.institution.trim() !== '') {
      filtered = filtered.filter((a) => a.institution === options.institution);
    }

    if (options.itemNumber && options.itemNumber.trim() !== '') {
      const target = options.itemNumber.trim();
      filtered = filtered.filter((a) => {
        const num = (a.itemNumber && String(a.itemNumber).trim()) || '';
        return num === target || num.replace(/^0+/, '') === target.replace(/^0+/, '');
      });
    }

    if (options.categoryId && options.categoryId.trim() !== '') {
      const cats = this.getCategories();
      const cat = cats.find((c) => c.id === options.categoryId || c.name === options.categoryId);
      if (cat) {
        filtered = filtered.filter((a) => a.categoryName === cat.name);
      }
    }

    if (options.locationId && options.locationId.trim() !== '') {
      filtered = filtered.filter((a) => a.locationId === options.locationId);
    }

    if (options.operationalStatus && options.operationalStatus.trim() !== '') {
      filtered = filtered.filter((a) => a.operationalStatus === options.operationalStatus);
    }

    if (options.search && options.search.trim() !== '') {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (a) =>
          (a.itemName && a.itemName.toLowerCase().includes(q)) ||
          (a.assetCode && a.assetCode.toLowerCase().includes(q)) ||
          (a.itemBrand && a.itemBrand.toLowerCase().includes(q)) ||
          (a.technicalSpecs && a.technicalSpecs.toLowerCase().includes(q))
      );
    }

    if (options.limit && options.limit > 0) {
      const offset = options.offset || (options.page ? (options.page - 1) * options.limit : 0);
      filtered = filtered.slice(offset, offset + options.limit);
    }

    return filtered;
  }

  public getAcquisitionYears(): number[] {
    const raw = getStored<AssetUnit[]>(STORAGE_KEYS.ASSETS, MOCK_ASSET_UNITS);
    const years = raw
      .filter((a) => !a.isDecommissioned && a.acquisitionYear)
      .map((a) => Number(a.acquisitionYear))
      .filter((y) => !isNaN(y) && y > 1900);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }

  public getAssetById(id: string): AssetUnit | undefined {
    return this.getAssets().find((a) => a.id === id || a.permanentId === id);
  }

  public getAssetByCodeOrQr(codeOrQr: string): AssetUnit | undefined {
    const clean = codeOrQr.trim().toUpperCase();
    return this.getAssets().find(
      (a) =>
        (a.permanentId && a.permanentId.toUpperCase() === clean) ||
        a.id.toUpperCase() === clean ||
        a.assetCode.toUpperCase() === clean ||
        a.assetCode.toUpperCase().replace(/^INV-/, 'SARPRAS-') === clean ||
        a.qrToken.toUpperCase() === clean ||
        (a.serialNumber && a.serialNumber.toUpperCase() === clean)
    );
  }

  public addAsset(newAssetData: Omit<AssetUnit, 'id' | 'createdAt' | 'updatedAt'>): AssetUnit {
    const assets = this.getAssets();
    const cleanCode = newAssetData.assetCode.trim().toUpperCase();

    // Pastikan kode inventaris atau identitas tidak pernah menduplikasi aset aktif maupun yang diarsipkan
    const duplicate = assets.find((a) => a.assetCode.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(
        `Kode barang "${cleanCode}" sudah digunakan oleh unit lain (${duplicate.itemName}). Kode tidak boleh diduplikasi agar QR code fisik tetap konsisten.`
      );
    }

    const newId = `unit-${Date.now()}`;
    const newPermanentId = `ID-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const newAsset: AssetUnit = {
      ...newAssetData,
      id: newId,
      permanentId: newPermanentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assets.unshift(newAsset);
    setStored(STORAGE_KEYS.ASSETS, assets);

    this.addAuditLog(
      'TAMBAH_BARANG',
      'ASSET',
      newId,
      newAsset.itemName,
      `Menambahkan barang: ${newAsset.itemName} (${newAsset.assetCode}) — Sumber: ${newAsset.fundingSource}`
    );

    return newAsset;
  }

  /**
   * Menonaktifkan atau menghapus logis unit barang (Soft Delete)
   * QR code lama tetap valid dan merujuk ke data historis unit ini,
   * serta TIDAK akan dialihkan ke barang lain.
   */
  public decommissionAsset(id: string, reason: string): AssetUnit {
    const assets = this.getAssets();
    const index = assets.findIndex((a) => a.id === id || a.permanentId === id);
    if (index === -1) throw new Error('Unit barang tidak ditemukan');

    const current = assets[index];
    const decommissionReason = reason.trim() || 'Dinonaktifkan / Dihapus secara logis dari inventaris aktif';
    const updated: AssetUnit = {
      ...current,
      operationalStatus: 'INACTIVE',
      isDecommissioned: true,
      decommissionedAt: new Date().toISOString(),
      decommissionedReason: decommissionReason,
      updatedAt: new Date().toISOString(),
    };

    assets[index] = updated;
    setStored(STORAGE_KEYS.ASSETS, assets);

    this.addAuditLog(
      'NONAKTIF_BARANG',
      'ASSET',
      current.id,
      current.itemName,
      `Menonaktifkan / menghapus logis barang: ${current.itemName} (${current.assetCode}) — Alasan: ${decommissionReason}`
    );

    return updated;
  }

  /**
   * Menghapus atau mengarsipkan data barang inventaris.
   * Hanya barang berstatus tidak aktif (INACTIVE atau isDecommissioned == true) yang dapat dihapus.
   * Jika memiliki riwayat transaksi peminjaman, diarsipkan secara logis.
   * Jika tidak memiliki riwayat relasi, dihapus permanen.
   */
  public deleteAsset(
    id: string,
    reason?: string
  ): { success: boolean; mode: 'DELETED' | 'ARCHIVED'; message: string; data?: any } {
    const assets = this.getAssets();
    const index = assets.findIndex((a) => a.id === id || a.permanentId === id);
    if (index === -1) throw new Error('Unit barang tidak ditemukan.');

    const current = assets[index];
    const isInactive = current.operationalStatus === 'INACTIVE' || Boolean(current.isDecommissioned);

    if (!isInactive) {
      throw new Error(
        `Barang "${current.itemName}" (${current.assetCode}) masih berstatus aktif (${current.operationalStatus}). Barang aktif tidak boleh dihapus. Silakan nonaktifkan barang terlebih dahulu.`
      );
    }

    const loans = this.getLoans();
    const activeLoans = loans.filter(
      (l) =>
        (l.unit?.id === current.id || (l as any).assetId === current.id) &&
        ['PENDING_APPROVAL', 'APPROVED', 'READY_FOR_HANDOVER', 'ACTIVE', 'RETURN_REQUESTED', 'RETURN_RECEIVED', 'RETURN_ISSUE'].includes(
          l.status
        )
    );

    if (activeLoans.length > 0) {
      throw new Error(
        `Barang "${current.itemName}" (${current.assetCode}) tidak dapat dihapus karena masih terkait dengan ${activeLoans.length} transaksi peminjaman aktif atau pengembalian yang sedang berjalan.`
      );
    }

    const totalLoans = loans.filter((l) => l.unit?.id === current.id || (l as any).assetId === current.id);
    const deleteReason = reason?.trim() || 'Dihapus oleh administrator inventaris';

    if (totalLoans.length > 0) {
      // Soft-delete / Archival
      const updated: AssetUnit = {
        ...current,
        operationalStatus: 'INACTIVE',
        isDecommissioned: true,
        decommissionedAt: current.decommissionedAt || new Date().toISOString(),
        decommissionedReason: deleteReason,
        updatedAt: new Date().toISOString(),
      };
      assets[index] = updated;
      setStored(STORAGE_KEYS.ASSETS, assets);

      this.addAuditLog(
        'ARSIP_BARANG',
        'ASSET',
        current.id,
        current.itemName,
        `Mengarsipkan barang dengan riwayat transaksi: ${current.itemName} (${current.assetCode}) — Alasan: ${deleteReason}`
      );

      return {
        success: true,
        mode: 'ARCHIVED',
        message: `Barang "${current.itemName}" (${current.assetCode}) memiliki riwayat transaksi peminjaman, sehingga diarsipkan secara aman untuk menjaga keutuhan riwayat audit.`,
        data: updated,
      };
    } else {
      // Hard delete
      assets.splice(index, 1);
      setStored(STORAGE_KEYS.ASSETS, assets);

      this.addAuditLog(
        'HAPUS_BARANG',
        'ASSET',
        current.id,
        current.itemName,
        `Menghapus data barang secara permanen: ${current.itemName} (${current.assetCode}) — Alasan: ${deleteReason}`
      );

      return {
        success: true,
        mode: 'DELETED',
        message: `Data barang "${current.itemName}" (${current.assetCode}) berhasil dihapus secara permanen.`,
        data: {
          id: current.id,
          assetCode: current.assetCode,
          itemName: current.itemName,
          permanentId: current.permanentId,
          qrToken: current.qrToken,
        },
      };
    }
  }

  public updateAsset(id: string, updates: Partial<AssetUnit>): AssetUnit {
    const assets = this.getAssets();
    const index = assets.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Unit barang tidak ditemukan');

    const current = assets[index];

    // Validasi nama barang jika diubah
    if (updates.itemName !== undefined && !updates.itemName.trim()) {
      throw new Error('Nama barang/sarana tidak boleh kosong');
    }

    // Validasi spesifikasi teknis jika diubah
    if (updates.technicalSpecs !== undefined && !updates.technicalSpecs.trim()) {
      throw new Error('Spesifikasi teknis / ukuran tidak boleh kosong');
    }

    // Validasi kode inventaris dan cek duplikasi
    if (updates.assetCode !== undefined) {
      const cleanCode = updates.assetCode.trim().toUpperCase();
      if (!cleanCode) throw new Error('Kode inventaris tidak boleh kosong');
      const duplicate = assets.find(
        (a) => a.id !== id && a.assetCode.toUpperCase() === cleanCode
      );
      if (duplicate) {
        throw new Error(
          `Kode barang "${cleanCode}" sudah digunakan oleh unit lain (${duplicate.itemName})`
        );
      }
      updates.assetCode = cleanCode;
      if (!updates.qrToken) {
        updates.qrToken = `QR-${cleanCode}`;
      }
    }

    // Sinkronisasi locationName jika locationId diperbarui
    let locationName = updates.locationName;
    if (updates.locationId && !locationName) {
      const loc = this.getLocations().find((l) => l.id === updates.locationId);
      if (loc) locationName = loc.name;
    }

    const updated: AssetUnit = {
      ...current,
      ...updates,
      ...(locationName ? { locationName } : {}),
      updatedAt: new Date().toISOString(),
    };

    if ('photoUrl' in updates || 'photoPath' in updates) {
      const p = updates.photoUrl !== undefined ? updates.photoUrl : updates.photoPath;
      updated.photoUrl = p ? p : undefined;
      updated.photoPath = p ? p : undefined;
    }

    assets[index] = updated;
    setStored(STORAGE_KEYS.ASSETS, assets);

    // Sinkronisasi unit di transaksi peminjaman
    const loans = this.getLoans();
    let loansChanged = false;
    loans.forEach((loan) => {
      if (loan.unit.id === id) {
        loan.unit = { ...updated };
        loansChanged = true;
      }
    });
    if (loansChanged) {
      setStored(STORAGE_KEYS.LOANS, loans);
    }

    this.addAuditLog(
      'UPDATE_BARANG',
      'ASSET',
      id,
      updated.itemName,
      `Memperbarui data barang: ${updated.itemName} (${updated.assetCode})`
    );

    return updated;
  }

  public updateAssetLoanMode(id: string, newMode: LoanMode): AssetUnit {
    return this.updateAsset(id, { effectiveLoanMode: newMode });
  }

  // LOANS & STATE MACHINE
  public getLoans(): LoanRequest[] {
    const raw = getStored<LoanRequest[]>(STORAGE_KEYS.LOANS, MOCK_LOAN_REQUESTS);
    let changed = false;
    const mapped = raw.map((item) => {
      let itemChanged = false;
      let status = item.status;
      // Otomatis migrasikan status READY_FOR_HANDOVER lama menjadi ACTIVE
      if (status === 'READY_FOR_HANDOVER') {
        status = 'ACTIVE';
        itemChanged = true;
      }
      if (itemChanged) {
        changed = true;
        return {
          ...item,
          status,
        };
      }
      return item;
    });
    if (changed) {
      setStored(STORAGE_KEYS.LOANS, mapped);
    }
    return mapped;
  }

  public getLoanById(id: string): LoanRequest | undefined {
    return this.getLoans().find((l) => l.id === id);
  }

  public createLoanRequest(params: {
    assetUnitId: string;
    purpose: string;
    expectedReturnAt: string;
    borrower?: UserProfile;
  }): LoanRequest {
    const assets = this.getAssets();
    const assetIndex = assets.findIndex((a) => a.id === params.assetUnitId);
    if (assetIndex === -1) throw new Error('Unit barang tidak ditemukan');

    const unit = assets[assetIndex];

    if (unit.operationalStatus !== 'AVAILABLE') {
      throw new Error(`Unit ${unit.assetCode} sedang tidak tersedia (${unit.operationalStatus})`);
    }

    const borrower = params.borrower || this.getActiveUser();
    const effectiveMode = unit.effectiveLoanMode;

    // Mode DIRECT langsung AKTIF (ON_LOAN); Mode ADMIN_APPROVAL menunggu persetujuan (RESERVED)
    const initialStatus: LoanStatus =
      effectiveMode === 'DIRECT' ? 'ACTIVE' : 'PENDING_APPROVAL';

    unit.operationalStatus = effectiveMode === 'DIRECT' ? 'ON_LOAN' : 'RESERVED';
    unit.updatedAt = new Date().toISOString();
    assets[assetIndex] = unit;
    setStored(STORAGE_KEYS.ASSETS, assets);

    const now = new Date().toISOString();
    const loanSeq = Math.floor(100 + Math.random() * 900);
    const loanNumber = `PINJAM-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${loanSeq}`;

    const newLoan: LoanRequest = {
      id: `loan-${Date.now()}`,
      loanNumber,
      borrowerId: borrower.id,
      borrowerName: borrower.fullName,
      borrowerEmployeeNumber: borrower.employeeNumber,
      borrowerRole: borrower.role,
      status: initialStatus,
      loanModeSnapshot: effectiveMode,
      purpose: params.purpose,
      requestedAt: now,
      expectedReturnAt: params.expectedReturnAt,
      unit: { ...unit },
      handover:
        effectiveMode === 'DIRECT'
          ? {
              handedOverBy: borrower.id,
              handedOverByName: borrower.fullName,
              handedOverAt: now,
              conditionAtHandover: 'GOOD',
              accessoriesVerified: true,
              notes: 'Peminjaman Mandiri / Scan QR Langsung (DIRECT)',
            }
          : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const loans = this.getLoans();
    loans.unshift(newLoan);
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      effectiveMode === 'DIRECT' ? 'PENGAJUAN_PINJAMAN_DIRECT' : 'PENGAJUAN_PINJAMAN_APPROVAL',
      'LOAN_REQUEST',
      newLoan.id,
      `${unit.itemName} (${unit.assetCode})`,
      `Peminjam: ${borrower.fullName}. Mode: ${effectiveMode}. Status: ${initialStatus}`
    );

    return newLoan;
  }

  public approveLoanRequest(loanId: string, adminUser: UserProfile): LoanRequest {
    if (adminUser.role !== 'ADMIN_SARPRAS' && adminUser.role !== 'KEPALA_SEKOLAH') {
      throw new Error('Akses ditolak: Hanya Admin Sarpras yang berhak menyetujui peminjaman');
    }

    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === loanId);
    if (idx === -1) throw new Error('Pengajuan pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status !== 'PENDING_APPROVAL' && loan.status !== 'READY_FOR_HANDOVER') {
      throw new Error(`Tidak dapat menyetujui transaksi dengan status saat ini: ${loan.status}`);
    }

    const now = new Date().toISOString();
    // Persetujuan langsung mengaktifkan pinjaman dan mengubah status barang menjadi ON_LOAN
    loan.status = 'ACTIVE';
    loan.approvedBy = adminUser.id;
    loan.approvedByName = adminUser.fullName;
    loan.approvedAt = now;
    loan.handover = {
      handedOverBy: adminUser.id,
      handedOverByName: adminUser.fullName,
      handedOverAt: now,
      conditionAtHandover: 'GOOD',
      accessoriesVerified: true,
      notes: 'Disetujui dan diserahkan langsung oleh Admin Sarpras',
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = 'ON_LOAN';
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'PERSETUJUAN_PINJAMAN',
      'LOAN_REQUEST',
      loan.id,
      loan.loanNumber,
      `Disetujui oleh ${adminUser.fullName}. Status pinjaman aktif (ON_LOAN).`
    );

    return loan;
  }

  public rejectLoanRequest(loanId: string, reason: string, adminUser: UserProfile): LoanRequest {
    if (adminUser.role !== 'ADMIN_SARPRAS') {
      throw new Error('Akses ditolak: Hanya Admin Sarpras yang berhak menolak pengajuan');
    }

    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === loanId);
    if (idx === -1) throw new Error('Pengajuan pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status !== 'PENDING_APPROVAL') {
      throw new Error(`Tidak dapat menolak transaksi dengan status saat ini: ${loan.status}`);
    }

    const now = new Date().toISOString();
    loan.status = 'REJECTED';
    loan.rejectionReason = reason;
    loan.approvedBy = adminUser.id;
    loan.approvedByName = adminUser.fullName;
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = 'AVAILABLE';
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'PENOLAKAN_PINJAMAN',
      'LOAN_REQUEST',
      loan.id,
      loan.loanNumber,
      `Ditolak oleh ${adminUser.fullName}. Alasan: ${reason}`
    );

    return loan;
  }

  public confirmHandover(params: {
    loanId: string;
    conditionAtHandover: ConditionStatus;
    accessoriesVerified: boolean;
    notes?: string;
    staffUser: UserProfile;
  }): LoanRequest {
    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === params.loanId);
    if (idx === -1) throw new Error('Pengajuan pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status !== 'READY_FOR_HANDOVER' && loan.status !== 'ACTIVE') {
      throw new Error(`Barang belum siap serah terima (Status: ${loan.status})`);
    }

    const now = new Date().toISOString();
    loan.status = 'ACTIVE';
    loan.handover = {
      handedOverBy: params.staffUser.id,
      handedOverByName: params.staffUser.fullName,
      handedOverAt: now,
      conditionAtHandover: params.conditionAtHandover,
      accessoriesVerified: params.accessoriesVerified,
      notes: params.notes,
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = 'ON_LOAN';
      assets[assetIdx].conditionStatus = params.conditionAtHandover;
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
      loan.unit = { ...assets[assetIdx] };
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'SERAH_TERIMA_PINJAMAN',
      'LOAN_REQUEST',
      loan.id,
      loan.loanNumber,
      `Barang diserahkan oleh ${params.staffUser.fullName}. Status ACTIVE, unit ON_LOAN.`
    );

    return loan;
  }

  public submitReturnRequest(params: {
    loanId: string;
    borrowerUser: UserProfile;
    notes?: string;
  }): LoanRequest {
    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === params.loanId);
    if (idx === -1) throw new Error('Transaksi pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status === 'RETURN_REQUESTED') {
      throw new Error('Pengembalian barang sudah diajukan sebelumnya dan sedang menunggu verifikasi admin');
    }
    if (loan.status === 'COMPLETED') {
      throw new Error('Transaksi peminjaman ini telah selesai');
    }
    if (loan.status !== 'ACTIVE' && loan.status !== 'APPROVED' && loan.status !== 'READY_FOR_HANDOVER') {
      throw new Error(`Transaksi tidak dalam status yang dapat dikembalikan (Status: ${loan.status})`);
    }

    if (params.borrowerUser.role === 'GURU_PEGAWAI' && loan.borrowerId && loan.borrowerId !== params.borrowerUser.id) {
      throw new Error('Anda hanya dapat mengajukan pengembalian untuk barang yang Anda pinjam');
    }

    const now = new Date().toISOString();
    loan.status = 'RETURN_REQUESTED';
    loan.returnInspection = {
      conditionAtReturn: 'GOOD',
      accessoriesComplete: true,
      resultingStatus: 'AVAILABLE',
      notes: params.notes || 'Pengembalian diajukan oleh guru via Scan QR. Menunggu pemeriksaan fisik oleh admin.',
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = 'RETURN_PENDING';
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
      loan.unit = { ...assets[assetIdx] };
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'PENGAJUAN_PENGEMBALIAN',
      'RETURN',
      loan.id,
      loan.loanNumber,
      `Guru ${params.borrowerUser.fullName} mengajukan pengembalian unit ${loan.unit.assetCode}.`
    );

    return loan;
  }

  public receiveReturnPhysical(loanId: string, adminUser: UserProfile): LoanRequest {
    if (adminUser.role !== 'ADMIN_SARPRAS') {
      throw new Error('Akses ditolak: Hanya Admin Sarpras yang dapat menerima barang fisik');
    }

    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === loanId);
    if (idx === -1) throw new Error('Transaksi pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status !== 'RETURN_REQUESTED') {
      throw new Error(`Barang belum dalam status pengajuan pengembalian (Status: ${loan.status})`);
    }

    const now = new Date().toISOString();
    loan.status = 'RETURN_RECEIVED';
    loan.returnInspection = {
      ...loan.returnInspection,
      receivedBy: adminUser.id,
      receivedByName: adminUser.fullName,
      receivedAt: now,
      conditionAtReturn: loan.returnInspection?.conditionAtReturn || 'GOOD',
      accessoriesComplete: loan.returnInspection?.accessoriesComplete ?? true,
      resultingStatus: 'AVAILABLE',
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = 'RETURN_INSPECTION';
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
      loan.unit = { ...assets[assetIdx] };
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'PENERIMAAN_FISIK_PENGEMBALIAN',
      'RETURN',
      loan.id,
      loan.loanNumber,
      `Barang fisik diterima oleh ${adminUser.fullName}. Siap dilakukan pemeriksaan kondisi.`
    );

    return loan;
  }

  public completeReturnInspection(params: {
    loanId: string;
    conditionAtReturn: ConditionStatus;
    accessoriesComplete: boolean;
    issueDescription?: string;
    notes?: string;
    photoPath?: string;
    adminUser: UserProfile;
  }): LoanRequest {
    if (params.adminUser.role !== 'ADMIN_SARPRAS') {
      throw new Error('Akses ditolak: Hanya Admin Sarpras yang dapat menyetujui pengembalian');
    }

    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === params.loanId);
    if (idx === -1) throw new Error('Transaksi pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status !== 'RETURN_RECEIVED') {
      throw new Error(`Barang harus diterima secara fisik terlebih dahulu sebelum persetujuan (Status: ${loan.status})`);
    }

    const now = new Date().toISOString();

    let resultingStatus: OperationalStatus = 'AVAILABLE';
    if (params.conditionAtReturn === 'MINOR_DAMAGE' || params.conditionAtReturn === 'MAJOR_DAMAGE') {
      resultingStatus = 'MAINTENANCE';
    } else if (params.conditionAtReturn === 'LOST') {
      resultingStatus = 'LOST';
    }

    loan.status = 'COMPLETED';
    loan.returnInspection = {
      ...loan.returnInspection,
      inspectedBy: params.adminUser.id,
      inspectedByName: params.adminUser.fullName,
      inspectedAt: now,
      approvedBy: params.adminUser.id,
      approvedByName: params.adminUser.fullName,
      approvedAt: now,
      conditionAtReturn: params.conditionAtReturn,
      accessoriesComplete: params.accessoriesComplete,
      issueDescription: params.issueDescription,
      notes: params.notes,
      photoPath: params.photoPath,
      resultingStatus,
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    if (assetIdx !== -1) {
      assets[assetIdx].operationalStatus = resultingStatus;
      assets[assetIdx].conditionStatus = params.conditionAtReturn;
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
      loan.unit = { ...assets[assetIdx] };
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'PERSETUJUAN_PENGEMBALIAN',
      'RETURN',
      loan.id,
      loan.loanNumber,
      `Pemeriksaan disetujui oleh ${params.adminUser.fullName}. Kondisi: ${params.conditionAtReturn}. Unit sekarang: ${resultingStatus}. Transaksi COMPLETED.`
    );

    return loan;
  }

  public verifyReturn(loanId: string, adminUser?: UserProfile, notes?: string): LoanRequest {
    const active = adminUser || this.getActiveUser();
    if (active.role !== 'ADMIN_SARPRAS') {
      throw new Error('Akses ditolak: Hanya Admin Sarpras yang dapat memverifikasi penerimaan pengembalian');
    }

    const loans = this.getLoans();
    const idx = loans.findIndex((l) => l.id === loanId);
    if (idx === -1) throw new Error('Transaksi pinjaman tidak ditemukan');

    const loan = loans[idx];
    if (loan.status === 'COMPLETED') {
      throw new Error('Transaksi pengembalian ini sudah selesai diverifikasi sebelumnya.');
    }
    if (
      loan.status !== 'RETURN_REQUESTED' &&
      loan.status !== 'RETURN_RECEIVED' &&
      loan.status !== 'ACTIVE'
    ) {
      throw new Error(`Pengembalian tidak dapat diverifikasi untuk status ${loan.status}`);
    }

    const now = new Date().toISOString();
    loan.status = 'COMPLETED';
    loan.approvedBy = active.id;
    loan.approvedByName = active.fullName;
    loan.approvedAt = now;
    loan.returnInspection = {
      ...loan.returnInspection,
      receivedBy: active.id,
      receivedByName: active.fullName,
      receivedAt: now,
      inspectedBy: active.id,
      inspectedByName: active.fullName,
      inspectedAt: now,
      approvedBy: active.id,
      approvedByName: active.fullName,
      approvedAt: now,
      conditionAtReturn: 'GOOD',
      accessoriesComplete: true,
      resultingStatus: 'AVAILABLE',
      notes: notes || 'Verifikasi penerimaan pengembalian disetujui oleh admin.',
    };
    loan.updatedAt = now;

    const assets = this.getAssets();
    const assetIdx = assets.findIndex((a) => a.id === loan.unit.id);
    let resultingStatus: OperationalStatus = 'AVAILABLE';
    if (assetIdx !== -1) {
      const asset = assets[assetIdx];
      if (asset.isDecommissioned) {
        resultingStatus = 'INACTIVE';
      } else {
        resultingStatus = 'AVAILABLE';
      }
      assets[assetIdx].operationalStatus = resultingStatus;
      assets[assetIdx].updatedAt = now;
      setStored(STORAGE_KEYS.ASSETS, assets);
      loan.unit = { ...assets[assetIdx] };
    }

    loans[idx] = loan;
    setStored(STORAGE_KEYS.LOANS, loans);

    this.addAuditLog(
      'VERIFIKASI_PENGEMBALIAN',
      'RETURN',
      loan.id,
      loan.loanNumber,
      `Verifikasi penerimaan pengembalian unit ${loan.unit.assetCode} disetujui oleh ${active.fullName}. Status transaksi COMPLETED, unit ${resultingStatus}.`
    );

    return loan;
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return getStored<AuditLog[]>(STORAGE_KEYS.AUDIT, MOCK_AUDIT_LOGS);
  }

  private addAuditLog(
    action: string,
    entityType: 'ASSET' | 'LOAN_REQUEST' | 'RETURN' | 'POLICY' | 'USER' | 'MASTER_DATA',
    entityId: string,
    entityName: string | undefined,
    details: string
  ): void {
    const active = this.getActiveUser();
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      userId: active.id,
      userName: active.fullName,
      userRole: active.role,
      action,
      entityType,
      entityId,
      entityName,
      details,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    setStored(STORAGE_KEYS.AUDIT, logs.slice(0, 100));
  }

  // Backup & Restore
  public getBackupSummary(): BackupSummary {
    const users = this.getAllUsers();
    const assets = this.getAssets();
    const categories = this.getCategories();
    const locations = this.getLocations();
    const fundingSources = this.getFundingSources();
    const loans = this.getLoans();
    const auditLogs = this.getAuditLogs();

    return {
      counts: {
        users: users.length,
        assets: assets.length,
        categories: categories.length,
        locations: locations.length,
        fundingSources: fundingSources.length,
        loans: loans.length,
        auditLogs: auditLogs.length,
      },
      databaseTime: new Date().toISOString(),
    };
  }

  public exportBackup(): BackupPayload {
    const active = this.getActiveUser();
    const summary = this.getBackupSummary();
    const schoolSettings = this.getSchoolSettings();

    const payload: BackupPayload = {
      system: 'SIMSARPRAS_SMART_CAMPUS',
      signature: 'SIMSARPRAS_BACKUP_V2',
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: {
        id: active.id,
        name: active.fullName,
        email: active.email,
      },
      counts: summary.counts,
      data: {
        schoolSettings,
        users: this.getAllUsers(),
        categories: this.getCategories(),
        locations: this.getLocations(),
        fundingSources: this.getFundingSources(),
        assets: this.getAssets(),
        loans: this.getLoans(),
        auditLogs: this.getAuditLogs(),
      },
    };

    this.addAuditLog('BACKUP_EXPORTED', 'POLICY', 'backup', 'Cadangan Data', 'Ekspor berkas cadangan data sistem');
    return payload;
  }

  public restoreBackup(payload: BackupPayload, mode: RestoreMode = 'clean'): RestoreResult {
    const data = payload.data || {};

    if (mode === 'clean') {
      if (Array.isArray(data.categories)) setStored(STORAGE_KEYS.CATEGORIES, data.categories);
      if (Array.isArray(data.locations)) setStored(STORAGE_KEYS.LOCATIONS, data.locations);
      if (Array.isArray(data.fundingSources)) setStored(STORAGE_KEYS.FUNDING_SOURCES, data.fundingSources);
      if (Array.isArray(data.assets)) setStored(STORAGE_KEYS.ASSETS, data.assets);
      if (Array.isArray(data.loans)) setStored(STORAGE_KEYS.LOANS, data.loans);
      if (Array.isArray(data.users)) setStored(STORAGE_KEYS.USERS, data.users);
      if (data.schoolSettings) setStored(STORAGE_KEYS.SCHOOL_SETTINGS, data.schoolSettings);
    } else {
      // Merge
      if (Array.isArray(data.categories)) {
        const cur = this.getCategories();
        const map = new Map(cur.map((c) => [c.id, c]));
        data.categories.forEach((c) => map.set(c.id, c));
        setStored(STORAGE_KEYS.CATEGORIES, Array.from(map.values()));
      }
      if (Array.isArray(data.locations)) {
        const cur = this.getLocations();
        const map = new Map(cur.map((l) => [l.id, l]));
        data.locations.forEach((l) => map.set(l.id, l));
        setStored(STORAGE_KEYS.LOCATIONS, Array.from(map.values()));
      }
      if (Array.isArray(data.fundingSources)) {
        const cur = this.getFundingSources();
        const map = new Map(cur.map((f) => [f.id, f]));
        data.fundingSources.forEach((f) => map.set(f.id, f));
        setStored(STORAGE_KEYS.FUNDING_SOURCES, Array.from(map.values()));
      }
      if (Array.isArray(data.assets)) {
        const cur = this.getAssets();
        const map = new Map(cur.map((a) => [a.id, a]));
        data.assets.forEach((a) => map.set(a.id, a));
        setStored(STORAGE_KEYS.ASSETS, Array.from(map.values()));
      }
    }

    this.addAuditLog('BACKUP_RESTORED', 'POLICY', 'restore', 'Pemulihan Cadangan', `Pemulihan basis data selesai dengan mode: ${mode}`);

    return {
      message: 'Pemulihan data berhasil diselesaikan.',
      mode,
      restoredAt: new Date().toISOString(),
      counts: {
        users: data.users?.length || 0,
        assets: data.assets?.length || 0,
        categories: data.categories?.length || 0,
        locations: data.locations?.length || 0,
        fundingSources: data.fundingSources?.length || 0,
        loans: data.loans?.length || 0,
      },
    };
  }
}
