interface WritableJsonResponse {
  setHeader(name: string, value: string): void;
  flushHeaders?: () => void;
  write(chunk: string): boolean;
  once(event: "drain", listener: () => void): unknown;
  end(chunk?: string): void;
}

const DEFAULT_STREAM_CHUNK_SIZE = 64 * 1024;

async function writeChunk(
  response: WritableJsonResponse,
  chunk: string
): Promise<void> {
  if (response.write(chunk)) return;
  await new Promise<void>((resolve) => response.once("drain", resolve));
}

/**
 * Streams the base64 image inside the existing JSON response contract.
 * Vercel exempts streaming responses from its 4.5 MB buffered response limit.
 */
export async function streamGeneratedImageResponse(
  response: WritableJsonResponse,
  mimeType: string,
  base64Data: string,
  chunkSize = DEFAULT_STREAM_CHUNK_SIZE
): Promise<void> {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders?.();

  await writeChunk(
    response,
    `{"success":true,"image":"data:${mimeType};base64,`
  );

  for (let offset = 0; offset < base64Data.length; offset += chunkSize) {
    await writeChunk(response, base64Data.slice(offset, offset + chunkSize));
    // Yield between chunks so the platform observes a streaming response
    // instead of buffering synchronous writes into one oversized payload.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  response.end('"}');
}
