import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Header } from "./Header";

test("shows the current SaaS integral in the top-right header", () => {
  const html = renderToStaticMarkup(
    createElement(Header, { integral: 88, userName: "张三" })
  );
  assert.match(html, /88 积分/);
  assert.match(html, /张三/);
});
