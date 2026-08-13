import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { formatImageAspectRatio } from "../lib/image";
import type { UploadedImageMeta } from "../types";

interface ImageUploaderProps {
  label: string;
  sublabel?: string;
  image: string | null;
  metadata: UploadedImageMeta | null;
  isProcessing: boolean;
  error: string | null;
  isDragActive: boolean;
  getRootProps: any;
  getInputProps: any;
  onClear: () => void;
  compact?: boolean;
  primary?: boolean;
  overlay?: ReactNode;
}

export function ImageUploader({
  label,
  sublabel,
  image,
  metadata,
  isProcessing,
  error,
  isDragActive,
  getRootProps,
  getInputProps,
  onClear,
  compact = false,
  primary = false,
  overlay,
}: ImageUploaderProps) {
  if (image) {
    return (
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900",
          !metadata && "aspect-[16/10]",
          compact && "h-24 aspect-auto lg:h-24 lg:aspect-auto",
          primary && "desktop-primary-image"
        )}
        style={
          metadata && !compact
            ? { aspectRatio: formatImageAspectRatio(metadata) }
            : undefined
        }
      >
        <img
          src={image}
          alt={label}
          className="h-full w-full object-contain"
          referrerPolicy="no-referrer"
        />
        <button
          type="button"
          onClick={onClear}
          aria-label={`移除${label}`}
          className="absolute top-3 right-3 w-8 h-8 bg-black/60 backdrop-blur-md rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-10">
          <span className="text-[11px] font-medium text-white/90">{label}</span>
          {metadata && (
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-emerald-300/90">
              <Check className="h-3 w-3" />
              {metadata.width} × {metadata.height} · 已优化
            </span>
          )}
        </div>
        {overlay}
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      aria-disabled={isProcessing}
      className={cn(
        "relative flex aspect-[16/10] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-zinc-900/50 p-6 text-center transition-all duration-300",
        compact && "h-24 aspect-auto p-3 lg:h-24 lg:aspect-auto lg:p-3",
        primary && "desktop-primary-image",
        isProcessing ? "cursor-wait border-zinc-700" : "cursor-pointer",
        error && "border-red-900/80 bg-red-950/10",
        !error && isDragActive
          ? "border-zinc-500 bg-zinc-800/50"
          : !error && "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-900"
      )}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <>
          <LoaderCircle className="mb-3 h-7 w-7 animate-spin text-zinc-300" />
          <p className="text-xs font-semibold text-zinc-300">
            正在读取并优化图片…
          </p>
        </>
      ) : (
        <>
          <div
            className={cn(
              "mb-3 flex items-center justify-center rounded-2xl",
              compact ? "h-10 w-10" : "h-14 w-14",
              error ? "bg-red-950/60" : "bg-zinc-800"
            )}
          >
            {error ? (
              <AlertCircle className="h-5 w-5 text-red-400" />
            ) : compact ? (
              <Upload className="w-4 h-4 text-zinc-500" />
            ) : (
              <ImageIcon className="w-6 h-6 text-zinc-500" />
            )}
          </div>
          <p
            className={cn(
              "mb-1 font-semibold",
              compact ? "text-xs" : "text-sm",
              error ? "text-red-300" : "text-zinc-300"
            )}
          >
            {error || label}
          </p>
          <p className={cn("text-[10px]", error ? "text-red-500/80" : "text-zinc-600")}>
            {error ? "点击重新选择" : sublabel}
          </p>
        </>
      )}
    </div>
  );
}
