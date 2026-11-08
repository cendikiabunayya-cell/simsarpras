/**
 * SIMSARPRAS: Database Migration Reconciliation Audit Script
 * Versi: 2.1.0 - Fase 2A (Audit dan Persiapan Database)
 *
 * Fungsi:
 * 1. Mengaudit seluruh struktur data localStorage / Mock Data.
 * 2. Memeriksa integritas token permanen (qrToken, assetCode, permanentId).
 * 3. Mendeteksi adanya relasi yatim (orphan references) antar-tabel.
 * 4. Mendeteksi duplikasi token atau kode unik.
 * 5. Memverifikasi konsistensi status transaksi peminjaman terhadap status unit.
 */

import {
  MOCK_ASSET_UNITS,
  MOCK_AUDIT_LOGS,
  MOCK_CATEGORIES,
  MOCK_FUNDING_SOURCES,
  MOCK_LOAN_REQUESTS,
  MOCK_LOCATIONS,
  MOCK_USERS,
} from '../../src/data/mockData';

export interface ReconciliationReport {
  timestamp: string;
  counts: {
    categories: number;
    locations: number;
    fundingSources: number;
    users: number;
    assets: number;
    loans: number;
    auditLogs: number;
  };
  tokenIntegrity: {
    totalTokens: number;
    duplicateQrTokens: string[];
    duplicateAssetCodes: string[];
    duplicatePermanentIds: string[];
    preservedTokens: {
      assetCode: string;
      qrToken: string;
      permanentId?: string;
    }[];
    allTokensValid: boolean;
  };
  relationalIntegrity: {
    orphanAssetLocations: { assetId: string; locationId: string }[];
    orphanAssetCategories: { assetId: string; categoryName: string }[];
    orphanAssetFunding: { assetId: string; fundingSource: string }[];
    orphanLoanAssets: { loanId: string; assetId: string }[];
    orphanLoanBorrowers: { loanId: string; borrowerId?: string }[];
    isRelationalClean: boolean;
  };
  transactionConsistency: {
    activeLoansCount: number;
    unitsOnLoanCount: number;
    inconsistentPairs: { loanId: string; unitId: string; loanStatus: string; unitStatus: string }[];
    isTransactionConsistent: boolean;
  };
  auditVerdict: 'PASSED' | 'FAILED';
}

export function runReconciliationAudit(): ReconciliationReport {
  // 1. Audit Jumlah Record Data
  const counts = {
    categories: MOCK_CATEGORIES.length,
    locations: MOCK_LOCATIONS.length,
    fundingSources: MOCK_FUNDING_SOURCES.length,
    users: MOCK_USERS.length,
    assets: MOCK_ASSET_UNITS.length,
    loans: MOCK_LOAN_REQUESTS.length,
    auditLogs: MOCK_AUDIT_LOGS.length,
  };

  // 2. Audit Integritas Token & Kode Unik
  const qrTokens = new Set<string>();
  const duplicateQrTokens: string[] = [];

  const assetCodes = new Set<string>();
  const duplicateAssetCodes: string[] = [];

  const permanentIds = new Set<string>();
  const duplicatePermanentIds: string[] = [];

  const preservedTokens: { assetCode: string; qrToken: string; permanentId?: string }[] = [];

  for (const asset of MOCK_ASSET_UNITS) {
    // Cek QR Token
    if (qrTokens.has(asset.qrToken)) {
      duplicateQrTokens.push(asset.qrToken);
    } else {
      qrTokens.add(asset.qrToken);
    }

    // Cek Asset Code
    if (assetCodes.has(asset.assetCode)) {
      duplicateAssetCodes.push(asset.assetCode);
    } else {
      assetCodes.add(asset.assetCode);
    }

    // Cek Permanent ID
    const permId = asset.permanentId || asset.id;
    if (permanentIds.has(permId)) {
      duplicatePermanentIds.push(permId);
    } else {
      permanentIds.add(permId);
    }

    preservedTokens.push({
      assetCode: asset.assetCode,
      qrToken: asset.qrToken,
      permanentId: permId,
    });
  }

  const allTokensValid =
    duplicateQrTokens.length === 0 &&
    duplicateAssetCodes.length === 0 &&
    duplicatePermanentIds.length === 0 &&
    preservedTokens.every((t) => t.qrToken && t.assetCode && t.permanentId);

  // 3. Audit Relasi & Referensi Yatim (Orphan Checks)
  const locationIds = new Set(MOCK_LOCATIONS.map((l) => l.id));
  const categoryNames = new Set(MOCK_CATEGORIES.map((c) => c.name.toLowerCase()));
  const fundingNames = new Set(MOCK_FUNDING_SOURCES.map((f) => f.name.toLowerCase()));
  const assetIds = new Set(MOCK_ASSET_UNITS.map((a) => a.id));
  const userIds = new Set(MOCK_USERS.map((u) => u.id));

  const orphanAssetLocations: { assetId: string; locationId: string }[] = [];
  const orphanAssetCategories: { assetId: string; categoryName: string }[] = [];
  const orphanAssetFunding: { assetId: string; fundingSource: string }[] = [];

  for (const asset of MOCK_ASSET_UNITS) {
    if (!locationIds.has(asset.locationId)) {
      orphanAssetLocations.push({ assetId: asset.id, locationId: asset.locationId });
    }
    if (!categoryNames.has(asset.categoryName.toLowerCase())) {
      orphanAssetCategories.push({ assetId: asset.id, categoryName: asset.categoryName });
    }
    if (asset.fundingSource && !fundingNames.has(asset.fundingSource.toLowerCase())) {
      orphanAssetFunding.push({ assetId: asset.id, fundingSource: asset.fundingSource });
    }
  }

  const orphanLoanAssets: { loanId: string; assetId: string }[] = [];
  const orphanLoanBorrowers: { loanId: string; borrowerId?: string }[] = [];

  for (const loan of MOCK_LOAN_REQUESTS) {
    if (!assetIds.has(loan.unit.id)) {
      orphanLoanAssets.push({ loanId: loan.id, assetId: loan.unit.id });
    }
    if (loan.borrowerId && !userIds.has(loan.borrowerId) && !loan.borrowerId.startsWith('user-guest-')) {
      orphanLoanBorrowers.push({ loanId: loan.id, borrowerId: loan.borrowerId });
    }
  }

  const isRelationalClean =
    orphanAssetLocations.length === 0 &&
    orphanAssetCategories.length === 0 &&
    orphanAssetFunding.length === 0 &&
    orphanLoanAssets.length === 0 &&
    orphanLoanBorrowers.length === 0;

  // 4. Audit Konsistensi Status Transaksi terhadap Status Unit Aset
  let activeLoansCount = 0;
  let unitsOnLoanCount = 0;
  const inconsistentPairs: { loanId: string; unitId: string; loanStatus: string; unitStatus: string }[] = [];

  for (const loan of MOCK_LOAN_REQUESTS) {
    if (loan.status === 'ACTIVE') {
      activeLoansCount++;
      const targetUnit = MOCK_ASSET_UNITS.find((u) => u.id === loan.unit.id);
      if (targetUnit) {
        if (targetUnit.operationalStatus !== 'ON_LOAN') {
          inconsistentPairs.push({
            loanId: loan.id,
            unitId: targetUnit.id,
            loanStatus: loan.status,
            unitStatus: targetUnit.operationalStatus,
          });
        }
      }
    }
  }

  for (const asset of MOCK_ASSET_UNITS) {
    if (asset.operationalStatus === 'ON_LOAN') {
      unitsOnLoanCount++;
    }
  }

  const isTransactionConsistent =
    inconsistentPairs.length === 0 && activeLoansCount === unitsOnLoanCount;

  // Kesimpulan Audit
  const auditVerdict: 'PASSED' | 'FAILED' =
    allTokensValid && isRelationalClean && isTransactionConsistent ? 'PASSED' : 'FAILED';

  return {
    timestamp: new Date().toISOString(),
    counts,
    tokenIntegrity: {
      totalTokens: preservedTokens.length,
      duplicateQrTokens,
      duplicateAssetCodes,
      duplicatePermanentIds,
      preservedTokens,
      allTokensValid,
    },
    relationalIntegrity: {
      orphanAssetLocations,
      orphanAssetCategories,
      orphanAssetFunding,
      orphanLoanAssets,
      orphanLoanBorrowers,
      isRelationalClean,
    },
    transactionConsistency: {
      activeLoansCount,
      unitsOnLoanCount,
      inconsistentPairs,
      isTransactionConsistent,
    },
    auditVerdict,
  };
}

