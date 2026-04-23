"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-4 text-sm text-red-400 mb-3">
          <div className="flex items-center gap-2 mb-1 font-medium">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Something went wrong
          </div>
          <p className="text-xs text-red-400/70">{this.state.error?.message ?? "An unexpected error occurred."}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
