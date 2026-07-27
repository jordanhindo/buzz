// HQ shell prototype — the honest status vocabulary (Buzz-side derivation).
//
// HQ's raw run/outcome/release-item vocabulary is internal lane-naming, not
// live activity: a `needs-replan` run-record is a retry attempt, not a
// distinct piece of stuck work; a `research` frontier bucket is an idea that
// hasn't started, not something executing right now. This module is the
// single place that turns HQ's raw fields into the six words the shell is
// allowed to show. See PLANS/HQ_WORK_HONEST_STATUS_SPEC.md — this is a pure,
// dependency-free implementation of that spec (no globals, no transport).

import type { FrontierComposition } from "./types";

export type Activity =
  | "working" // a live run is executing right now
  | "needs-you" // founder attention / needs-jordan
  | "blocked" // hard-stopped: circuit/repair-exhausted/product-defect, or unmet blockedBy
  | "waiting" // open but not executing and not hard-blocked (the honest default)
  | "idea" // release item not yet started (state: idea)
  | "done"; // landed/proven/completed

// The subset of a `hq run list` row this module reads. Deliberately narrow —
// callers pass HQ's real run JSON straight through; unknown fields are ignored.
export interface RunLike {
  workstreamId?: string | null;
  outcomeId?: string | null;
  state?: string | null;
  failureClass?: string | null;
  circuitReason?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
}

// Inputs kept explicit and small, per the spec: the run rows for the subject,
// its own outcome/release state, whether the founder is already on the
// critical path for it, and any unmet blocking dependency. No globals.
export interface DeriveActivityInput {
  /** Every known run row for this subject (workstream or outcome). */
  runs?: RunLike[];
  /** The subject's own raw HQ state string (outcome state or release item state) — pre-mapping. */
  state?: string | null;
  /** True when in founder-attention `.open[]`, or release item `workflow === "needs-jordan"`. */
  needsYou?: boolean;
  /** An unmet blocking dependency — release `blockedBy`, or an outcome's unresolved `dependencies`. */
  blockedBy?: string | readonly string[] | null;
}

// Outcome states ∈ {done,complete,completed}; release states ∈
// {landed,proven,shipped}. `deferred → 1.1` is deliberately NOT in this set —
// a deferred item gets its own chip, never "done" (spec: derivation rule 3).
const DONE_STATES = new Set([
  "done",
  "complete",
  "completed",
  "landed",
  "proven",
  "shipped",
]);

