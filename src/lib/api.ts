import type {
  AnalyzeMasterRequest,
  AnalyzeMasterResponse,
  GenerateRequest,
  GenerateResponse,
  HealthResponse,
} from "../types";

async function readJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? "服务端返回了无效数据" : `请求失败（${res.status}）`);
  }
}

/**
 * Call the backend /api/generate endpoint to transform a raw room image.
 */
export async function generateRoom(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return readJsonResponse<GenerateResponse>(res);
}

export async function analyzeMasterDesign(
  req: AnalyzeMasterRequest
): Promise<AnalyzeMasterResponse> {
  const res = await fetch("/api/analyze-master", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return readJsonResponse<AnalyzeMasterResponse>(res);
}

/**
 * Check backend health / API key configuration status.
 */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  return readJsonResponse<HealthResponse>(res);
}
