import { AssetUnit } from '../types';

export interface PublicQrConfig {
  /**
   * Mode URL QR Code:
   * 'ip': Menggunakan alamat IP Wi-Fi lokal (default: http://192.168.100.45:5173 atau window.location.origin).
   *       Sangat cocok untuk guru yang scan barcode langsung via HP di jaringan Wi-Fi sekolah saat ini.
   * 'custom': Menggunakan domain publik resmi (contoh: https://sarpras.cendikiabunayya.sch.id) jika sistem sudah online di internet.
   */
  mode: 'ip' | 'custom';

  /**
   * Alamat IP & Port server lokal (contoh: 'http://192.168.100.45:5173')
   */
  ipBaseUrl: string;

  /**
   * Domain publik resmi yang digunakan jika mode 'custom' dipilih.
   * Contoh: 'https://sarpras.cendikiabunayya.sch.id'
   */
  publicBaseUrl: string;

  /**
   * Pola format URL:
   * 'query': /scan?code={idOrCode} (Kompatibel luas & query param)
   * 'path':  /q/{idOrCode} (Permalink pendek & bersih)
   */
  urlPattern: 'query' | 'path';

  /**
   * Keterangan catatan instansi / organisasi pemilik sistem
   */
  organizationName: string;

  /**
   * Riwayat domain lama yang pernah digunakan untuk panduan migrasi
   */
  legacyDomains: string[];
}

export const STORAGE_KEYS = {
  QR_URL_CONFIG: 'sisarpras_public_qr_config_v1',
};

export const DEFAULT_LOCAL_IP_BASE = 'http://192.168.100.45:5173';
export const DEFAULT_PUBLIC_QR_DOMAIN = 'https://sarpras.cendikiabunayya.sch.id';

export const DEFAULT_QR_CONFIG: PublicQrConfig = {
  mode: 'ip', // Default kembali ke IP sesuai instruksi pengguna
  ipBaseUrl: DEFAULT_LOCAL_IP_BASE,
  publicBaseUrl: DEFAULT_PUBLIC_QR_DOMAIN,
  urlPattern: 'query',
  organizationName: 'RA & MIS Cendikia Bunayya',
  legacyDomains: [
    'https://cendikiabunayya.sch.id/sarpras',
    'http://sarpras-lama.sekolah.sch.id',
  ],
};

/**
 * Cek apakah sebuah URL atau hostname adalah alamat IP, localhost, atau hosting preview sementara
 */
export function isLocalOrTemporaryHost(urlOrHost: string): boolean {
  if (!urlOrHost) return false;
  try {
    const parsed = urlOrHost.includes('://')
      ? new URL(urlOrHost)
      : new URL(`http://${urlOrHost}`);

    const hostname = parsed.hostname.toLowerCase();

    // 1. Localhost & loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    // 2. Private IP ranges (RFC 1918)
    // 192.168.x.x
    if (hostname.startsWith('192.168.')) return true;
    // 10.x.x.x
    if (hostname.startsWith('10.')) return true;
    // 172.16.x.x - 172.31.x.x
    const match172 = hostname.match(/^172\.(\d+)\./);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }

    // 3. Temporary preview & tunneling domains
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.ngrok.io') ||
      hostname.endsWith('.ngrok-free.app') ||
      hostname.endsWith('.trycloudflare.com') ||
      hostname.endsWith('.loca.lt')
    ) {
      return true;
    }

    // 4. Ada port selain 80/443 (misal :5173, :3000, :8080)
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validasi apakah URL dasar QR layak digunakan
 */
