import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SIMSARPRAS UI Crash]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[350px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 shadow-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {this.props.fallbackTitle || 'Halaman Mengalami Kendala'}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {this.state.error?.message ||
                  'Terjadi kendala saat merender komponen tampilan. Silakan muat ulang halaman.'}
              </p>
            </div>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                leftIcon={<RotateCcw className="w-4 h-4" />}
                className="bg-blue-800 hover:bg-blue-900"
              >
                Muat Ulang Halaman
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
