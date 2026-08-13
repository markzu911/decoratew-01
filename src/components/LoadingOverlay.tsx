import { Sparkles } from "lucide-react";

interface LoadingOverlayProps {
  message: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-md rounded-2xl">
      <div className="relative mb-6">
        <div className="w-16 h-16 border-2 border-zinc-800 border-t-white rounded-full animate-spin" />
        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-white animate-pulse" />
      </div>
      <h3 className="text-lg font-bold text-zinc-100 mb-2">{message}</h3>
      <p className="text-zinc-500 text-xs animate-pulse">
        预计需要 30-60 秒，请耐心等待...
      </p>
    </div>
  );
}
