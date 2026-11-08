import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useRealtime } from '../../context/RealtimeContext';

export interface SyncIndicatorProps {
  isFetching: boolean;
  isLoading?: boolean;
  dataUpdatedAt?: number;
  isError?: boolean;
  onRefresh?: () => void;
  className?: string;
  autoRefreshIntervalSeconds?: number;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  isFetching,
  isLoading = false,
  dataUpdatedAt,
  isError = false,
  onRefresh,
  className,
}) => {
  let realtimeStatus: 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';
  try {
    const realtime = useRealtime();
    if (realtime) {
      realtimeStatus = realtime.status;
    }
  } catch {
    // Graceful fallback jika dirender di luar RealtimeProvider
  }

  // Format timestamp dataUpdatedAt to HH:mm:ss
  const formattedTime = React.useMemo(() => {
    if (!dataUpdatedAt) return null;
    const date = new Date(dataUpdatedAt);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }, [dataUpdatedAt]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors select-none',
        isError
          ? 'bg-amber-50/90 text-amber-800 border-amber-200'
          : isFetching && !isLoading
          ? 'bg-blue-50/90 text-blue-800 border-blue-200 animate-pulse'
          : realtimeStatus === 'RECONNECTING'
          ? 'bg-amber-50/90 text-amber-800 border-amber-200'
          : realtimeStatus === 'CONNECTED'
          ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200'
          : 'bg-slate-50/90 text-slate-600 border-slate-200 hover:bg-slate-100',
        className
      )}
      title={
        realtimeStatus === 'CONNECTED'
          ? 'Sinkronisasi real-time aktif (Server-Sent Events).'
          : realtimeStatus === 'RECONNECTING'
          ? 'Mencoba menyambungkan kembali ke stream real-time...'
          : 'Sinkronisasi data SIMSARPRAS.'
      }
    >
      {isFetching && !isLoading ? (
        <>
          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin shrink-0" />
          <span>Memperbarui data...</span>
        </>
      ) : isError ? (
        <>
          <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Sinkronisasi terganggu</span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-amber-700 underline hover:text-amber-900 ml-0.5 cursor-pointer"
              title="Coba sinkronisasi manual sekarang"
            >
              Coba lagi
            </button>
          )}
        </>
      ) : realtimeStatus === 'RECONNECTING' ? (
        <>
          <RefreshCw className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
          <span>Menyambungkan kembali...</span>
        </>
      ) : (
        <>
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              realtimeStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'
            )}
          />
          <span>
            {formattedTime
              ? realtimeStatus === 'CONNECTED'
                ? `Real-Time • ${formattedTime}`
                : `Terakhir diperbarui: ${formattedTime}`
              : realtimeStatus === 'CONNECTED'
              ? 'Terhubung'
              : 'Data tersinkron'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Segarkan data manual sekarang"
              className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors ml-0.5 cursor-pointer"
              title="Segarkan data sekarang"
            >
              <RefreshCw className="w-2.5 h-2.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
};
