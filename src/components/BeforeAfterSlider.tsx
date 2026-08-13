import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MoveHorizontal } from "lucide-react";
import { cn } from "../lib/utils";

interface BeforeAfterSliderProps {
  /** 底层图（毛坯原图） */
  beforeImage: string;
  /** 顶层图（效果图），左侧露出 */
  afterImage: string;
  /** 是否禁用交互（如仍在生成中） */
  disabled?: boolean;
  /** 外层样式（用于与 ResultModal 的 fittedSize 缩放尺寸对齐） */
  style?: CSSProperties;
  alt?: string;
  /** 图片加载完成回调，上报自然尺寸（用于外层做适配计算） */
  onImageLoad?: (naturalWidth: number, naturalHeight: number) => void;
}

const KEY_STEP = 0.04;

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  disabled = false,
  style,
  alt = "装修前后对比",
  onImageLoad,
}: BeforeAfterSliderProps) {
  // 0~1，表示 effect 图露出宽度的比例
  const [position, setPosition] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  // 键盘操作时临时高亮提示
  const [keyboardFocus, setKeyboardFocus] = useState(false);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container || disabled) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = (clientX - rect.left) / rect.width;
      setPosition(Math.min(1, Math.max(0, ratio)));
    },
    [disabled]
  );

  const handlePointerDown = useCallback(
    (clientX: number) => {
      if (disabled) return;
      handlePointerMove(clientX);
    },
    [disabled, handlePointerMove]
  );

  const offsetPct = position * 100;
  // 顶图通过 clip-path 只露出左侧部分，clip 只作用于图片本身
  const afterClipStyle: CSSProperties = {
    clipPath: `inset(0 ${100 - offsetPct}% 0 0)`,
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-lg select-none"
      style={style}
      aria-label={alt}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      role="slider"
      aria-orientation="horizontal"
    >
      {/* 底层：毛坯原图 */}
      <img
        src={beforeImage}
        alt={`${alt} - 毛坯`}
        className="absolute inset-0 h-full w-full object-contain"
        draggable={false}
        referrerPolicy="no-referrer"
        onLoad={(event) => {
          onImageLoad?.(
            event.currentTarget.naturalWidth,
            event.currentTarget.naturalHeight
          );
        }}
      />

      {/* 顶层：效果图（左侧露出） */}
      <img
        src={afterImage}
        alt={`${alt} - 效果`}
        className="absolute inset-0 h-full w-full object-contain"
        style={afterClipStyle}
        draggable={false}
        referrerPolicy="no-referrer"
      />

      {/* 分隔线 */}
      <div
        className="absolute inset-y-0 z-10 w-px bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.6)]"
        style={{ left: `${offsetPct}%`, transform: "translateX(-50%)" }}
      >
        {/* 拖动手柄 */}
        <button
          type="button"
          role="presentation"
          tabIndex={disabled ? -1 : 0}
          aria-label="拖动查看装修前后对比"
          disabled={disabled}
          className={cn(
            "absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border border-white/50 bg-zinc-900/90 text-white shadow-lg backdrop-blur-sm transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait",
            keyboardFocus && "scale-105 ring-2 ring-white/70"
          )}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            handlePointerDown(event.clientX);
          }}
          onPointerMove={(event) => handlePointerMove(event.clientX)}
          onPointerUp={() => setKeyboardFocus(false)}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              setPosition((value) => Math.max(0, value - KEY_STEP));
              setKeyboardFocus(true);
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              setPosition((value) => Math.min(1, value + KEY_STEP));
              setKeyboardFocus(true);
            } else if (event.key === "Home") {
              event.preventDefault();
              setPosition(0);
              setKeyboardFocus(true);
            } else if (event.key === "End") {
              event.preventDefault();
              setPosition(1);
              setKeyboardFocus(true);
            }
          }}
        >
          <MoveHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* 左右标签 */}
      <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur-sm">
        效果图
      </span>
      <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur-sm">
        毛坯
      </span>
    </div>
  );
}
