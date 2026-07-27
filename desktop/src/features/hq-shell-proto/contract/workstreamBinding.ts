// Session → workstream binding implementations (D5 write-path blocker (b)).
//
// The interface (`WorkstreamConversationBinding`) lives in types.ts alongside
// the rest of the contract; the concrete resolvers live here, exactly like
// HqTransport (interface in types.ts) vs. LiveHqTransport / FixtureTransport.
//
// Today no real binding source exists — HQ does not project which Buzz
// channel/thread carries the live agent session for a workstream. The honest
// default is therefore EMPTY: the Work surface shows "No conversation bound to
// this yet" until a real source (a Buzz presence/registry lookup) is wired.
// The fixture resolver is a dev/e2e stand-in so the confirm → submit relay UI
// can be built and screenshotted against a real-shaped binding first.

import type {
  BoundConversationRef,
  WorkstreamConversationBinding,
} from "./types";

// Honest default. Nothing is bound → getConversation() stays null and
// WorkstreamDetail.boundConversations stays []. This is byte-identical to the
// pre-binding behavior, so "delete the binding and the surface is unchanged".
export const EmptyWorkstreamBinding: WorkstreamConversationBinding = {
  boundFor: () => [],
};

// A static, in-memory binding for dev/e2e. Keyed by the exact `subjectId` the
// inbox requests — a workstream id (e.g. "launch-site") or an attention item
// id. Real ids only; never invent a subject that the portfolio can't open.
export class FixtureWorkstreamBinding implements WorkstreamConversationBinding {
  private readonly bindings: ReadonlyMap<string, BoundConversationRef[]>;

  constructor(entries: Record<string, BoundConversationRef[]>) {
    this.bindings = new Map(Object.entries(entries));
  }

  boundFor(subjectId: string): BoundConversationRef[] {
    return this.bindings.get(subjectId) ?? [];
  }
}

// Real attention-item ids from the captured founder-attention fixture, bound so
// the confirm → submit write path is demonstrable in dev/e2e. One drives the
// accepted flow; the other is also listed in the fixture relay's mismatch set
// to drive the digest-mismatch re-present path.
export const DEV_ACCEPT_ATTENTION_ID = "46dc6da4-0481-4159-ba03-0e458e2d26b2";
export const DEV_MISMATCH_ATTENTION_ID = "e8990413-5326-4762-a46b-2815129ba297";

const devAgentChannel = (label: string, id: string): BoundConversationRef => ({
  kind: "channel",
  id,
  label,
  agentPubkey: "dev-agent-session",
  sessionKind: "claude",
});

// The dev/e2e binding: one real workstream (`launch-site` — the same node
// Jordan reads in the Map and the dependency strip) and two real attention
// items, each bound to a Buzz channel + its live agent session, so the inbox
// shows a bound conversation (and the write path) instead of the empty gap.
// The channel ids are placeholders until the live wire resolves real Buzz
// channels — flagged, not passed off as real.
export const DEV_WORKSTREAM_BINDING: Record<string, BoundConversationRef[]> = {
  "launch-site": [devAgentChannel("#launch-site", "dev-binding-launch-site")],
  [DEV_ACCEPT_ATTENTION_ID]: [
    devAgentChannel("#launch-site-review", "dev-binding-attn-accept"),
  ],
  [DEV_MISMATCH_ATTENTION_ID]: [
    devAgentChannel("#demand-loop-review", "dev-binding-attn-mismatch"),
  ],
};
