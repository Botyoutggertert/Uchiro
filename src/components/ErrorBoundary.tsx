import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      } else {
        this.setState({ hasError: false, error: null, errorInfo: null });
      }
    } catch {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0B0E] text-[#e2e2ec] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#14161D] border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold font-headline text-white uppercase tracking-wider">
              កំហុសប្រព័ន្ធ (Application Notice)
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed font-sans">
              កម្មវិធីបានជួបប្រទះបញ្ហាបន្តិចបន្តួច។ សូមចុចប៊ូតុងខាងក្រោមដើម្បីផ្ទុកទំព័រឡើងវិញ។
            </p>
            {this.state.error && (
              <div className="bg-[#0A0B0E] border border-white/10 rounded-xl p-3 text-left overflow-x-auto text-xs text-red-300 font-mono">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-xl bg-[#ffb230] text-[#291800] font-headline font-bold text-sm uppercase flex items-center gap-2 hover:bg-[#ffa81e] transition-all cursor-pointer shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ផ្ទុកឡើងវិញ (Reload)</span>
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-headline text-sm uppercase flex items-center gap-2 hover:bg-white/15 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>សាកល្បងម្ដងទៀត</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
