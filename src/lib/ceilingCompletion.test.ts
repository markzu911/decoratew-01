import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCeilingRepairPrompt,
  ceilingCompletionPassed,
} from "./ceilingCompletion";

test("ceiling completion rejects exposed pipes and suspension hardware", () => {
  assert.equal(
    ceilingCompletionPassed({
      ceilingVisible: true,
      fullyRenovated: false,
      exposedConstructionServices: true,
      rawSurfaceRemaining: false,
      reason: "Exposed pipes, rods, and hangers remain across the ceiling.",
    }),
    false
  );
});

test("ceiling completion accepts a finished ceiling", () => {
  assert.equal(
    ceilingCompletionPassed({
      ceilingVisible: true,
      fullyRenovated: true,
      exposedConstructionServices: false,
      rawSurfaceRemaining: false,
      reason: "The ceiling is fully finished.",
    }),
    true
  );
});

test("ceiling repair changes only unfinished ceiling services and finish", () => {
  const prompt = buildCeilingRepairPrompt("Exposed pipes remain visible.");

  assert.match(prompt, /IMAGE 2.*candidate/i);
  assert.match(prompt, /pipes.*conduits.*cables.*hangers/i);
  assert.match(prompt, /preserve.*camera.*walls.*openings.*furniture/i);
  assert.match(prompt, /do not redesign/i);
});
