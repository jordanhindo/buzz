// HQ shell prototype — representative fixtures (Seam 7).
// Fixture-only. Mirrors HQ's real projection shapes so the same data can
// later become the LoopbackHqTransport contract test suite. Every
// lie-inducing state named in the freeze doc's Seam 7 + the wireflows'
// failure catalog appears here as a real row, not a hypothetical.
// See RESEARCH/BUZZ_HQ_CONSTITUTIONAL_FREEZE_2026_07_26.md.

import type {
  Actor,
  AttentionItem,
  CompanyStructure,
  Conversation,
  ConversationMessage,
  FrontierComposition,
  LineageLink,
  OutcomeSummary,
  PackSurface,
  ProjectSummary,
  RecentEvent,
  ReleaseSummary,
  TeamRef,
  WorkflowRoute,
  WorkstreamDetail,
  WorkstreamRow,
} from "./types";
import { DETAIL_OVERRIDES, type OutcomeSpec } from "./detailOverrides";

// --- Actor identities (Seam 5) --------------------------------------------

// Personas — durable, Buzz-owned, conversational. They are NEVER assigned an
// Outcome or turned into a Worker by the shell; presenting them is fine,
// promoting them to authority is not.
export const PERSONAS: Actor[] = [
  {
    id: "persona-navigator",
    kind: "persona",
    label: "Navigator",
    presence: "online",
  },
  {
    id: "persona-fizz",
    kind: "persona",
    label: "Fizz",
    presence: "in a huddle",
  },
];

// Role Profiles — summonable Pack specializations. Durable/versioned, but
// NOT a permanent roster entry — they become a Worker only once assigned.
export const ROLE_PROFILES: Actor[] = [
  {
    id: "role-reviewer",
    kind: "role-profile",
    label: "Reviewer",
    presence: "summonable specialization",
  },
  {
    id: "role-researcher",
    kind: "role-profile",
    label: "Researcher",
    presence: "summonable specialization",
  },
];

// Ephemeral Workers — HQ-owned, per-Outcome, admitted transiently. They must
// disappear from the People directory when their Outcome ends; the fixture
// only ever shows them scoped to the Workstream row/detail that hosts them.
const WORKER_SECURITY_REVIEW: Actor = {
  id: "worker-secreview-d2",
  kind: "worker",
  label: "Security review · Outcome D2",
  outcomeId: "outcome-d2",
  presence: "reviewing Outcome D2",
  modelRoute: "claude-opus-4.6",
};

const WORKER_PERF_TRIAGE: Actor = {
  id: "worker-perf-c7",
  kind: "worker",
  label: "Perf regression triage · Outcome C7",
  outcomeId: "outcome-c7",
  presence: "triaging Outcome C7",
  modelRoute: "gpt-5.4-codex",
};

// Sessions — the native run thread (Codex/Claude/Cursor), one per run.
const SESSION_CODEX_88: Actor = {
  id: "session-codex-88",
  kind: "session",
  label: "Codex session #88",
  presence: "running",
  modelRoute: "gpt-5.4-codex",
};

const SESSION_CLAUDE_14: Actor = {
  id: "session-claude-14",
  kind: "session",
  label: "Claude session #14",
  presence: "idle, resumable",
  modelRoute: "claude-sonnet-5",
};

// --- Workstream portfolio (Seam 7 lie-inducing states) ---------------------

const NOW = "2026-07-25T17:00:00Z";

function frontier(partial: Partial<FrontierComposition>): FrontierComposition {
  return {
    ready: 0,
    running: 0,
    verifying: 0,
    needsContract: 0,
    toGrill: 0,
    needsJordan: 0,
    waiting: 0,
    research: 0,
    blocked: 0,
    ...partial,
  };
}

