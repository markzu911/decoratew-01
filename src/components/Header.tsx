import { Sparkles } from "lucide-react";

export function Header() {
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
      <div className="text-[10px] font-bold tracking-[0.2em] text-stone-400 uppercase">
        Nano Banana 2
      </div>
    </header>
  );
}
