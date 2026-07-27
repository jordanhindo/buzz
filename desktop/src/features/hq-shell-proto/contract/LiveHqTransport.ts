// HQ shell prototype — LiveHqTransport (M1 adapter).
//
// Maps HQ's real safe-projection JSON (pinned to HQ `main`) onto the frozen
// `HqTransport` contract, using the field paths the HQ agent measured against the
// live control plane and re-confirmed on current main. This is the drop-in swap
// for FixtureTransport.
//
// It does NOT ship a live client: HQ is a locked local control plane (capability
// token + project-binding header + no CORS), so the app reaches it through a
// native bridge supplied as the `HqClient`. In the packaged Buzz Desktop app that
// bridge is `createTauriHqClient()` (shells the real `hq` CLI); in a plain
// browser preview there is no Tauri runtime, so the shell falls back to
// FixtureTransport. This file is the pure mapping layer between the two.

import {
  deriveActivity,
  type RunLike,
  workingNowWorkstreamIds,
} from "./activity";
import type {
  AttentionItem,
  CompanyStructure,
  Conversation,
  DependencyEdge,
  FrontierComposition,
  HqTransport,
  LifecycleState,
  LineageLink,
  LineageRelation,
  OutcomeSummary,
  PackSurface,
  Receipt,
  RecentEvent,
  ReleaseChecklistItem,
  ReleaseSummary,
  RunReceipt,
  FounderReplyInput,
  FounderReplyRelay,
  SubjectBinding,
  TypedIntent,
  WorkflowRoute,
  WorkstreamConversationBinding,
  WorkstreamDetail,
  WorkstreamRow,
} from "./types";
import { UnboundFounderReplyRelay } from "./founderReplyRelay";
import { EmptyWorkstreamBinding } from "./workstreamBinding";

/**
 * The narrow seam to the real HQ read surface. A single JSON GET is all the
 * mapper needs; the concrete implementation (Tauri command / authed fetch) is
 * provided by the host once the native bridge lands.
 */
export interface HqClient {
  getJson(path: string): Promise<unknown>;
}

// --- HQ's raw JSON shapes (only the fields the mapping consumes) --------------

const FRONTIER_BUCKETS = [
  "ready",
  "running",
  "verifying",
  "needsContract",
  "toGrill",
  "needsJordan",
  "waiting",
  "research",
  "blocked",
] as const;
type FrontierBucket = (typeof FRONTIER_BUCKETS)[number];

interface RawFrontier {
  counts?: Partial<Record<FrontierBucket, number>>;
  groups?: Partial<Record<FrontierBucket, { workstreamId?: string }[]>>;
}

interface RawContextLink {
  relation?: string;
  label?: string;
  reference?: string;
  version?: string;
}

interface RawExecutionContract {
  deliverables?: string[];
  decomposition?: { boundedResult?: string };
  authorityGrants?: { scopes?: string[] }[];
  proofGate?: {
    publicSeam?: string;
    requiredEvidence?: string[];
    completionAuthority?: string;
  };
}

// `outcome.lifecycleFacts.dependencyEdges[]` — HQ's own typed edge, already
// carrying a `kind` ("blocked-by-workstream", "requires-outcome", …).
interface RawDependencyEdge {
  kind?: string;
  schema?: string;
  targetId?: string;
}

interface RawLifecycleFacts {
  dependencyEdges?: RawDependencyEdge[];
}

interface RawOutcome {
  id?: string;
  title?: string;
  state?: string;
  contextLinks?: RawContextLink[];
  executionContract?: RawExecutionContract;
  // Plain target-id list — observed to duplicate lifecycleFacts.dependencyEdges'
  // targets 1:1 on every real capture, but carries no `kind`. Read as a
  // fallback for any target lifecycleFacts didn't name.
  dependencies?: string[];
  lifecycleFacts?: RawLifecycleFacts;
}

