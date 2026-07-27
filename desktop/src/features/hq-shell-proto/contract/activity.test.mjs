import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  deriveActivity,
  distinctOutcomesInState,
  hasRunningRun,
  portfolioActivitySummary,
  workingNowWorkstreamIds,
} from "./activity.ts";

// Real safe-projection JSON captured from the live `hq` control plane — the
// same fixtures LiveHqTransport.test.mjs drives. Proves every Activity value
// against HQ's actual shapes, not a hand-written stand-in.
const LIVE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "live",
);
const load = (name) =>
  JSON.parse(readFileSync(join(LIVE_DIR, `${name}.json`), "utf8"));

const runList = load("run-list-sample").runs;
const releaseItems = load("release-report").release.items;
const affiliatesOutcome = load("workstream-list").workstreams.find(
  (ws) => ws.id === "affiliates",
).outcomes[0];

const runsForOutcome = (outcomeId) =>
  runList.filter((run) => run.outcomeId === outcomeId);

const releaseItem = (slug) =>
  releaseItems.find((item) => item.id === `release-train:0.2.10:${slug}`);

// --- "working" ---------------------------------------------------------------

test("working: a real run in state=running wins over everything else", () => {
  const runs = runsForOutcome("demand-loop-ticket-3");
  // This outcome also carries needs-replan history, but one of its runs is
  // running right now — that's the only thing that matters.
  assert.ok(runs.some((r) => r.state === "running"));
  assert.equal(deriveActivity({ runs, state: "ready" }), "working");
});

test("hasRunningRun / workingNowWorkstreamIds agree with the raw sample", () => {
  const runningRows = runList.filter((r) => r.state === "running");
  assert.equal(
    runningRows.length,
    1,
    "sample fixture has exactly one running run",
  );
  assert.ok(hasRunningRun(runningRows));

  const workingNow = workingNowWorkstreamIds(runList);
  // Today's honest "Working now" against the sample fixture is 1 distinct
  // workstream — not 31 run-records and not a frontier bucket count.
  assert.deepEqual(workingNow, ["demand-loop"]);
  assert.equal(workingNow.length, 1);
});

// --- "needs-you" ---------------------------------------------------------------

test("needs-you: a release item routed workflow=needs-jordan", () => {
  const item = releaseItem("batch-queued-generation");
  assert.ok(item, "fixture carries the needs-jordan item");
  assert.equal(item.workflow, "needs-jordan");
  const needsYou = item.workflow === "needs-jordan";
  assert.equal(
    deriveActivity({ state: item.state, needsYou, blockedBy: item.blockedBy }),
    "needs-you",
  );
});

// --- "done" ---------------------------------------------------------------

test("done: landed and proven release states both resolve to done", () => {
  const landed = releaseItem(
    "finish-the-release-acceleration-system-and-canonical-operating-record",
  );
  const proven = releaseItem(
    "shorten-and-harden-the-signed-release-candidate-pipeline",
  );
  assert.equal(landed.state, "landed");
  assert.equal(proven.state, "proven");
  assert.equal(deriveActivity({ state: landed.state }), "done");
  assert.equal(deriveActivity({ state: proven.state }), "done");
});

test("deferred is NOT done — it falls through to waiting, not the done chip", () => {
  const deferred = releaseItem(
    "batch-presets-saving-multiple-generations-to-send-off-again-at-one-time",
  );
  assert.equal(deferred.state, "deferred → 1.1");
  assert.equal(
    deriveActivity({ state: deferred.state, blockedBy: deferred.blockedBy }),
    "waiting",
  );
});

// --- "blocked" ---------------------------------------------------------------

test("blocked: latest run is a live circuit-open hard stop", () => {
  const runs = runsForOutcome(
    "artifact-continuation:scheduling-policies-improvement",
  );
  assert.equal(runs.length, 1);
  assert.equal(runs[0].state, "circuit-open");
  assert.equal(deriveActivity({ runs, state: "ready" }), "blocked");
});

test("blocked: latest run is checkpointed but carries a product-defect failure", () => {
  // Three runs share this outcome; the most-recently-updated one is the
  // product-defect checkpoint, not the earlier needs-replan attempts — proves
  // the "latest run", not "any run", rule.
  const runs = runsForOutcome(
    "artifact-continuation-5-dogfood:interrupted-resume",
  );
  assert.equal(runs.length, 3);
  const latest = runs
    .slice()
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  assert.equal(latest.failureClass, "product-defect");
  assert.equal(deriveActivity({ runs, state: "ready" }), "blocked");
});

