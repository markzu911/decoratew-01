import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSaasClient,
  dataUrlToBlob,
  normalizeSaasInit,
  type SaasConfig,
  type SaasLaunchData,
} from "../lib/saas";

export interface SaasIntegration {
  configured: boolean;
  loading: boolean;
  userName?: string;
  integral: number | null;
  requiredIntegral: number | null;
  context?: string;
  prompt: string[];
  error: string | null;
  verifyGeneration: () => Promise<void>;
  consumeGeneration: () => Promise<void>;
  uploadResult: (dataUrl: string, fileName?: string) => Promise<void>;
}

function configFromUrl(): SaasConfig {
  if (typeof window === "undefined") return { prompt: [] };
  const params = new URLSearchParams(window.location.search);
  return normalizeSaasInit({
    userId: params.get("userId"),
    toolId: params.get("toolId"),
    context: params.get("context"),
    prompt: params.getAll("prompt"),
    launchUrl: params.get("launchUrl"),
    verifyUrl: params.get("verifyUrl"),
    consumeUrl: params.get("consumeUrl"),
    callbackUrl: params.get("callbackUrl"),
    uploadTokenUrl: params.get("uploadTokenUrl"),
    uploadCommitUrl: params.get("uploadCommitUrl"),
  });
}

export function useSaasIntegration(): SaasIntegration {
  const [config, setConfig] = useState<SaasConfig>(() => configFromUrl());
  const [launchData, setLaunchData] = useState<SaasLaunchData | null>(null);
  const [integral, setIntegral] = useState<number | null>(null);
  const [requiredIntegral, setRequiredIntegral] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launchedSessionRef = useRef("");

  const configured = !!config.userId && !!config.toolId;
  const client = useMemo(() => createSaasClient(config), [config]);

  useEffect(() => {
    const receiveInit = (event: MessageEvent) => {
      if (event.data?.type !== "SAAS_INIT") return;
      if (window.parent !== window && event.source !== window.parent) return;
      setConfig(normalizeSaasInit(event.data));
    };
    window.addEventListener("message", receiveInit);
    window.parent?.postMessage({ type: "SAAS_READY" }, "*");
    return () => window.removeEventListener("message", receiveInit);
  }, []);

  useEffect(() => {
    if (!configured) return;
    const sessionKey = `${config.userId}:${config.toolId}:${config.launchUrl || ""}`;
    if (launchedSessionRef.current === sessionKey) return;
    launchedSessionRef.current = sessionKey;
    setLoading(true);
    setError(null);
    client
      .launch()
      .then((data) => {
        setLaunchData(data);
        setIntegral(data.user.integral);
        setRequiredIntegral(data.tool.integral);
      })
      .catch((launchError) => {
        launchedSessionRef.current = "";
        setError(
          launchError instanceof Error
            ? launchError.message
            : "获取用户积分信息失败。"
        );
      })
      .finally(() => setLoading(false));
  }, [client, config.launchUrl, config.toolId, config.userId, configured]);

  const verifyGeneration = useCallback(async () => {
    if (!configured) {
      throw new Error("未获取到主站用户信息，请关闭后从主站重新打开工具。");
    }
    setError(null);
    const data = await client.verify();
    setIntegral(data.currentIntegral);
    if (typeof data.requiredIntegral === "number") {
      setRequiredIntegral(data.requiredIntegral);
    }
  }, [client, configured]);

  const consumeGeneration = useCallback(async () => {
    const data = await client.consume();
    setIntegral(data.currentIntegral);
  }, [client]);

  const uploadResult = useCallback(
    async (dataUrl: string, fileName?: string) => {
      const blob = await dataUrlToBlob(dataUrl);
      await client.uploadResult(blob, fileName);
    },
    [client]
  );

  return {
    configured,
    loading,
    userName: launchData?.user.name,
    integral,
    requiredIntegral,
    context: config.context,
    prompt: config.prompt || [],
    error,
    verifyGeneration,
    consumeGeneration,
    uploadResult,
  };
}