export const WORKSTREAMS: WorkstreamRow[] = [
  // Mixed/composite frontier — a single "Active" badge would be dishonest.
  {
    id: "ws-checkout-latency",
    sourceVersion: "v41",
    freshness: "live",
    observedAt: NOW,
    title: "0.2.5 first-use crash hot-fix",
    objective:
      "Fix the self-destructing completion lambda that crashes Salience on first launch, then re-cut the notarized 0.2.5 Mac build.",
    grouping: "Salience 0.2.5",
    frontier: frontier({
      running: 2,
      verifying: 1,
      toGrill: 1,
      needsJordan: 1,
      waiting: 1,
    }),
    nextAction: "Approve shipping 0.2.5 once CI is green",
    actors: [SESSION_CODEX_88, WORKER_PERF_TRIAGE, PERSONAS[0]],
    lastChange: "Run #41 finished verifying 12m ago",
    primaryAction: "join-orchestration",
    lifecycle: "ready",
  },
  // Active orchestration — live Run + bound Session.
  {
    id: "ws-vendor-onboarding",
    sourceVersion: "v18",
    freshness: "live",
    observedAt: NOW,
    title: "Vendor onboarding pipeline",
    objective: "Automate KYC intake for new marketplace vendors.",
    grouping: "Platform",
    frontier: frontier({ running: 3, research: 1 }),
    nextAction: "Orchestration in progress — no action needed",
    actors: [SESSION_CLAUDE_14, PERSONAS[1]],
    lastChange: "Session resumed 4m ago",
    primaryAction: "join-orchestration",
    lifecycle: "ready",
  },
  // Planned maintenance — daemon intentionally stopped. Labeled, not an outage.
  {
    id: "ws-nightly-index",
    sourceVersion: "v9",
    freshness: "recent",
    observedAt: NOW,
    title: "Nightly index rebuild",
    objective: "Rebuild the search index nightly for freshness.",
    grouping: "Infra",
    frontier: frontier({ waiting: 1 }),
    nextAction: "Daemon paused for scheduled maintenance until 02:00 UTC",
    actors: [],
    lastChange: "Maintenance window started 40m ago",
    primaryAction: "open-inspect-only",
    lifecycle: "planned-maintenance",
  },
  // Stale source — button must say "Prepare to resume," never "Resume."
  {
    id: "ws-legacy-billing",
    sourceVersion: "v7",
    freshness: "stale",
    observedAt: NOW,
    title: "Legacy billing sync",
    objective:
      "Reconcile the legacy billing ledger with the new invoicing service.",
    grouping: "Finance",
    frontier: frontier({ needsJordan: 1, waiting: 2 }),
    nextAction: "Prepare to resume — source snapshot is 14h old",
    actors: [PERSONAS[0]],
    lastChange: "Last synced 14h ago",
    primaryAction: "prepare-to-resume",
    lifecycle: "stale",
    risk: "Source snapshot is 14h old — refresh before resuming.",
  },
  // Source/connector conflict — a live writer/fence is present.
  {
    id: "ws-data-warehouse",
    sourceVersion: "v23",
    freshness: "live",
    observedAt: NOW,
    title: "Data warehouse connector",
    objective: "Land nightly analytics exports into the warehouse.",
    grouping: "Data",
    frontier: frontier({ running: 1, needsJordan: 1, blocked: 1 }),
    nextAction: "Resolve the competing writer before continuing",
    actors: [SESSION_CODEX_88],
    lastChange: "Conflict detected 6m ago",
    primaryAction: "open-inspect-only",
    lifecycle: "conflicted",
    risk: "ops-console holds an active fence on this Workstream.",
  },
  // Unauthorized actor — rejected on authority grounds, not a fake success.
  {
    id: "ws-security-policy",
    sourceVersion: "v5",
    freshness: "live",
    observedAt: NOW,
    title: "Security policy rewrite",
    objective: "Rewrite the data-retention policy ahead of SOC2 renewal.",
    grouping: "Security",
    frontier: frontier({ verifying: 1, needsJordan: 1 }),
    nextAction: "Requires Founder authority — your role lacks Approve",
    actors: [WORKER_SECURITY_REVIEW],
    lastChange: "Blocked on authority 2h ago",
    primaryAction: "open-inspect-only",
    lifecycle: "unauthorized",
    risk: "Your role lacks Approve authority for this policy change.",
  },
  // Mobile-style pending — delivered, not yet accepted. Never auto-resolves.
  {
    id: "ws-customer-migration",
    sourceVersion: "v31",
    freshness: "recent",
    observedAt: NOW,
    title: "Customer migration wave 3",
    objective: "Migrate wave-3 enterprise customers to the new billing plan.",
    grouping: "Customer Success",
    frontier: frontier({ running: 1, needsJordan: 1 }),
    nextAction: "Decision submitted from mobile — awaiting HQ receipt",
    actors: [PERSONAS[1]],
    lastChange: "Submitted from mobile 3m ago",
    primaryAction: "open-inspect-only",
    lifecycle: "pending",
  },
  // Explicit rejection — the reason is shown, not a silent drop.
  {
    id: "ws-onboarding-experiment",
    sourceVersion: "v2",
    freshness: "live",
    observedAt: NOW,
    title: "Onboarding flow experiment",
    objective: "Test a shortened onboarding flow with the new cohort.",
    grouping: "Growth",
    frontier: frontier({ needsContract: 1, blocked: 1 }),
    nextAction: "Rejected: contract validation failed (missing proof spec)",
    actors: [],
    lastChange: "Rejected 1h ago",
    primaryAction: "open-inspect-only",
    lifecycle: "rejected",
    risk: "Contract validation failed — missing proof spec for Outcome.",
  },
  // Recovery — a post-failure resume plan that does not auto-authorize.
  {
    id: "ws-relay-recovery",
    sourceVersion: "v56",
    freshness: "recent",
    observedAt: NOW,
    title: "Incident recovery: relay outage",
    objective:
      "Restore relay availability and backfill missed events after the outage.",
    grouping: "Infra",
    frontier: frontier({ verifying: 1, needsJordan: 1, waiting: 1 }),
    nextAction:
      "Resume plan drafted after last failure — review before resuming",
    actors: [SESSION_CLAUDE_14, PERSONAS[0]],
    lastChange: "Failed at 03:12, resume plan drafted 03:40",
    primaryAction: "prepare-to-resume",
    lifecycle: "ready",
    risk: "Recovering from a failed run — resume is not automatic.",
  },
  // Waiting-heavy frontier.
  {
    id: "ws-design-audit",
    sourceVersion: "v3",
    freshness: "live",
    observedAt: NOW,
    title: "Design system audit",
    objective: "Audit component drift across the design system.",
    grouping: "Design",
    frontier: frontier({ research: 2, waiting: 1 }),
    nextAction: "Mapping component drift across the library",
    actors: [PERSONAS[1]],
    lastChange: "Drift scan started 2h ago",
    primaryAction: "open-inspect-only",
    lifecycle: "ready",
  },
  // Blocked-heavy frontier.
  {
    id: "ws-partner-api",
    sourceVersion: "v11",
    freshness: "live",
    observedAt: NOW,
    title: "Partner API integration",
    objective: "Ship the v2 partner API with rate-limit tiers.",
    grouping: "Platform",
    frontier: frontier({ toGrill: 1, needsJordan: 1, blocked: 2 }),
    nextAction: "Blocked on partner sandbox credentials",
    actors: [],
    lastChange: "Blocked 5h ago",
    primaryAction: "open-inspect-only",
    lifecycle: "ready",
    risk: "Blocked on partner sandbox credentials.",
  },
  // Offline — the relay/gateway is unreachable; last-known state only.
  {
    id: "ws-field-ops-sync",
    sourceVersion: "v4",
    freshness: "unknown",
    observedAt: NOW,
    title: "Field ops companion sync",
    objective: "Sync field-ops checklists for the mobile companion.",
    grouping: "Mobile",
    frontier: frontier({}),
    nextAction: "Relay unreachable — showing last known state",
    actors: [],
    lastChange: "Last seen 1d ago",
    primaryAction: "open-inspect-only",
    lifecycle: "offline",
  },
  // Unsupported — a capability this workspace doesn't have, not an error.
  {
    id: "ws-legacy-slack-bridge",
    sourceVersion: "v1",
    freshness: "unknown",
    observedAt: NOW,
    title: "Legacy Slack bridge",
    objective:
      "Bridge legacy Slack workflows into HQ (deprecated integration).",
    grouping: "Automations",
    frontier: frontier({}),
    nextAction: "This capability isn't available in this workspace yet",
    actors: [],
    lastChange: "Never connected",
    primaryAction: "open-inspect-only",
    lifecycle: "unsupported",
  },
];