test("blocked: an outcome with unmet dependencies (real workstream-list fixture)", () => {
  // `affiliates` is blocked on three sibling workstreams — real
  // dependency-edge data, not a synthetic stand-in.
  assert.equal(affiliatesOutcome.state, "blocked");
  assert.deepEqual(affiliatesOutcome.dependencies, [
    "commerce-legal",
    "email-lifecycle",
    "creator-reviewer",
  ]);
  assert.equal(
    deriveActivity({
      state: affiliatesOutcome.state,
      blockedBy: affiliatesOutcome.dependencies,
    }),
    "blocked",
  );
});

test("blocked: an unmet blockedBy alone is sufficient (synthetic — real fixture has none set)", () => {
  assert.equal(
    deriveActivity({
      state: "ready",
      blockedBy: "partner-sandbox-credentials",
    }),
    "blocked",
  );
  assert.equal(deriveActivity({ state: "ready", blockedBy: [] }), "waiting");
});

// --- "idea" ---------------------------------------------------------------

test("idea: release items in state=idea render as idea, not research", () => {
  const item = releaseItem(
    "account-first-welcome-and-license-recovery-on-first-launch",
  );
  assert.equal(item.state, "idea");
  assert.equal(item.workflow, "research");
  assert.equal(
    deriveActivity({ state: item.state, blockedBy: item.blockedBy }),
    "idea",
  );

  // 0.2.10 is dominated by not-started ideas — the real "research wall".
  const ideaCount = releaseItems.filter((i) => i.state === "idea").length;
  assert.ok(ideaCount >= 14, `expected the 0.2.10 idea-wall, got ${ideaCount}`);
});

// --- "waiting" ---------------------------------------------------------------

test("waiting: an open, non-idea, non-blocked release item", () => {
  const item = releaseItem(
    "ai-edit-long-source-duration-fix-stereo-preservation-proof",
  );
  assert.equal(item.state, "building");
  assert.equal(item.workflow, "ready");
  assert.equal(
    deriveActivity({ state: item.state, blockedBy: item.blockedBy }),
    "waiting",
  );
});

// --- counting: distinct outcomes, never run-records ---------------------------

test("distinctOutcomesInState collapses needs-replan run-records to their outcomes", () => {
  const needsReplanRuns = runList.filter((r) => r.state === "needs-replan");
  assert.equal(
    needsReplanRuns.length,
    6,
    "6 needs-replan run-records in the sample",
  );
  const distinct = distinctOutcomesInState(runList, "needs-replan");
  // Same 6 rows collapse to 3 distinct outcomes — demand-loop-ticket-3 and the
  // two artifact-continuation-5-dogfood outcomes, not 6 separate stuck items.
  assert.equal(distinct, 3);
  assert.notEqual(distinct, needsReplanRuns.length);
});

// --- masthead summary: the honest words reconcile with the boxes -------------

test("portfolioActivitySummary: working is the LIVE count, never the frontier bucket (kills the 7-vs-2 chip-bar bug)", () => {
  // The exact shape of the bug Jordan saw: the raw frontier reports 7 running,
  // but only 2 workstreams have a live run right now. The summary must show
  // working=2 (the live count), and fold the frontier's running/research/etc.
  // into waiting — never a competing "7 running".
  const summary = portfolioActivitySummary({
    frontier: {
      running: 7,
      research: 3,
      waiting: 6,
      verifying: 0,
      ready: 0,
      needsContract: 0,
      toGrill: 0,
      needsJordan: 4, // must be ignored — needs-you comes from the live count
      blocked: 2,
    },
    workingCount: 2,
    needsYouCount: 1,
  });
  // Fixed order, zero-count activities dropped, one honest number each.
  assert.deepEqual(summary, [
    ["needs-you", 1], // from needsYouCount, NOT frontier.needsJordan (4)
    ["working", 2], // from workingCount, NOT frontier.running (7)
    ["blocked", 2],
    ["waiting", 16], // 7 running + 3 research + 6 waiting fold into waiting
  ]);
});

test("portfolioActivitySummary: zero-count activities drop; a quiet portfolio shows only what is live", () => {
  const summary = portfolioActivitySummary({
    frontier: {
      running: 0,
      research: 0,
      waiting: 0,
      verifying: 0,
      ready: 0,
      needsContract: 0,
      toGrill: 0,
      needsJordan: 0,
      blocked: 3,
    },
    workingCount: 0,
    needsYouCount: 0,
  });
  assert.deepEqual(summary, [["blocked", 3]]);
});
