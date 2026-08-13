import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "../lib/utils";
import { formatImageAspectRatio } from "../lib/image";
import type { UploadedImageMeta } from "../types";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export type ResultTab = "result" | "original" | "reference";

interface ResultModalProps {
  resultImage: string;
  originalImage: string;
  referenceImage?: string | null;
  imageMetadata: UploadedImageMeta;
  initialTab?: ResultTab;
  onClose: () => void;
}

interface ImageSize {
  width: number;
  height: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function ResultModal({
  resultImage,
  originalImage,
  referenceImage,
  imageMetadata,
  initialTab = "result",
  onClose,
}: ResultModalProps) {
  const [tab, setTab] = useState<ResultTab>(initialTab);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null);
  const [stageSize, setStageSize] = useState<ImageSize>({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(
    () => [
      { id: "result" as const, label: "效果图", image: resultImage, show: true },
      { id: "original" as const, label: "毛坯原图", image: originalImage, show: true },
      {
        id: "reference" as const,
        label: "参考风格图",
        image: referenceImage || "",
        show: !!referenceImage,
      },
    ],
    [originalImage, referenceImage, resultImage]
  );

  const currentImage =
    tabs.find((item) => item.id === tab && item.show)?.image || resultImage;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") {
        setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
      }
      if (event.key === "-") {
        setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
      }
      if (event.key === "0") setZoom(MIN_ZOOM);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateStageSize = () => {
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    };

    updateStageSize();
    const observer = new ResizeObserver(updateStageSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setZoom(MIN_ZOOM);
    setNaturalSize(null);
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, [tab]);

  const fittedSize = useMemo(() => {
    if (!naturalSize || stageSize.width === 0 || stageSize.height === 0) {
      return null;
    }

    const horizontalPadding = stageSize.width < 640 ? 24 : 64;
    const verticalPadding = stageSize.height < 640 ? 24 : 64;
    const availableWidth = Math.max(1, stageSize.width - horizontalPadding);
    const availableHeight = Math.max(1, stageSize.height - verticalPadding);
    const fitScale = Math.min(
      availableWidth / naturalSize.width,
      availableHeight / naturalSize.height
    );

    return {
      width: Math.round(naturalSize.width * fitScale * zoom),
      height: Math.round(naturalSize.height * fitScale * zoom),
    };
  }, [naturalSize, stageSize, zoom]);

  const changeTab = (nextTab: ResultTab) => {
    setTab(nextTab);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-2 backdrop-blur-lg sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="图片完整预览"
    >
      <div className="flex h-[calc(100vh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black sm:h-[calc(100vh-2.5rem)] sm:rounded-3xl">
        <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-3 sm:flex-nowrap sm:px-5">
          <div className="order-2 flex w-full min-w-0 gap-1 overflow-x-auto sm:order-1 sm:w-auto sm:flex-1">
            {tabs.filter((item) => item.show).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeTab(item.id)}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:px-4",
                  tab === item.id
                    ? "bg-white text-zinc-950"
                    : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="order-1 ml-auto flex shrink-0 items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1 sm:order-2 sm:ml-0">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
              disabled={zoom <= MIN_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
              aria-label="缩小图片"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(MIN_ZOOM)}
              className="flex h-8 min-w-14 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold tabular-nums text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              title="恢复完整显示"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
              disabled={zoom >= MAX_ZOOM}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
              aria-label="放大图片"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="order-1 ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white sm:order-3"
            aria-label="关闭图片预览"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div
          ref={stageRef}
          className="custom-scrollbar relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.055),transparent_42%)]"
        >
          <div
            className="flex items-center justify-center p-3 sm:p-8"
            style={{
              minWidth: "100%",
              minHeight: "100%",
              width: fittedSize && zoom > MIN_ZOOM ? fittedSize.width + 64 : "100%",
              height: fittedSize && zoom > MIN_ZOOM ? fittedSize.height + 64 : "100%",
            }}
          >
            {tab === "result" ? (
              <BeforeAfterSlider
                beforeImage={originalImage}
                afterImage={resultImage}
                alt="装修效果前后对比"
                onImageLoad={(w, h) => setNaturalSize({ width: w, height: h })}
                style={
                  fittedSize
                    ? {
                        width: fittedSize.width,
                        height: fittedSize.height,
                        maxWidth: "none",
                        borderRadius: "0.5rem",
                      }
                    : {
                        maxWidth: "calc(100vw - 3rem)",
                        minWidth: "min(90vw, 26rem)",
                        aspectRatio: formatImageAspectRatio(imageMetadata),
                        height: "auto",
                      }
                }
              />
            ) : (
              <img
                src={currentImage}
                alt={`${tabs.find((item) => item.id === tab)?.label || "图片"}完整预览`}
                className="block select-none rounded-lg shadow-2xl shadow-black/70"
                style={
                  fittedSize
                    ? { width: fittedSize.width, height: fittedSize.height, maxWidth: "none" }
                    : { maxWidth: "calc(100vw - 3rem)", maxHeight: "calc(100vh - 7rem)" }
                }
                referrerPolicy="no-referrer"
                draggable={false}
                onLoad={(event) => {
                  setNaturalSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
                onDoubleClick={() =>
                  setZoom((value) => (value === MIN_ZOOM ? 2 : MIN_ZOOM))
                }
              />
            )}
          </div>

          <div className="pointer-events-none fixed bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3 py-2 text-[10px] text-zinc-400 backdrop-blur-md sm:flex">
            <RotateCcw className="h-3 w-3" />
            双击放大或还原 · Esc 关闭
          </div>
        </div>
      </div>
    </div>
  );
}
