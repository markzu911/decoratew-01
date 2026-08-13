import { Coins, LoaderCircle, Sparkles } from "lucide-react";

interface HeaderProps {
  integral: number | null;
  integralLoading?: boolean;
  userName?: string;
}

export function Header({ integral, integralLoading = false, userName }: HeaderProps) {
  return (
    <header className="desktop-header mx-auto flex w-full max-w-[1500px] shrink-0 items-center justify-between px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#d8f542] text-[#263000] shadow-[0_8px_24px_rgba(143,170,25,0.2)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-stone-950">
            AI 装修大师
          </h1>
          <p className="text-[10px] font-medium tracking-[0.08em] text-stone-500">
            毛坯变精装
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-[9px] font-medium text-stone-400">
            {userName || "当前账户"}
          </p>
          <p className="text-[8px] tracking-[0.16em] text-stone-300 uppercase">
            Nano Banana 2
          </p>
        </div>
        <div className="flex h-9 min-w-[92px] items-center justify-center gap-2 rounded-xl border border-lime-300/80 bg-lime-50 px-3 text-lime-800 shadow-[0_8px_22px_rgba(151,181,27,0.1)]">
          {integralLoading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Coins className="h-3.5 w-3.5" />
          )}
          <span className="text-[11px] font-bold">
            {integralLoading ? "读取中" : integral === null ? "-- 积分" : `${integral} 积分`}
          </span>
        </div>
      </div>
    </header>
  );
}