function runSortKey(run: RunLike): number {
  const iso = run.updatedAt ?? run.completedAt ?? run.createdAt;
  const parsed = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestRun(runs: RunLike[]): RunLike | undefined {
  if (runs.length === 0) return undefined;
  return runs.slice().sort((a, b) => runSortKey(b) - runSortKey(a))[0];
}

// "working" — ANY run for the subject is currently executing.
export function hasRunningRun(runs: RunLike[] | undefined): boolean {
  return (runs ?? []).some((run) => run.state === "running");
}

// "blocked" via run history — the LATEST run (not just any run) has a hard
// stop: an explicit circuit reason, a product-defect failure, or the run's
// own state is already `circuit-open`. HQ's run shape carries no separate
// "repair-envelope-exhausted" flag — `circuit-open` is HQ's own expression of
// a repair envelope tripping, so it's covered by the same check.
function isHardBlockedRun(runs: RunLike[] | undefined): boolean {
  const latest = latestRun(runs ?? []);
  if (!latest) return false;
  return (
    !!latest.circuitReason ||
    latest.failureClass === "product-defect" ||
    latest.state === "circuit-open"
  );
}

function hasUnmetBlockedBy(
  blockedBy: DeriveActivityInput["blockedBy"],
): boolean {
  if (!blockedBy) return false;
  return Array.isArray(blockedBy) ? blockedBy.length > 0 : true;
}

// The single honest status vocabulary. Priority order, first match wins — the
// same subject must never resolve to two different words depending on which
// caller asks.
export function deriveActivity(input: DeriveActivityInput): Activity {
  if (hasRunningRun(input.runs)) return "working";
  if (input.needsYou) return "needs-you";
  if (input.state && DONE_STATES.has(input.state)) return "done";
  if (
    hasUnmetBlockedBy(input.blockedBy) ||
    input.state === "blocked" ||
    isHardBlockedRun(input.runs)
  ) {
    return "blocked";
  }
  if (input.state === "idea") return "idea";
  return "waiting";
}

// "Working now" — the ONLY honest source: distinct workstream ids with ≥1 run
// in `state === "running"` right now. Never derived from frontier buckets
// (those are outcome-state snapshots, not live run state).
export function workingNowWorkstreamIds(runs: RunLike[]): string[] {
  const ids = new Set<string>();
  for (const run of runs) {
    if (run.state === "running" && run.workstreamId) ids.add(run.workstreamId);
  }
  return [...ids];
}

// Count distinct outcomes carrying a given run state — never the run-record
// count. (345 `needs-replan` run-records can be 17 distinct outcomes stuck
// retrying, not 345 separate pieces of stuck work.)
export function distinctOutcomesInState(
  runs: RunLike[],
  state: string,
): number {
  const ids = new Set<string>();
  for (const run of runs) {
    if (run.state === state && run.outcomeId) ids.add(run.outcomeId);
  }
  return ids.size;
}

// --- dominant-status priority (shared by Home, Projects, and the Map) --------
// The one dominant-status signal a WorkstreamRow resolves to — a single LED
// color instead of a wall of chips. Priority: needsJordan > blocked > toGrill
// > needsContract > running > verifying > research > waiting > ready. Lives
// here (not primitives/StatusLed.tsx) because it's pure FrontierComposition
// arithmetic with zero JSX/React dependency — the Map's graph builder
// (contract/mapGraph.ts) needs it under the node test runner
// (--experimental-strip-types can't parse a .tsx file's JSX), and StatusLed.tsx
// re-exports these for its existing consumers.

// The live states an LED can show (needs-me is rendered as a chip, not an LED).
export type WorkState =
  | "ready"
  | "running"
  | "verifying"
  | "needsContract"
  | "toGrill"
  | "research"
  | "waiting"
  | "blocked"
  | "done";
export type DominantStatus = "needs-me" | WorkState;

// Number of outcomes/streams carried by a frontier composition (min 1).
export function frontierStreamCount(frontier: FrontierComposition): number {
  return Math.max(
    1,
    frontier.ready +
      frontier.running +
      frontier.verifying +
      frontier.needsContract +
      frontier.toGrill +
      frontier.needsJordan +
      frontier.waiting +
      frontier.research +
      frontier.blocked,
  );
}

// The single dominant status for a frontier, by the fixed most-urgent-first
// priority order (mirrors HQ's Ready-Frontier precedence).
export function dominantFrontierStatus(
  frontier: FrontierComposition,
): DominantStatus {
  if (frontier.needsJordan > 0) return "needs-me";
  if (frontier.blocked > 0) return "blocked";
  if (frontier.toGrill > 0) return "toGrill";
  if (frontier.needsContract > 0) return "needsContract";
  if (frontier.running > 0) return "running";
  if (frontier.verifying > 0) return "verifying";
  if (frontier.research > 0) return "research";
  if (frontier.waiting > 0) return "waiting";
  if (frontier.ready > 0) return "ready";
  return "done";
}

// Fold a DominantStatus down to the six-word Activity vocabulary this module
// already defines — the same folding rule portfolioActivitySummary uses
// (needs-me → needs-you; running/verifying → working; the rest of the open
// buckets → waiting). Lets the Map's status filter speak the same honest
// words as the rest of the app instead of a third status vocabulary.
export function dominantStatusActivity(status: DominantStatus): Activity {
  if (status === "needs-me") return "needs-you";
  if (status === "running" || status === "verifying") return "working";
  if (status === "blocked") return "blocked";
  if (status === "done") return "done";
  return "waiting"; // ready, toGrill, needsContract, research, waiting
}

// The nine-bucket Ready-Frontier composition, narrowed to the fields this
// module maps. Every field optional — a caller passing HQ's real composition
// straight through gets zero for anything absent. Same "narrow local input"
// pattern as RunLike: no dependency on the transport's type surface.
export interface FrontierLike {
  ready?: number;
  running?: number;
  verifying?: number;
  needsContract?: number;
  toGrill?: number;
  needsJordan?: number;
  waiting?: number;
  research?: number;
  blocked?: number;
}

export interface PortfolioSummaryInput {
  /** The raw Ready-Frontier composition (nine HQ lane-buckets). */
  frontier: FrontierLike;
  /** Honest "Working now" — distinct workstreams with a live running run. */
  workingCount: number;
  /** Founder-attention `.open[]` count. */
  needsYouCount: number;
}

// The masthead's portfolio Activity mix, in the honest words — the single
// place that collapses the nine raw frontier lane-buckets so the strip stops
// showing "3 research · 7 running" and instead reconciles with the boxes below
// it. Two rules from the spec make this safe against showing a *competing*
// number:
//   • "working" is sourced from the live count, NEVER a frontier bucket
//     (spec rule 1) — so it always equals the "Working now" box.
//   • "needs-you" is sourced from founder-attention, so it equals that box.
// The remaining open buckets fold into "waiting" — including `research`, which
// spec rule 6 relabels to waiting for non-idea items (idea is reserved for
// release items in `state:idea`, which the frontier composition has no concept
// of). `blocked` stays blocked. Zero-count activities drop; order is fixed.
export function portfolioActivitySummary(
  input: PortfolioSummaryInput,
): [Activity, number][] {
  const f = input.frontier;
  const waiting =
    (f.ready ?? 0) +
    (f.running ?? 0) +
    (f.verifying ?? 0) +
    (f.needsContract ?? 0) +
    (f.toGrill ?? 0) +
    (f.waiting ?? 0) +
    (f.research ?? 0);
  const counts: Partial<Record<Activity, number>> = {
    "needs-you": input.needsYouCount,
    working: input.workingCount,
    blocked: f.blocked ?? 0,
    waiting,
  };
  const order: Activity[] = ["needs-you", "working", "blocked", "waiting"];
  return order
    .filter((activity) => (counts[activity] ?? 0) > 0)
    .map((activity) => [activity, counts[activity] as number]);
}
