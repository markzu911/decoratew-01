import { useState, useCallback, useEffect, useRef } from "react";
import { generateRoom } from "../lib/api";
import type { GenerateRequest, GenerateResponse } from "../types";

const LOADING_MESSAGES = [
  "正在测量房间尺寸...",
  "正在粉刷墙面...",
  "正在铺设高级地板...",
  "正在搬运家具...",
  "正在调试灯光氛围...",
  "正在进行最后的软装点缀...",
  "正在渲染装修效果图...",
  "正在核对墙体、门窗、柱体和透视...",
];

interface UseImageGenerationResult {
  isGenerating: boolean;
  loadingMessage: string;
  result: string | null;
  error: string | null;
  generate: (req: GenerateRequest) => Promise<GenerateResponse>;
  clear: () => void;
  clearError: () => void;
}

/**
 * Call /api/generate and manage loading state, rotating messages, error.
 */
export function useImageGeneration(): UseImageGenerationResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("AI 正在为您精心装修...");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const inFlightRef = useRef(false);

  // Rotate loading messages
  useEffect(() => {
    if (isGenerating) {
      let index = 0;
      intervalRef.current = setInterval(() => {
        setLoadingMessage(LOADING_MESSAGES[index % LOADING_MESSAGES.length]);
        index++;
      }, 2500);
    } else {
      setLoadingMessage("AI 正在为您精心装修...");
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isGenerating]);

  const generate = useCallback(async (req: GenerateRequest): Promise<GenerateResponse> => {
    if (inFlightRef.current) {
      return { success: false, error: "已有生成任务正在进行中" };
    }

    inFlightRef.current = true;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await generateRoom(req);
      if (res.success && res.image) {
        setResult(res.image);
      } else {
        setError(res.error || "生成失败，请稍后重试。");
      }
      return res;
    } catch (requestError: unknown) {
      console.error("Generate request error:", requestError);
      const msg = "网络错误，请检查连接后重试。";
      setError(msg);
      return { success: false, error: msg };
    } finally {
      inFlightRef.current = false;
      setIsGenerating(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    loadingMessage,
    result,
    error,
    generate,
    clear,
    clearError,
  };
}
