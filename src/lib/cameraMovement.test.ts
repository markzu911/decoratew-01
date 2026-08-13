import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCameraMotionContract,
  cameraValidationPassed,
  formatCameraMovementForLog,
} from "./cameraMovement";

test("left rotation contract requires a visibly different projection", () => {
  const contract = buildCameraMotionContract({
    orbitAngle: "left-90",
    distance: "same",
    height: "same",
    fieldOfView: "standard",
  });

  assert.match(contract, /new camera position/i);
  assert.match(contract, /move.*camera.*arc/i);
  assert.match(contract, /look.*orbit target/i);
  assert.match(contract, /re-project/i);
  assert.match(contract, /reveal.*left/i);
  assert.match(contract, /same composition.*invalid/i);
});

test("camera validation rejects a near-duplicate composition", () => {
  assert.equal(
    cameraValidationPassed({
      cameraPositionChanged: true,
      orbitDirectionMatched: true,
      orbitMagnitudeMatched: true,
      targetRemainsCentered: true,
      foregroundBackgroundParallax: true,
      sharedArchitectureConsistent: true,
      furnitureIdentityConsistent: true,
      furniturePlacementConsistent: true,
      hiddenAreaDoesNotContradictMaster: true,
      compositionSimilarity: 0.91,
      reason: "Architecture remains in nearly identical canvas positions.",
    }),
    false
  );
});

test("camera validation rejects the observed 0.82-similarity false positive", () => {
  assert.equal(
    cameraValidationPassed({
      cameraPositionChanged: true,
      orbitDirectionMatched: true,
      orbitMagnitudeMatched: true,
      targetRemainsCentered: true,
      foregroundBackgroundParallax: true,
      sharedArchitectureConsistent: true,
      furnitureIdentityConsistent: true,
      furniturePlacementConsistent: true,
      hiddenAreaDoesNotContradictMaster: true,
      compositionSimilarity: 0.82,
      reason:
        "The evaluator claimed a camera move, but the composition remained highly similar.",
    }),
    false
  );
});

test("camera validation accepts a materially changed matching viewpoint", () => {
  assert.equal(
    cameraValidationPassed({
      cameraPositionChanged: true,
      orbitDirectionMatched: true,
      orbitMagnitudeMatched: true,
      targetRemainsCentered: true,
      foregroundBackgroundParallax: true,
      sharedArchitectureConsistent: true,
      furnitureIdentityConsistent: true,
      furniturePlacementConsistent: true,
      hiddenAreaDoesNotContradictMaster: true,
      compositionSimilarity: 0.42,
      reason: "The left side is newly revealed and the old right side exits frame.",
    }),
    true
  );
});

test("camera validation rejects in-place yaw without orbit parallax", () => {
  assert.equal(
    cameraValidationPassed({
      cameraPositionChanged: true,
      orbitDirectionMatched: true,
      orbitMagnitudeMatched: true,
      targetRemainsCentered: true,
      foregroundBackgroundParallax: false,
      sharedArchitectureConsistent: true,
      furnitureIdentityConsistent: true,
      furniturePlacementConsistent: true,
      hiddenAreaDoesNotContradictMaster: true,
      compositionSimilarity: 0.35,
      reason: "The lens panned right from the same position without foreground parallax.",
    }),
    false
  );
});

test("camera movement log includes every control", () => {
  assert.equal(
    formatCameraMovementForLog({
      orbitAngle: "right-45",
      distance: "farther",
      height: "higher",
      fieldOfView: "wide",
    }),
    "orbit=right-45,distance=farther,height=higher,fov=wide"
  );
});
