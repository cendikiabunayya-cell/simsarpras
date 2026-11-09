export type UserRole = 'ADMIN_SARPRAS' | 'GURU_PEGAWAI' | 'KEPALA_SEKOLAH';

export interface UserProfile {
  id: string;
  fullName: string;
  employeeNumber: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  department?: string;
  avatarUrl?: string;
}

export type LoanMode = 'DIRECT' | 'ADMIN_APPROVAL';
export type TrackingMode = 'INDIVIDUAL' | 'QUANTITY';

export type ConditionStatus = 'GOOD' | 'MINOR_DAMAGE' | 'MAJOR_DAMAGE' | 'LOST';

export type OperationalStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'RESERVED'
  | 'ON_LOAN'
  | 'RETURN_PENDING'
  | 'RETURN_INSPECTION'
  | 'MAINTENANCE'
  | 'INACTIVE'
  | 'LOST';

export type LoanStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'READY_FOR_HANDOVER'
  | 'ACTIVE'
  | 'RETURN_REQUESTED'
  | 'RETURN_RECEIVED'
  | 'RETURN_ISSUE'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export interface Category {
  id: string;
  name: string;
  defaultLoanMode: LoanMode;
  isActive: boolean;
  description?: string;
  itemCount?: number;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface FundingSource {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface SchoolSettings {
  schoolName: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  headmasterName?: string;
  headmasterNip?: string;
  sarprasManagerName?: string;
  sarprasManagerNip?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type SchoolUnit = 'RA Cendikia Bunayya' | 'MIS Cendikia Bunayya';
export const SCHOOL_UNITS: SchoolUnit[] = ['RA Cendikia Bunayya', 'MIS Cendikia Bunayya'];

export interface AssetUnit {
  id: string;
  permanentId?: string; // Identitas unik permanen yang tidak bergantung nama, kategori, lokasi, atau domain
  itemName: string; // Nama Barang / Sarana
  institution?: SchoolUnit | string; // Satuan Pendidikan (RA Cendikia Bunayya & MIS Cendikia Bunayya)
  categoryName: string; // Kategori (TIK/Multimedia, Mebeler, Alat Olahraga, Elektronik, dll)
  technicalSpecs: string; // Spesifikasi Teknis / Ukuran
  itemBrand: string; // Merek / Pabrikan
  fundingSource: string; // Sumber Pendanaan (misal BOS Reguler, DAK Fisik, dll)
  acquisitionYear: number | string; // Tahun Perolehan
  locationId: string;
  locationName: string; // Ruangan / Lokasi
  assetCode: string;
  itemNumber?: string | null; // Nomor Barang (Ketik Manual, misal: '01', '02', 'Laptop 01')
  qrToken: string;
  serialNumber?: string;
  effectiveLoanMode: LoanMode;
  conditionStatus: ConditionStatus;
  operationalStatus: OperationalStatus;
  photoPath?: string | null;
  photoUrl?: string | null;
  notes?: string;
  standardAccessories?: string[];
  isDecommissioned?: boolean; // Status penghapusan / penonaktifan secara logis
  decommissionedAt?: string; // Waktu penonaktifan/penghapusan logis
  decommissionedReason?: string; // Alasan penonaktifan (rusak berat, dihibahkan, dilelang, dll)
  createdAt: string;
  updatedAt: string;
}

export interface HandoverDetails {
  handedOverBy: string;
  handedOverByName: string;
  handedOverAt: string;
  conditionAtHandover: ConditionStatus;
  accessoriesVerified: boolean;
  notes?: string;
}

export interface ReturnInspectionDetails {
  receivedBy?: string;
  receivedByName?: string;
  receivedAt?: string;
  inspectedBy?: string;
  inspectedByName?: string;
  inspectedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  conditionAtReturn: ConditionStatus;
  accessoriesComplete: boolean;
  issueDescription?: string;
  notes?: string;
  photoPath?: string;
  resultingStatus: OperationalStatus; // AVAILABLE or MAINTENANCE
}

export interface LoanRequest {
  id: string;
  loanNumber: string;
  borrowerId: string;
  borrowerName: string;
  borrowerEmployeeNumber: string;
  borrowerRole: UserRole;
  status: LoanStatus;
  loanModeSnapshot: LoanMode;
  purpose: string;
  requestedAt: string;
  expectedReturnAt: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  cancelledAt?: string;
  unit: AssetUnit;
  handover?: HandoverDetails;
  returnInspection?: ReturnInspectionDetails;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: 'ASSET' | 'LOAN_REQUEST' | 'RETURN' | 'POLICY' | 'USER' | 'MASTER_DATA';
  entityId: string;
  entityName?: string;
  details: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalAssets: number;
  availableAssets: number;
  onLoanAssets: number;
  maintenanceAssets: number;
  pendingApprovalsCount: number;
  pendingReturnsCount: number;
  overdueLoansCount: number;
  byCategory: { name: string; count: number; available: number }[];
  byCondition: { status: ConditionStatus; label: string; count: number }[];
  byLocation: { name: string; count: number }[];
  byFundingSource?: { name: string; count: number }[];
}

export type RestoreMode = 'clean' | 'merge';

export interface BackupTableCounts {
  users?: number;
  assets?: number;
  categories?: number;
  locations?: number;
  fundingSources?: number;
  loans?: number;
  returnInspections?: number;
  auditLogs?: number;
}

export interface BackupSummary {
  counts: {
    users: number;
    assets: number;
    categories: number;
    locations: number;
    fundingSources: number;
    loans: number;
    auditLogs: number;
  };
  databaseTime: string;
}

export interface BackupPayload {
  system: string;
  signature: string;
  version: string;
  exportedAt: string;
  exportedBy: {
    id: string;
    name: string;
    email: string;
  };
  counts: BackupTableCounts;
  data: {
    schoolSettings?: SchoolSettings;
    users?: any[];
    categories?: Category[];
    locations?: Location[];
    fundingSources?: FundingSource[];
    assets?: AssetUnit[];
    loans?: any[];
    returnInspections?: any[];
    auditLogs?: any[];
  };
}

export interface RestoreResult {
  message: string;
  mode: RestoreMode;
  restoredAt: string;
  counts: BackupTableCounts;
}

