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
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f2eb] p-8 text-center">
          <h2 className="text-xl font-bold text-stone-900">应用出现异常</h2>
          <p className="max-w-md text-sm text-stone-500">{this.state.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-stone-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