// Expand a row's frontier composition into one Outcome per bucket unit, in the
// same most-urgent-first order the LED and chips use, so the Outcomes list reads
// consistently with the frontier badge.
function outcomesFromFrontier(
  row: WorkstreamRow,
  specs: OutcomeSpec[],
): OutcomeSummary[] {
  const f = row.frontier;
  const states: OutcomeSummary["state"][] = [];
  for (let i = 0; i < f.blocked; i++) states.push("blocked");
  for (let i = 0; i < f.needsJordan; i++) states.push("needs-you");
  for (let i = 0; i < f.toGrill; i++) states.push("toGrill");
  for (let i = 0; i < f.needsContract; i++) states.push("needsContract");
  for (let i = 0; i < f.verifying; i++) states.push("verifying");
  for (let i = 0; i < f.running; i++) states.push("running");
  for (let i = 0; i < f.research; i++) states.push("research");
  for (let i = 0; i < f.waiting; i++) states.push("waiting");
  for (let i = 0; i < f.ready; i++) states.push("ready");
  if (states.length === 0) states.push("done");
  return states.map((state, index) => {
    const spec = specs[index];
    const executionContract =
      spec && (spec.deliverables || spec.requiredEvidence)
        ? {
            deliverables: spec.deliverables ?? [],
            requiredEvidence: spec.requiredEvidence ?? [],
          }
        : undefined;
    return {
      id: `${row.id}-outcome-${index}`,
      title: spec?.label ?? `${row.title} — outcome ${index + 1}`,
      state,
      proofContract: state === "done" ? "closed · proof on file" : undefined,
      executionContract,
      contextLinks: spec?.contextLinks,
    };
  });
}