// Eksekusi otomatis jika dipanggil langsung via CLI
if (process.argv[1]?.includes('reconcile')) {
  const result = runReconciliationAudit();
  console.log('=====================================================');
  console.log(' SIMSARPRAS - REKONSILIASI AUDIT DATABASE (FASE 2A)');
  console.log('=====================================================');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Verdict:   ${result.auditVerdict}`);
  console.log('\n--- 1. Jumlah Entitas Data ---');
  console.table(result.counts);
  console.log('\n--- 2. Integritas Token & Kode Unik ---');
  console.log(`Total Token Terverifikasi: ${result.tokenIntegrity.totalTokens}`);
  console.log(`Duplikat qrToken: ${result.tokenIntegrity.duplicateQrTokens.length}`);
  console.log(`Duplikat assetCode: ${result.tokenIntegrity.duplicateAssetCodes.length}`);
  console.log(`Duplikat permanentId: ${result.tokenIntegrity.duplicatePermanentIds.length}`);
  console.log(`Status Token: ${result.tokenIntegrity.allTokensValid ? 'VALID (100% Preserved)' : 'INVALID'}`);
  console.log('\n--- 3. Relasi & Referensi Yatim (Orphan Records) ---');
  console.log(`Orphan Location: ${result.relationalIntegrity.orphanAssetLocations.length}`);
  console.log(`Orphan Category: ${result.relationalIntegrity.orphanAssetCategories.length}`);
  console.log(`Orphan Funding:  ${result.relationalIntegrity.orphanAssetFunding.length}`);
  console.log(`Orphan Loan Asset: ${result.relationalIntegrity.orphanLoanAssets.length}`);
  console.log(`Orphan Loan Borrower: ${result.relationalIntegrity.orphanLoanBorrowers.length}`);
  console.log(`Relational Clean: ${result.relationalIntegrity.isRelationalClean}`);
  console.log('\n--- 4. Konsistensi Status Transaksi ---');
  console.log(`Active Loans: ${result.transactionConsistency.activeLoansCount}`);
  console.log(`Units ON_LOAN: ${result.transactionConsistency.unitsOnLoanCount}`);
  console.log(`Inconsistent Pairs: ${result.transactionConsistency.inconsistentPairs.length}`);
  console.log(`Transaction Consistent: ${result.transactionConsistency.isTransactionConsistent}`);
  console.log('=====================================================');
}
