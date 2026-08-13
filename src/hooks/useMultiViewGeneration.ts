import { useCallback, useRef, useState } from "react";
import { analyzeMasterDesign, generateRoom } from "../lib/api";
import { resizeImage } from "../lib/image";
import type {
  DesignStyle,
  GeneratedRoomView,
  MasterDesignProfile,
  MasterSpatialProfile,
  RenovationIntensity,
  RoomType,
  RoomViewInput,
  ViewDirection,
} from "../types";

export interface MultiViewGenerationConfig {
  primary: RoomViewInput;
  referenceImage?: string;
  requirements: string;
  roomType: RoomType;
  designStyle: DesignStyle;
  renovationIntensity: RenovationIntensity;
}

interface MasterCache {
  image: string;
  profile: MasterDesignProfile;
  spatialProfile: MasterSpatialProfile;
}

interface UseMultiViewGenerationResult {
  views: GeneratedRoomView[];
  isGenerating: boolean;
  masterConfirmed: boolean;
  loadingMessage: string;
  error: string | null;
  generateInitial: (config: MultiViewGenerationConfig) => Promise<boolean>;
  refinePrimary: (
    config: MultiViewGenerationConfig,
    feedback: string
  ) => Promise<boolean>;
  redesignPrimary: (
    config: MultiViewGenerationConfig,
    requirements?: string
  ) => Promise<boolean>;
  confirmMaster: (config: MultiViewGenerationConfig) => Promise<boolean>;
  generateDirectionalView: (
    config: MultiViewGenerationConfig,
    direction: ViewDirection,
    viewRequirements?: string
  ) => Promise<boolean>;
  refineView: (
    viewId: string,
    config: MultiViewGenerationConfig,
    feedback: string
  ) => Promise<boolean>;
  clear: () => void;
  clearError: () => void;
}

const defaultMessage = "AI 正在生成装修方案...";

function directionalViewLabel(direction: ViewDirection): string {
  return direction === "left" ? "查看左侧" : "查看右侧";
}