// Default workflow route when a row doesn't ground one explicitly. Follows the
// dominant-frontier priority so the badge never contradicts the LED.
function defaultWorkflow(row: WorkstreamRow): WorkflowRoute {
  const f = row.frontier;
  if (f.needsJordan > 0) return "needs-jordan";
  if (f.blocked > 0) return "blocked";
  if (f.toGrill > 0) return "to-grill";
  if (f.research > 0 && f.running === 0 && f.verifying === 0) return "research";
  if (f.waiting > 0 && f.running === 0 && f.verifying === 0) return "waiting";
  return "ready";
}

// Every workstream carries lineage — an origin link that's present and an ADR
// that honestly isn't (it gets created during the grill). Grounded rows extend
// this with the real typed chain.
function defaultLineage(row: WorkstreamRow): LineageLink[] {
  return [
    {
      relation: "origin",
      label: `${row.grouping ?? "HQ"} intake`,
      reference: `hq://workstream/${row.id}`,
      present: true,
    },
    {
      relation: "adr",
      label: "none yet (created during grill)",
      reference: "",
      present: false,
    },
  ];
}

// A plain-language fallback brief for rows without a hand-written one, so the
// top of every stream reads like a human wrote it, not a status enum.
function defaultBrief(row: WorkstreamRow): string {
  const f = row.frontier;
  if (f.needsJordan > 0) {
    return `${row.objective} Right now it's waiting on you — ${row.nextAction.toLowerCase()}.`;
  }
  if (f.blocked > 0) {
    return `${row.objective} It's stuck for now — ${row.nextAction.toLowerCase()} — so nothing moves until that clears.`;
  }
  return `${row.objective} It's moving on its own — ${row.nextAction.toLowerCase()}. Nothing needed from you yet.`;
}

