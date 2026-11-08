import { Response } from 'express';

export type RealtimeEventType =
  | 'loan.created'
  | 'loan.approved'
  | 'loan.rejected'
  | 'loan.returned'
  | 'asset.updated'
  | 'asset.availability_changed'
  | 'connected'
  | 'heartbeat';

export interface SSEClient {
  id: string;
  res: Response;
  userId?: string;
  role?: string;
  connectedAt: number;
}

export interface RealtimeEventPayload {
  [key: string]: any;
}

/**
 * Pengelola Koneksi Server-Sent Events (SSE) Terpusat SIMSARPRAS
 * Menyiarkan notifikasi perubahan data secara instan ke seluruh browser/klien aktif.
 * Karakteristik Keamanan & Kestabilan:
 * - Event dikirim HANYA setelah transaksi database berhasil di-COMMIT
 * - Payload event berupa sinyal ringkas (tidak membocorkan data pribadi pengguna)
 * - Pembersihan koneksi otomatis saat klien menutup tab browser
 * - Heartbeat keep-alive berkala untuk mencegah pemutusan oleh proxy/firewall
 */
export class SSEManager {
  private static instance: SSEManager;
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  /**
   * Mendaftarkan koneksi klien baru ke kanal stream SSE
   */
  public addClient(client: SSEClient): void {
    const { id, res, role } = client;

    // Set header standar SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Nonaktifkan buffering pada NGINX reverse-proxy
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    this.clients.set(id, client);

    // Kirim event sambutan awal
    const welcomeData = JSON.stringify({
      status: 'CONNECTED',
      clientId: id,
      serverTime: new Date().toISOString(),
      role: role || 'GUEST',
    });
    res.write(`event: connected\ndata: ${welcomeData}\n\n`);

    // Deteksi pemutusan koneksi klien (misal tutup tab atau refresh)
    res.on('close', () => {
      this.removeClient(id);
    });
  }

  /**
   * Menghapus klien yang telah terputus
   */
  public removeClient(id: string): void {
    if (this.clients.has(id)) {
      this.clients.delete(id);
    }
  }

  /**
   * Menyiarkan event perubahan data ke semua klien yang terhubung
   * Wajib dipanggil HANYA setelah transaksi database di-COMMIT secara sukses
   */
  public broadcast(
    eventType: RealtimeEventType,
    payload: RealtimeEventPayload = {},
    options?: { targetRoles?: string[]; targetUserId?: string }
  ): void {
    const eventMessage = JSON.stringify({
      ...payload,
      type: eventType,
      timestamp: new Date().toISOString(),
    });

    const sseFormatted = `event: ${eventType}\ndata: ${eventMessage}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      // Filter role jika spesifik ditargetkan
      if (options?.targetRoles && options.targetRoles.length > 0) {
        if (!client.role || !options.targetRoles.includes(client.role)) {
          continue;
        }
      }

      // Filter user spesifik jika ditargetkan
      if (options?.targetUserId) {
        if (client.userId !== options.targetUserId) {
          continue;
        }
      }

      try {
        client.res.write(sseFormatted);
      } catch (err) {
        console.error(`[SSE Broadcast Error] Gagal mengirim ke client ${id}:`, err);
        this.removeClient(id);
      }
    }
  }

  /**
   * Mengirim heartbeat / komentar keep-alive setiap 20 detik
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      for (const [id, client] of this.clients.entries()) {
        try {
          client.res.write(`: keep-alive ${Date.now()}\n\n`);
        } catch {
          this.removeClient(id);
        }
      }
    }, 20000);

    // Jangan tahan proses node agar tidak mencegah exit saat testing
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Jumlah klien aktif yang terhubung saat ini
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Bersihkan semua koneksi (untuk testing/reset)
   */
  public reset(): void {
    for (const client of this.clients.values()) {
      try {
        client.res.end();
      } catch {}
    }
    this.clients.clear();
  }
}

export const sseManager = SSEManager.getInstance();
