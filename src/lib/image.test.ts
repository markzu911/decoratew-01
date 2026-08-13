import assert from "node:assert/strict";
import test from "node:test";
import { formatImageAspectRatio } from "./image";

test("image display uses the uploaded image's exact dimensions", () => {
  assert.equal(formatImageAspectRatio({ width: 985, height: 736 }), "985 / 736");
  assert.equal(formatImageAspectRatio({ width: 736, height: 985 }), "736 / 985");
});
