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

// The main-site tool proxy rewrites literal deployment origins inside JavaScript
// responses to "/". Keep the default URL encoded so it is resolved by the
// browser at runtime and AI requests can bypass the proxy's body-size limit.
const DEFAULT_PRODUCTION_TOOL_ORIGIN = decodeURIComponent(
  "https%3A%2F%2Fdecoratew-01.vercel.app"
);

const PRODUCTION_TOOL_ORIGIN = (
  import.meta.env.VITE_TOOL_API_ORIGIN || DEFAULT_PRODUCTION_TOOL_ORIGIN
).replace(/\/$/, "");

export function toolApiUrl(path: string): string {
  return import.meta.env.DEV ? path : `${PRODUCTION_TOOL_ORIGIN}${path}`;
}

/**
 * Call the backend /api/generate endpoint to transform a raw room image.
 */
export async function generateRoom(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await fetch(toolApiUrl("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return readJsonResponse<GenerateResponse>(res);
}

export async function analyzeMasterDesign(
  req: AnalyzeMasterRequest
): Promise<AnalyzeMasterResponse> {
  const res = await fetch(toolApiUrl("/api/analyze-master"), {
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
  const res = await fetch(toolApiUrl("/api/health"));
  return readJsonResponse<HealthResponse>(res);
}
