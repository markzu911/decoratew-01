import assert from "node:assert/strict";
import test from "node:test";
import { streamGeneratedImageResponse } from "./streamingResponse";

test("streams a large generated image without changing the JSON contract", async () => {
  const headers = new Map<string, string>();
  const chunks: string[] = [];
  let flushed = false;

  const response = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    flushHeaders() {
      flushed = true;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    once() {
      throw new Error("drain should not be needed in this test");
    },
    end(chunk = "") {
      chunks.push(chunk);
    },
  };

  const base64Data = "a".repeat(40);
  await streamGeneratedImageResponse(response, "image/jpeg", base64Data, 8);

  assert.equal(flushed, true);
  assert.equal(headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.equal(headers.get("Cache-Control"), "no-store");
  assert.ok(chunks.length > 3, "image data should be split into multiple chunks");
  assert.deepEqual(JSON.parse(chunks.join("")), {
    success: true,
    image: `data:image/jpeg;base64,${base64Data}`,
  });
});