export const WORKSTREAM_DETAILS: Record<string, WorkstreamDetail> =
  Object.fromEntries(
    WORKSTREAMS.map((row) => {
      const overrides = DETAIL_OVERRIDES[row.id] ?? {};
      const detail: WorkstreamDetail = {
        ...row,
        brief: overrides.brief ?? defaultBrief(row),
        truthNow: overrides.truthNow ?? row.nextAction,
        truthOwner: overrides.truthOwner ?? "HQ",
        workflow: overrides.workflow ?? defaultWorkflow(row),
        origin: overrides.origin,
        outcomeContract: overrides.outcomeContract,
        outcomes: outcomesFromFrontier(row, overrides.outcomeSpecs ?? []),
        lineage: overrides.lineage ?? defaultLineage(row),
        plan: overrides.plan,
        proofGate: overrides.proofGate,
        runs: overrides.runs,
        dependencyChain: overrides.dependencyChain,
        boundConversations: overrides.boundConversations ?? [],
      };
      return [row.id, detail];
    }),
  );

// --- Founder Attention (Needs Me / To Grill) -------------------------------

export const ATTENTION_ITEMS: AttentionItem[] = [
  {
    id: "attn-checkout-grill",
    sourceVersion: "v41",
    freshness: "live",
    observedAt: NOW,
    kind: "grill",
    title: "How should we finish the 0.2.5 crash hot-fix?",
    question:
      "The crash fix is verified locally but CI is still red on Mac + Windows. How should we get 0.2.5 out?",
    options: [
      "Ship 0.2.5 as soon as CI is green",
      "Ship now with a manual notarized build, repair CI after",
      "Hold 0.2.5 until both runners are green",
    ],
    evidence:
      "Crash fix landed 12m ago; Mac + Windows CI runners are still failing.",
    workstreamId: "ws-checkout-latency",
  },
  {
    id: "attn-billing-decision",
    sourceVersion: "v7",
    freshness: "stale",
    observedAt: NOW,
    kind: "decision",
    title: "Resume legacy billing sync on a stale snapshot?",
    question:
      "The source snapshot is 14h old. Resume against it, or wait for a fresh export?",
    options: ["Resume on current snapshot", "Wait for a fresh export"],
    evidence:
      "Snapshot v7 observed 14h ago; connector has not refreshed since.",
    workstreamId: "ws-legacy-billing",
  },
  {
    id: "attn-security-approval",
    sourceVersion: "v5",
    freshness: "live",
    observedAt: NOW,
    kind: "approval",
    title: "Approve the data-retention policy rewrite",
    question: "Approve the verified policy draft for publication?",
    options: ["Approve", "Send back for revision"],
    evidence: "Verified by Security review · Outcome D2.",
    workstreamId: "ws-security-policy",
    outcomeId: "outcome-d2",
  },
  {
    id: "attn-recovery-review",
    sourceVersion: "v56",
    freshness: "recent",
    observedAt: NOW,
    kind: "review",
    title: "Review the relay-outage resume plan",
    question: "Does the drafted resume plan look safe to run?",
    options: ["Looks safe — proceed", "Needs changes"],
    evidence: "Drafted 03:40 after failure at 03:12.",
    workstreamId: "ws-relay-recovery",
  },
  {
    // Goes stale mid-decision: upstream changed since this was opened. HQ
    // must re-fetch, never apply a decision to state that's moved on.
    id: "attn-warehouse-stale",
    sourceVersion: "v19",
    freshness: "stale",
    observedAt: NOW,
    kind: "decision",
    title: "Resolve the warehouse connector conflict",
    question: "Which writer should hold the fence on the warehouse connector?",
    options: ["Take over the fence", "Release and wait"],
    evidence: "Observed at v19 — the connector has since moved to v23.",
    workstreamId: "ws-data-warehouse",
  },
  {
    id: "attn-partner-grill",
    sourceVersion: "v11",
    freshness: "live",
    observedAt: NOW,
    kind: "grill",
    title: "How should we unblock the partner API launch?",
    question:
      "Sandbox credentials are blocking two Outcomes. How should we proceed?",
    options: [
      "Escalate to partner team for expedited creds",
      "Ship without sandbox verification",
      "Slip the launch date",
    ],
    evidence: "Blocked 5h; partner team has not responded to the request.",
    workstreamId: "ws-partner-api",
  },
];

