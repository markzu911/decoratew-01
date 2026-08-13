import { Sparkles } from "lucide-react";

interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-white/88 backdrop-blur-md">
      <div className="relative mb-6">
        <div className="h-16 w-16 animate-spin rounded-full border-2 border-stone-200 border-t-lime-600" />
        <Sparkles className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse text-lime-700" />
      </div>
      <h3 className="mb-2 text-lg font-bold text-stone-900">{message}</h3>
      <p className="animate-pulse text-xs text-stone-500">
        预计需要 30-60 秒，请耐心等待...
      </p>
    </div>
  );
}
