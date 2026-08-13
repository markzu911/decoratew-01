import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  Download,
  Eye,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import type { GeneratedRoomView, ViewDirection } from "../types";
import { LoadingOverlay } from "./LoadingOverlay";
import { ResultModal, type ResultTab } from "./ResultModal";

interface ResultPageProps {
  views: GeneratedRoomView[];
  referenceImage?: string | null;
  isGenerating: boolean;
  masterConfirmed: boolean;
  loadingMessage: string;
  generationError: string | null;
  onConfirmMaster: () => Promise<boolean>;
  onRefinePrimary: (feedback: string) => Promise<boolean>;
  onRedesignPrimary: (requirements?: string) => Promise<boolean>;
  onGenerateDirectionalView: (
    direction: ViewDirection,
    viewRequirements: string
  ) => Promise<boolean>;
  onRefineView: (viewId: string, feedback: string) => Promise<boolean>;
  onDismissError: () => void;
  onBackToEditor: () => void;
  onRestart: () => void;
}

function getImageExtension(dataUrl: string): string {
  const mimeType = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);/)?.[1];
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export function ResultPage({
  views,
  referenceImage,
  isGenerating,
  masterConfirmed,
  loadingMessage,
  generationError,
  onConfirmMaster,
  onRefinePrimary,
  onRedesignPrimary,
  onGenerateDirectionalView,
  onRefineView,
  onDismissError,
  onBackToEditor,
  onRestart,
}: ResultPageProps) {
  const [activeViewId, setActiveViewId] = useState(views[0]?.id || "");
  const [activeTab, setActiveTab] = useState<ResultTab>("result");
  const [previewTab, setPreviewTab] = useState<ResultTab | null>(null);
  const [feedback, setFeedback] = useState("");
  const [viewDirection, setViewDirection] = useState<ViewDirection>("left");
  const [viewRequirements, setViewRequirements] = useState("");

  useEffect(() => {
    const generatingView = views.find((item) => item.status === "generating");
    if (generatingView) {
      setActiveViewId(generatingView.id);
      setActiveTab("result");
      return;
    }
    if (!views.some((item) => item.id === activeViewId)) {
      setActiveViewId(views[0]?.id || "");
    }
  }, [activeViewId, views]);

  const activeView = views.find((item) => item.id === activeViewId) || views[0];
  const primaryView = views[0];
  const isPrimary = activeView?.id === primaryView?.id;

  const tabs = useMemo(
    () => [
      {
        id: "result" as const,
        label: "效果图",
        image: activeView?.resultImage || "",
      },
      {
        id: "original" as const,
        label: isPrimary ? "毛坯原图" : "生成依据",
        image: activeView?.image || "",
      },
      ...(referenceImage
        ? [
            {
              id: "reference" as const,
              label: "参考风格图",
              image: referenceImage,
            },
          ]
        : []),
    ],
    [activeView, isPrimary, referenceImage]
  );

  if (!activeView || !primaryView) return null;

  const currentImage = tabs.find((item) => item.id === activeTab)?.image || "";
  const activeIsGenerating =
    activeView.status === "generating" && activeTab === "result";

  const handleDownload = () => {
    if (!activeView.resultImage) return;
    const link = document.createElement("a");
    link.href = activeView.resultImage;
    link.download = `ai-renovation-${activeView.label}-${Date.now()}.${getImageExtension(activeView.resultImage)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleRefine = async () => {
    if (!feedback.trim()) return;
    const succeeded = isPrimary
      ? await onRefinePrimary(feedback.trim())
      : await onRefineView(activeView.id, feedback.trim());
    if (succeeded) setFeedback("");
  };

  const handleDirectionalGeneration = async () => {
    const succeeded = await onGenerateDirectionalView(
      viewDirection,
      viewRequirements.trim()
    );
    if (succeeded) setViewRequirements("");
  };

  return (
    <main className="desktop-result-page mx-auto w-full max-w-[1500px] flex-1 px-4 pb-6 sm:px-6">
      <div className="desktop-result-frame flex h-full min-h-[720px] flex-col overflow-hidden rounded-[28px] border border-zinc-800/90 bg-[#101211] shadow-2xl shadow-black/40">
        <header className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#d9ff57]/20 bg-[#d9ff57]/10 text-[#d9ff57]">
              {isGenerating ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-zinc-100 sm:text-lg">
                  空间设计工作台
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-semibold",
                    masterConfirmed
                      ? "bg-emerald-400/10 text-emerald-300"
                      : "bg-amber-400/10 text-amber-300"
                  )}
                >
                  {masterConfirmed ? "主方案已确认" : "等待确认主方案"}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {views.length === 1 ? "先调整并确认第一张结果" : `已生成 ${views.length - 1} 个新视角`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBackToEditor}
              disabled={isGenerating}
              className="flex h-9 items-center gap-2 rounded-xl border border-zinc-800 px-3 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-900 hover:text-white disabled:cursor-wait"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回需求
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={!activeView.resultImage}
              className="flex h-9 items-center gap-2 rounded-xl bg-zinc-100 px-3 text-[11px] font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </button>
          </div>
        </header>

        {generationError && (
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/35 px-4 py-2.5 text-xs text-red-300 sm:mx-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{generationError}</span>
            <button onClick={onDismissError} className="font-semibold text-red-400">
              关闭
            </button>
          </div>
        )}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-0 min-w-0 flex-col border-b border-zinc-800 lg:border-r lg:border-b-0">
            <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-800 px-4 py-3 sm:px-6">
              {views.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveViewId(item.id);
                    setActiveTab("result");
                    setFeedback("");
                  }}
                  className={cn(
                    "group flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition",
                    item.id === activeView.id
                      ? "border-zinc-600 bg-zinc-800 text-white"
                      : "border-transparent bg-zinc-900/60 text-zinc-500 hover:border-zinc-800 hover:text-zinc-200"
                  )}
                >
                  <span className="relative h-9 w-12 overflow-hidden rounded-lg bg-black">
                    <img
                      src={item.resultImage || item.image}
                      alt={item.label}
                      className="h-full w-full object-contain"
                    />
                    {item.status === "generating" && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/65">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-white" />
                      </span>
                    )}
                  </span>
                  <span>
                    <span className="block text-[10px] font-semibold">
                      {index === 0 ? "主方案" : item.label}
                    </span>
                    <span
                      className={cn(
                        "block text-[8px]",
                        item.status === "complete"
                          ? "text-emerald-400"
                          : item.status === "error"
                            ? "text-red-400"
                            : "text-zinc-600"
                      )}
                    >
                      {item.status === "complete"
                        ? "已完成"
                        : item.status === "error"
                          ? "生成失败"
                          : "生成中"}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 border-b border-zinc-800 px-4 py-2 sm:px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[10px] font-semibold transition",
                    activeTab === tab.id
                      ? "bg-zinc-100 text-zinc-950"
                      : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="desktop-result-image relative flex min-h-[430px] flex-1 items-center justify-center bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035),transparent_58%)] p-4 sm:p-6">
              {currentImage ? (
                <button
                  type="button"
                  onClick={() => !activeIsGenerating && setPreviewTab(activeTab)}
                  disabled={activeIsGenerating}
                  className="group relative flex h-full w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-2xl bg-black/25 p-3 outline-none ring-[#d9ff57]/30 focus-visible:ring-2 disabled:cursor-wait"
                >
                  <img
                    src={currentImage}
                    alt={tabs.find((tab) => tab.id === activeTab)?.label}
                    className="max-h-[70vh] max-w-full object-contain shadow-2xl shadow-black/60 transition duration-500 group-hover:scale-[1.006]"
                  />
                  {!activeIsGenerating && (
                    <span className="absolute right-4 bottom-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-[9px] font-semibold text-white/80 backdrop-blur-md">
                      <Eye className="h-3.5 w-3.5" />
                      完整查看
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex flex-col items-center text-center">
                  {activeView.status === "error" ? (
                    <AlertCircle className="h-8 w-8 text-red-400" />
                  ) : (
                    <LoaderCircle className="h-8 w-8 animate-spin text-zinc-500" />
                  )}
                  <p className="mt-3 text-xs font-semibold text-zinc-300">
                    {activeView.error || "正在生成当前视角"}
                  </p>
                </div>
              )}
              {activeIsGenerating && <LoadingOverlay message={loadingMessage} />}
            </div>
          </section>

          <aside className="custom-scrollbar min-h-0 overflow-y-auto bg-zinc-950/30 p-4 sm:p-5">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#d9ff57]" />
                <div>
                  <h2 className="text-xs font-semibold text-zinc-200">
                    {isPrimary ? "调整主方案" : `调整${activeView.label}`}
                  </h2>
                  <p className="mt-0.5 text-[9px] text-zinc-600">
                    只描述本轮需要改变的内容
                  </p>
                </div>
              </div>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                maxLength={800}
                placeholder={isPrimary ? "例如：只把沙发换成浅灰色，其他部分保持不变" : "例如：保持镜头不变，减少这个视角的装饰品"}
                className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-[#d9ff57]/40 focus:ring-2 focus:ring-[#d9ff57]/5"
              />
              <button
                type="button"
                onClick={() => setFeedback("天花板仍有毛坯或未完成区域。保持天花板高度、边界和结构不变，将所有可见天花板完整处理为与当前方案一致的装修完成面。")}
                className="mt-2 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-[9px] font-semibold text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-200"
              >
                天花板未完成
              </button>
              <button
                type="button"
                onClick={() => void handleRefine()}
                disabled={!feedback.trim() || isGenerating}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 text-[11px] font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-600"
              >
                {isGenerating ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                根据反馈调整
              </button>

              {isPrimary && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void onRedesignPrimary(feedback.trim() || undefined)}
                    disabled={isGenerating}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-zinc-800 text-[10px] font-semibold text-zinc-400 transition hover:bg-zinc-900 hover:text-white disabled:cursor-wait"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重新设计
                  </button>
                  <button
                    type="button"
                    onClick={() => void onConfirmMaster()}
                    disabled={isGenerating || masterConfirmed}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#d9ff57] text-[10px] font-bold text-zinc-950 transition hover:bg-[#e4ff83] disabled:cursor-default disabled:bg-emerald-400/10 disabled:text-emerald-300"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {masterConfirmed ? "已确认" : "确认主方案"}
                  </button>
                </div>
              )}
            </section>

            {masterConfirmed && (
              <section className="mt-5 border-t border-zinc-800 pt-5">
                <div className="mb-4 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-[#d9ff57]" />
                  <div>
                    <h2 className="text-xs font-semibold text-zinc-200">查看房间其他方向</h2>
                    <p className="mt-0.5 text-[9px] text-zinc-600">根据已确认结果，生成以左侧或右侧空间为主体的新画面</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-1.5">
                  {(["left", "right"] as ViewDirection[]).map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => setViewDirection(direction)}
                      className={cn(
                        "min-h-10 rounded-lg px-3 text-[10px] font-semibold transition",
                        viewDirection === direction
                          ? "bg-zinc-100 text-zinc-950 shadow-sm"
                          : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
                      )}
                    >
                      {direction === "left" ? "查看左侧" : "查看右侧"}
                    </button>
                  ))}
                </div>

                <textarea
                  value={viewRequirements}
                  onChange={(event) => setViewRequirements(event.target.value)}
                  maxLength={500}
                  placeholder="可选：补充这个视角的要求"
                  className="mt-3 h-16 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[10px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-[#d9ff57]/40"
                />

                <button
                  type="button"
                  onClick={() => void handleDirectionalGeneration()}
                  disabled={isGenerating}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#d9ff57] text-[11px] font-bold text-zinc-950 shadow-[0_10px_30px_rgba(217,255,87,0.1)] transition hover:bg-[#e4ff83] disabled:cursor-wait disabled:bg-zinc-800 disabled:text-zinc-600"
                >
                  <Camera className="h-4 w-4" />
                  生成{viewDirection === "left" ? "左侧" : "右侧"}画面
                </button>
                <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">
                  保留主方案中的核心空间，同时展示所选侧面的新区域；元素会按新视角自然重排。
                </p>
              </section>
            )}

            <button
              type="button"
              onClick={onRestart}
              disabled={isGenerating}
              className="mt-5 flex h-9 w-full items-center justify-center gap-2 border-t border-zinc-800 pt-4 text-[10px] text-zinc-600 transition hover:text-zinc-300 disabled:cursor-wait"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              清空并重新开始
            </button>
          </aside>
        </div>
      </div>

      {previewTab && activeView.resultImage && (
        <ResultModal
          resultImage={activeView.resultImage}
          originalImage={activeView.image}
          referenceImage={referenceImage}
          imageMetadata={activeView.metadata}
          initialTab={previewTab}
          onClose={() => setPreviewTab(null)}
        />
      )}
    </main>
  );
}
