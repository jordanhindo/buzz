import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LiveHqTransport } from "./LiveHqTransport.ts";
import { FixtureWorkstreamBinding } from "./workstreamBinding.ts";

// Real safe-projection JSON captured from the live `hq` control plane (the same
// bytes the native bridge returns). Driving the adapter with these proves the
// mapping against HQ's actual shapes, not a hand-written fixture.
const LIVE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "live",
);
const load = (name) =>
  JSON.parse(readFileSync(join(LIVE_DIR, `${name}.json`), "utf8"));

// A stub HqClient mapping the adapter's read paths to captured JSON — the exact
// seam createTauriHqClient() fills with the native `hq_read` bridge.
function stubClient(overrides = {}) {
  const routes = {
    "/v1/frontier": () => load("next"),
    "/v1/workstreams": () => load("workstream-list"),
    "/v1/founder-attention": () => load("founder-attention"),
    ...overrides,
  };
  return {
    async getJson(path) {
      const handler = routes[path];
      if (!handler) throw new Error(`stubClient: unmapped path '${path}'`);
      return handler();
    },
  };
}

test("getReadyFrontier maps all nine HQ buckets from live counts", async () => {
  const transport = new LiveHqTransport(stubClient());
  const frontier = await transport.getReadyFrontier();
  const raw = load("next").counts;
  for (const bucket of Object.keys(raw)) {
    assert.equal(frontier[bucket], raw[bucket], `bucket ${bucket}`);
  }
  // research is the majority bucket the old 5-bucket view hid — assert it survives.
  assert.ok(frontier.research > 0);
});

test("getWorkstreamPortfolio maps every live workstream to a row", async () => {
  const transport = new LiveHqTransport(stubClient());
  const rows = await transport.getWorkstreamPortfolio();
  const raw = load("workstream-list").workstreams;
  assert.equal(rows.length, raw.length);
  for (const row of rows) {
    assert.equal(typeof row.id, "string");
    assert.ok(row.title.length > 0);
    // nextAction is composed from exactNextAction; frontier is the 9-bucket shape.
    assert.equal(typeof row.nextAction, "string");
    assert.equal(typeof row.frontier.research, "number");
  }
});

test("getFounderAttention maps live .open[] to attention items", async () => {
  const transport = new LiveHqTransport(stubClient());
  const items = await transport.getFounderAttention();
  const open = load("founder-attention").open;
  assert.equal(items.length, open.length);

  const first = items[0];
  const rawFirst = open[0];
  // .requestedAction is the ask, .quickTake is the readable "why", ids carry over.
  assert.equal(first.question, rawFirst.requestedAction);
  assert.equal(first.evidence, rawFirst.quickTake);
  assert.equal(first.workstreamId, rawFirst.workstreamId);
  // kind always resolves to a valid union member; options stay honest (unmodeled).
  assert.ok(["grill", "decision", "approval", "review"].includes(first.kind));
  assert.deepEqual(first.options, []);
});

test("getFounderAttention tolerates an empty open set", async () => {
  const transport = new LiveHqTransport(
    stubClient({ "/v1/founder-attention": () => ({ inbox: [], open: [] }) }),
  );
  assert.deepEqual(await transport.getFounderAttention(), []);
});

test("getConversation is null and boundConversations empty with the default (empty) binding", async () => {
  // The honest pre-binding behavior: no wire → nothing bound. This must stay
  // byte-identical to the old hardcoded null / [] so the surface is unchanged.
  const wsId = "demand-loop";
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
    }),
  );
  assert.equal(await transport.getConversation(wsId), null);
  const detail = await transport.getWorkstream(wsId);
  assert.deepEqual(detail.boundConversations, []);
});

test("an injected binding surfaces on getConversation and boundConversations", async () => {
  const wsId = "launch-site";
  const ref = {
    kind: "channel",
    id: "chan-xyz",
    label: "#launch-site",
    agentPubkey: "agent-1",
    sessionKind: "claude",
  };
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
    }),
    new FixtureWorkstreamBinding({ [wsId]: [ref] }),
  );

  // getConversation returns a conversation bound to the channel, with no
  // relayed messages yet (HQ projects none) — the seam the relay writes into.
  const convo = await transport.getConversation(wsId);
  assert.ok(convo, "conversation present when bound");
  assert.equal(convo.subjectId, wsId);
  assert.equal(convo.title, ref.label);
  assert.deepEqual(convo.messages, []);

  // A subject with no binding still returns null (honest gap preserved).
  assert.equal(await transport.getConversation("not-bound"), null);

  // boundConversations passes the ref through to the workstream detail.
  const detail = await transport.getWorkstream(wsId);
  assert.deepEqual(detail.boundConversations, [ref]);
});

