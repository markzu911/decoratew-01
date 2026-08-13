import assert from "node:assert/strict";
import test from "node:test";
import {
  createSaasClient,
  executeBillableGeneration,
  normalizeSaasInit,
} from "./saas";

test("filters invalid SaaS identifiers and normalizes prompt values", () => {
  const config = normalizeSaasInit({
    type: "SAAS_INIT",
    userId: " null ",
    toolId: "tool-1",
    context: "客厅设计",
    prompt: ["原木", "undefined", "暖光"],
  });

  assert.equal(config.userId, undefined);
  assert.equal(config.toolId, "tool-1");
  assert.deepEqual(config.prompt, ["原木", "暖光"]);
});

test("uses callbackUrl as a legacy consume endpoint", () => {
  const config = normalizeSaasInit({
    userId: "user-1",
    toolId: "tool-1",
    callbackUrl: "/legacy-consume",
  });
  assert.equal(config.consumeUrl, "/legacy-consume");
});

test("launch, verify, and consume send only the current user and tool", async () => {
  const requests: Array<{ url: string; body: unknown }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    if (url === "/launch") {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            user: { name: "张三", integral: 100 },
            tool: { name: "毛坯精装", integral: 10 },
          },
        }),
        { status: 200 }
      );
    }
    if (url === "/verify") {
      return new Response(
        JSON.stringify({
          success: true,
          data: { currentIntegral: 100, requiredIntegral: 10 },
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        success: true,
        data: { currentIntegral: 90, consumedIntegral: 10 },
      }),
      { status: 200 }
    );
  };
  const client = createSaasClient(
    {
      userId: "user-1",
      toolId: "tool-1",
      launchUrl: "/launch",
      verifyUrl: "/verify",
      consumeUrl: "/consume",
    },
    fetcher
  );

  const launch = await client.launch();
  const verified = await client.verify();
  const consumed = await client.consume();

  assert.equal(launch.user.integral, 100);
  assert.equal(verified.requiredIntegral, 10);
  assert.equal(consumed.currentIntegral, 90);
  assert.deepEqual(requests, [
    { url: "/launch", body: { userId: "user-1", toolId: "tool-1" } },
    { url: "/verify", body: { userId: "user-1", toolId: "tool-1" } },
    { url: "/consume", body: { userId: "user-1", toolId: "tool-1" } },
  ]);
});

test("billable generation verifies before work and consumes only after success", async () => {
  const calls: string[] = [];
  const result = await executeBillableGeneration(
    {
      verify: async () => {
        calls.push("verify");
      },
      consume: async () => {
        calls.push("consume");
      },
    },
    async () => {
      calls.push("generate");
      return { success: true, image: "data:image/jpeg;base64,AA==" };
    }
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls, ["verify", "generate", "consume"]);
});

test("failed generation does not consume integral", async () => {
  const calls: string[] = [];
  await executeBillableGeneration(
    {
      verify: async () => calls.push("verify"),
      consume: async () => calls.push("consume"),
    },
    async () => {
      calls.push("generate");
      return { success: false, error: "failed" };
    }
  );

  assert.deepEqual(calls, ["verify", "generate"]);
});

test("failed verification prevents image analysis and generation", async () => {
  const calls: string[] = [];
  await assert.rejects(
    executeBillableGeneration(
      {
        verify: async () => {
          calls.push("verify");
          throw new Error("积分不足");
        },
        consume: async () => calls.push("consume"),
      },
      async () => {
        calls.push("analyze-or-generate");
        return { success: true };
      }
    ),
    /积分不足/
  );
  assert.deepEqual(calls, ["verify"]);
});

test("result upload follows direct-token, PUT, then commit", async () => {
  const requests: Array<{ url: string; method: string }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    requests.push({ url, method });
    if (url === "/token") {
      return new Response(
        JSON.stringify({
          success: true,
          method: "PUT",
          objectKey: "result/user/result.jpg",
          uploadUrl: "/put",
          headers: { "Content-Type": "image/jpeg" },
        }),
        { status: 200 }
      );
    }
    if (url === "/put") return new Response(null, { status: 200 });
    if (url === "/commit") {
      return new Response(
        JSON.stringify({
          success: true,
          savedToRecords: true,
          recordId: "img-1",
        }),
        { status: 200 }
      );
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = createSaasClient(
    {
      userId: "user-1",
      toolId: "tool-1",
      uploadTokenUrl: "/token",
      uploadCommitUrl: "/commit",
    },
    fetcher
  );

  const result = await client.uploadResult(
    new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    "result.jpg"
  );

  assert.equal(result.recordId, "img-1");
  assert.deepEqual(requests, [
    { url: "/token", method: "POST" },
    { url: "/put", method: "PUT" },
    { url: "/commit", method: "POST" },
  ]);
});
