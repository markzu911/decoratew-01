import { cn } from "../lib/utils";
import type { DesignOption } from "../config/designOptions";

interface OptionSelectorProps<T extends string> {
  label: string;
  value: T;
  options: readonly DesignOption<T>[];
  onChange: (value: T) => void;
}

export function OptionSelector<T extends string>({
  label,
  value,
  options,
  onChange,
}: OptionSelectorProps<T>) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <fieldset className="option-selector rounded-2xl border border-stone-200 bg-white p-3.5 shadow-[0_12px_32px_rgba(47,43,35,0.04)]">
      <legend className="sr-only">{label}</legend>
      <div className="option-selector-header mb-2.5 flex items-center justify-between gap-3 px-0.5">
        <span className="text-[11px] font-semibold tracking-wide text-stone-700">
          {label}
        </span>
        {selectedOption?.description && (
          <span className="truncate text-[10px] text-stone-400">
            {selectedOption.description}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "option-selector-button rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all duration-200",
                selected
                  ? "border-stone-900 bg-stone-900 text-white shadow-[0_5px_18px_rgba(47,43,35,0.12)]"
                  : "border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300 hover:bg-white hover:text-stone-800"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
