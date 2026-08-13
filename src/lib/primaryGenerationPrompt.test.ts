import assert from "node:assert/strict";
import test from "node:test";

test("primary generation keeps the original structure-preserving prompt policy", async () => {
  process.env.NODE_ENV = "production";
  process.env.VERCEL = "true";

  const serverModule = await import("../../server");
  const buildPrompt = (serverModule as unknown as {
    buildPrompt?: (options: Record<string, unknown>) => string;
  }).buildPrompt;

  assert.equal(typeof buildPrompt, "function");

  const prompt = buildPrompt!({
    hasReference: false,
    roomType: "auto",
    designStyle: "smart",
    renovationIntensity: "standard",
    generationMode: "initial",
    userRequirements: "保留通道，并使用暖色调。",
  });

  assert.match(prompt, /semantic inpainting/i);
  assert.match(prompt, /locked mask/i);
  assert.match(prompt, /保留通道，并使用暖色调。/);
  assert.match(prompt, /exposed.*(?:pipes|conduits|cables|hangers)/i);
  assert.match(prompt, /not protected architectural geometry/i);
  assert.doesNotMatch(prompt, /MANDATORY CEILING COMPLETION/i);
  assert.doesNotMatch(prompt, /Remove the visual appearance of bare concrete/i);
});