interface RawWorkstream {
  id?: string;
  title?: string;
  objective?: string;
  grouping?: string;
  currentTruth?: string;
  exactNextAction?: string;
  unresolvedRisks?: string[];
  origin?: string;
  lifecycleState?: string;
  workflowRoute?: string;
  observedAt?: string;
  sourceReferences?: { version?: string }[];
  intake?: { fullySpecified?: boolean; notes?: string };
  outcomes?: RawOutcome[];
}

interface RawWorkstreamListResponse {
  workstreams?: RawWorkstream[];
}

interface RawWorkstreamResponse {
  workstream?: RawWorkstream;
}

interface RawAttentionItem {
  id?: string;
  workstreamId?: string | null;
  outcomeId?: string | null;
  title?: string;
  quickTake?: string;
  recommendation?: string;
  requestedAction?: string;
  proof?: string[];
  updatedAt?: string;
  // HQ emits `"sha256:<64hex>"` or `null` (a non-conforming stored digest
  // projects to null — never a malformed string). Distinct from `correlationId`
  // (the stable identity key); the digest is the content version and rotates.
  packageDigest?: string | null;
}

// `hq founder attention --json` → `{ inbox, open }`. Only `.open[]` is the
// live founder-attention set the shell surfaces.
interface RawFounderAttentionResponse {
  open?: RawAttentionItem[];
}

// `hq run list [--workstream <id>] --json` → `{ runs: [...] }`. Covers both the
// "Runs" strip fields (who ran, what state, when) and the fields activity.ts
// needs to derive Activity honestly (workstreamId/outcomeId/failureClass/
// circuitReason) — HQ's run rows carry many more fields than either consumer
// reads; both stay narrow on purpose.
interface RawRun {
  id?: string;
  workstreamId?: string;
  outcomeId?: string;
  state?: string;
  role?: string;
  nativeHarness?: string;
  mergeEligible?: boolean;
  failureClass?: string | null;
  circuitReason?: string | null;
  updatedAt?: string;
  completedAt?: string;
  createdAt?: string;
}

interface RawRunListResponse {
  runs?: RawRun[];
}

// `hq release report --json` (pinned to the open release, e.g. 0.2.10) →
// `{ openReleaseVersion, release: { version, status, items: [...] } }`. Only
// the fields the roll-up + honest-status mapping consumes.
interface RawReleaseItem {
  id?: string;
  state?: string;
  workflow?: string;
  title?: string;
  owner?: string | null;
  blockedBy?: string | string[] | null;
}

interface RawRelease {
  version?: string;
  status?: string;
  items?: RawReleaseItem[];
}

interface RawReleaseReportResponse {
  openReleaseVersion?: string;
  release?: RawRelease;
}

// --- static mapping tables ----------------------------------------------------

const VALID_RELATIONS = new Set<LineageRelation>([
  "origin",
  "decision",
  "grill",
  "adr",
  "spec",
  "research",
  "issue",
  "handoff",
  "run",
  "review",
  "proof",
  "prototype",
  "visual-contract",
  "adjudication",
  "completion",
]);

// App-defined expected lineage: the relations a fully-grounded workstream should
// carry. Any expected relation with no HQ link is surfaced as an honest gap
// (`present: false`) — HQ only stores links that exist.
const EXPECTED_RELATIONS: LineageRelation[] = [
  "origin",
  "decision",
  "spec",
  "proof",
];

// HQ lifecycleState (24-value set) → the shell's LifecycleState. Unknown values
// fall through to "ready" rather than inventing an error state.
const LIFECYCLE_MAP: Record<string, LifecycleState> = {
  loading: "loading",
  empty: "empty",
  ready: "ready",
  active: "ready",
  running: "ready",
  stale: "stale",
  unauthorized: "unauthorized",
  offline: "offline",
  unsupported: "unsupported",
  pending: "pending",
  rejected: "rejected",
  conflicted: "conflicted",
  "planned-maintenance": "planned-maintenance",
  maintenance: "planned-maintenance",
};