test("getFounderAttention projects packageDigest verbatim, distinct from correlationId", async () => {
  const transport = new LiveHqTransport(stubClient());
  const items = await transport.getFounderAttention();
  const rawOpen = load("founder-attention").open;
  assert.ok(items.length > 0, "attention items present");
  for (let i = 0; i < items.length; i += 1) {
    const raw = rawOpen[i];
    if (raw.packageDigest == null) {
      // null (non-conforming stored digest) must project to undefined.
      assert.equal(items[i].packageDigest, undefined);
    } else {
      assert.equal(items[i].packageDigest, raw.packageDigest);
      assert.match(items[i].packageDigest, /^sha256:[0-9a-f]{64}$/);
      // The landmine: never the correlationId decoy.
      assert.notEqual(items[i].packageDigest, raw.correlationId);
    }
  }
});

const RUN_SORT_KEY = (r) =>
  Date.parse(r.updatedAt ?? r.completedAt ?? r.createdAt ?? "") || 0;

test("getWorkstream populates the Runs strip, newest-first and capped", async () => {
  const wsId = "demand-loop";
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
      [`/v1/workstreams/${wsId}/runs`]: () => load("run-list-workstream"),
    }),
  );
  const detail = await transport.getWorkstream(wsId);
  assert.ok(detail, "detail present");

  const rawRuns = load("run-list-workstream").runs;
  // Capped to the most-recent 8 by last update, newest first — same key the mapper uses.
  const expectedIds = rawRuns
    .slice()
    .sort((a, b) => RUN_SORT_KEY(b) - RUN_SORT_KEY(a))
    .slice(0, 8)
    .map((r) => r.id);
  assert.deepEqual(
    detail.runs.map((r) => r.id),
    expectedIds,
  );

  const first = detail.runs[0];
  assert.ok(first.label.length > 0); // role · harness
  assert.ok(first.result.length > 0); // state (+ merge-eligible)
  assert.equal(typeof first.at, "string"); // relative age
});

test("getWorkstream brief is the objective LEAD only — not a four-field mash", async () => {
  const wsId = "demand-loop";
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
    }),
  );
  const detail = await transport.getWorkstream(wsId);
  assert.ok(detail, "detail present");

  const raw = load("workstream-show").workstream;
  // The brief is one honest line: the objective (fallback title), nothing else.
  assert.equal(detail.brief, raw.objective ?? raw.title ?? "");
  // The old blob concatenated exactNextAction into the brief — prove that's dead.
  if (raw.exactNextAction && raw.exactNextAction !== raw.objective) {
    assert.ok(
      !detail.brief.includes(raw.exactNextAction),
      "brief must not mash in the next action",
    );
  }
  // Those fields now live separately, rendered as their own labeled lines.
  assert.equal(detail.nextAction, raw.exactNextAction ?? "");
  assert.equal(typeof detail.truthNow, "string");
});

test("getWorkstream maps lifecycleFacts.dependencyEdges + dependencies into typed DependencyEdges", async () => {
  const wsId = "demand-loop";
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
    }),
  );
  const detail = await transport.getWorkstream(wsId);
  assert.ok(detail, "detail present");

  const rawOutcomes = load("workstream-show").workstream.outcomes;
  const ticket1 = rawOutcomes.find((o) => o.id === "demand-loop-ticket-1");
  const ticket2 = rawOutcomes.find((o) => o.id === "demand-loop-ticket-2");
  assert.ok(ticket1 && ticket2, "capture still has ticket-1/ticket-2");

  // ticket-1 carries no dependencies — its mapped OutcomeSummary has no edges.
  const mappedTicket1 = detail.outcomes.find(
    (o) => o.id === "demand-loop-ticket-1",
  );
  assert.deepEqual(mappedTicket1.dependencyEdges, []);

  // ticket-2's lifecycleFacts.dependencyEdges = [{kind:"requires-outcome",
  // targetId:"demand-loop-ticket-1"}] AND dependencies=["demand-loop-ticket-1"]
  // (the same target from both sources) — dedup means exactly ONE typed edge.
  assert.deepEqual(ticket2.lifecycleFacts.dependencyEdges, [
    {
      kind: "requires-outcome",
      schema: "outcome-dependency-edge-v1",
      targetId: "demand-loop-ticket-1",
    },
  ]);
  assert.deepEqual(ticket2.dependencies, ["demand-loop-ticket-1"]);
  const mappedTicket2 = detail.outcomes.find(
    (o) => o.id === "demand-loop-ticket-2",
  );
  assert.deepEqual(mappedTicket2.dependencyEdges, [
    {
      source: "demand-loop-ticket-2",
      target: "demand-loop-ticket-1",
      kind: "requires-outcome",
    },
  ]);

  // WorkstreamRow.edges (inherited onto WorkstreamDetail) is the union of
  // every outcome's own edges, source-tagged per outcome.
  assert.deepEqual(
    detail.edges.map((e) => `${e.source}->${e.target}(${e.kind})`).sort(),
    [
      "demand-loop-ticket-2->demand-loop-ticket-1(requires-outcome)",
      "demand-loop-ticket-3->demand-loop-ticket-1(requires-outcome)",
    ].sort(),
  );
});