// --- Releases (every app-related thing carries its release) ----------------
// Grounded in the real Latent Sea / Salience world so the roll-up reads
// truthfully: the 0.2.5 first-use crash hot-fix + CI repair in flight.

export const RELEASES: ReleaseSummary[] = [
  {
    id: "rel-salience-025",
    sourceVersion: "v41",
    freshness: "live",
    observedAt: NOW,
    company: "Latent Sea",
    product: "Salience",
    version: "0.2.5",
    channel: "hotfix",
    state: "in-progress",
    headline:
      "First-use crash hot-fix + CI repair before re-cutting Mac build.",
    workstreamId: "ws-checkout-latency",
    required: [
      {
        label: "Root-cause first-use crash (self-destructing lambda)",
        done: true,
        owner: "code",
        activity: "done",
      },
      {
        label: "Land crash fix on trunk",
        done: true,
        owner: "code",
        activity: "done",
      },
      {
        label: "Repair Mac + Windows CI runners",
        done: false,
        owner: "code",
        // A session is actively seeding the Mac JUCE cache right now — this
        // is the one item that's genuinely executing, not just queued.
        activity: "working",
      },
      {
        label: "Notarized 0.2.5 Mac build",
        done: false,
        owner: "code",
        activity: "waiting",
      },
      {
        label: "Release note + changelog in line with the fix",
        done: false,
        owner: "marketing",
        activity: "waiting",
      },
    ],
  },
  {
    id: "rel-salience-030",
    sourceVersion: "v6",
    freshness: "recent",
    observedAt: NOW,
    company: "Latent Sea",
    product: "Salience",
    version: "0.3.0",
    channel: "beta",
    state: "planning",
    headline: "Next feature train — scoped, not yet cut.",
    required: [
      {
        label: "Lock 0.3.0 scope",
        done: false,
        owner: "code",
        activity: "idea",
      },
      {
        label: "Launch campaign brief",
        done: false,
        owner: "marketing",
        activity: "idea",
      },
    ],
  },
];

// --- Recent activity ("what just happened while you were gone") ------------

export const RECENT_EVENTS: RecentEvent[] = [
  {
    id: "evt-crash-verified",
    kind: "verified",
    title: "First-use crash root-caused",
    detail:
      "Self-destructing completion lambda, fires on every terminal setup.",
    actorLabel: "Security review · Outcome D2",
    at: "12m ago",
    workstreamId: "ws-checkout-latency",
  },
  {
    id: "evt-style-sync-merged",
    kind: "merged",
    title: "account-style sync superset merged",
    detail: "codex/account-style-sync-completion → integration",
    actorLabel: "Codex session #88",
    at: "1h ago",
  },
  {
    id: "evt-hotfix-decided",
    kind: "decided",
    title: "Ship 0.2.5 as a hot-fix, not a feature cut",
    actorLabel: "Founder verdict",
    at: "1h ago",
    workstreamId: "ws-checkout-latency",
  },
  {
    id: "evt-ci-started",
    kind: "started",
    title: "CI runner repair started",
    detail: "Mac JUCE cache seeding + Windows fsmonitor EBUSY.",
    actorLabel: "Claude session #14",
    at: "2h ago",
  },
  {
    id: "evt-partner-blocked",
    kind: "blocked",
    title: "Partner API blocked on sandbox creds",
    at: "5h ago",
    workstreamId: "ws-partner-api",
  },
];

// --- Pack surfaces (Seam 2 extension slots) --------------------------------

