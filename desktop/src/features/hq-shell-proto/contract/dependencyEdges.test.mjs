import assert from "node:assert/strict";
import test from "node:test";

import { splitWorkstreamDependencyEdges } from "./dependencyEdges.ts";

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

test("splitWorkstreamDependencyEdges resolves upstream edges against sibling outcomes", () => {
  const detail = {
    id: "demand-loop",
    edges: [
      {
        source: "demand-loop-ticket-2",
        target: "demand-loop-ticket-1",
        kind: "requires-outcome",
      },
      {
        source: "demand-loop-ticket-3",
        target: "demand-loop-ticket-1",
        kind: "requires-outcome",
      },
    ],
    outcomes: [
      {
        id: "demand-loop-ticket-1",
        title: "Ticket 1 objective",
        state: "done",
      },
      {
        id: "demand-loop-ticket-2",
        title: "Ticket 2 objective",
        state: "waiting",
      },
      {
        id: "demand-loop-ticket-3",
        title: "Ticket 3 objective",
        state: "blocked",
      },
    ],
  };

  const { upstream, downstream } = splitWorkstreamDependencyEdges(detail, []);

  // Two edges target the SAME outcome — deduped into one upstream row.
  assert.equal(upstream.length, 1);
  assert.equal(upstream[0].target, "demand-loop-ticket-1");
  assert.equal(upstream[0].resolvedAs, "outcome");
  assert.equal(upstream[0].label, "Ticket 1 objective");
  assert.equal(upstream[0].outcomeState, "done");

  // No portfolio passed — nothing can prove downstream, so it stays empty.
  assert.deepEqual(downstream, []);
});

test("splitWorkstreamDependencyEdges resolves upstream edges against another workstream's portfolio row", () => {
  const detail = {
    id: "launch-site",
    edges: [
      {
        source: "launch-site:current-outcome",
        target: "brand-system",
        kind: "blocked-by-workstream",
      },
      {
        source: "launch-site:current-outcome",
        target: "flagship-assets",
        kind: "blocked-by-workstream",
      },
    ],
    outcomes: [
      {
        id: "launch-site:current-outcome",
        title: "Launch site",
        state: "running",
      },
    ],
  };
  const portfolio = [
    {
      id: "brand-system",
      title: "Brand system",
      frontier: frontier({ ready: 1 }),
    },
    {
      id: "flagship-assets",
      title: "Flagship assets",
      frontier: frontier({ blocked: 1 }),
    },
  ];

  const { upstream } = splitWorkstreamDependencyEdges(detail, portfolio);
  assert.equal(upstream.length, 2);
  const byTarget = Object.fromEntries(upstream.map((e) => [e.target, e]));
  assert.equal(byTarget["brand-system"].resolvedAs, "workstream");
  assert.equal(byTarget["brand-system"].label, "Brand system");
  assert.deepEqual(byTarget["brand-system"].frontier, frontier({ ready: 1 }));
  assert.equal(byTarget["flagship-assets"].resolvedAs, "workstream");
});

test("splitWorkstreamDependencyEdges derives downstream from the reverse of the portfolio's own edges", () => {
  const detail = { id: "launch-site", edges: [], outcomes: [] };
  const portfolio = [
    { id: "launch-site", title: "Launch site", frontier: frontier() },
    {
      id: "email-lifecycle",
      title: "Email lifecycle",
      frontier: frontier({ blocked: 1 }),
      edges: [
        {
          source: "email-lifecycle:current-outcome",
          target: "launch-site",
          kind: "blocked-by-workstream",
        },
      ],
    },
    {
      id: "paid-ads",
      title: "Paid ads",
      frontier: frontier({ blocked: 1 }),
      edges: [
        {
          source: "paid-ads:current-outcome",
          target: "launch-site",
          kind: "blocked-by-workstream",
        },
      ],
    },
    {
      id: "unrelated",
      title: "Unrelated workstream",
      frontier: frontier(),
      edges: [
        {
          source: "unrelated:current-outcome",
          target: "brand-system",
          kind: "blocked-by-workstream",
        },
      ],
    },
  ];

  const { downstream } = splitWorkstreamDependencyEdges(detail, portfolio);
  assert.deepEqual(downstream.map((e) => e.target).sort(), [
    "email-lifecycle",
    "paid-ads",
  ]);
  for (const edge of downstream) {
    assert.equal(edge.resolvedAs, "workstream");
    assert.equal(edge.kind, "blocked-by-workstream");
  }
});

test("splitWorkstreamDependencyEdges degrades an unresolvable target to a plain id, never crashes", () => {
  const detail = {
    id: "ws-with-stale-edge",
    edges: [
      {
        source: "ws-with-stale-edge:current-outcome",
        target: "no-such-workstream",
        kind: "blocked-by-workstream",
      },
    ],
    outcomes: [],
  };
  const { upstream, downstream } = splitWorkstreamDependencyEdges(detail, []);
  assert.equal(upstream.length, 1);
  assert.equal(upstream[0].resolvedAs, "unresolved");
  assert.equal(upstream[0].label, "no-such-workstream");
  assert.deepEqual(downstream, []);
});

test("splitWorkstreamDependencyEdges returns empty upstream/downstream for a workstream with no edges", () => {
  const detail = { id: "quiet-workstream", edges: [], outcomes: [] };
  const result = splitWorkstreamDependencyEdges(detail, [
    { id: "quiet-workstream", title: "Quiet", frontier: frontier() },
    { id: "other", title: "Other", frontier: frontier(), edges: [] },
  ]);
  assert.deepEqual(result, { upstream: [], downstream: [] });
});
