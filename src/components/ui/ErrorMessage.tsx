import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Terjadi Kesalahan',
  message,
  onRetry,
}) => {
  return (
    <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/70 text-rose-800 flex items-start gap-3 my-4">
      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1">
        <h5 className="text-sm font-semibold text-rose-900">{title}</h5>
        <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="shrink-0 bg-white border-rose-200 text-rose-800 hover:bg-rose-100"
        >
          Coba Lagi
        </Button>
      )}
    </div>
  );
};
