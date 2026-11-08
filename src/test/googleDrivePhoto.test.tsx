import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Inventory } from '../pages/Inventory';
import { EditAssetModal } from '../components/modals/EditAssetModal';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../services/api';
import { AssetUnit } from '../types';
import {
  isValidHttpsUrl,
  isGoogleDriveUrl,
  extractGoogleDriveFileId,
  getOptimizedImageUrl,
  getDirectViewUrl,
} from '../lib/driveUtils';
import {
  httpsUrlSchema,
  assetCreateSchema,
  assetUpdateSchema,
} from '../../server/src/validators';

const mockAssetsWithPhotos: AssetUnit[] = [
  {
    id: 'asset-drive-1',
    permanentId: 'PERM-001',
    qrToken: 'QR-001',
    assetCode: 'INV-2024-001',
    itemName: 'Laptop ASUS Guru',
    institution: 'MIS Cendikia Bunayya',
    categoryName: 'TIK/Multimedia',
    locationId: 'loc-1',
    locationName: 'Lab Komputer 1',
    itemBrand: 'ASUS',
    fundingSource: 'BOS Reguler',
    acquisitionYear: 2024,
    technicalSpecs: 'Core i5 RAM 16GB',
    effectiveLoanMode: 'DIRECT',
    conditionStatus: 'GOOD',
    operationalStatus: 'AVAILABLE',
    photoUrl: 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing',
    photoPath: 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    id: 'asset-no-photo-2',
    permanentId: 'PERM-002',
    qrToken: 'QR-002',
    assetCode: 'INV-2023-002',
    itemName: 'Proyektor Epson EB-E01',
    institution: 'RA Cendikia Bunayya',
    categoryName: 'TIK/Multimedia',
    locationId: 'loc-2',
    locationName: 'Ruang Guru',
    itemBrand: 'Epson',
    fundingSource: 'DAK Fisik',
    acquisitionYear: 2023,
    technicalSpecs: '3300 Lumens',
    effectiveLoanMode: 'ADMIN_APPROVAL',
    conditionStatus: 'GOOD',
    operationalStatus: 'AVAILABLE',
    photoUrl: undefined,
    photoPath: undefined,
    createdAt: '2023-01-01',
    updatedAt: '2023-01-01',
  },
];