export const PACK_SURFACES: PackSurface[] = [
  {
    key: "latent-sea.work-lenses",
    title: "Work lenses + row details",
    slot: "work-lenses-and-row-details",
  },
  {
    key: "latent-sea.workstream-tabs",
    title: "Workstream workspace tabs + side-rail",
    slot: "workstream-workspace-tabs",
  },
  {
    key: "latent-sea.attention-renderer",
    title: "Attention & decision renderer",
    slot: "attention-decision-renderer",
  },
  {
    key: "latent-sea.capability-inspector",
    title: "Company capability inspector",
    slot: "company-capability-inspector",
  },
  {
    key: "latent-sea.find-ask-act",
    title: "Find / Ask / Act provider",
    slot: "find-ask-act-provider",
  },
  {
    key: "latent-sea.automation-catalog",
    title: "Automation trigger/action catalog",
    slot: "automation-trigger-action-catalog",
  },
];

// --- Conversations (the two-panel inbox surface) ---------------------------
// Clicking anything lands you in a chat with the agent who owns that work —
// never a modal, never a bare verdict form. Grills open with the agent's
// framing; suggestions are stances you can insert and send in your own words.

function msg(
  id: string,
  author: string,
  authorKind: ConversationMessage["authorKind"],
  body: string,
  at: string,
): ConversationMessage {
  return { id, author, authorKind, body, at };
}

// Hand-authored rich threads for the two grills a founder is most likely to
// open first. Everything else is seeded from its attention/workstream below.
const AUTHORED_CONVERSATIONS: Record<string, Conversation> = {
  "attn-checkout-grill": {
    subjectId: "attn-checkout-grill",
    title: "How should we finish the 0.2.5 crash hot-fix?",
    subtitle: "Grill · 0.2.5 first-use crash hot-fix · Salience 0.2.5",
    suggestions: [
      "Ship 0.2.5 as soon as CI is green",
      "Ship now with a manual build, repair CI after",
      "Hold 0.2.5 until both runners are green",
    ],
    messages: [
      msg(
        "m1",
        "Fizz",
        "agent",
        "The self-destructing completion lambda is patched and I've verified a clean first-run locally. The blocker now is CI — the Mac and Windows runners are both red. Do you want to wait for green CI, or cut a manual notarized build to get the fix to users faster?",
        "8m ago",
      ),
      msg(
        "m2",
        "Codex #88",
        "agent",
        "For context: the crash fix landed on trunk 12m ago with no regressions locally. The Mac runner just needs its JUCE cache reseeded; the Windows failure is a separate fsmonitor EBUSY I'm still chasing.",
        "7m ago",
      ),
    ],
  },
  "attn-partner-grill": {
    subjectId: "attn-partner-grill",
    title: "How should we unblock the partner API launch?",
    subtitle: "Grill · Partner API integration · Platform",
    suggestions: [
      "Escalate to partner team for expedited creds",
      "Ship without sandbox verification",
      "Slip the launch date",
    ],
    messages: [
      msg(
        "m1",
        "HQ",
        "agent",
        "Two Outcomes have been blocked for 5h on partner sandbox credentials. The partner team hasn't responded to the request. I don't want to pick a path here without you — shipping unverified trades safety for the date.",
        "5h ago",
      ),
    ],
  },
};

// A neutral seeded thread for any subject without an authored one, so every
// click still lands in a real conversation.
function seedConversationForAttention(item: AttentionItem): Conversation {
  return {
    subjectId: item.id,
    title: item.title,
    subtitle: `${item.kind[0].toUpperCase()}${item.kind.slice(1)}`,
    suggestions: item.options,
    messages: [
      msg(
        "m1",
        "HQ",
        "agent",
        item.question + (item.evidence ? `\n\n${item.evidence}` : ""),
        "just now",
      ),
    ],
  };
}

function seedConversationForWorkstream(detail: WorkstreamDetail): Conversation {
  const lead =
    detail.actors.find((a) => a.kind === "session")?.label ??
    detail.actors[0]?.label ??
    "HQ";
  return {
    subjectId: detail.id,
    title: detail.title,
    subtitle: detail.objective,
    messages: [
      msg("m1", lead, "agent", detail.truthNow, detail.lastChange),
      msg(
        "m2",
        "HQ",
        "system",
        `Next: ${detail.nextAction}`,
        detail.lastChange,
      ),
    ],
  };
}