// HQ workflow route → the shell's WorkflowRoute. Defaults to "ready".
const WORKFLOW_MAP: Record<string, WorkflowRoute> = {
  ready: "ready",
  "to-grill": "to-grill",
  toGrill: "to-grill",
  research: "research",
  waiting: "waiting",
  "needs-jordan": "needs-jordan",
  needsJordan: "needs-jordan",
  blocked: "blocked",
};

// HQ's 14-value outcome state → the shell's widened OutcomeSummary state union.
const OUTCOME_STATE_MAP: Record<string, OutcomeSummary["state"]> = {
  ready: "ready",
  running: "running",
  "in-progress": "running",
  verifying: "verifying",
  needsContract: "needsContract",
  "needs-contract": "needsContract",
  toGrill: "toGrill",
  "to-grill": "toGrill",
  needsJordan: "needs-you",
  "needs-jordan": "needs-you",
  "needs-you": "needs-you",
  waiting: "waiting",
  research: "research",
  blocked: "blocked",
  done: "done",
  complete: "done",
  completed: "done",
};

// --- pure mappers -------------------------------------------------------------

function emptyFrontier(): FrontierComposition {
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
  };
}

function mapFrontierCounts(
  counts: Partial<Record<FrontierBucket, number>> | undefined,
): FrontierComposition {
  const frontier = emptyFrontier();
  if (!counts) return frontier;
  for (const bucket of FRONTIER_BUCKETS) {
    frontier[bucket] = counts[bucket] ?? 0;
  }
  return frontier;
}

// Group `frontier.groups.<bucket>[]` by workstreamId → each workstream's own
// nine-bucket composition.
function frontierByWorkstream(
  raw: RawFrontier,
): Map<string, FrontierComposition> {
  const byId = new Map<string, FrontierComposition>();
  const groups = raw.groups ?? {};
  for (const bucket of FRONTIER_BUCKETS) {
    for (const entry of groups[bucket] ?? []) {
      const id = entry.workstreamId;
      if (!id) continue;
      const current = byId.get(id) ?? emptyFrontier();
      current[bucket] += 1;
      byId.set(id, current);
    }
  }
  return byId;
}

function mapLifecycle(state: string | undefined): LifecycleState {
  return (state && LIFECYCLE_MAP[state]) || "ready";
}

function mapWorkflow(route: string | undefined): WorkflowRoute {
  return (route && WORKFLOW_MAP[route]) || "ready";
}

function mapOutcomeState(state: string | undefined): OutcomeSummary["state"] {
  return (state && OUTCOME_STATE_MAP[state]) || "waiting";
}

function mapRelation(relation: string | undefined): LineageRelation | null {
  if (relation && VALID_RELATIONS.has(relation as LineageRelation)) {
    return relation as LineageRelation;
  }
  return null;
}

// A LineageLink from HQ: `reference` is an opaque pin string (NOT a URI), and
// `present` is always true — HQ only stores links that exist. The app synthesises
// the absent set separately.
function mapContextLink(raw: RawContextLink): LineageLink | null {
  const relation = mapRelation(raw.relation);
  if (!relation) return null;
  return {
    relation,
    label: raw.label ?? relation,
    reference: raw.reference ?? "",
    version: raw.version,
    present: true,
  };
}

function mapContextLinks(links: RawContextLink[] | undefined): LineageLink[] {
  const mapped: LineageLink[] = [];
  for (const link of links ?? []) {
    const result = mapContextLink(link);
    if (result) mapped.push(result);
  }
  return mapped;
}

// One outcome's typed dependency edges: `lifecycleFacts.dependencyEdges` is
// the primary source (it already carries a `kind`); `dependencies` fills in
// any target lifecycleFacts didn't name, defaulting to "requires-outcome" —
// the only kind a plain dependency-id list has been observed to mean. Deduped
// by target so a workstream that depends on the same target from more than
// one place (e.g. two lifecycle-fact edges vs. the flat dependencies mirror)
// never renders as two separate edges.
function mapDependencyEdges(
  outcomeId: string,
  raw: Pick<RawOutcome, "dependencies" | "lifecycleFacts">,
): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const seenTargets = new Set<string>();
  for (const edge of raw.lifecycleFacts?.dependencyEdges ?? []) {
    if (!edge.targetId || seenTargets.has(edge.targetId)) continue;
    seenTargets.add(edge.targetId);
    edges.push({
      source: outcomeId,
      target: edge.targetId,
      kind: edge.kind ?? "depends-on",
    });
  }
  for (const target of raw.dependencies ?? []) {
    if (!target || seenTargets.has(target)) continue;
    seenTargets.add(target);
    edges.push({ source: outcomeId, target, kind: "requires-outcome" });
  }
  return edges;
}

