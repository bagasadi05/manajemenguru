import React from 'react';
import { AlertTriangleIcon } from './Icons';
import { Button } from './ui/Button';

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-950 text-center p-8">
          <div className="max-w-md w-full">
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-orange-200 dark:from-red-900/50 dark:to-orange-900/70 rounded-full flex items-center justify-center">
                    <AlertTriangleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Oops! Terjadi Kesalahan.</h1>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              Kami menemukan galat yang tidak terduga. Silakan coba muat ulang halaman. Jika masalah berlanjut, hubungi dukungan.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-8 bg-gradient-to-r from-red-600 to-orange-500 hover:shadow-lg hover:shadow-red-500/40 text-white font-semibold transition-all duration-300 hover:-translate-y-0.5"
            >
              Muat Ulang Halaman
            </Button>
            {this.state.error && (
              <details className="mt-6 text-left bg-gray-200 dark:bg-gray-800 p-4 rounded-lg">
                <summary className="cursor-pointer font-semibold">Detail Error</summary>
                <pre className="mt-2 text-sm whitespace-pre-wrap">
                  {this.state.error.toString()}
                  <br />
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
