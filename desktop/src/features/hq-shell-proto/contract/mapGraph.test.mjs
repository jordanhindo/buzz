import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyMapFilters,
  buildWorkstreamMapGraph,
  connectedNodeIds,
} from "./mapGraph.ts";
import { LiveHqTransport } from "./LiveHqTransport.ts";

// Real safe-projection JSON captured from the live `hq` control plane — same
// fixture LiveHqTransport.test.mjs and dependencyEdges rely on. Driving the
// graph builder off the REAL mapped portfolio (not a hand-written fixture)
// proves the Map renders launch-site's real blocked-by-workstream edges, not
// invented ones.
const LIVE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "live",
);
const load = (name) =>
  JSON.parse(readFileSync(join(LIVE_DIR, `${name}.json`), "utf8"));

async function realPortfolio() {
  const transport = new LiveHqTransport({
    async getJson(path) {
      if (path === "/v1/frontier") return load("next");
      if (path === "/v1/workstreams") return load("workstream-list");
      throw new Error(`unmapped path '${path}'`);
    },
  });
  return transport.getWorkstreamPortfolio();
}

function frontier(overrides = {}) {
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
    ...overrides,
  };
}

// --- buildWorkstreamMapGraph ---------------------------------------------------

test("buildWorkstreamMapGraph maps the real 48-workstream portfolio to one node per row", async () => {
  const rows = await realPortfolio();
  const graph = buildWorkstreamMapGraph(rows);
  assert.equal(graph.nodes.length, 48);
  assert.equal(rows.length, 48);
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const row of rows) assert.ok(ids.has(row.id));
});

test("buildWorkstreamMapGraph keeps only workstream-to-workstream edges, deduped, dropping sibling-outcome edges", async () => {
  const rows = await realPortfolio();
  const graph = buildWorkstreamMapGraph(rows);
  // Measured against the real capture: 18 deduped blocked-by-workstream edges
  // across 13 distinct participating workstreams (see probe in the D-Map task
  // notes) — every edge whose raw target was a sibling OUTCOME id (the
  // "requires-outcome" edges within e.g. artifact-continuation's own ticket
  // chain) is correctly dropped, not fabricated as a self-referencing node.
  assert.equal(graph.edges.length, 18);
  for (const edge of graph.edges) {
    assert.notEqual(edge.source, edge.target);
    assert.equal(edge.kind, "blocked-by-workstream");
  }
  assert.equal(connectedNodeIds(graph).length, 13);
});

test("buildWorkstreamMapGraph: launch-site carries its real upstream + downstream edges", async () => {
  const rows = await realPortfolio();
  const graph = buildWorkstreamMapGraph(rows);
  const fromLaunchSite = graph.edges
    .filter((e) => e.source === "launch-site")
    .map((e) => e.target)
    .sort();
  const toLaunchSite = graph.edges
    .filter((e) => e.target === "launch-site")
    .map((e) => e.source)
    .sort();
  assert.deepEqual(fromLaunchSite, [
    "brand-system",
    "commerce-legal",
    "flagship-assets",
  ]);
  assert.deepEqual(toLaunchSite, ["email-lifecycle", "paid-ads"]);
});

test("buildWorkstreamMapGraph dedupes an edge that would otherwise be counted per-outcome", () => {
  const rows = [
    {
      id: "a",
      sourceVersion: "1",
      freshness: "live",
      observedAt: "now",
      title: "A",
      objective: "",
      frontier: frontier(),
      nextAction: "",
      actors: [],
      lastChange: "",
      primaryAction: "open-inspect-only",
      lifecycle: "ready",
      edges: [
        { source: "a:outcome-1", target: "b", kind: "blocked-by-workstream" },
        { source: "a:outcome-2", target: "b", kind: "blocked-by-workstream" },
      ],
    },
    {
      id: "b",
      sourceVersion: "1",
      freshness: "live",
      observedAt: "now",
      title: "B",
      objective: "",
      frontier: frontier(),
      nextAction: "",
      actors: [],
      lastChange: "",
      primaryAction: "open-inspect-only",
      lifecycle: "ready",
      edges: [],
    },
  ];
  const graph = buildWorkstreamMapGraph(rows);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].source, "a");
  assert.equal(graph.edges[0].target, "b");
});