function mapOutcome(raw: RawOutcome, index: number): OutcomeSummary {
  const contract = raw.executionContract;
  const proofGate = contract?.proofGate;
  const hasExecutionContract =
    !!contract &&
    ((contract.deliverables?.length ?? 0) > 0 ||
      (proofGate?.requiredEvidence?.length ?? 0) > 0);
  const id = raw.id ?? `outcome-${index}`;
  return {
    id,
    title: raw.title ?? `Outcome ${index + 1}`,
    state: mapOutcomeState(raw.state),
    proofContract: proofGate?.publicSeam,
    executionContract: hasExecutionContract
      ? {
          deliverables: contract?.deliverables ?? [],
          requiredEvidence: proofGate?.requiredEvidence ?? [],
        }
      : undefined,
    contextLinks: mapContextLinks(raw.contextLinks),
    dependencyEdges: mapDependencyEdges(id, raw),
  };
}

// A workstream's row-level edges: the union of every one of its outcomes'
// DependencyEdges. Operates on the raw shape directly (not the mapped
// OutcomeSummary[]) so the portfolio-list route — which never calls
// mapOutcome() — can populate WorkstreamRow.edges too.
function aggregateWorkstreamEdges(raw: RawWorkstream): DependencyEdge[] {
  return (raw.outcomes ?? []).flatMap((outcome, index) =>
    mapDependencyEdges(outcome.id ?? `outcome-${index}`, outcome),
  );
}

// Derive a workstream's frontier from its outcomes' states (the single-workstream
// route returns outcomes, not a pre-grouped composition).
function frontierFromOutcomes(outcomes: OutcomeSummary[]): FrontierComposition {
  const frontier = emptyFrontier();
  for (const outcome of outcomes) {
    switch (outcome.state) {
      case "needs-you":
        frontier.needsJordan += 1;
        break;
      case "done":
        // Closed outcomes carry no open-frontier weight.
        break;
      default:
        frontier[outcome.state] += 1;
    }
  }
  return frontier;
}

// The 5 "why it exists" questions, composed from real HQ fields (HQ does not
// return them pre-built).
function composeOutcomeContract(
  raw: RawWorkstream,
  outcomes: RawOutcome[],
): WorkstreamDetail["outcomeContract"] {
  const first = outcomes[0]?.executionContract;
  const proofGate = first?.proofGate;
  const controlling = mapContextLinks(
    outcomes.flatMap((outcome) => outcome.contextLinks ?? []),
  ).filter((link) =>
    (["decision", "adr", "grill"] as LineageRelation[]).includes(link.relation),
  );
  const scopes = (first?.authorityGrants ?? []).flatMap(
    (grant) => grant.scopes ?? [],
  );
  const proofParts = [
    proofGate?.publicSeam,
    ...(proofGate?.requiredEvidence ?? []),
    proofGate?.completionAuthority,
  ].filter((part): part is string => !!part);
  const unknownParts = [
    ...(raw.unresolvedRisks ?? []),
    raw.intake?.fullySpecified === false ? raw.intake?.notes : undefined,
  ].filter((part): part is string => !!part);

  return {
    what: [raw.title, raw.objective].filter(Boolean).join(" — "),
    controllingDecision:
      controlling.map((link) => link.label).join("; ") || "No decision linked.",
    authorizedResult:
      [first?.decomposition?.boundedResult, ...scopes]
        .filter(Boolean)
        .join(" · ") || "Not yet bounded.",
    proofThatCloses: proofParts.join(" · ") || "No proof gate defined.",
    unknown: unknownParts.length > 0 ? unknownParts.join("; ") : undefined,
  };
}

