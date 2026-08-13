import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDirectionalViewPrompt,
  directionalViewValidationPassed,
} from "./directionalView";

test("right-side view keeps the proven new-view behavior with more master context", () => {
  const prompt = buildDirectionalViewPrompt(
    "right",
    "Keep the room open and bright."
  );

  assert.match(prompt, /right side/i);
  assert.match(prompt, /new view/i);
  assert.match(prompt, /not a canvas to edit/i);
  assert.match(prompt, /approximately 60%/i);
  assert.match(prompt, /approximately 40%/i);
  assert.match(prompt, /dominant/i);
  assert.match(prompt, /perspective.*change/i);
  assert.match(prompt, /Keep the room open and bright\./);
  assert.doesNotMatch(prompt, /mostly or completely leave the frame/i);
  assert.doesNotMatch(prompt, /overlap/i);
  assert.doesNotMatch(prompt, /anchor/i);
  assert.doesNotMatch(prompt, /locked mask/i);
});

test("directional validation rejects a result that loses too much master context", () => {
  assert.equal(
    directionalViewValidationPassed({
      requestedDirectionMatched: true,
      newDirectionalAreaDominates: true,
      masterSceneStillRecognizable: false,
      designIdentityConsistent: true,
      architecturePlausible: true,
      nearDuplicate: false,
      reason: "The new side fills almost the entire frame.",
    }),
    false
  );
});

test("directional validation rejects a near-duplicate result", () => {
  assert.equal(
    directionalViewValidationPassed({
      requestedDirectionMatched: false,
      newDirectionalAreaDominates: false,
      masterSceneStillRecognizable: true,
      designIdentityConsistent: true,
      architecturePlausible: true,
      nearDuplicate: true,
      reason: "The original framing remains unchanged.",
    }),
    false
  );
});

test("directional validation accepts a coherent 60/40 side view", () => {
  assert.equal(
    directionalViewValidationPassed({
      requestedDirectionMatched: true,
      newDirectionalAreaDominates: true,
      masterSceneStillRecognizable: true,
      designIdentityConsistent: true,
      architecturePlausible: true,
      nearDuplicate: false,
      reason: "The new side dominates while the master scene remains visible.",
    }),
    true
  );
});