describe('Google Drive Photo Feature Test Suite — SIMSARPRAS', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.restoreAllMocks();

    vi.spyOn(api, 'getAssets').mockResolvedValue(mockAssetsWithPhotos);
    vi.spyOn(api, 'getAcquisitionYears').mockResolvedValue([2024, 2023]);
    vi.spyOn(api, 'getFundingSources').mockResolvedValue([
      { id: 'fs-1', name: 'BOS Reguler', description: '', isActive: true },
      { id: 'fs-2', name: 'DAK Fisik', description: '', isActive: true },
    ]);
    vi.spyOn(api, 'getCategories').mockResolvedValue([
      { id: 'cat-1', name: 'TIK/Multimedia', defaultLoanMode: 'DIRECT', isActive: true },
    ]);
    vi.spyOn(api, 'getLocations').mockResolvedValue([
      { id: 'loc-1', name: 'Lab Komputer 1', code: 'LAB-1', isActive: true },
      { id: 'loc-2', name: 'Ruang Guru', code: 'RG-1', isActive: true },
    ]);
  });

  describe('1. Inventory Table "Foto" Column Rendering', () => {
    const renderInventory = () =>
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthProvider>
              <Inventory />
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

    it('renders "Foto" column header in table', async () => {
      renderInventory();

      await waitFor(() => {
        expect(screen.getByText('Laptop ASUS Guru')).toBeInTheDocument();
      });

      const photoHeader = screen.getByRole('columnheader', { name: /foto/i });
      expect(photoHeader).toBeInTheDocument();
    });

    it('displays "Lihat Foto" button for item with valid Google Drive link', async () => {
      renderInventory();

      await waitFor(() => {
        expect(screen.getByText('Laptop ASUS Guru')).toBeInTheDocument();
      });

      const lihatFotoBtn = screen.getByRole('link', { name: /lihat foto/i });
      expect(lihatFotoBtn).toBeInTheDocument();
      expect(lihatFotoBtn).toHaveAttribute(
        'href',
        'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing'
      );
      expect(lihatFotoBtn).toHaveAttribute('target', '_blank');
      expect(lihatFotoBtn).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('displays "Belum ada foto" for item without photo link', async () => {
      renderInventory();

      await waitFor(() => {
        expect(screen.getByText('Proyektor Epson EB-E01')).toBeInTheDocument();
      });

      const noPhotoText = screen.getByText(/belum ada foto/i);
      expect(noPhotoText).toBeInTheDocument();
    });
  });

  describe('2. Drive Utility Validation & Extraction', () => {
    it('validates HTTPS Google Drive URLs and rejects dangerous schemes', () => {
      // Valid HTTPS Google Drive URLs
      expect(isValidHttpsUrl('https://drive.google.com/file/d/12345/view?usp=sharing')).toBe(true);
      expect(isValidHttpsUrl('https://drive.google.com/open?id=12345')).toBe(true);
      expect(isValidHttpsUrl('https://docs.google.com/document/d/12345/edit')).toBe(true);
      expect(isGoogleDriveUrl('https://drive.google.com/file/d/12345/view')).toBe(true);

      // Dangerous schemes
      expect(isValidHttpsUrl('javascript:alert(1)')).toBe(false);
      expect(isValidHttpsUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isValidHttpsUrl('file:///etc/passwd')).toBe(false);
      expect(isValidHttpsUrl('http://insecure-drive.com')).toBe(false);
      expect(isValidHttpsUrl('https://user:pass@drive.google.com/evil')).toBe(false);

      // Empty or undefined is optional (valid)
      expect(isValidHttpsUrl('')).toBe(true);
      expect(isValidHttpsUrl(null)).toBe(true);
      expect(isValidHttpsUrl(undefined)).toBe(true);
    });

    it('extracts Google Drive File ID correctly for preview thumbnails', () => {
      const fileId1 = extractGoogleDriveFileId(
        'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing'
      );
      expect(fileId1).toBe('1A2B3C4D5E6F7G8H9I0J');

      const fileId2 = extractGoogleDriveFileId('https://drive.google.com/open?id=XYZ_987-abc');
      expect(fileId2).toBe('XYZ_987-abc');

      const thumbnail = getOptimizedImageUrl('https://drive.google.com/file/d/FILE123/view');
      expect(thumbnail).toBe('https://drive.google.com/thumbnail?id=FILE123&sz=w600');

      const direct = getDirectViewUrl('https://drive.google.com/file/d/FILE123/view');
      expect(direct).toBe('https://drive.google.com/file/d/FILE123/view');
    });
  });

  describe('3. Edit Asset Modal with Google Drive Link', () => {
    it('renders field label, input placeholder, and allows testing & clearing link', async () => {
      const targetAsset = mockAssetsWithPhotos[0];
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      render(
        <QueryClientProvider client={queryClient}>
          <EditAssetModal
            isOpen={true}
            onClose={onClose}
            asset={targetAsset}
            onSuccess={onSuccess}
          />
        </QueryClientProvider>
      );

      // Wait for locations to load
      await waitFor(() => {
        expect(screen.getByText('Lab Komputer 1 (LAB-1)')).toBeInTheDocument();
      });

      // Verify label and input
      expect(screen.getByLabelText(/link foto google drive/i)).toBeInTheDocument();
      const input = screen.getByPlaceholderText('Tempel link Google Drive foto barang') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing');

      // Verify "Tes Link" button
      const tesLinkBtn = screen.getByRole('link', { name: /tes link/i });
      expect(tesLinkBtn).toBeInTheDocument();
      expect(tesLinkBtn).toHaveAttribute('href', targetAsset.photoUrl);
      expect(tesLinkBtn).toHaveAttribute('target', '_blank');

      // Verify "Kosongkan Link" button
      const kosongkanBtn = screen.getByRole('button', { name: /kosongkan link/i });
      expect(kosongkanBtn).toBeInTheDocument();

      // Click "Kosongkan Link"
      fireEvent.click(kosongkanBtn);
      expect(input.value).toBe('');

      // Input invalid protocol and verify warning
      fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
      expect(
        screen.getByText(/tautan foto harus menggunakan protokol aman https/i)
      ).toBeInTheDocument();
    });

    it('submits updated photo URL or null when cleared', async () => {
      const targetAsset = mockAssetsWithPhotos[0];
      const updateSpy = vi.spyOn(api, 'updateAsset').mockResolvedValue({
        ...targetAsset,
        photoUrl: undefined,
        photoPath: undefined,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <EditAssetModal
            isOpen={true}
            onClose={vi.fn()}
            asset={targetAsset}
          />
        </QueryClientProvider>
      );

      // Wait for locations to load
      await waitFor(() => {
        expect(screen.getByText('Lab Komputer 1 (LAB-1)')).toBeInTheDocument();
      });

      // Clear the link
      const kosongkanBtn = screen.getByRole('button', { name: /kosongkan link/i });
      fireEvent.click(kosongkanBtn);

      // Save changes
      const saveBtn = screen.getByRole('button', { name: /simpan perubahan/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          targetAsset.id,
          expect.objectContaining({
            photoUrl: null,
            photoPath: null,
          })
        );
      });
    });
  });

  describe('4. Backend Zod Schema Validation', () => {
    it('accepts valid HTTPS Google Drive URL and null in assetCreateSchema', () => {
      const validPayload = {
        itemName: 'Kamera Digital',
        locationId: 'loc-1',
        photoUrl: 'https://drive.google.com/file/d/abcd1234efgh/view',
      };
      const result = assetCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);

      const nullPhotoPayload = {
        itemName: 'Kamera Digital',
        locationId: 'loc-1',
        photoUrl: null,
      };
      const nullResult = assetCreateSchema.safeParse(nullPhotoPayload);
      expect(nullResult.success).toBe(true);
    });

    it('rejects dangerous javascript: and http: schemes in backend validators', () => {
      // Test httpsUrlSchema directly
      expect(httpsUrlSchema.safeParse('https://drive.google.com/file/d/xyz').success).toBe(true);
      expect(httpsUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
      expect(httpsUrlSchema.safeParse('http://insecure.com').success).toBe(false);

      const dangerousPayload = {
        itemName: 'Kamera Digital',
        locationId: 'loc-1',
        photoUrl: 'javascript:alert("XSS")',
      };
      const result = assetCreateSchema.safeParse(dangerousPayload);
      expect(result.success).toBe(false);

      const httpPayload = {
        photoUrl: 'http://drive.google.com/file/d/123/view',
      };
      const httpResult = assetUpdateSchema.safeParse(httpPayload);
      expect(httpResult.success).toBe(false);
    });
  });
});