export function validateQrBaseUrl(
  url: string,
  mode: 'ip' | 'custom'
): {
  isValid: boolean;
  isWarning: boolean;
  message?: string;
} {
  if (!url || !url.trim()) {
    return {
      isValid: false,
      isWarning: false,
      message: 'Alamat URL tidak boleh kosong',
    };
  }

  const clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return {
      isValid: false,
      isWarning: false,
      message: 'URL wajib diawali dengan protokol http:// atau https://',
    };
  }

  if (mode === 'ip') {
    try {
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return {
          isValid: true,
          isWarning: true,
          message:
            'Perhatian: Alamat ini menggunakan localhost. Smartphone/HP lain yang memindai QR code tidak akan bisa membuka halaman. Gunakan IP Wi-Fi (misal: http://192.168.100.45:5173).',
        };
      }
    } catch {
      return { isValid: false, isWarning: false, message: 'Format URL tidak valid' };
    }
    return { isValid: true, isWarning: false };
  }

  // mode === 'custom'
  if (isLocalOrTemporaryHost(clean)) {
    return {
      isValid: true,
      isWarning: true,
      message:
        'Peringatan: URL ini terdeteksi sebagai alamat IP lokal, localhost, atau port dev server. Untuk mode domain resmi, gunakan domain seperti https://sarpras.cendikiabunayya.sch.id.',
    };
  }

  return { isValid: true, isWarning: false };
}

/**
 * Validasi apakah URL domain publik aman dan layak untuk dicetak pada stiker fisik
 */
export function validatePublicDomain(url: string): {
  isValid: boolean;
  isWarning: boolean;
  message?: string;
} {
  return validateQrBaseUrl(url, 'custom');
}

/**
 * Mengambil konfigurasi URL QR saat ini dari penyimpanan lokal
 */
export function getPublicQrConfig(): PublicQrConfig {
  if (typeof window === 'undefined') return DEFAULT_QR_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QR_URL_CONFIG);
    if (!raw) return DEFAULT_QR_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_QR_CONFIG,
      ...parsed,
      // Default ke mode 'ip' jika belum diatur atau pengguna ingin kembali ke IP
      mode: parsed.mode || 'ip',
      ipBaseUrl: parsed.ipBaseUrl || DEFAULT_LOCAL_IP_BASE,
      publicBaseUrl: parsed.publicBaseUrl || DEFAULT_PUBLIC_QR_DOMAIN,
    };
  } catch {
    return DEFAULT_QR_CONFIG;
  }
}

/**
 * Menyimpan pembaruan konfigurasi URL QR
 */
export function savePublicQrConfig(updates: Partial<PublicQrConfig>): PublicQrConfig {
  const current = getPublicQrConfig();
  const merged: PublicQrConfig = {
    ...current,
    ...updates,
  };

  // Bersihkan trailing slash
  if (merged.publicBaseUrl?.endsWith('/')) {
    merged.publicBaseUrl = merged.publicBaseUrl.replace(/\/+$/, '');
  }
  if (merged.ipBaseUrl?.endsWith('/')) {
    merged.ipBaseUrl = merged.ipBaseUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.QR_URL_CONFIG, JSON.stringify(merged));
  }

  return merged;
}

/**
 * Mendapatkan base URL aktif yang digunakan untuk menghasilkan link QR code.
 * Dalam mode 'ip':
 * - Jika pengguna sedang membuka aplikasi lewat IP di browser (misal http://192.168.100.45:5173), gunakan window.location.origin
 * - Jika diakses lewat localhost atau testing, gunakan ipBaseUrl (default: http://192.168.100.45:5173)
 * Dalam mode 'custom':
 * - Gunakan publicBaseUrl (default: https://sarpras.cendikiabunayya.sch.id)
 */
export function getEffectiveBaseUrl(config?: PublicQrConfig): string {
  const cfg = config || getPublicQrConfig();

  if (cfg.mode === 'custom' && cfg.publicBaseUrl && cfg.publicBaseUrl.trim()) {
    return cfg.publicBaseUrl.trim().replace(/\/+$/, '');
  }

  // Mode 'ip':
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    const hostname = window.location.hostname;
    // Jika aplikasi diakses via IP langsung dari HP / browser lain (bukan localhost)
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
      return window.location.origin.replace(/\/+$/, '');
    }
  }

  // Fallback ke ipBaseUrl terkonfigurasi (default http://192.168.100.45:5173)
  return (cfg.ipBaseUrl || DEFAULT_LOCAL_IP_BASE).replace(/\/+$/, '');
}

