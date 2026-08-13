import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("production AI requests use the tool Vercel origin", async () => {
  const source = await readFile(new URL("./api.ts", import.meta.url), "utf8");
  assert.match(source, /https:\/\/decoratew-01\.vercel\.app/);
  assert.match(source, /toolApiUrl\("\/api\/generate"\)/);
  assert.match(source, /toolApiUrl\("\/api\/analyze-master"\)/);
});
