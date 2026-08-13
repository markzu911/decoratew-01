import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImageUploader } from "./ImageUploader";

test("renders a supplied generation overlay inside the uploaded-image frame", () => {
  const html = renderToStaticMarkup(
    createElement(ImageUploader, {
      label: "Uploaded room",
      image: "data:image/png;base64,AA==",
      metadata: {
        width: 781,
        height: 1024,
        aspectRatio: 781 / 1024,
        mimeType: "image/png",
      },
      isProcessing: false,
      error: null,
      isDragActive: false,
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      onClear: () => undefined,
      primary: true,
      overlay: createElement("div", { "data-generation-overlay": "true" }),
    } as never)
  );

  assert.match(html, /data-generation-overlay="true"/);
  assert.ok(
    html.indexOf("data-generation-overlay") > html.indexOf("desktop-primary-image")
  );
});