// The brief is the LEAD line only — what this stream is (HQ returns no `brief`,
// so we use its objective). `currentTruth`, `exactNextAction`, and the top risk
// are each carried as their own typed fields (`truthNow`, `nextAction`, `risk`)
// and rendered as separate labeled lines in WorkstreamDetailPanel — so the brief
// stays one honest sentence instead of a run-on blob of four mashed fields.
function composeBrief(raw: RawWorkstream): string {
  return raw.objective ?? raw.title ?? "";
}

// Flatten every outcome's contextLinks to the workstream level, then fill in the
// expected-but-absent relations as honest gaps.
function composeLineage(outcomes: RawOutcome[]): LineageLink[] {
  const present = mapContextLinks(
    outcomes.flatMap((outcome) => outcome.contextLinks ?? []),
  );
  const seen = new Set(present.map((link) => link.relation));
  const absent: LineageLink[] = EXPECTED_RELATIONS.filter(
    (relation) => !seen.has(relation),
  ).map((relation) => ({
    relation,
    label: "not linked yet",
    reference: "",
    present: false,
  }));
  return [...present, ...absent];
}

function firstSourceVersion(raw: RawWorkstream): string {
  return raw.sourceReferences?.[0]?.version ?? "unknown";
}

function mapWorkstreamRow(
  raw: RawWorkstream,
  frontier: FrontierComposition,
): WorkstreamRow {
  return {
    id: raw.id ?? "",
    sourceVersion: firstSourceVersion(raw),
    // HQ carries no freshness field; a just-read projection is treated as live.
    freshness: "live",
    observedAt: raw.observedAt ?? new Date().toISOString(),
    title: raw.title ?? "Untitled workstream",
    objective: raw.objective ?? "",
    grouping: raw.grouping,
    frontier,
    nextAction: raw.exactNextAction ?? "",
    // HQ does not attach actor identities to the projection yet.
    actors: [],
    lastChange: raw.observedAt ?? "",
    // HQ does not model the reality-resolved primary action; inspect-only is the
    // safe default until an intent surface is wired.
    primaryAction: "open-inspect-only",
    lifecycle: mapLifecycle(raw.lifecycleState),
    risk: raw.unresolvedRisks?.[0],
    edges: aggregateWorkstreamEdges(raw),
  };
}

// Derive the attention kind from the ask's language — HQ carries no explicit
// kind field. Defaults to "decision": every founder-attention item is a
// reply-with-X choice unless it names a grill, review, or approval.
function mapAttentionKind(raw: RawAttentionItem): AttentionItem["kind"] {
  const text = `${raw.title ?? ""} ${raw.requestedAction ?? ""}`.toLowerCase();
  if (text.includes("grill")) return "grill";
  if (text.includes("review")) return "review";
  if (text.includes("approve") || text.includes("approval")) return "approval";
  return "decision";
}

// Map one `hq founder attention` `.open[]` item to an AttentionItem. The report
// measured these paths against the live control plane: `.requestedAction` is the
// actual ask, `.recommendation` is HQ's suggested answer (a chip, not the
// question), `.quickTake` is HQ's plain-language "why", and `options` are not yet
// modeled (they live as prose inside `.requestedAction`), so we surface none
// rather than fabricate chips.
function mapAttentionItem(raw: RawAttentionItem, index: number): AttentionItem {
  return {
    id: raw.id ?? `attention-${index}`,
    // HQ attaches no per-item source version or freshness; a just-read item is
    // live (`.correlationId` is a correlation key, not a source version).
    sourceVersion: "unknown",
    freshness: "live",
    observedAt: raw.updatedAt ?? new Date().toISOString(),
    kind: mapAttentionKind(raw),
    title: raw.title ?? "Founder attention",
    question: raw.requestedAction ?? raw.recommendation ?? "",
    options: [],
    evidence: raw.quickTake,
    workstreamId: raw.workstreamId ?? undefined,
    outcomeId: raw.outcomeId ?? undefined,
    // `null` (non-conforming stored digest) → undefined = not submittable.
    packageDigest: raw.packageDigest ?? undefined,
  };
}

