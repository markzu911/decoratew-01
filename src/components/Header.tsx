import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="desktop-header mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between px-6 py-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-zinc-900" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-100">
            AI 装修大师
          </h1>
          <p className="text-[10px] text-zinc-500 tracking-wider uppercase">
            毛坯变精装
          </p>
        </div>
      </div>
      <div className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
        Nano Banana 2
      </div>
    </header>
  );
}
