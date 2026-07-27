// HQ shell prototype — the frozen contract vocabulary (Seams 3, 5, 6).
// Fixture-only. Mirrors HQ's real safe projection/intent surface so the same
// fixtures can later become the LoopbackHqTransport contract test suite.
// See RESEARCH/BUZZ_HQ_CONSTITUTIONAL_FREEZE_2026_07_26.md.

import type { Activity } from "./activity";

// --- Seam 3: shared state + receipt vocabulary --------------------------------

export type Freshness = "live" | "recent" | "stale" | "unknown";

export interface ProjectionMeta {
  id: string;
  sourceVersion: string;
  freshness: Freshness;
  observedAt: string; // ISO-8601
}

export type ReceiptStatus =
  | "accepted"
  | "rejected"
  | "stale"
  | "conflicted"
  | "pending";

export interface Receipt {
  status: ReceiptStatus;
  intentId: string;
  subjectId: string;
  sourceVersion?: string;
  message?: string;
  observedAt: string;
}

// HQ's authoritative Ready-Frontier buckets (`hq next` → `.counts`). A flat
// numeric composition — one field per bucket. The five-bucket shape hid ~60% of
// the portfolio (`research` alone is the largest bucket), so this mirrors all
// nine HQ groups.
export interface FrontierComposition {
  ready: number;
  running: number;
  verifying: number;
  needsContract: number;
  toGrill: number;
  needsJordan: number;
  waiting: number;
  research: number;
  blocked: number;
}

export type LifecycleState =
  | "loading"
  | "empty"
  | "ready"
  | "stale"
  | "unauthorized"
  | "offline"
  | "unsupported"
  | "pending"
  | "rejected"
  | "conflicted"
  | "planned-maintenance";

// The reality-resolved primary action on a Workstream.
export type PrimaryAction =
  | "join-orchestration"
  | "resume-previous-session"
  | "start-orchestration"
  | "open-inspect-only"
  | "prepare-to-resume";

// --- Seam 5: actor identities -------------------------------------------------

export type ActorKind =
  | "persona" // durable Buzz conversational identity
  | "role-profile" // summonable Pack specialization
  | "worker" // ephemeral HQ execution identity, per-Outcome
  | "session"; // the native run thread

export interface Actor {
  id: string;
  kind: ActorKind;
  label: string;
  presence?: string; // e.g. "reviewing Outcome D2"
  outcomeId?: string; // set for ephemeral workers
  modelRoute?: string; // shown, never pinned by the UI
}

// --- Work domain projections --------------------------------------------------

export interface WorkstreamRow extends ProjectionMeta {
  title: string;
  objective: string;
  grouping?: string; // program / release / source
  frontier: FrontierComposition;
  nextAction: string; // exact next move or blocking reason
  actors: Actor[];
  lastChange: string; // human-facing "last meaningful change"
  primaryAction: PrimaryAction;
  lifecycle: LifecycleState;
  risk?: string;
  // The union of every outcome's DependencyEdge on this workstream (source =
  // outcome id). Carried at the portfolio-row level — not just WorkstreamDetail
  // — so a portfolio-wide dependency graph (D3, the Map) can be assembled from
  // `getWorkstreamPortfolio()` alone, without an N+1 per-workstream detail
  // fetch. WorkstreamDetail inherits this field for free.
  edges?: DependencyEdge[];
}

export interface OutcomeSummary {
  id: string;
  title: string;
  // HQ's outcome states, widened to mirror the frontier buckets: `ready`,
  // `needsContract`, `toGrill`, and `research` join the original set.
  state:
    | "running"
    | "verifying"
    | "needs-you"
    | "waiting"
    | "blocked"
    | "done"
    | "ready"
    | "needsContract"
    | "toGrill"
    | "research";
  proofContract?: string;
  // The Outcome's plan (SourceOutcome.executionContract): the deliverables it
  // must produce and the evidence its proof gate requires to close.
  executionContract?: {
    deliverables: string[];
    requiredEvidence: string[];
  };
  // The outcome's own typed lineage (SourceOutcome.contextLinks): the
  // decision/grill/spec that controls it. Opening an outcome surfaces these so
  // its controlling call is one click away.
  contextLinks?: LineageLink[];
  // This outcome's own typed dependency edges (source === this outcome's id),
  // read from HQ's `lifecycleFacts.dependencyEdges` + `dependencies`. See
  // `DependencyEdge` below — this is the per-outcome slice of the same typed
  // edge model that rolls up onto `WorkstreamRow.edges`.
  dependencyEdges?: DependencyEdge[];
}

