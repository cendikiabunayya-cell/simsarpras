import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { getStoredToken } from '../services/api';

export type RealtimeStatus = 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

export interface RealtimeContextType {
  status: RealtimeStatus;
  lastEvent: { type: string; timestamp: string } | null;
  reconnect: () => void;
  isRealtimeActive: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({
  status: 'DISCONNECTED',
  lastEvent: null,
  reconnect: () => {},
  isRealtimeActive: false,
});

export const useRealtime = () => useContext(RealtimeContext);

interface RealtimeProviderProps {
  children: React.ReactNode;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children }) => {
  const { isAuthenticated, isMock } = useAuth();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<RealtimeStatus>('DISCONNECTED');
  const [lastEvent, setLastEvent] = useState<{ type: string; timestamp: string } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInvalidationKeys = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Menggabungkan (debounce) permintaan invalidasi query jika beberapa event
   * tiba berdekatan (misal: loan.created dan asset.availability_changed),
   * sehingga mencegah query spamming ke server.
   */
  const scheduleDebouncedInvalidation = useCallback((keys: string[][]) => {
    keys.forEach((keyArray) => {
      pendingInvalidationKeys.current.add(JSON.stringify(keyArray));
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      pendingInvalidationKeys.current.forEach((serializedKey) => {
        try {
          const key = JSON.parse(serializedKey);
          queryClient.invalidateQueries({ queryKey: key });
        } catch (err) {
          console.error('[Realtime Invalidation Error]:', err);
        }
      });
      pendingInvalidationKeys.current.clear();
      debounceTimerRef.current = null;
    }, 300);
  }, [queryClient]);

  /**
   * Menangani event yang masuk dari stream SSE
   */
  const handleEvent = useCallback((eventType: string, eventData: string) => {
    let payload: any = {};
    try {
      payload = JSON.parse(eventData);
    } catch {
      payload = { raw: eventData };
    }

    setLastEvent({
      type: eventType,
      timestamp: payload.timestamp || new Date().toISOString(),
    });

    switch (eventType) {
      case 'loan.created':
      case 'loan.approved':
      case 'loan.rejected':
        scheduleDebouncedInvalidation([
          ['loans'],
          ['loan-requests'],
          ['dashboard-metrics'],
          ['assets'], // Ketersediaan aset ikut berubah saat disetujui
        ]);
        break;

      case 'loan.returned':
        scheduleDebouncedInvalidation([
          ['loans'],
          ['loan-requests'],
          ['dashboard-metrics'],
          ['assets'], // Status ketersediaan aset pulih kembali
        ]);
        break;

      case 'asset.updated':
        scheduleDebouncedInvalidation([
          ['assets'],
          ['dashboard-metrics'],
        ]);
        break;

      case 'asset.availability_changed':
        scheduleDebouncedInvalidation([
          ['assets'],
          ['loans'],
          ['dashboard-metrics'],
        ]);
        break;

      case 'connected':
        setStatus('CONNECTED');
        // Sinkronisasi ulang data seketika saat berhasil terhubung kembali
        // untuk memastikan tidak ada perubahan yang terlewat selama offline
        queryClient.invalidateQueries();
        break;

      default:
        break;
    }
  }, [scheduleDebouncedInvalidation, queryClient]);

  /**
   * Menginisialisasi koneksi EventSource ke server backend
   */
  const connectSSE = useCallback(() => {
    // Jangan sambungkan jika dalam mode mock simulasi lokal tanpa backend
    if (isMock) {
      setStatus('DISCONNECTED');
      return;
    }

    // Bersihkan koneksi dan timer sebelumnya jika ada
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Token otentikasi wajib ada
    const token = getStoredToken();
    if (!token && !isAuthenticated) {
      setStatus('DISCONNECTED');
      return;
    }

    const rawApiBase = import.meta.env.VITE_API_BASE_URL || '';
    const apiBase =
      typeof window !== 'undefined' &&
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
        ? rawApiBase.replace(/localhost|127\.0\.0\.1/, window.location.hostname)
        : rawApiBase;
    const sseUrl = `${apiBase}/api/v1/realtime/events?token=${encodeURIComponent(token || '')}`;

    try {
      setStatus('RECONNECTING');
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('CONNECTED');
        // Saat koneksi pulih, sinkronkan ulang data dari API agar perubahan yang terlewat tidak hilang
        scheduleDebouncedInvalidation([
          ['loans'],
          ['loan-requests'],
          ['assets'],
          ['dashboard-metrics'],
        ]);
      };

      es.onerror = () => {
        // EventSource browser secara native akan mencoba reconnecting.
        // Kita perbarui status visual di UI.
        setStatus('RECONNECTING');
      };

      // Daftarkan listener untuk masing-masing event spesifik SIMSARPRAS
      const supportedEvents = [
        'connected',
        'loan.created',
        'loan.approved',
        'loan.rejected',
        'loan.returned',
        'asset.updated',
        'asset.availability_changed',
      ];

      supportedEvents.forEach((evtName) => {
        es.addEventListener(evtName, (event: MessageEvent) => {
          handleEvent(evtName, event.data);
        });
      });
    } catch (err) {
      console.error('[Realtime SSE Connection Error]:', err);
      setStatus('DISCONNECTED');
    }
  }, [isAuthenticated, isMock, handleEvent, scheduleDebouncedInvalidation]);

  // Efek utama pemeliharaan koneksi
  useEffect(() => {
    if (isAuthenticated && !isMock) {
      connectSSE();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('DISCONNECTED');
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [isAuthenticated, isMock, connectSSE]);

  const reconnect = useCallback(() => {
    connectSSE();
  }, [connectSSE]);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        lastEvent,
        reconnect,
        isRealtimeActive: status === 'CONNECTED',
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};