// A coarse "2h ago" from an ISO timestamp — the Runs strip shows relative age,
// not absolute clocks. Empty string when the timestamp is missing/unparseable.
function relativeTime(iso: string | undefined): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Map one `hq run list` row → the RunReceipt the detail panel renders. `label` =
// who ran (role · harness), `result` = live state (+ merge-eligibility when set),
// `at` = relative age of the last update.
function mapRun(raw: RawRun): RunReceipt {
  const label = [raw.role, raw.nativeHarness].filter(Boolean).join(" · ");
  const result = raw.mergeEligible
    ? `${raw.state ?? "unknown"} · merge-eligible`
    : (raw.state ?? "unknown");
  return {
    id: raw.id ?? "",
    label: label || (raw.id ?? "run"),
    result,
    at: relativeTime(raw.completedAt ?? raw.updatedAt ?? raw.createdAt),
  };
}

// A workstream can carry hundreds of runs; the detail strip shows only the most
// recently active handful, newest first.
const RUNS_SHOWN = 8;

function mapRuns(raw: RawRunListResponse): RunReceipt[] {
  return (raw.runs ?? [])
    .slice()
    .sort((a, b) => sortKey(b) - sortKey(a))
    .slice(0, RUNS_SHOWN)
    .map(mapRun);
}