test("buildWorkstreamMapGraph drops an edge whose target isn't a workstream in this portfolio", () => {
  const rows = [
    {
      id: "a",
      sourceVersion: "1",
      freshness: "live",
      observedAt: "now",
      title: "A",
      objective: "",
      frontier: frontier(),
      nextAction: "",
      actors: [],
      lastChange: "",
      primaryAction: "open-inspect-only",
      lifecycle: "ready",
      edges: [
        // "a:ticket-2" is a sibling OUTCOME id, not a portfolio workstream id.
        {
          source: "a:ticket-1",
          target: "a:ticket-2",
          kind: "requires-outcome",
        },
      ],
    },
  ];
  const graph = buildWorkstreamMapGraph(rows);
  assert.equal(graph.edges.length, 0);
});

// --- applyMapFilters ------------------------------------------------------------

function simpleGraph() {
  // a -> b -> c, and d is disconnected.
  return {
    nodes: [
      { id: "a", title: "A", status: "running", streamCount: 1 },
      { id: "b", title: "B", status: "needsContract", streamCount: 1 },
      { id: "c", title: "C", status: "blocked", streamCount: 1 },
      { id: "d", title: "D", status: "done", streamCount: 1 },
    ],
    edges: [
      { id: "a->b", source: "a", target: "b", kind: "blocked-by-workstream" },
      { id: "b->c", source: "b", target: "c", kind: "blocked-by-workstream" },
    ],
  };
}

test("applyMapFilters with no active filters dims nothing", () => {
  const result = applyMapFilters(simpleGraph(), {
    workstreamFocus: null,
    statusFilter: "all",
  });
  assert.ok(result.nodes.every((n) => !n.dimmed));
  assert.ok(result.edges.every((e) => !e.dimmed));
});

test("applyMapFilters: workstream focus isolates the node + its direct neighborhood, dims the rest", () => {
  const result = applyMapFilters(simpleGraph(), {
    workstreamFocus: "b",
    statusFilter: "all",
  });
  const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]));
  // b's neighborhood: a (upstream, points to b) and c (downstream, b points to it).
  assert.equal(byId.a.dimmed, false);
  assert.equal(byId.b.dimmed, false);
  assert.equal(byId.c.dimmed, false);
  assert.equal(byId.d.dimmed, true); // disconnected from b entirely
  assert.equal(byId.b.focused, true);
  assert.equal(byId.a.focused, false);
  // Edges stay present (coherent topology) — none touch the dimmed node d.
  assert.equal(result.edges.length, 2);
  assert.ok(result.edges.every((e) => !e.dimmed));
});

test("applyMapFilters: status filter dims nodes outside the Activity bucket, keeping edges coherent", () => {
  // a=running(working), b=needsContract(waiting), c=blocked(blocked), d=done(done)
  const result = applyMapFilters(simpleGraph(), {
    workstreamFocus: null,
    statusFilter: "working",
  });
  const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]));
  assert.equal(byId.a.dimmed, false);
  assert.equal(byId.b.dimmed, true);
  assert.equal(byId.c.dimmed, true);
  assert.equal(byId.d.dimmed, true);
  // Edges never vanish — but dim when either endpoint is dimmed.
  assert.equal(result.edges.length, 2);
  const abEdge = result.edges.find((e) => e.id === "a->b");
  assert.equal(abEdge.dimmed, true); // b is dimmed
  const bcEdge = result.edges.find((e) => e.id === "b->c");
  assert.equal(bcEdge.dimmed, true); // both dimmed
});

test("applyMapFilters: workstream focus AND status filter compose (a node must pass both)", () => {
  const result = applyMapFilters(simpleGraph(), {
    workstreamFocus: "b", // neighborhood: a, b, c
    statusFilter: "blocked", // only c matches
  });
  const byId = Object.fromEntries(result.nodes.map((n) => [n.id, n]));
  assert.equal(byId.a.dimmed, true); // in neighborhood, wrong status
  assert.equal(byId.b.dimmed, true); // in neighborhood, wrong status
  assert.equal(byId.c.dimmed, false); // in neighborhood AND matches status
  assert.equal(byId.d.dimmed, true); // fails both
});

test("applyMapFilters against the real portfolio: launch-site focus narrows to its real 6-node neighborhood", async () => {
  const rows = await realPortfolio();
  const graph = buildWorkstreamMapGraph(rows);
  const result = applyMapFilters(graph, {
    workstreamFocus: "launch-site",
    statusFilter: "all",
  });
  const visible = result.nodes
    .filter((n) => !n.dimmed)
    .map((n) => n.id)
    .sort();
  assert.deepEqual(visible, [
    "brand-system",
    "commerce-legal",
    "email-lifecycle",
    "flagship-assets",
    "launch-site",
    "paid-ads",
  ]);
});
