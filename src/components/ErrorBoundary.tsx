import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare state: Readonly<ErrorBoundaryState>;
  declare props: Readonly<ErrorBoundaryProps>;
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-bold text-zinc-100">应用出现异常</h2>
          <p className="text-sm text-zinc-500 max-w-md">{this.state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white text-zinc-900 rounded-xl font-semibold text-sm hover:bg-zinc-200 transition-colors"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
