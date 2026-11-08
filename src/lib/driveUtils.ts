/**
 * Utilitas untuk validasi dan penanganan tautan foto Google Drive / Eksternal HTTPS
 */

/**
 * Validasi apakah URL menggunakan protokol HTTPS aman dan bukan skema berbahaya
 */
export function isValidHttpsUrl(urlString?: string | null): boolean {
  if (!urlString || !urlString.trim()) return true; // Opsional
  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Memeriksa apakah URL merupakan link Google Drive yang valid dan aman
 */
export function isGoogleDriveUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'drive.google.com' || host === 'docs.google.com';
  } catch {
    return false;
  }
}

/**
 * Mengekstrak File ID dari berbagai format URL Google Drive
 * Contoh:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 */
export function extractGoogleDriveFileId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: /file/d/FILE_ID
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_\-]+)/);
  if (matchFileD && matchFileD[1]) {
    return matchFileD[1];
  }

  // Pattern 2: id=FILE_ID
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_\-]+)/);
  if (matchIdParam && matchIdParam[1]) {
    return matchIdParam[1];
  }

  return null;
}

/**
 * Menghasilkan URL thumbnail yang dapat ditampilkan langsung oleh tag <img>
 * Jika bukan tautan Google Drive, mengembalikan URL asli.
 */
export function getOptimizedImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    // Thumbnail resolusi sedang (w600) untuk pratinjau kartu / modal
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w600`;
  }

  return trimmed;
}

/**
 * Mendapatkan tautan langsung untuk membuka berkas foto di tab baru
 */
export function getDirectViewUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
}