/**
 * Menghasilkan URL QR code untuk suatu unit barang.
 * Secara default menghasilkan link alamat IP (http://192.168.100.45:5173/scan?code=...)
 * sehingga HP guru dapat langsung memindai dan membuka aplikasi di jaringan sekolah.
 */
export function getCanonicalQrUrl(asset: AssetUnit): string {
  const config = getPublicQrConfig();
  const base = getEffectiveBaseUrl(config);

  // Gunakan assetCode atau permanentId sebagai identitas unik barang
  const targetIdentifier = asset.assetCode || asset.permanentId || asset.id;

  if (config.urlPattern === 'path') {
    return `${base}/q/${encodeURIComponent(targetIdentifier)}`;
  }

  return `${base}/scan?code=${encodeURIComponent(targetIdentifier)}`;
}

/**
 * Generator Script & Prosedur Migrasi Domain:
 * Jika sekolah mengganti IP atau berpindah dari IP ke domain baru, fungsi ini menghasilkan
 * konfigurasi redirect HTTP 301 untuk Nginx, Apache, Cloudflare, dan file HTML universal.
 */
export function generateDomainMigrationSnippets(oldDomainUrl: string, newDomainUrl: string) {
  const cleanOld = oldDomainUrl.trim().replace(/\/+$/, '');
  const cleanNew = newDomainUrl.trim().replace(/\/+$/, '');

  let oldHost = cleanOld;
  let newHost = cleanNew;
  try {
    oldHost = new URL(cleanOld).hostname;
  } catch {
    // fallback
  }
  try {
    newHost = new URL(cleanNew).hostname;
  } catch {
    // fallback
  }

  // 1. Nginx 301 Redirect Block
  const nginxSnippet = `# Konfigurasi Nginx untuk domain / IP lama (${oldHost})
server {
    listen 80;
    listen 443 ssl http2;
    server_name ${oldHost};

    # Redirect permanen HTTP 301 ke alamat baru sambil mempertahankan parameter URL /scan
    location / {
        return 301 ${cleanNew}$request_uri;
    }
}`;

  // 2. Apache .htaccess Rewrite
  const apacheSnippet = `# Aturan Apache .htaccess untuk domain / IP lama (${oldHost})
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTP_HOST} ^${oldHost.replace(/\./g, '\\.')}$ [NC]
    RewriteRule ^(.*)$ ${cleanNew}/$1 [R=301,L]
</IfModule>`;

  // 3. Cloudflare Redirect Rule (Single Page Rule)
  const cloudflareRule = `Pengaturan Cloudflare Redirect Rules:
1. Masuk ke dashboard Cloudflare domain lama (${oldHost}).
2. Buka menu Rules -> Redirect Rules.
3. Buat Rule Baru:
   - Field: Hostname eq "${oldHost}"
   - Type: Dynamic Redirect
   - Target URL: concat("${cleanNew}", http.request.uri)
   - Status Code: 301 (Permanent Redirect)
   - Preserve Query String: Aktif`;

  // 4. Standalone HTML Universal Client-side Redirector (index.html di hosting lama)
  const htmlRedirectScript = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Pengalihan Sistem Inventaris SI-SARPRAS</title>
  <script>
    (function() {
      // Ambil path dan query string pemindaian QR code saat ini
      var currentPath = window.location.pathname;
      var currentSearch = window.location.search;
      var newBase = "${cleanNew}";
      
      // Jika scan menggunakan format /scan?code=... atau /q/...
      var targetUrl = newBase + currentPath + currentSearch;
      
      // Lakukan redirect otomatis seketika
      window.location.replace(targetUrl);
    })();
  </script>
</head>
<body style="font-family: sans-serif; text-align: center; padding: 40px; color: #1e293b;">
  <h3>Mengalihkan ke Sistem Sarpras...</h3>
  <p>Alamat sistem inventaris telah diperbarui. Mohon tunggu sejenak, halaman barang akan terbuka otomatis.</p>
</body>
</html>`;

  return {
    oldDomain: cleanOld,
    newDomain: cleanNew,
    oldHost,
    newHost,
    nginxSnippet,
    apacheSnippet,
    cloudflareRule,
    htmlRedirectScript,
  };
}
