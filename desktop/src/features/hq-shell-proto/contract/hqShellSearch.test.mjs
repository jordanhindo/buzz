import assert from "node:assert/strict";
import test from "node:test";

import { validateHqShellSearch } from "./hqShellSearch.ts";

test("validateHqShellSearch: view accepts 'projects' and 'map', drops anything else", () => {
  assert.equal(validateHqShellSearch({ view: "projects" }).view, "projects");
  assert.equal(validateHqShellSearch({ view: "map" }).view, "map");
  assert.equal(validateHqShellSearch({ view: "bogus" }).view, undefined);
  assert.equal(validateHqShellSearch({}).view, undefined);
});

test("validateHqShellSearch: from accepts 'projects' and 'map', drops anything else", () => {
  assert.equal(validateHqShellSearch({ from: "projects" }).from, "projects");
  assert.equal(validateHqShellSearch({ from: "map" }).from, "map");
  assert.equal(validateHqShellSearch({ from: "ws" }).from, undefined);
});

test("validateHqShellSearch: attn/ws pass through non-empty strings only", () => {
  const result = validateHqShellSearch({ attn: "a1", ws: "" });
  assert.equal(result.attn, "a1");
  assert.equal(result.ws, undefined);
});