// --- typed dependency edges (D3/D4 shared foundation) -------------------------
// HQ's real captures carry actual typed edges (`outcome.lifecycleFacts.
// dependencyEdges`, `outcome.dependencies`, release-item `blockedBy`) — this is
// the app-side typed model that preserves them, instead of collapsing them
// into `dependencyChain`'s opaque string list. `kind` is HQ's raw edge-kind
// string (observed: "blocked-by-workstream", "requires-outcome") passed
// through as-is rather than re-enumerated, so a new HQ edge kind degrades to
// "an edge with an unfamiliar kind" instead of vanishing.
export interface DependencyEdge {
  source: string; // the outcome id this edge belongs to
  target: string; // the workstream/outcome id it depends on or is blocked by
  kind: string;
}

// The federated frontier workflow route (HQ: release-train workflow-routing.md).
// `waiting` = a named external event must occur first; `blocked` = a named
// dependency or failure prevents progress (has a blocked-by edge). They are
// NOT the same state.
export type WorkflowRoute =
  | "ready"
  | "to-grill"
  | "research"
  | "waiting"
  | "needs-jordan"
  | "blocked";

// Typed decision lineage (HQ: decision-lineage.md). Every accepted item carries
// navigable links to the sources that govern it. `present: false` renders the
// honest gap ("no ADR yet") instead of hiding it.
export type LineageRelation =
  | "origin"
  | "decision"
  | "grill"
  | "adr"
  | "spec"
  | "research"
  | "issue"
  | "handoff"
  | "run"
  | "review"
  | "proof"
  | "prototype"
  | "visual-contract"
  | "adjudication"
  | "completion";

export interface LineageLink {
  relation: LineageRelation;
  label: string;
  // An opaque HQ reference string (a pin), NOT a URI — HQ stores the coordinate,
  // not the content. The app decides how (and whether) it opens.
  reference: string;
  version?: string; // which source state it used
  present: boolean; // false → "not linked yet" (app-side; HQ only stores existing)
}

// The five things `hq outcome show` must answer (decision-lineage.md).
export interface OutcomeContract {
  what: string; // what happened or was requested
  controllingDecision: string; // which decision controls the work
  authorizedResult: string; // the bounded result authorized
  proofThatCloses: string; // which proof closes it
  unknown?: string; // what remains unknown
}

// A run/session execution receipt attached to the workstream (native session
// history is evidence attached to the durable Workstream).
export interface RunReceipt {
  id: string;
  label: string; // "Codex session #88"
  result: string; // "verified · no regressions"
  at: string;
}

export interface WorkstreamDetail extends WorkstreamRow {
  // A plain-language brief: what this stream is, where it stands, and — when it
  // needs you — what the call actually is. Human first, jargon-free. This is the
  // top of the left panel, the stream telling you its own story.
  brief: string;
  truthNow: string; // what is true now
  truthOwner: string; // who/what owns that truth
  workflow: WorkflowRoute;
  origin?: string; // where this work came from (SourceWorkstream.origin)
  outcomeContract?: OutcomeContract; // the five "why it exists" questions
  outcomes: OutcomeSummary[];
  lineage: LineageLink[]; // the typed source chain (present + absent)
  plan?: { summary: string; steps: string[] }; // once it no longer needs a grill
  proofGate?: { status: "open" | "passed" | "failed"; contract: string };
  runs?: RunReceipt[];
  dependencyChain?: string[];
  boundConversations: BoundConversationRef[];
}

export interface AttentionItem extends ProjectionMeta {
  kind: "grill" | "decision" | "approval" | "review";
  title: string;
  question: string;
  options: string[];
  evidence?: string;
  workstreamId?: string;
  outcomeId?: string;
  // The content version of this attention package — HQ's `open[].packageDigest`
  // (a `sha256:<64hex>`). Both founder write verbs compare it and refuse on
  // mismatch, so it must round-trip verbatim from read → confirm → submit.
  // HQ emits `null` for a non-conforming stored digest; `null` projects to
  // `undefined` here (absent = not submittable, no shape-check needed).
  packageDigest?: string;
}

