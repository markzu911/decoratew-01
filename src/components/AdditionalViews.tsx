import { Camera, LoaderCircle, Plus, X } from "lucide-react";
import type { RoomViewInput } from "../types";

interface AdditionalViewsProps {
  views: RoomViewInput[];
  isProcessing: boolean;
  error: string | null;
  disabled?: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (viewId: string) => void;
}

const MAX_ADDITIONAL_VIEWS = 3;

export function AdditionalViews({
  views,
  isProcessing,
  error,
  disabled = false,
  onAdd,
  onRemove,
}: AdditionalViewsProps) {
  const canAdd = views.length < MAX_ADDITIONAL_VIEWS && !disabled;

  return (
    <section className="desktop-additional-views rounded-2xl border border-stone-200 bg-white p-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Camera className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <p className="truncate text-[11px] font-semibold text-stone-700">
            其他毛坯视角
          </p>
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[9px] text-stone-500">
            可选 · 最多3张
          </span>
        </div>
        <span className="text-[9px] text-stone-400">主视角驱动一致设计</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {views.map((view, index) => (
          <div
            key={view.id}
            className="group relative h-[74px] w-[112px] shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
          >
            <img
              src={view.image}
              alt={view.label}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[9px] font-semibold text-white/85">
              视角 {index + 2}
            </div>
            <button
              type="button"
              onClick={() => onRemove(view.id)}
              disabled={disabled}
              aria-label={`移除${view.label}`}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-lg bg-black/70 text-white/70 transition hover:bg-black hover:text-white disabled:cursor-wait"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {canAdd && (
          <label className="flex h-[74px] w-[112px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-stone-300 bg-stone-50 text-stone-500 transition hover:border-lime-500 hover:bg-lime-50 hover:text-stone-800">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files || []) as File[];
                if (files.length) onAdd(files);
                event.target.value = "";
              }}
            />
            {isProcessing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="text-[9px] font-semibold">
              {isProcessing ? "处理中" : "添加视角"}
            </span>
          </label>
        )}
      </div>

      {error && <p className="mt-2 text-[10px] text-red-600">{error}</p>}
    </section>
  );
}
