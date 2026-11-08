/**
 * Modul Konfigurasi Query SIMSARPRAS
 * Mengutamakan sinkronisasi real-time berbasis event (Server-Sent Events / SSE)
 * tanpa polling berkala 5 detik, sehingga menghemat konsumsi jaringan dan sumber daya server.
 */

export const AUTO_REFRESH_INTERVAL = false;

export interface AutoRefreshOptionsConfig {
  enabled?: boolean;
  interval?: number | false;
}

export interface AutoRefreshOptions {
  refetchInterval: number | false;
  refetchIntervalInBackground: boolean;
  refetchOnWindowFocus: boolean;
  staleTime: number;
  retry: number;
}

/**
 * Menghasilkan opsi TanStack React Query terstandarisasi untuk halaman-halaman operasional.
 * Polling 5 detik dinonaktifkan secara default (refetchInterval: false).
 * Data diperbarui secara instan melalui sinyal SSE saat mutasi terjadi.
 */
export function getAutoRefreshOptions(config: AutoRefreshOptionsConfig = {}): AutoRefreshOptions {
  const { enabled = false, interval = false } = config;

  return {
    refetchInterval: enabled && interval ? interval : false, // Nonaktifkan polling 5 detik berkala
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // Ambil data terbaru seketika saat user kembali membuka tab browser
    staleTime: 1000 * 60 * 2, // 2 menit
    retry: 2,
  };
}