export interface PackSurface {
  key: string;
  title: string;
  slot: string; // stable extension slot name
}

// --- Releases: every app-related thing carries its release --------------------

export interface ReleaseChecklistItem {
  label: string;
  done: boolean;
  owner?: string; // which part of the company owns it (code / marketing / ...)
  // The honest status vocabulary (activity.ts), computed once at the mapping
  // layer since the raw HQ state/workflow/blockedBy fields aren't otherwise
  // preserved on this checklist shape. `done` stays as the simple boolean the
  // roll-up needs; `activity` is what the UI badges.
  activity: Activity;
  // The raw `blockedBy` target id(s), normalized to a list — previously read
  // only to derive `activity` (deriveActivity) and then discarded. Kept here
  // so a release item can also contribute edges to a portfolio-wide
  // dependency graph, not just gate its own status pill.
  blockedByIds?: string[];
}

export interface ReleaseSummary extends ProjectionMeta {
  company: string; // "Latent Sea"
  product: string; // "Salience"
  version: string; // "0.2.5"
  channel: "stable" | "beta" | "hotfix" | "internal";
  state: "planning" | "in-progress" | "verifying" | "blocked" | "shipped";
  headline: string; // one line: what this release is
  required: ReleaseChecklistItem[]; // what's required / what's left
  workstreamId?: string; // the work that carries it
}

// --- Recent activity: "what just happened while you were gone" ----------------

export type RecentEventKind =
  | "shipped"
  | "merged"
  | "decided"
  | "verified"
  | "started"
  | "blocked";

export interface RecentEvent {
  id: string;
  kind: RecentEventKind;
  title: string;
  detail?: string;
  actorLabel?: string;
  at: string; // human-facing relative time, e.g. "12m ago"
  workstreamId?: string;
}

// --- Conversation: the surface you land in when you click ANYTHING -----------
// A grill, a workstream, a task, a decision — clicking it never opens a modal.
// It opens the two-panel inbox: context on the left, this conversation (with a
// real composer) on the right. A grill is a chat with an agent, not a verdict
// form.

export type ConversationAuthorKind = "founder" | "agent" | "system";

export interface ConversationMessage {
  id: string;
  author: string; // display label — "You", "Fizz", "HQ", "Codex #88"
  authorKind: ConversationAuthorKind;
  body: string;
  at: string; // human-facing relative time, e.g. "4m ago"
}

export interface Conversation {
  subjectId: string; // workstream id or attention id it's bound to
  title: string;
  subtitle?: string; // one line of orientation under the title
  messages: ConversationMessage[];
  // For a grill/decision: stances the founder can insert into the composer and
  // send in their own words. Never auto-submitted — this stays a discussion.
  suggestions?: string[];
}

// --- Session → workstream binding (D5 write-path blocker (b)) -----------------
// The missing wire the write path needs: which Buzz channel/thread carries the
// live agent session bound to a workstream/attention subject, so the confirm →
// submit path can hand it prose and receive an HQ receipt back. The shell can
// never originate a `hq founder intent` itself (it isn't a native session); it
// relays into a real agent session that can. This is that lookup.

export interface BoundConversationRef {
  kind: "channel" | "thread";
  id: string; // Buzz channel UUID or thread root event id
  label: string; // human label — "#salience-0-2-5"
  // The native-session identity the relay must reach to shell `hq founder
  // intent`. Absent until a live session is actually bound — carried here (not
  // invented) so the write path can address a real session when one exists.
  agentPubkey?: string;
  sessionKind?: "codex" | "claude"; // → CODEX_THREAD_ID / HQ_CLAUDE_SESSION_ID
}

// The resolver seam. One conforming implementation per binding source (empty
// today, a Buzz presence/registry lookup later) — nothing else in the surface
// changes when a new source is added. The rigid core; the growable edge.
export interface WorkstreamConversationBinding {
  // Every conversation bound to a workstream/attention subject (may be empty).
  boundFor(subjectId: string): BoundConversationRef[];
}

