export interface SaasInitPayload {
  type?: string;
  userId?: unknown;
  toolId?: unknown;
  context?: unknown;
  prompt?: unknown;
  launchUrl?: unknown;
  verifyUrl?: unknown;
  consumeUrl?: unknown;
  callbackUrl?: unknown;
  uploadTokenUrl?: unknown;
  uploadCommitUrl?: unknown;
}

export interface SaasConfig {
  userId?: string;
  toolId?: string;
  context?: string;
  prompt?: string[];
  launchUrl?: string;
  verifyUrl?: string;
  consumeUrl?: string;
  uploadTokenUrl?: string;
  uploadCommitUrl?: string;
}

export interface SaasLaunchData {
  user: { name?: string; enterprise?: string; integral: number };
  tool: { name?: string; integral: number };
}

export interface SaasIntegralData {
  currentIntegral: number;
  requiredIntegral?: number;
  consumedIntegral?: number;
}

export interface SaasUploadResult {
  recordId: string;
  url?: string;
  fileName?: string;
  savedToRecords: true;
}

export interface BillableResult {
  success: boolean;
}

export interface BillingSteps {
  verify: () => Promise<unknown>;
  consume: () => Promise<unknown>;
}

export interface SaasClient {
  launch: () => Promise<SaasLaunchData>;
  verify: () => Promise<SaasIntegralData>;
  consume: () => Promise<SaasIntegralData>;
  uploadResult: (blob: Blob, fileName?: string) => Promise<SaasUploadResult>;
}

const INVALID_VALUES = new Set(["", "null", "undefined"]);

function validString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return INVALID_VALUES.has(normalized.toLowerCase()) ? undefined : normalized;
}

function inferLaunchUrl(verifyUrl?: string): string | undefined {
  if (!verifyUrl) return undefined;
  return verifyUrl.replace(/\/verify(?:\?.*)?$/, "/launch");
}

export function normalizeSaasInit(payload: SaasInitPayload): SaasConfig {
  const prompt = Array.isArray(payload.prompt)
    ? payload.prompt.map(validString).filter((item): item is string => !!item)
    : validString(payload.prompt)
      ? [validString(payload.prompt)!]
      : [];
  const verifyUrl = validString(payload.verifyUrl);

  return {
    userId: validString(payload.userId),
    toolId: validString(payload.toolId),
    context: validString(payload.context),
    prompt,
    launchUrl: validString(payload.launchUrl) || inferLaunchUrl(verifyUrl),
    verifyUrl,
    consumeUrl:
      validString(payload.consumeUrl) || validString(payload.callbackUrl),
    uploadTokenUrl: validString(payload.uploadTokenUrl),
    uploadCommitUrl: validString(payload.uploadCommitUrl),
  };
}

function requireSession(config: SaasConfig): asserts config is SaasConfig & {
  userId: string;
  toolId: string;
} {
  if (!config.userId || !config.toolId) {
    throw new Error("未获取到有效的用户或工具信息，请从主站重新打开工具。");
  }
}

function resolveEndpoint(configured: string | undefined, fallback: string): string {
  return configured || fallback;
}

async function readApiResponse<T>(response: Response): Promise<T & {
  success?: boolean;
  valid?: boolean;
  message?: string;
  error?: string;
}> {
  const text = await response.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`主站接口返回了无效数据（${response.status}）`);
  }
  if (!response.ok || (body.success !== true && body.valid !== true)) {
    throw new Error(body.message || body.error || `主站接口请求失败（${response.status}）`);
  }
  return body;
}

async function postJson<T>(
  fetcher: typeof fetch,
  url: string,
  body: Record<string, unknown>
): Promise<T & { success?: boolean; valid?: boolean }> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readApiResponse<T>(response);
}

