import assert from "node:assert/strict";
import test from "node:test";

import {
  DEV_WORKSTREAM_BINDING,
  EmptyWorkstreamBinding,
  FixtureWorkstreamBinding,
  LiveWorkstreamBinding,
} from "./workstreamBinding.ts";

test("EmptyWorkstreamBinding binds nothing and reports no session", async () => {
  assert.deepEqual(await EmptyWorkstreamBinding.resolve("anything"), {
    conversations: [],
    session: null,
    bound: false,
  });
  assert.deepEqual(await EmptyWorkstreamBinding.resolve("launch-site"), {
    conversations: [],
    session: null,
    bound: false,
  });
});

test("FixtureWorkstreamBinding resolves known subjects and empties unknown ones", async () => {
  const ref = { kind: "channel", id: "c1", label: "#one" };
  const binding = new FixtureWorkstreamBinding({ "ws-1": [ref] });

  const known = await binding.resolve("ws-1");
  assert.deepEqual(known.conversations, [ref]);
  assert.equal(known.bound, true);
  assert.equal(known.session, null);

  const missing = await binding.resolve("ws-missing");
  assert.deepEqual(missing.conversations, []);
  assert.equal(missing.bound, false);
});

test("DEV_WORKSTREAM_BINDING binds the real launch-site workstream", async () => {
  const binding = new FixtureWorkstreamBinding(DEV_WORKSTREAM_BINDING);
  const { conversations, bound } = await binding.resolve("launch-site");
  assert.equal(conversations.length, 1);
  assert.equal(conversations[0].kind, "channel");
  assert.equal(conversations[0].sessionKind, "claude");
  assert.equal(bound, true);
  // Anything not explicitly seeded stays unbound (honest gap).
  const missing = await binding.resolve("demand-loop");
  assert.deepEqual(missing.conversations, []);
  assert.equal(missing.bound, false);
});

// The core of the fix Jordan hit: HQ reports a live session with NO relay
// coordinates (`bound:false`, `conversation:null`). The Live binding must still
// surface that session so the right pane shows it instead of a dead gap.
test("LiveWorkstreamBinding surfaces the live session even when nothing is bound", async () => {
  const client = {
    getJson: async (path) => {
      assert.equal(path, "/v1/conversation-bindings/artifact-continuation");
      return {
        schema: "conversation-binding-v1",
        conversation: null,
        bound: false,
        session: {
          sessionKind: "codex",
          harness: "codex",
          nativeSessionId: "hq-outcome-orchestrator-abc",
          agentPubkey: null,
          admissionId: "adm-1",
          lifecycleState: "active",
          leaseRelation: "no-writer",
          transcriptPointer: null,
          resumeOperation: "codex resume hq-outcome-orchestrator-abc",
        },
      };
    },
  };
  const result = await new LiveWorkstreamBinding(client).resolve(
    "artifact-continuation",
  );
  assert.equal(result.bound, false);
  assert.deepEqual(result.conversations, []);
  assert.equal(result.session.sessionKind, "codex");
  assert.equal(result.session.lifecycleState, "active");
  assert.equal(
    result.session.resumeOperation,
    "codex resume hq-outcome-orchestrator-abc",
  );
});

// Once HQ's registration write path authors real coordinates (`bound:true` with
// a conversation), the Live binding exposes a bound conversation carrying the
// session identity — the LiveSessionPanel gives way to the real chat.
test("LiveWorkstreamBinding binds a conversation once real coordinates exist", async () => {
  const client = {
    getJson: async () => ({
      schema: "conversation-binding-v1",
      bound: true,
      conversation: { kind: "channel", id: "chan-uuid", label: "#launch-site" },
      session: {
        sessionKind: "claude",
        harness: "claude",
        nativeSessionId: "sess-1",
        agentPubkey: "npub-real",
        admissionId: "adm-2",
        lifecycleState: "active",
        leaseRelation: "current-writer",
        transcriptPointer: null,
        resumeOperation: null,
      },
    }),
  };
  const result = await new LiveWorkstreamBinding(client).resolve("launch-site");
  assert.equal(result.bound, true);
  assert.equal(result.conversations.length, 1);
  assert.equal(result.conversations[0].id, "chan-uuid");
  assert.equal(result.conversations[0].kind, "channel");
  assert.equal(result.conversations[0].agentPubkey, "npub-real");
  assert.equal(result.conversations[0].sessionKind, "claude");
});
