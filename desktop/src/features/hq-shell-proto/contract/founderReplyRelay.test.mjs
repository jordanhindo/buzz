import assert from "node:assert/strict";
import test from "node:test";

import {
  FixtureFounderReplyRelay,
  UnboundFounderReplyRelay,
} from "./founderReplyRelay.ts";

const input = (over = {}) => ({
  attentionId: "attn-1",
  packageDigest: `sha256:${"a".repeat(64)}`,
  reply: "Approve and proceed.",
  idempotencyKey: "key-1",
  ...over,
});

test("UnboundFounderReplyRelay refuses rather than fabricating an accept", async () => {
  const r = await UnboundFounderReplyRelay.submit(input());
  assert.equal(r.status, "rejected");
  assert.match(r.message, /no live agent session/i);
});

test("FixtureFounderReplyRelay accepts by default", async () => {
  const relay = new FixtureFounderReplyRelay();
  const r = await relay.submit(input());
  assert.equal(r.status, "accepted");
  assert.equal(r.subjectId, "attn-1");
});

test("FixtureFounderReplyRelay returns a stale receipt for a mismatch attentionId", async () => {
  const relay = new FixtureFounderReplyRelay({
    mismatchAttentionIds: ["attn-bad"],
  });
  const r = await relay.submit(input({ attentionId: "attn-bad" }));
  assert.equal(r.status, "stale");
  assert.match(r.message, /stale/i);
});

test("FixtureFounderReplyRelay is idempotent by key", async () => {
  const relay = new FixtureFounderReplyRelay();
  const first = await relay.submit(input({ idempotencyKey: "dup" }));
  // A second call with the same key returns the SAME receipt, even if the
  // attention would otherwise mismatch — the first outcome is authoritative.
  const second = await relay.submit(
    input({ idempotencyKey: "dup", attentionId: "attn-different" }),
  );
  assert.deepEqual(second, first);
});