function absoluteUploadUrl(uploadUrl: string, tokenUrl: string): string {
  if (/^https?:\/\//i.test(uploadUrl)) return uploadUrl;
  if (typeof window !== "undefined") {
    if (/^https?:\/\//i.test(tokenUrl)) return new URL(uploadUrl, tokenUrl).toString();
    return new URL(uploadUrl, window.location.href).toString();
  }
  return uploadUrl;
}

export function createSaasClient(
  config: SaasConfig,
  fetcher: typeof fetch = fetch
): SaasClient {
  const identity = () => {
    requireSession(config);
    return { userId: config.userId, toolId: config.toolId };
  };

  return {
    async launch() {
      const response = await postJson<{ data?: SaasLaunchData }>(
        fetcher,
        resolveEndpoint(config.launchUrl, "/api/tool/launch"),
        identity()
      );
      if (!response.data?.user || !response.data?.tool) {
        throw new Error("主站未返回有效的用户积分信息。");
      }
      return response.data;
    },

    async verify() {
      const response = await postJson<
        Partial<SaasIntegralData> & { data?: SaasIntegralData }
      >(
        fetcher,
        resolveEndpoint(config.verifyUrl, "/api/tool/verify"),
        identity()
      );
      const data = response.data || response;
      if (typeof data.currentIntegral !== "number") {
        throw new Error("主站未返回有效的积分校验结果。");
      }
      return {
        currentIntegral: data.currentIntegral,
        requiredIntegral: data.requiredIntegral,
        consumedIntegral: data.consumedIntegral,
      };
    },

    async consume() {
      const response = await postJson<
        Partial<SaasIntegralData> & { data?: SaasIntegralData }
      >(
        fetcher,
        resolveEndpoint(config.consumeUrl, "/api/tool/consume"),
        identity()
      );
      const data = response.data || response;
      if (typeof data.currentIntegral !== "number") {
        throw new Error("主站未返回有效的积分扣除结果。");
      }
      return {
        currentIntegral: data.currentIntegral,
        requiredIntegral: data.requiredIntegral,
        consumedIntegral: data.consumedIntegral,
      };
    },

    async uploadResult(blob, fileName = `renovation-${Date.now()}.jpg`) {
      requireSession(config);
      const tokenUrl = resolveEndpoint(
        config.uploadTokenUrl,
        "/api/upload/direct-token"
      );
      const commitUrl = resolveEndpoint(
        config.uploadCommitUrl,
        "/api/upload/commit"
      );
      const mimeType = blob.type || "image/jpeg";
      const token = await postJson<{
        method?: string;
        objectKey?: string;
        uploadUrl?: string;
        proxyUploadUrl?: string;
        headers?: Record<string, string>;
      }>(fetcher, tokenUrl, {
        ...identity(),
        source: "result",
        fileName,
        mimeType,
        fileSize: blob.size,
      });
      const uploadUrl = token.uploadUrl || token.proxyUploadUrl;
      if (!uploadUrl || !token.objectKey) {
        throw new Error("主站未返回有效的图片上传地址。");
      }
      const uploadResponse = await fetcher(absoluteUploadUrl(uploadUrl, tokenUrl), {
        method: token.method || "PUT",
        headers: token.headers || { "Content-Type": mimeType },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error(`结果图上传失败（${uploadResponse.status}）`);
      }
      const committed = await postJson<{
        savedToRecords?: boolean;
        recordId?: string;
        url?: string;
        fileName?: string;
        image?: { url?: string; fileName?: string; recordId?: string };
      }>(fetcher, commitUrl, {
        ...identity(),
        source: "result",
        objectKey: token.objectKey,
        fileSize: blob.size,
      });
      const recordId = committed.recordId || committed.image?.recordId;
      const savedToRecords =
        committed.savedToRecords === true ||
        (committed.image as { savedToRecords?: boolean } | undefined)
          ?.savedToRecords === true;
      if (!savedToRecords || !recordId) {
        throw new Error("结果图已上传，但主站未确认写入“我的图片”。");
      }
      return {
        recordId,
        url: committed.url || committed.image?.url,
        fileName: committed.fileName || committed.image?.fileName,
        savedToRecords: true,
      };
    },
  };
}

export async function executeBillableGeneration<T extends BillableResult>(
  billing: BillingSteps,
  work: () => Promise<T>
): Promise<T> {
  await billing.verify();
  const result = await work();
  if (result.success) await billing.consume();
  return result;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("无法读取生成结果图。");
  return response.blob();
}
