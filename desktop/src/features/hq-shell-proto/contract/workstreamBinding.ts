// Session → workstream binding implementations (D5 write-path blocker (b)).
//
// The interface (`WorkstreamConversationBinding`) lives in types.ts alongside
// the rest of the contract; the concrete resolvers live here, exactly like
// HqTransport (interface in types.ts) vs. LiveHqTransport / FixtureTransport.
//
// Three sources conform to the one seam:
//   • Empty   — nothing bound, no session (honest pre-wire default).
//   • Fixture — a static in-memory map for dev/e2e (the write-path demo).
//   • Live    — HQ's `conversation-binding-v1` read. Renders the live session
//               even before any Buzz channel is registered (`bound === false`),
//               so the surface says "a live codex session is orchestrating
//               this" instead of "nothing bound yet".

import type { HqClient } from "./LiveHqTransport";
import type {
  BoundConversationRef,
  LiveSessionRef,
  SubjectBinding,
  WorkstreamConversationBinding,
} from "./types";

const EMPTY_BINDING: SubjectBinding = {
  conversations: [],
  session: null,
  bound: false,
};

// Honest default. Nothing is bound and no session is reported → getConversation()
// stays null and WorkstreamDetail.boundConversations stays []. Byte-identical to
// the pre-binding behavior: "delete the binding and the surface is unchanged".
export const EmptyWorkstreamBinding: WorkstreamConversationBinding = {
  resolve: async () => EMPTY_BINDING,
};

// A static, in-memory binding for dev/e2e. Keyed by the exact `subjectId` the
// inbox requests — a workstream id (e.g. "launch-site") or an attention item
// id. Real ids only; never invent a subject that the portfolio can't open.
export class FixtureWorkstreamBinding implements WorkstreamConversationBinding {
  private readonly bindings: ReadonlyMap<string, BoundConversationRef[]>;

  constructor(entries: Record<string, BoundConversationRef[]>) {
    this.bindings = new Map(Object.entries(entries));
  }

  async resolve(subjectId: string): Promise<SubjectBinding> {
    const conversations = this.bindings.get(subjectId) ?? [];
    // The fixture carries no live session — its point is the bound-conversation
    // write-path demo, so `bound` tracks whether a conversation is present.
    return { conversations, session: null, bound: conversations.length > 0 };
  }
}

// The shape HQ's `hq workstream binding <id>` / GET /v1/conversation-bindings/:id
// returns (schema "conversation-binding-v1"). Only the fields the surface reads
// are typed; everything is treated as optional/nullable at the boundary.
interface RawConversationBinding {
  conversation?: { kind?: string; id?: string; label?: string } | null;
  session?: {
    sessionKind?: "codex" | "claude" | null;
    harness?: string;
    nativeSessionId?: string;
    agentPubkey?: string | null;
    admissionId?: string;
    lifecycleState?: string;
    leaseRelation?: "no-writer" | "current-writer" | "other-writer";
    transcriptPointer?: string | null;
    resumeOperation?: string | null;
  } | null;
  bound?: boolean;
}

function mapSession(
  raw: RawConversationBinding["session"],
): LiveSessionRef | null {
  if (!raw) return null;
  return {
    sessionKind: raw.sessionKind ?? null,
    harness: raw.harness ?? "",
    nativeSessionId: raw.nativeSessionId ?? "",
    agentPubkey: raw.agentPubkey ?? null,
    admissionId: raw.admissionId ?? "",
    lifecycleState: raw.lifecycleState ?? "",
    leaseRelation: raw.leaseRelation ?? "no-writer",
    transcriptPointer: raw.transcriptPointer ?? null,
    resumeOperation: raw.resumeOperation ?? null,
  };
}

// The live source: HQ's conversation-binding read. Serves the live session now;
// bound conversations only once `bound === true` (i.e. HQ's registration write
// path has authored real relay coordinates — null for every subject today).
export class LiveWorkstreamBinding implements WorkstreamConversationBinding {
  // Explicit field rather than a constructor parameter property — the desktop
  // unit runner strips types in strip-only mode, which rejects TS parameter
  // properties (`constructor(private readonly x)`).
  private readonly client: HqClient;

  constructor(client: HqClient) {
    this.client = client;
  }

  async resolve(subjectId: string): Promise<SubjectBinding> {
    const raw = (await this.client.getJson(
      `/v1/conversation-bindings/${subjectId}`,
    )) as RawConversationBinding;

    const session = mapSession(raw.session);

    // Only surface a bound conversation when HQ says so AND it carries real
    // coordinates. The agent-session identity for the write path comes from the
    // live session, not fabricated onto the conversation.
    const conv = raw.conversation;
    const conversations: BoundConversationRef[] =
      raw.bound === true && conv?.id
        ? [
            {
              kind: conv.kind === "thread" ? "thread" : "channel",
              id: conv.id,
              label: conv.label ?? conv.id,
              agentPubkey: session?.agentPubkey ?? undefined,
              sessionKind: session?.sessionKind ?? undefined,
            },
          ]
        : [];

    return { conversations, session, bound: raw.bound === true };
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