test("getWorkstreamPortfolio maps launch-site's real blocked-by-workstream edges", async () => {
  const transport = new LiveHqTransport(stubClient());
  const rows = await transport.getWorkstreamPortfolio();
  const launchSite = rows.find((row) => row.id === "launch-site");
  assert.ok(launchSite, "launch-site present in the live capture");

  const raw = load("workstream-list").workstreams.find(
    (w) => w.id === "launch-site",
  );
  const rawTargets = raw.outcomes
    .flatMap((o) => o.lifecycleFacts?.dependencyEdges ?? [])
    .map((e) => e.targetId)
    .sort();
  assert.deepEqual(rawTargets, [
    "brand-system",
    "commerce-legal",
    "flagship-assets",
  ]);

  assert.deepEqual(launchSite.edges.map((e) => e.target).sort(), rawTargets);
  for (const edge of launchSite.edges) {
    assert.equal(edge.kind, "blocked-by-workstream");
    assert.equal(edge.source, "launch-site:current-outcome");
  }

  // The reverse relationship: other workstreams whose own edges target
  // launch-site (what launch-site BLOCKS) — proves a portfolio-wide graph is
  // assemblable from getWorkstreamPortfolio() alone, no per-workstream fetch.
  const blockedByLaunchSite = rows
    .filter((row) =>
      (row.edges ?? []).some((edge) => edge.target === "launch-site"),
    )
    .map((row) => row.id)
    .sort();
  assert.deepEqual(blockedByLaunchSite, ["email-lifecycle", "paid-ads"]);
});

test("getReleases normalizes blockedBy (string | array | null) into blockedByIds", async () => {
  const withBlockedBy = {
    openReleaseVersion: "9.9.9",
    release: {
      version: "9.9.9",
      status: "open",
      items: [
        { id: "single", state: "building", blockedBy: "brand-system" },
        {
          id: "multi",
          state: "building",
          blockedBy: ["brand-system", "commerce-legal"],
        },
        { id: "none", state: "building", blockedBy: null },
      ],
    },
  };
  const transport = new LiveHqTransport(
    stubClient({ "/v1/releases": () => withBlockedBy }),
  );
  const [release] = await transport.getReleases();
  const byLabel = Object.fromEntries(
    release.required.map((item) => [item.label, item.blockedByIds]),
  );
  assert.deepEqual(byLabel.single, ["brand-system"]);
  assert.deepEqual(byLabel.multi, ["brand-system", "commerce-legal"]);
  assert.deepEqual(byLabel.none, []);
});

test("getWorkstream degrades to an empty Runs strip when the runs fetch fails", async () => {
  const wsId = "demand-loop";
  const transport = new LiveHqTransport(
    stubClient({
      [`/v1/workstreams/${wsId}`]: () => load("workstream-show"),
      [`/v1/workstreams/${wsId}/runs`]: () => {
        throw new Error("bridge down");
      },
    }),
  );
  const detail = await transport.getWorkstream(wsId);
  assert.ok(detail, "detail still renders without runs");
  assert.deepEqual(detail.runs, []);
});

test("getWorkingNow reads the unscoped run list, never the frontier", async () => {
  const transport = new LiveHqTransport(
    stubClient({ "/v1/runs": () => load("run-list-sample") }),
  );
  // The real sample fixture has exactly one running run, on demand-loop.
  assert.deepEqual(await transport.getWorkingNow(), ["demand-loop"]);
});

test("getReleases maps the live release report to one version-badged ReleaseSummary", async () => {
  const transport = new LiveHqTransport(
    stubClient({ "/v1/releases": () => load("release-report") }),
  );
  const releases = await transport.getReleases();
  assert.equal(releases.length, 1);

  const release = releases[0];
  const raw = load("release-report");
  assert.equal(release.version, raw.release.version);
  assert.equal(release.required.length, raw.release.items.length);

  // Idea vs waiting split — the 0.2.10 "research wall" relabels honestly.
  const idea = release.required.filter((item) => item.activity === "idea");
  const rawIdea = raw.release.items.filter((item) => item.state === "idea");
  assert.equal(idea.length, rawIdea.length);
  assert.ok(idea.length >= 14, "the 0.2.10 idea-wall survives the mapping");

  // A non-idea open item (state=building, workflow=ready) maps to waiting,
  // not "research".
  const buildingReady = release.required.find((item) =>
    item.label.startsWith("AI-edit long-source duration fix"),
  );
  assert.equal(buildingReady.activity, "waiting");

  // workflow=needs-jordan wins over its own state.
  const needsJordan = release.required.find(
    (item) => item.label === "Batch/queued generation",
  );
  assert.equal(needsJordan.activity, "needs-you");

  // landed/proven both close as done.
  const done = release.required.filter((item) => item.activity === "done");
  assert.equal(done.length, 2);
});

test("getReleases degrades to empty when the report route fails", async () => {
  const transport = new LiveHqTransport(
    stubClient({
      "/v1/releases": () => {
        throw new Error("bridge down");
      },
    }),
  );
  assert.deepEqual(await transport.getReleases(), []);
});