function sortKey(run: RawRun): number {
  const iso = run.updatedAt ?? run.completedAt ?? run.createdAt;
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

// --- releases (honest status vocabulary, Seam 7 "release version badge") -----

// HQ's release-item states ∈ {done,complete,completed,landed,proven,shipped}
// close a checklist row; every other state stays open. `deferred → 1.1` is
// deliberately excluded here too (see activity.ts DONE_STATES) — a deferred
// item is an open item, not a finished one.
const RELEASE_ITEM_DONE_STATES = new Set([
  "done",
  "complete",
  "completed",
  "landed",
  "proven",
  "shipped",
]);

// HQ's release `status` → the shell's coarse release lifecycle. `open` is the
// only status this pin's report shape has been observed to carry; anything
// else degrades to "planning" rather than guessing a channel HQ never sent.
const RELEASE_STATUS_MAP: Record<string, ReleaseSummary["state"]> = {
  open: "in-progress",
  shipped: "shipped",
  blocked: "blocked",
  verifying: "verifying",
  planning: "planning",
};

// `blockedBy` arrives as a single id, a list, or null — normalize to a flat
// list so a release item can contribute real target ids to a dependency graph
// instead of only gating its own `activity` pill (the field was previously
// read once by deriveActivity() and then thrown away).
function normalizeBlockedBy(blockedBy: RawReleaseItem["blockedBy"]): string[] {
  if (!blockedBy) return [];
  return Array.isArray(blockedBy) ? blockedBy : [blockedBy];
}

function mapReleaseItem(raw: RawReleaseItem): ReleaseChecklistItem {
  return {
    label: raw.title ?? raw.id ?? "Untitled release item",
    done: !!raw.state && RELEASE_ITEM_DONE_STATES.has(raw.state),
    owner: raw.owner ?? undefined,
    // The item's own workflow decides "needs you"; HQ's release runs carry no
    // linkage to `hq run list` today, so `runs` stays empty — an item can
    // never resolve to "working" from this route (an honest limitation, not
    // a bug: nothing here claims a release item is executing right now).
    activity: deriveActivity({
      state: raw.state,
      needsYou: raw.workflow === "needs-jordan",
      blockedBy: raw.blockedBy,
    }),
    blockedByIds: normalizeBlockedBy(raw.blockedBy),
  };
}

function mapRelease(
  release: RawRelease,
  reportVersion: string | undefined,
): ReleaseSummary {
  const version = release.version ?? reportVersion ?? "unknown";
  const items = release.items ?? [];
  return {
    id: `rel-${version}`,
    // HQ's release report carries no per-item source pin; the whole report is
    // read as one snapshot, so a just-read report is treated as live.
    sourceVersion: version,
    freshness: "live",
    observedAt: new Date().toISOString(),
    // HQ's release report does not model company/product names — an honest
    // gap, not a fabricated brand (same convention as getCompanyStructure()).
    company: "",
    product: "",
    version,
    // HQ's report has no channel field at this pin; "internal" is the least
    // specific, least misleading default until one exists.
    channel: "internal",
    state: (release.status && RELEASE_STATUS_MAP[release.status]) || "planning",
    headline: `${items.length} item${items.length === 1 ? "" : "s"} tracked for v${version}.`,
    required: items.map(mapReleaseItem),
  };
}

// --- the transport ------------------------------------------------------------

export class LiveHqTransport implements HqTransport {
  private readonly client: HqClient;
  // Which Buzz channel/thread carries the live agent session for a subject.
  // Defaults to the honest empty binding (no live wire yet) so live HQ behaves
  // exactly as before; a dev/e2e resolver can be injected to exercise the
  // bound-conversation UI. See workstreamBinding.ts.
  private readonly binding: WorkstreamConversationBinding;
  // Where an approved founder reply is relayed. Defaults to the honest unbound
  // relay (no live session) so live HQ never fabricates an accept; a fixture
  // relay is injected for dev/e2e. The shell itself never calls `hq`.
  private readonly replyRelay: FounderReplyRelay;

  constructor(
    client: HqClient,
    binding: WorkstreamConversationBinding = EmptyWorkstreamBinding,
    replyRelay: FounderReplyRelay = UnboundFounderReplyRelay,
  ) {
    this.client = client;
    this.binding = binding;
    this.replyRelay = replyRelay;
  }

  async getReadyFrontier(): Promise<FrontierComposition> {
    const raw = (await this.client.getJson("/v1/frontier")) as RawFrontier;
    return mapFrontierCounts(raw.counts);
  }

  async getWorkingNow(): Promise<string[]> {
    // The unscoped `hq run list --json` (no `--workstream` filter) — the ONLY
    // honest source for "Working now" (activity.ts). Frontier buckets are
    // outcome-state snapshots and must never stand in for this.
    const raw = (await this.client.getJson("/v1/runs")) as RawRunListResponse;
    return workingNowWorkstreamIds((raw.runs ?? []) as RunLike[]);
  }

  async getWorkstreamPortfolio(): Promise<WorkstreamRow[]> {
    const [listRaw, frontierRaw] = await Promise.all([
      this.client.getJson(
        "/v1/workstreams",
      ) as Promise<RawWorkstreamListResponse>,
      this.client.getJson("/v1/frontier") as Promise<RawFrontier>,
    ]);
    const byWorkstream = frontierByWorkstream(frontierRaw);
    return (listRaw.workstreams ?? []).map((raw) =>
      mapWorkstreamRow(raw, byWorkstream.get(raw.id ?? "") ?? emptyFrontier()),
    );
  }

  async getWorkstream(id: string): Promise<WorkstreamDetail | null> {
    const raw = (await this.client.getJson(
      `/v1/workstreams/${id}`,
    )) as RawWorkstreamResponse;
    const workstream = raw.workstream;
    if (!workstream) return null;

    const rawOutcomes = workstream.outcomes ?? [];
    const outcomes = rawOutcomes.map(mapOutcome);
    const row = mapWorkstreamRow(workstream, frontierFromOutcomes(outcomes));

    // Runs are a second read; a failure here must not blank the whole detail, so
    // it degrades to no Runs strip rather than throwing the panel away.
    let runs: RunReceipt[] = [];
    try {
      const rawRuns = (await this.client.getJson(
        `/v1/workstreams/${id}/runs`,
      )) as RawRunListResponse;
      runs = mapRuns(rawRuns);
    } catch {
      runs = [];
    }

    // truthOwner is an authority string, NOT a person — sourced from the proof
    // gate's completion authority.
    const truthOwner =
      rawOutcomes[0]?.executionContract?.proofGate?.completionAuthority ?? "HQ";

    const binding = await this.binding.resolve(id);

    return {
      ...row,
      brief: composeBrief(workstream),
      truthNow: workstream.currentTruth ?? row.nextAction,
      truthOwner,
      workflow: mapWorkflow(workstream.workflowRoute),
      origin: workstream.origin,
      outcomeContract: composeOutcomeContract(workstream, rawOutcomes),
      outcomes,
      lineage: composeLineage(rawOutcomes),
      runs,
      // HQ has no separate plan (the per-outcome executionContract IS the plan).
      // Bound conversations + the live session come from the injected binding
      // resolver, not the workstream read — empty/null by default, real on the
      // live path once HQ's conversation-binding read reports them.
      boundConversations: binding.conversations,
      liveSession: binding.session,
    };
  }

  async getFounderAttention(): Promise<AttentionItem[]> {
    // Reachable only via `hq founder attention --json` (`.open[]`) — the native
    // bridge maps `/v1/founder-attention` to that verb. No HTTP route exists.
    const raw = (await this.client.getJson(
      "/v1/founder-attention",
    )) as RawFounderAttentionResponse;
    return (raw.open ?? []).map(mapAttentionItem);
  }

  async getRecentActivity(): Promise<RecentEvent[]> {
    // No HQ backing yet — awaits a future `hq activity --since` verb.
    return [];
  }

  async getReleases(): Promise<ReleaseSummary[]> {
    // `hq release report --json`, pinned to the currently-open release (the
    // real 0.2.10 capture in __fixtures__/live/release-report.json). Defensive:
    // a missing/malformed report degrades to no releases rather than throwing
    // the whole portfolio away.
    let raw: RawReleaseReportResponse;
    try {
      raw = (await this.client.getJson(
        "/v1/releases",
      )) as RawReleaseReportResponse;
    } catch {
      return [];
    }
    if (!raw.release) return [];
    return [mapRelease(raw.release, raw.openReleaseVersion)];
  }

  async getPackSurfaces(): Promise<PackSurface[]> {
    // Pack surfaces are an app-side extension registry, not an HQ projection.
    return [];
  }

  async getConversation(subjectId: string): Promise<Conversation | null> {
    // HQ projects no conversation content in M1. The binding resolver only
    // tells us WHICH Buzz channel/thread carries the live session — not its
    // messages (those live on the relay). So: no binding → null (the honest
    // "nothing bound yet" gap, unchanged); a binding → a conversation bound to
    // that channel, seeded with the write-path wire but no relayed messages
    // yet. This is the seam the confirm → submit relay writes into.
    const { conversations } = await this.binding.resolve(subjectId);
    const primary = conversations[0];
    if (!primary) return null;
    return {
      subjectId,
      title: primary.label,
      subtitle: `Bound to ${primary.label} — reply routes to its agent session`,
      messages: [],
    };
  }

  async getSubjectBinding(subjectId: string): Promise<SubjectBinding> {
    // The one primitive: the injected resolver's read of HQ's
    // conversation-binding. getConversation() is the bound-conversation slice of
    // this; the live session + `bound` come straight through for the right pane.
    return this.binding.resolve(subjectId);
  }

  async getCompanyStructure(): Promise<CompanyStructure> {
    // CompanyStructure has no HQ backing — the org/structure lens is not modeled.
    return { company: "", teams: [], projects: [] };
  }

  async submitIntent(_intent: TypedIntent): Promise<Receipt> {
    // Intent submission needs the write bridge (POST + capability token), which
    // is out of scope for this read-shaped M1 adapter.
    throw new Error(
      "submitIntent is not available — it requires the HQ intent write bridge.",
    );
  }

  async submitFounderReply(input: FounderReplyInput): Promise<Receipt> {
    // The shell can't shell `hq founder intent` (not a native session) — it
    // relays the approved bytes to the bound agent session. That relay is
    // injected; the default refuses honestly (no live session bound yet).
    return this.replyRelay.submit(input);
  }
}
