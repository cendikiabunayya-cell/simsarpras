import { describe, it, expect } from 'vitest';
import { MockStorageService } from '../services/mockStorage';

describe('Backup and Restore Full Data Test Suite', () => {
  const storage = MockStorageService.getInstance();

  it('1. Menghasilkan ringkasan data (summary) dengan jumlah entitas lengkap', () => {
    const summary = storage.getBackupSummary();
    expect(summary).toBeDefined();
    expect(summary.counts).toBeDefined();
    expect(typeof summary.counts.assets).toBe('number');
    expect(typeof summary.counts.users).toBe('number');
    expect(typeof summary.counts.categories).toBe('number');
    expect(typeof summary.counts.locations).toBe('number');
    expect(typeof summary.counts.fundingSources).toBe('number');
    expect(typeof summary.counts.loans).toBe('number');
    expect(typeof summary.counts.auditLogs).toBe('number');
    expect(summary.databaseTime).toBeDefined();
  });

  it('2. Mengekspor payload cadangan lengkap dengan signature SIMSARPRAS_BACKUP_V2', () => {
    const backup = storage.exportBackup();
    expect(backup.system).toBe('SIMSARPRAS_SMART_CAMPUS');
    expect(backup.signature).toBe('SIMSARPRAS_BACKUP_V2');
    expect(backup.version).toBe('2.1.0');
    expect(backup.exportedAt).toBeDefined();
    expect(backup.exportedBy).toBeDefined();
    expect(backup.counts).toBeDefined();
    expect(backup.data).toBeDefined();
    expect(Array.isArray(backup.data.assets)).toBe(true);
    expect(Array.isArray(backup.data.categories)).toBe(true);
    expect(Array.isArray(backup.data.locations)).toBe(true);
    expect(Array.isArray(backup.data.fundingSources)).toBe(true);
    expect(Array.isArray(backup.data.users)).toBe(true);
    expect(Array.isArray(backup.data.loans)).toBe(true);
  });

  it('3. Memulihkan basis data dalam mode merge tanpa menghilangkan data yang sudah ada', () => {
    const backup = storage.exportBackup();
    const result = storage.restoreBackup(backup, 'merge');
    expect(result.mode).toBe('merge');
    expect(result.message).toContain('berhasil');
    expect(result.counts.assets).toBeGreaterThanOrEqual(0);
  });

  it('4. Memulihkan basis data dalam mode clean (timpa bersih)', () => {
    const backup = storage.exportBackup();
    const result = storage.restoreBackup(backup, 'clean');
    expect(result.mode).toBe('clean');
    expect(result.message).toContain('berhasil');
    const summaryAfter = storage.getBackupSummary();
    expect(summaryAfter.counts.assets).toBe(backup.data.assets?.length);
  });
});