// The bytes the operator approves for a founder reply. The shell NEVER shells
// `hq founder intent` itself (it isn't a native session); it hands these to the
// bound agent session, which assembles `admissionId` (from its own `hq enter`)
// and submits `native-founder-intent-v1`. So the shell's boundary carries only
// what the operator authored + the exact digest read from HQ.
export interface FounderReplyInput {
  attentionId: string;
  packageDigest: string; // must equal HQ's open[].packageDigest verbatim
  reply: string;
  idempotencyKey: string; // client-side dedupe; the relay may thread it through
}

// The write seam (D5): routing an approved reply to the bound agent session and
// returning HQ's receipt. NOT an HqTransport read — the shell can't originate
// the write. One implementation per relay source: unbound (no live session) by
// default, a fixture for dev/e2e, a real Buzz-channel relay later.
export interface FounderReplyRelay {
  submit(input: FounderReplyInput): Promise<Receipt>;
}

// --- Company structure: the org / structure lens (Projects surface) ----------
// Home is the attention/time lens ("what needs me, what's alive"). Projects is
// the structure lens: company → teams → projects → workstreams + cross-team
// waits. Where HQ doesn't model a piece yet, it is marked honestly, never
// invented.

export type TeamKind = "dev" | "marketing" | "community" | "ops" | "design";

export interface TeamRef {
  id: string;
  name: string;
  kind: TeamKind;
}

export interface ProjectWorkstreamRef {
  id: string; // workstream id (present even when not yet modeled in HQ)
  title: string;
  teamId?: string; // owning team
  state:
    | "running"
    | "verifying"
    | "needs-you"
    | "waiting"
    | "blocked"
    | "done"
    | "not-modeled";
  waitingOn?: string; // cross-team dependency, human text ("waiting on Dev")
  modeled: boolean; // false → rendered as "not modeled in HQ yet"
}

export interface ProjectSummary {
  id: string;
  name: string; // "Salience"
  company: string; // "Latent Sea"
  headline: string;
  teams: TeamRef[]; // the teams that touch this project
  workstreams: ProjectWorkstreamRef[];
  releaseId?: string; // the release this project currently carries
}

export interface CompanyStructure {
  company: string;
  teams: TeamRef[];
  projects: ProjectSummary[];
}

// --- Seam 6: typed intents (all idempotent, all return a Receipt) -------------

export type IntentKind =
  | "enter"
  | "inspect"
  | "claim"
  | "takeover"
  | "release"
  | "resume"
  | "stop"
  | "replan"
  | "submit-founder-decision"
  | "promote-thread-to-work"
  | "assign-worker";

export interface TypedIntent {
  kind: IntentKind;
  subjectId: string;
  intentId: string; // idempotency key
  expectedSourceVersion?: string; // optimistic fence
  payload?: Record<string, unknown>;
}

// The single socket. FixtureTransport and LoopbackHqTransport are interchangeable.
export interface HqTransport {
  getWorkstreamPortfolio(): Promise<WorkstreamRow[]>;
  getWorkstream(id: string): Promise<WorkstreamDetail | null>;
  getReadyFrontier(): Promise<FrontierComposition>;
  // Distinct workstream ids with ≥1 run in `state === "running"` right now —
  // the ONLY honest source for "Working now" (activity.ts). Frontier buckets
  // are outcome-state snapshots and must never be used for this.
  getWorkingNow(): Promise<string[]>;
  getFounderAttention(): Promise<AttentionItem[]>;
  getPackSurfaces(): Promise<PackSurface[]>;
  getReleases(): Promise<ReleaseSummary[]>;
  getRecentActivity(): Promise<RecentEvent[]>;
  getConversation(subjectId: string): Promise<Conversation | null>;
  getCompanyStructure(): Promise<CompanyStructure>;
  submitIntent(intent: TypedIntent): Promise<Receipt>;
  // The founder write path (D5). Distinct from submitIntent (Seam 6's generic
  // TypedIntent doesn't match the real `native-founder-intent-v1` shape). Routes
  // an approved reply to the bound agent session and returns HQ's receipt.
  submitFounderReply(input: FounderReplyInput): Promise<Receipt>;
}

// --- Saved lenses over the portfolio -----------------------------------------

export type LensKey =
  | "all"
  | "needs-me"
  | "to-grill"
  | "running"
  | "verifying"
  | "waiting"
  | "blocked"
  | "recently-changed";

export interface Lens {
  key: LensKey;
  label: string;
  predicate: (row: WorkstreamRow) => boolean;
}
