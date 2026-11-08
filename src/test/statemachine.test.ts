import { describe, it, expect, beforeEach } from 'vitest';
import { MockStorageService } from '../services/mockStorage';
import { UserProfile } from '../types';

describe('SI-SARPRAS State Machine & Integrity Tests (PRD Compliant)', () => {
  let storage: MockStorageService;

  const adminUser: UserProfile = {
    id: 'usr-admin-1',
    fullName: 'Bambang Hermawan, S.Kom.',
    employeeNumber: '198204152008011005',
    email: 'admin.sarpras@smkn1teladan.sch.id',
    role: 'ADMIN_SARPRAS',
    isActive: true,
  };

  const guruUser: UserProfile = {
    id: 'usr-guru-1',
    fullName: 'Siti Nurhaliza, S.Pd.',
    employeeNumber: '199003202015022003',
    email: 'siti.nurhaliza@smkn1teladan.sch.id',
    role: 'GURU_PEGAWAI',
    isActive: true,
  };

  beforeEach(() => {
    storage = MockStorageService.getInstance();
    storage.resetToDefaults();
  });

  it('L-01: Mode DIRECT langsung menuju ACTIVE (ON_LOAN) tanpa persetujuan admin', () => {
    // Pointer unit-pointer-01 adalah mode DIRECT
    const unit = storage.getAssetById('unit-pointer-01')!;
    expect(unit.effectiveLoanMode).toBe('DIRECT');
    expect(unit.operationalStatus).toBe('AVAILABLE');

    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Presentasi materi kelas X',
      expectedReturnAt: '2026-10-12T15:00:00Z',
      borrower: guruUser,
    });

    expect(loan.status).toBe('ACTIVE');
    expect(loan.loanModeSnapshot).toBe('DIRECT');

    // Unit langsung menjadi ON_LOAN
    const updatedUnit = storage.getAssetById(unit.id)!;
    expect(updatedUnit.operationalStatus).toBe('ON_LOAN');
  });

  it('L-02: Mode ADMIN_APPROVAL wajib menghasilkan PENDING_APPROVAL', () => {
    // unit-laptop-01 adalah mode ADMIN_APPROVAL
    const unit = storage.getAssetById('unit-laptop-01')!;
    expect(unit.effectiveLoanMode).toBe('ADMIN_APPROVAL');
    expect(unit.operationalStatus).toBe('AVAILABLE');

    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });

    expect(loan.status).toBe('PENDING_APPROVAL');
    expect(loan.loanModeSnapshot).toBe('ADMIN_APPROVAL');

    const updatedUnit = storage.getAssetById(unit.id)!;
    expect(updatedUnit.operationalStatus).toBe('RESERVED');
  });

  it('L-03: Persetujuan admin langsung mengaktifkan transaksi ke ACTIVE dan unit ke ON_LOAN', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });

    // Admin menyetujui
    const approvedLoan = storage.approveLoanRequest(loan.id, adminUser);
    expect(approvedLoan.status).toBe('ACTIVE');
    expect(approvedLoan.approvedBy).toBe(adminUser.id);

    // Unit langsung ON_LOAN tanpa perlu halaman serah terima terpisah
    const checkUnit = storage.getAssetById(unit.id)!;
    expect(checkUnit.operationalStatus).toBe('ON_LOAN');
  });

  it('L-05: Konfirmasi serah terima fisik (Handover) mencatat detail serah terima', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });
    storage.approveLoanRequest(loan.id, adminUser);

    // Lakukan pencatatan serah terima fisik
    const activeLoan = storage.confirmHandover({
      loanId: loan.id,
      conditionAtHandover: 'GOOD',
      accessoriesVerified: true,
      notes: 'Kabel dan tas lengkap',
      staffUser: adminUser,
    });

    expect(activeLoan.status).toBe('ACTIVE');
    expect(activeLoan.handover?.handedOverBy).toBe(adminUser.id);

    // Unit resmi menjadi ON_LOAN
    const onLoanUnit = storage.getAssetById(unit.id)!;
    expect(onLoanUnit.operationalStatus).toBe('ON_LOAN');
  });

  it('R-01 & R-03: Pengajuan pengembalian oleh guru mengubah status ke RETURN_REQUESTED dan unit tetap tidak tersedia (RETURN_PENDING)', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });
    storage.approveLoanRequest(loan.id, adminUser);
    storage.confirmHandover({
      loanId: loan.id,
      conditionAtHandover: 'GOOD',
      accessoriesVerified: true,
      staffUser: adminUser,
    });

    // Guru mengajukan pengembalian via QR
    const returnLoan = storage.submitReturnRequest({
      loanId: loan.id,
      borrowerUser: guruUser,
      notes: 'Selesai digunakan',
    });

    expect(returnLoan.status).toBe('RETURN_REQUESTED');

    // Unit TIDAK boleh langsung AVAILABLE!
    const pendingUnit = storage.getAssetById(unit.id)!;
    expect(pendingUnit.operationalStatus).toBe('RETURN_PENDING');
  });

  it('R-05 & R-07: Penerimaan fisik dan pemeriksaan kondisi BAIK mengubah status ke COMPLETED dan unit kembali AVAILABLE', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });
    storage.approveLoanRequest(loan.id, adminUser);
    storage.confirmHandover({
      loanId: loan.id,
      conditionAtHandover: 'GOOD',
      accessoriesVerified: true,
      staffUser: adminUser,
    });
    storage.submitReturnRequest({
      loanId: loan.id,
      borrowerUser: guruUser,
    });

    // Step 2: Admin terima fisik
    const receivedLoan = storage.receiveReturnPhysical(loan.id, adminUser);
    expect(receivedLoan.status).toBe('RETURN_RECEIVED');
    expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RETURN_INSPECTION');

    // Step 3: Admin periksa kondisi BAIK & setujui
    const completedLoan = storage.completeReturnInspection({
      loanId: loan.id,
      conditionAtReturn: 'GOOD',
      accessoriesComplete: true,
      adminUser,
    });

    expect(completedLoan.status).toBe('COMPLETED');

    // Unit kembali menjadi AVAILABLE
    const finalUnit = storage.getAssetById(unit.id)!;
    expect(finalUnit.operationalStatus).toBe('AVAILABLE');
    expect(finalUnit.conditionStatus).toBe('GOOD');
  });

  it('R-08: Pengembalian dengan kondisi RUSAK menjadikan unit berstatus MAINTENANCE (bukan AVAILABLE)', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });
    storage.approveLoanRequest(loan.id, adminUser);
    storage.confirmHandover({
      loanId: loan.id,
      conditionAtHandover: 'GOOD',
      accessoriesVerified: true,
      staffUser: adminUser,
    });
    storage.submitReturnRequest({
      loanId: loan.id,
      borrowerUser: guruUser,
    });
    storage.receiveReturnPhysical(loan.id, adminUser);

    // Admin memeriksa fisik dan menemukan RUSAK BERAT
    const completedLoan = storage.completeReturnInspection({
      loanId: loan.id,
      conditionAtReturn: 'MAJOR_DAMAGE',
      accessoriesComplete: false,
      issueDescription: 'Layar LCD pecah',
      adminUser,
    });

    expect(completedLoan.status).toBe('COMPLETED');

    // Unit TIDAK boleh AVAILABLE, harus MAINTENANCE
    const finalUnit = storage.getAssetById(unit.id)!;
    expect(finalUnit.operationalStatus).toBe('MAINTENANCE');
    expect(finalUnit.conditionStatus).toBe('MAJOR_DAMAGE');
  });

  it('L-07: Peminjaman ganda ditolak bila unit sedang tidak AVAILABLE', () => {
    const unit = storage.getAssetById('unit-laptop-02')!;
    // unit-laptop-02 di mock data berstatus ON_LOAN
    expect(unit.operationalStatus).toBe('ON_LOAN');

    expect(() => {
      storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Coba pinjam ganda',
        expectedReturnAt: '2026-10-14T10:00:00Z',
        borrower: guruUser,
      });
    }).toThrow(/sedang tidak tersedia/);
  });

  it('P-02: Guru tidak memiliki izin menyetujui peminjaman', () => {
    const unit = storage.getAssetById('unit-laptop-01')!;
    const loan = storage.createLoanRequest({
      assetUnitId: unit.id,
      purpose: 'Pelatihan guru',
      expectedReturnAt: '2026-10-15T16:00:00Z',
      borrower: guruUser,
    });
    expect(loan.status).toBe('PENDING_APPROVAL');

    expect(() => {
      storage.approveLoanRequest(loan.id, guruUser);
    }).toThrow(/Akses ditolak/);
  });

  describe('Fitur Ubah Data Barang (Asset Update & Audit Integrity)', () => {
    it('U-01: Berhasil memperbarui data barang dan otomatis memperbarui qrToken jika kode berubah', () => {
      const original = storage.getAssetById('unit-pointer-01')!;
      expect(original.itemName).toBe('Wireless Laser Presenter Pointer');

      const updated = storage.updateAsset('unit-pointer-01', {
        itemName: 'Laser Pointer Wireless Versi Pro',
        technicalSpecs: 'Koneksi 2.4GHz + Bluetooth 5.0, Baterai Rechargeable USB-C',
        itemBrand: 'Baseus Pro',
        fundingSource: 'BOS Kinerja',
        acquisitionYear: 2025,
        assetCode: 'INV-PTR-2025-999',
        conditionStatus: 'GOOD',
      });

      expect(updated.itemName).toBe('Laser Pointer Wireless Versi Pro');
      expect(updated.itemBrand).toBe('Baseus Pro');
      expect(updated.fundingSource).toBe('BOS Kinerja');
      expect(updated.acquisitionYear).toBe(2025);
      expect(updated.assetCode).toBe('INV-PTR-2025-999');
      expect(updated.qrToken).toBe('QR-INV-PTR-2025-999');

      // Verifikasi di penyimpanan
      const retrieved = storage.getAssetById('unit-pointer-01')!;
      expect(retrieved.itemName).toBe('Laser Pointer Wireless Versi Pro');
    });

    it('U-02: Menolak pembaruan jika nama barang kosong atau kode inventaris duplikat', () => {
      // 1. Coba ubah nama menjadi kosong
      expect(() => {
        storage.updateAsset('unit-pointer-01', { itemName: '   ' });
      }).toThrow(/Nama barang\/sarana tidak boleh kosong/);

      // 2. Coba ubah spesifikasi menjadi kosong
      expect(() => {
        storage.updateAsset('unit-pointer-01', { technicalSpecs: '' });
      }).toThrow(/Spesifikasi teknis \/ ukuran tidak boleh kosong/);

      // 3. Coba ubah assetCode ke kode yang sudah dipakai unit lain (unit-laptop-01)
      const laptopUnit = storage.getAssetById('unit-laptop-01')!;
      expect(() => {
        storage.updateAsset('unit-pointer-01', { assetCode: laptopUnit.assetCode });
      }).toThrow(/sudah digunakan oleh unit/);
    });

    it('U-03: Perubahan data barang tercatat di Audit Log dan tersinkronisasi ke transaksi peminjaman aktif', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Presentasi kepala sekolah',
        expectedReturnAt: '2026-10-18T10:00:00Z',
        borrower: guruUser,
      });

      expect(loan.unit.itemName).toBe(unit.itemName);

      // Update data barang
      storage.updateAsset(unit.id, {
        itemName: 'Laptop ASUS ExpertBook B1400 (Updated RAM 32GB)',
      });

      // Verifikasi sinkronisasi pada transaksi peminjaman
      const updatedLoan = storage.getLoanById(loan.id)!;
      expect(updatedLoan.unit.itemName).toBe('Laptop ASUS ExpertBook B1400 (Updated RAM 32GB)');

      // Verifikasi tercatat di Audit Log
      const logs = storage.getAuditLogs();
      const lastAudit = logs[0];
      expect(lastAudit.action).toBe('UPDATE_BARANG');
      expect(lastAudit.entityType).toBe('ASSET');
      expect(lastAudit.entityId).toBe(unit.id);
      expect(lastAudit.details).toContain('Memperbarui data barang');
    });
  });

  describe('Audit Siklus Lengkap Peminjaman & Pengembalian Sesuai Prosedur', () => {
    it('menjalankan audit lengkap: 1. Ajuan Pinjaman -> 2. Setujui Admin -> 3. Daftar Status -> 4. Pengembalian -> 5. Verifikasi Admin', () => {
      // 1. AJUAN PINJAMAN (Guru/User mengajukan pinjaman unit)
      const unit = storage.getAssetById('unit-laptop-01')!;
      expect(unit.operationalStatus).toBe('AVAILABLE');

      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Mengajar di Kelas X RPL',
        expectedReturnAt: '2026-10-15T15:00:00Z',
        borrower: guruUser,
      });

      expect(loan.status).toBe('PENDING_APPROVAL');
      expect(loan.borrowerName).toBe(guruUser.fullName);
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RESERVED');

      // 2. SETUJUI ADMIN (Admin Sarpras menyetujui di halaman Persetujuan Penerimaan)
      const approvedLoan = storage.approveLoanRequest(loan.id, adminUser);
      expect(approvedLoan.status).toBe('ACTIVE');
      expect(approvedLoan.approvedByName).toBe(adminUser.fullName);
      // Unit langsung ON_LOAN (tanpa halaman serah terima terpisah)
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('ON_LOAN');

      // 3. DAFTAR STATUS (Verifikasi status di daftar transaksi & inventaris)
      const activeLoans = storage.getLoans().filter((l) => l.status === 'ACTIVE');
      expect(activeLoans.some((l) => l.id === loan.id)).toBe(true);

      const assets = storage.getAssets();
      const currentAsset = assets.find((a) => a.id === unit.id)!;
      expect(currentAsset.operationalStatus).toBe('ON_LOAN');

      // 4. PENGEMBALIAN (Peminjam mengajukan pengembalian via Scan QR / Peminjaman Saya)
      const returnRequest = storage.submitReturnRequest({
        loanId: loan.id,
        borrowerUser: guruUser,
        notes: 'Peminjaman selesai, semua charger dan tas laptop utuh.',
      });
      expect(returnRequest.status).toBe('RETURN_REQUESTED');
      // Unit berstatus RETURN_PENDING saat menunggu diperiksa
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RETURN_PENDING');

      // 5. VERIFIKASI ADMIN (Admin Sarpras melakukan verifikasi fisik & checklist di Verifikasi Pengembalian)
      // Step A: Admin terima fisik
      const physicalReceived = storage.receiveReturnPhysical(loan.id, adminUser);
      expect(physicalReceived.status).toBe('RETURN_RECEIVED');
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RETURN_INSPECTION');

      // Step B: Admin periksa kelengkapan & kondisi (BAIK)
      const finalizedLoan = storage.completeReturnInspection({
        loanId: loan.id,
        conditionAtReturn: 'GOOD',
        accessoriesComplete: true,
        notes: 'Pemeriksaan tuntas, kondisi fisik mulus dan lengkap.',
        adminUser,
      });

      // Transaksi selesai & unit kembali tersedia
      expect(finalizedLoan.status).toBe('COMPLETED');
      expect(finalizedLoan.returnInspection?.conditionAtReturn).toBe('GOOD');
      expect(finalizedLoan.returnInspection?.approvedByName).toBe(adminUser.fullName);

      const restoredAsset = storage.getAssetById(unit.id)!;
      expect(restoredAsset.operationalStatus).toBe('AVAILABLE');
      expect(restoredAsset.conditionStatus).toBe('GOOD');

      // Verifikasi seluruh riwayat tercatat di Audit Log
      const auditLogs = storage.getAuditLogs();
      const relevantLogs = auditLogs.filter((log) => log.entityId === loan.id);
      expect(relevantLogs.some((l) => l.action === 'PERSETUJUAN_PINJAMAN')).toBe(true);
      expect(relevantLogs.some((l) => l.action === 'PENGAJUAN_PENGEMBALIAN')).toBe(true);
      expect(relevantLogs.some((l) => l.action === 'PENERIMAAN_FISIK_PENGEMBALIAN')).toBe(true);
      expect(relevantLogs.some((l) => l.action === 'PERSETUJUAN_PENGEMBALIAN')).toBe(true);
    });

    it('menjalankan audit penolakan admin: barang kembali AVAILABLE jika ditolak', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Kegiatan ekskul',
        expectedReturnAt: '2026-10-15T15:00:00Z',
        borrower: guruUser,
      });

      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('RESERVED');

      // Admin menolak pengajuan
      const rejected = storage.rejectLoanRequest(loan.id, 'Unit sedang dijadwalkan untuk asesmen', adminUser);
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toContain('asesmen');

      // Unit langsung kembali AVAILABLE
      expect(storage.getAssetById(unit.id)!.operationalStatus).toBe('AVAILABLE');
    });

    it('menjalankan audit pengembalian dengan kerusakan: unit dialihkan ke MAINTENANCE', () => {
      const unit = storage.getAssetById('unit-laptop-01')!;
      const loan = storage.createLoanRequest({
        assetUnitId: unit.id,
        purpose: 'Ujian sekolah',
        expectedReturnAt: '2026-10-15T15:00:00Z',
        borrower: guruUser,
      });
      storage.approveLoanRequest(loan.id, adminUser);
      storage.submitReturnRequest({ loanId: loan.id, borrowerUser: guruUser });
      storage.receiveReturnPhysical(loan.id, adminUser);

      // Verifikasi admin mencatat kerusakan minor (layar bergaris)
      const damagedReturn = storage.completeReturnInspection({
        loanId: loan.id,
        conditionAtReturn: 'MINOR_DAMAGE',
        accessoriesComplete: true,
        issueDescription: 'Layar LCD bergaris vertikal tipis',
        adminUser,
      });

      expect(damagedReturn.status).toBe('COMPLETED');
      // Unit dialihkan ke MAINTENANCE untuk perbaikan teknis
      const damagedAsset = storage.getAssetById(unit.id)!;
      expect(damagedAsset.operationalStatus).toBe('MAINTENANCE');
      expect(damagedAsset.conditionStatus).toBe('MINOR_DAMAGE');
    });
  });
});


