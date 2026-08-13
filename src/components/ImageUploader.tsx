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
    // 计算图片宽高比
    const aspectRatio = metadata ? metadata.width / metadata.height : 16 / 10;
    // 判断是否是高图（高度大于宽度）
    const isTallImage = aspectRatio < 1;

    return (
      <div
        className={cn(
          "group relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-[#f4f2eb] shadow-[0_18px_45px_rgba(47,43,35,0.07)]",
          !metadata && "aspect-[16/10]",
          compact && "h-24 aspect-auto lg:h-24 lg:aspect-auto",
          primary && "desktop-primary-image",
          // 高图时移除aspect-ratio，让图片自然高度
          primary && isTallImage && "aspect-auto"
        )}
        style={
          metadata && !compact && !(primary && isTallImage)
            ? { aspectRatio: formatImageAspectRatio(metadata) }
            : undefined
        }
      >
        <img
          src={image}
          alt={label}
          className={cn(
            "w-full object-contain",
            // 高图时限制最大高度
            primary && isTallImage ? "max-h-[70vh]" : "h-full"
          )}
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
            <span className="flex shrink-0 items-center gap-1 text-[10px] text-lime-200">
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
        "relative flex aspect-[16/10] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white/70 p-6 text-center shadow-[0_18px_45px_rgba(47,43,35,0.04)] transition-all duration-300",
        compact && "h-24 aspect-auto p-3 lg:h-24 lg:aspect-auto lg:p-3",
        primary && "desktop-primary-image",
        isProcessing ? "cursor-wait border-stone-300" : "cursor-pointer",
        error && "border-red-300 bg-red-50",
        !error && isDragActive
          ? "border-lime-500 bg-lime-50"
          : !error && "border-stone-300 hover:border-lime-500 hover:bg-lime-50/40"
      )}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <>
          <LoaderCircle className="mb-3 h-7 w-7 animate-spin text-stone-600" />
          <p className="text-xs font-semibold text-stone-700">
            正在读取并优化图片…
          </p>
        </>
      ) : (
        <>
          <div
            className={cn(
              "mb-3 flex items-center justify-center rounded-2xl",
              compact ? "h-10 w-10" : "h-14 w-14",
              error ? "bg-red-100" : "bg-stone-100"
            )}
          >
            {error ? (
              <AlertCircle className="h-5 w-5 text-red-600" />
            ) : compact ? (
              <Upload className="w-4 h-4 text-stone-500" />
            ) : (
              <ImageIcon className="w-6 h-6 text-stone-500" />
            )}
          </div>
          <p
            className={cn(
              "mb-1 font-semibold",
              compact ? "text-xs" : "text-sm",
              error ? "text-red-700" : "text-stone-800"
            )}
          >
            {error || label}
          </p>
          <p className={cn("text-[10px]", error ? "text-red-600" : "text-stone-400")}>
            {error ? "点击重新选择" : sublabel}
          </p>
        </>
      )}
    </div>
  );
}
