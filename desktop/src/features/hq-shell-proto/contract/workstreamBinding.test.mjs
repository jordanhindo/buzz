import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_WORKSTREAM_BINDING,
  EmptyWorkstreamBinding,
  FixtureWorkstreamBinding,
} from "./workstreamBinding.ts";

test("EmptyWorkstreamBinding binds nothing", () => {
  assert.deepEqual(EmptyWorkstreamBinding.boundFor("anything"), []);
  assert.deepEqual(EmptyWorkstreamBinding.boundFor("launch-site"), []);
});

test("FixtureWorkstreamBinding resolves known subjects and empties unknown ones", () => {
  const ref = { kind: "channel", id: "c1", label: "#one" };
  const binding = new FixtureWorkstreamBinding({ "ws-1": [ref] });
  assert.deepEqual(binding.boundFor("ws-1"), [ref]);
  assert.deepEqual(binding.boundFor("ws-missing"), []);
});

test("DEV_WORKSTREAM_BINDING binds the real launch-site workstream", () => {
  const binding = new FixtureWorkstreamBinding(DEV_WORKSTREAM_BINDING);
  const refs = binding.boundFor("launch-site");
  assert.equal(refs.length, 1);
  assert.equal(refs[0].kind, "channel");
  assert.equal(refs[0].sessionKind, "claude");
  // Anything not explicitly seeded stays unbound (honest gap).
  assert.deepEqual(binding.boundFor("demand-loop"), []);
});
