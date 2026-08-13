import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, Sparkles, Wand2 } from "lucide-react";
import { Header } from "./components/Header";
import { ImageUploader } from "./components/ImageUploader";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { ResultPage } from "./components/ResultPage";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OptionSelector } from "./components/OptionSelector";
import { useImageUpload } from "./hooks/useImageUpload";
import {
  type MultiViewGenerationConfig,
  useMultiViewGeneration,
} from "./hooks/useMultiViewGeneration";
import {
  DESIGN_STYLE_OPTIONS,
  RENOVATION_INTENSITY_OPTIONS,
} from "./config/designOptions";
import { checkHealth } from "./lib/api";
import { cn } from "./lib/utils";
import type {
  DesignStyle,
  RenovationIntensity,
  RoomViewInput,
} from "./types";

type AppView = "editor" | "result";

function AppInner() {
  const rawUpload = useImageUpload(1024);
  // Reference image remains optional and is analyzed into transferable style
  // metadata before the main room is generated.
  const refUpload = useImageUpload(768);
  const generation = useMultiViewGeneration();

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [view, setView] = useState<AppView>("editor");
  const [requirements, setRequirements] = useState("");
  const [designStyle, setDesignStyle] = useState<DesignStyle>("smart");
  const [renovationIntensity, setRenovationIntensity] =
    useState<RenovationIntensity>("standard");

  useEffect(() => {
    checkHealth()
      .then((data) => setHasApiKey(data.geminiConfigured))
      .catch(() => setHasApiKey(false));
  }, []);

  const primaryView = useMemo<RoomViewInput | null>(() => {
    if (!rawUpload.image || !rawUpload.metadata) return null;
    return {
      id: "primary",
      label: "主方案",
      image: rawUpload.image,
      metadata: rawUpload.metadata,
      aspectRatio: rawUpload.aspectRatio,
    };
  }, [rawUpload.aspectRatio, rawUpload.image, rawUpload.metadata]);

  const generationConfig = useMemo<MultiViewGenerationConfig | null>(() => {
    if (!primaryView) return null;
    return {
      primary: primaryView,
      referenceImage: refUpload.image || undefined,
      requirements: requirements.trim(),
      roomType: "auto",
      designStyle,
      renovationIntensity,
    };
  }, [designStyle, primaryView, refUpload.image, renovationIntensity, requirements]);

  const handleGenerate = async () => {
    if (!generationConfig) return;
    const succeeded = await generation.generateInitial(generationConfig);
    if (succeeded) setView("result");
  };

  const handleClearRaw = () => {
    rawUpload.clear();
    generation.clear();
    setView("editor");
  };

  const handleClearRef = () => {
    refUpload.clear();
  };

  const handleRestart = () => {
    rawUpload.clear();
    refUpload.clear();
    generation.clear();
    setRequirements("");
    setDesignStyle("smart");
    setRenovationIntensity("standard");
    setView("editor");
  };

  return (
    <div className="desktop-app-shell flex min-h-screen flex-col bg-[#090a0a] font-sans text-zinc-100">
      <Header />

      {view === "result" && generationConfig && generation.views[0]?.resultImage ? (
        <ResultPage
          views={generation.views}
          referenceImage={refUpload.image}
          isGenerating={generation.isGenerating}
          masterConfirmed={generation.masterConfirmed}
          loadingMessage={generation.loadingMessage}
          generationError={generation.error}
          onConfirmMaster={() => generation.confirmMaster(generationConfig)}
          onRefinePrimary={(feedback) =>
            generation.refinePrimary(generationConfig, feedback)
          }
          onRedesignPrimary={(newRequirements) =>
            generation.redesignPrimary(generationConfig, newRequirements)
          }
          onGenerateDirectionalView={(direction, viewRequirements) =>
            generation.generateDirectionalView(
              generationConfig,
              direction,
              viewRequirements
            )
          }
          onRefineView={(viewId, feedback) =>
            generation.refineView(viewId, generationConfig, feedback)
          }
          onDismissError={generation.clearError}
          onBackToEditor={() => setView("editor")}
          onRestart={handleRestart}
        />
      ) : (
        <main className="desktop-editor-page mx-auto w-full max-w-6xl flex-1 px-6 pb-12">
          <div className="desktop-editor-grid grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="desktop-source-stack custom-scrollbar relative flex min-h-0 flex-col gap-3">
              <ImageUploader
                label="上传毛坯房照片"
                sublabel="JPG / PNG / WebP，单张不超过 15MB"
                image={rawUpload.image}
                metadata={rawUpload.metadata}
                isProcessing={rawUpload.isProcessing}
                error={rawUpload.error}
                isDragActive={rawUpload.isDragActive}
                getRootProps={rawUpload.getRootProps}
                getInputProps={rawUpload.getInputProps}
                onClear={handleClearRaw}
                primary
                overlay={
                  generation.isGenerating ? (
                    <LoadingOverlay message={generation.loadingMessage} />
                  ) : undefined
                }
              />
            </div>

            <div className="desktop-controls flex flex-col gap-4">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-xl shadow-black/10">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">装修需求</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
                      描述空间功能、颜色、材质、家具与灯光偏好
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold tracking-wide text-emerald-300">
                    可迭代
                  </span>
                </div>
                <textarea
                  value={requirements}
                  onChange={(event) => setRequirements(event.target.value)}
                  maxLength={1200}
                  placeholder="例如：做成温暖的现代客厅，以原木和米白色为主；天花板使用平整暖白完成面，不做复杂吊顶……"
                  className="h-28 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/80 px-3.5 py-3 text-xs leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
                />
                <div className="mt-2 flex items-center justify-between text-[9px] text-zinc-600">
                  <span>未填写时，AI 将结合空间智能设计</span>
                  <span>{requirements.length}/1200</span>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/55 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-300">参考风格图</p>
                    <p className="mt-0.5 text-[9px] text-zinc-600">提取配色、材质、家具语言与灯光氛围</p>
                  </div>
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-[8px] font-semibold text-zinc-500">可选</span>
                </div>
                <ImageUploader
                  label="上传参考风格图"
                  sublabel="仅提取设计风格，不复制空间结构"
                  image={refUpload.image}
                  metadata={refUpload.metadata}
                  isProcessing={refUpload.isProcessing}
                  error={refUpload.error}
                  isDragActive={refUpload.isDragActive}
                  getRootProps={refUpload.getRootProps}
                  getInputProps={refUpload.getInputProps}
                  onClear={handleClearRef}
                  compact
                />
              </section>

              <div className="desktop-option-stack flex flex-col gap-2.5">
                <OptionSelector
                  label="装修倾向"
                  value={designStyle}
                  options={DESIGN_STYLE_OPTIONS}
                  onChange={setDesignStyle}
                />
                <OptionSelector
                  label="改造强度"
                  value={renovationIntensity}
                  options={RENOVATION_INTENSITY_OPTIONS}
                  onChange={setRenovationIntensity}
                />
              </div>

              <button
                onClick={() => void handleGenerate()}
                disabled={!rawUpload.image || generation.isGenerating}
                className={cn(
                  "flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold transition-all duration-300",
                  !rawUpload.image || generation.isGenerating
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    : "bg-[#d9ff57] text-zinc-950 shadow-[0_12px_40px_rgba(217,255,87,0.12)] hover:bg-[#e3ff7d] active:scale-[0.98]"
                )}
              >
                {generation.isGenerating ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-pulse" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    生成装修效果图
                  </>
                )}
              </button>

              {generation.views[0]?.resultImage && (
                <button
                  type="button"
                  onClick={() => setView("result")}
                  disabled={generation.isGenerating}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white disabled:cursor-wait"
                >
                  <Eye className="h-4 w-4" />
                  查看上次生成结果
                </button>
              )}

              {hasApiKey === false && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-900/50 bg-amber-950/40 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-[11px] leading-relaxed text-amber-400/90">
                    服务端未配置 API Key，请在 .env.local 中设置 GEMINI_API_KEY。
                  </p>
                </div>
              )}

              {generation.error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/40 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="flex-1 text-[11px] leading-relaxed text-red-300">
                    {generation.error}
                  </p>
                  <button onClick={generation.clearError} className="text-[10px] text-red-400">
                    关闭
                  </button>
                </div>
              )}

              <div className="desktop-editor-help rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  天花板会保留原始高度和结构，同时强制处理为完整装修面。主方案生成后，可继续输入反馈定向调整或重新设计。
                </p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