export const CONVERSATIONS: Record<string, Conversation> = {
  ...Object.fromEntries(
    ATTENTION_ITEMS.map((item) => [
      item.id,
      AUTHORED_CONVERSATIONS[item.id] ?? seedConversationForAttention(item),
    ]),
  ),
  ...Object.fromEntries(
    Object.values(WORKSTREAM_DETAILS).map((detail) => [
      detail.id,
      seedConversationForWorkstream(detail),
    ]),
  ),
};

// --- Company structure (the Projects org lens) -----------------------------
// Grounded in the real Latent Sea world. Teams and cross-team waits that HQ
// does NOT model yet are marked `modeled: false` rather than invented as
// hard state — same freeze-honesty rule as everywhere else.

const TEAM_DEV: TeamRef = { id: "team-dev", name: "Dev", kind: "dev" };
const TEAM_MARKETING: TeamRef = {
  id: "team-marketing",
  name: "Marketing",
  kind: "marketing",
};
const TEAM_COMMUNITY: TeamRef = {
  id: "team-community",
  name: "Community",
  kind: "community",
};
const TEAM_DESIGN: TeamRef = {
  id: "team-design",
  name: "Design",
  kind: "design",
};

const SALIENCE_PROJECT: ProjectSummary = {
  id: "proj-salience",
  name: "Salience",
  company: "Latent Sea",
  headline:
    "Local-first AI sampler workstation. Shipping the 0.2.5 crash hot-fix.",
  teams: [TEAM_DEV, TEAM_DESIGN, TEAM_MARKETING, TEAM_COMMUNITY],
  releaseId: "rel-salience-025",
  workstreams: [
    {
      id: "ws-checkout-latency",
      title: "0.2.5 hot-fix + CI repair",
      teamId: "team-dev",
      state: "needs-you",
      modeled: true,
    },
    {
      id: "ws-relay-recovery",
      title: "Incident recovery: relay outage",
      teamId: "team-dev",
      state: "verifying",
      modeled: true,
    },
    {
      id: "ws-design-audit",
      title: "Design system audit",
      teamId: "team-design",
      state: "waiting",
      waitingOn: "Dev review capacity",
      modeled: true,
    },
    {
      // Cross-team wait that HQ does not model as a Workstream yet.
      id: "proj-salience-release-note",
      title: "0.2.5 release note + changelog",
      teamId: "team-marketing",
      state: "not-modeled",
      waitingOn: "Dev to land the crash fix",
      modeled: false,
    },
    {
      id: "proj-salience-launch-community",
      title: "Community changelog thread",
      teamId: "team-community",
      state: "not-modeled",
      waitingOn: "Marketing release note",
      modeled: false,
    },
  ],
};

const PARTNER_PROJECT: ProjectSummary = {
  id: "proj-platform",
  name: "Platform",
  company: "Latent Sea",
  headline: "Vendor onboarding + partner API — the shared platform surface.",
  teams: [TEAM_DEV, TEAM_MARKETING],
  workstreams: [
    {
      id: "ws-vendor-onboarding",
      title: "Vendor onboarding pipeline",
      teamId: "team-dev",
      state: "running",
      modeled: true,
    },
    {
      id: "ws-partner-api",
      title: "Partner API integration",
      teamId: "team-dev",
      state: "blocked",
      waitingOn: "Partner sandbox credentials",
      modeled: true,
    },
    {
      id: "proj-platform-partner-gtm",
      title: "Partner launch GTM",
      teamId: "team-marketing",
      state: "not-modeled",
      waitingOn: "Dev to unblock the API",
      modeled: false,
    },
  ],
};

export const COMPANY_STRUCTURE: CompanyStructure = {
  company: "Latent Sea",
  teams: [TEAM_DEV, TEAM_DESIGN, TEAM_MARKETING, TEAM_COMMUNITY],
  projects: [SALIENCE_PROJECT, PARTNER_PROJECT],
};