export function useMultiViewGeneration(): UseMultiViewGenerationResult {
  const [views, setViews] = useState<GeneratedRoomView[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [masterConfirmed, setMasterConfirmed] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(defaultMessage);
  const [error, setError] = useState<string | null>(null);
  const viewsRef = useRef<GeneratedRoomView[]>([]);
  const masterCacheRef = useRef<MasterCache | null>(null);
  const inFlightRef = useRef(false);

  const replaceViews = useCallback((next: GeneratedRoomView[]) => {
    viewsRef.current = next;
    setViews(next);
  }, []);

  const updateView = useCallback(
    (viewId: string, update: Partial<GeneratedRoomView>) => {
      replaceViews(
        viewsRef.current.map((view) =>
          view.id === viewId ? { ...view, ...update } : view
        )
      );
    },
    [replaceViews]
  );

  const beginRequest = useCallback((message: string): boolean => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setIsGenerating(true);
    setError(null);
    setLoadingMessage(message);
    return true;
  }, []);

  const endRequest = useCallback(() => {
    inFlightRef.current = false;
    setIsGenerating(false);
    setLoadingMessage(defaultMessage);
  }, []);

  const invalidateMaster = useCallback(() => {
    setMasterConfirmed(false);
    masterCacheRef.current = null;
  }, []);

  const getMasterCache = useCallback(
    async (primaryResult: string, roomType: RoomType): Promise<MasterCache> => {
      if (masterCacheRef.current) return masterCacheRef.current;

      setLoadingMessage("正在提取已确认方案的空间与家具信息...");
      const optimizedMaster = await resizeImage(primaryResult, 1024);
      const analysis = await analyzeMasterDesign({
        masterImage: optimizedMaster.data,
        roomType,
      });
      if (!analysis.success || !analysis.profile || !analysis.spatialProfile) {
        throw new Error(analysis.error || "主设计方案提取失败");
      }

      const cache = {
        image: optimizedMaster.data,
        profile: analysis.profile,
        spatialProfile: analysis.spatialProfile,
      };
      masterCacheRef.current = cache;
      return cache;
    },
    []
  );

  const generatePrimary = useCallback(
    async (
      config: MultiViewGenerationConfig,
      mode: "initial" | "redesign",
      requirementsOverride?: string
    ): Promise<boolean> => {
      if (!beginRequest(mode === "initial" ? "正在生成第一版装修方案..." : "正在重新设计整套方案...")) {
        return false;
      }

      invalidateMaster();
      const primary: GeneratedRoomView = {
        ...config.primary,
        label: "主方案",
        status: "generating",
      };
      replaceViews([primary]);

      try {
        const response = await generateRoom({
          rawImage: config.primary.image,
          referenceImage: config.referenceImage,
          generationMode: mode,
          userRequirements:
            requirementsOverride?.trim() || config.requirements,
          aspectRatio: config.primary.aspectRatio,
          roomType: config.roomType,
          designStyle: config.designStyle,
          renovationIntensity: config.renovationIntensity,
        });

        if (!response.success || !response.image) {
          const message = response.error || "主方案生成失败";
          updateView(primary.id, { status: "error", error: message });
          setError(message);
          return false;
        }

        updateView(primary.id, {
          status: "complete",
          resultImage: response.image,
          error: undefined,
        });
        return true;
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "网络错误，请检查连接后重试。";
        updateView(primary.id, { status: "error", error: message });
        setError(message);
        return false;
      } finally {
        endRequest();
      }
    },
    [beginRequest, endRequest, invalidateMaster, replaceViews, updateView]
  );

  const generateInitial = useCallback(
    (config: MultiViewGenerationConfig) => generatePrimary(config, "initial"),
    [generatePrimary]
  );

  const redesignPrimary = useCallback(
    (config: MultiViewGenerationConfig, requirements?: string) =>
      generatePrimary(config, "redesign", requirements),
    [generatePrimary]
  );

  const refinePrimary = useCallback(
    async (
      config: MultiViewGenerationConfig,
      feedback: string
    ): Promise<boolean> => {
      const primary = viewsRef.current[0];
      if (!primary?.resultImage || !feedback.trim()) return false;
      if (!beginRequest("正在根据反馈调整主方案...")) return false;

      invalidateMaster();
      replaceViews([{ ...primary, status: "generating", error: undefined }]);

      try {
        const response = await generateRoom({
          rawImage: config.primary.image,
          editImage: primary.resultImage,
          generationMode: "refine",
          editInstructions: feedback.trim(),
          aspectRatio: config.primary.aspectRatio,
          roomType: config.roomType,
          designStyle: config.designStyle,
          renovationIntensity: config.renovationIntensity,
        });
        if (!response.success || !response.image) {
          const message = response.error || "主方案调整失败";
          updateView(primary.id, { status: "error", error: message });
          setError(message);
          return false;
        }
        updateView(primary.id, {
          status: "complete",
          resultImage: response.image,
          error: undefined,
        });
        return true;
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "主方案调整失败";
        updateView(primary.id, { status: "error", error: message });
        setError(message);
        return false;
      } finally {
        endRequest();
      }
    },
    [beginRequest, endRequest, invalidateMaster, replaceViews, updateView]
  );

  const confirmMaster = useCallback(
    async (_config: MultiViewGenerationConfig): Promise<boolean> => {
      const primary = viewsRef.current[0];
      if (!primary?.resultImage) return false;
      setMasterConfirmed(true);
      return true;
    },
    []
  );

  const generateDirectionalView = useCallback(
    async (
      config: MultiViewGenerationConfig,
      direction: ViewDirection,
      viewRequirements = ""
    ): Promise<boolean> => {
      const primary = viewsRef.current[0];
      if (!masterConfirmed || !primary?.resultImage) {
        setError("请先确认主方案，再生成新视角。");
        return false;
      }
      if (!beginRequest(`正在构思房间${direction === "left" ? "左侧" : "右侧"}的新画面...`)) return false;

      const viewId = globalThis.crypto?.randomUUID?.() || `directional-${Date.now()}`;
      const nextView: GeneratedRoomView = {
        id: viewId,
        label: directionalViewLabel(direction),
        image: primary.resultImage,
        metadata: primary.metadata,
        aspectRatio: primary.aspectRatio,
        status: "generating",
        viewDirection: direction,
        viewRequirements: viewRequirements.trim() || undefined,
      };
      replaceViews([...viewsRef.current, nextView]);

      try {
        setLoadingMessage(`正在生成${nextView.label}...`);
        const response = await generateRoom({
          rawImage: primary.resultImage,
          generationMode: "directional-view",
          viewDirection: direction,
          userRequirements: viewRequirements.trim() || undefined,
          aspectRatio: primary.aspectRatio,
          roomType: config.roomType,
          designStyle: config.designStyle,
          renovationIntensity: config.renovationIntensity,
        });

        if (!response.success || !response.image) {
          const message = response.error || `${nextView.label}生成失败`;
          updateView(viewId, { status: "error", error: message });
          setError(message);
          return false;
        }
        updateView(viewId, {
          status: "complete",
          resultImage: response.image,
          error: undefined,
        });
        return true;
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : `${nextView.label}生成失败`;
        updateView(viewId, { status: "error", error: message });
        setError(message);
        return false;
      } finally {
        endRequest();
      }
    },
    [beginRequest, endRequest, masterConfirmed, replaceViews, updateView]
  );

  const refineView = useCallback(
    async (
      viewId: string,
      config: MultiViewGenerationConfig,
      feedback: string
    ): Promise<boolean> => {
      const view = viewsRef.current.find((item) => item.id === viewId);
      const primary = viewsRef.current[0];
      if (!view?.resultImage || !primary?.resultImage || viewId === primary.id || !feedback.trim()) {
        return false;
      }
      if (!beginRequest(`正在调整${view.label}...`)) return false;
      updateView(viewId, { status: "generating", error: undefined });

      try {
        const master = await getMasterCache(primary.resultImage, config.roomType);
        const response = await generateRoom({
          rawImage: view.resultImage,
          masterImage: master.image,
          masterDesignProfile: master.profile,
          generationMode: "refine-view",
          editInstructions: feedback.trim(),
          aspectRatio: view.aspectRatio,
          roomType: config.roomType,
          designStyle: config.designStyle,
          renovationIntensity: config.renovationIntensity,
        });
        if (!response.success || !response.image) {
          const message = response.error || `${view.label}调整失败`;
          updateView(viewId, { status: "error", error: message });
          setError(message);
          return false;
        }
        updateView(viewId, {
          status: "complete",
          resultImage: response.image,
          error: undefined,
        });
        return true;
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : `${view.label}调整失败`;
        updateView(viewId, { status: "error", error: message });
        setError(message);
        return false;
      } finally {
        endRequest();
      }
    },
    [beginRequest, endRequest, getMasterCache, updateView]
  );

  const clear = useCallback(() => {
    replaceViews([]);
    masterCacheRef.current = null;
    setMasterConfirmed(false);
    setError(null);
    setLoadingMessage(defaultMessage);
  }, [replaceViews]);

  return {
    views,
    isGenerating,
    masterConfirmed,
    loadingMessage,
    error,
    generateInitial,
    refinePrimary,
    redesignPrimary,
    confirmMaster,
    generateDirectionalView,
    refineView,
    clear,
    clearError: () => setError(null),
  };
}
