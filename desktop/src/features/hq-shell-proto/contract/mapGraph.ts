// HQ shell prototype — the Map lens's pure graph model (D3/the Map).
//
// Turns `getWorkstreamPortfolio()`'s rows into a workstream-level dependency
// graph, and applies the Map's two required filters (focus a workstream +
// its neighborhood, filter by status) to it. Pure, dependency-free — no
// React, no dagre, no transport — same pattern as activity.ts and
// dependencyEdges.ts, so it runs under the node test runner
// (--experimental-strip-types can't parse JSX) and is trivially unit-testable
// against the real captured portfolio.

import {
  type Activity,
  dominantStatusActivity,
  type DominantStatus,
  dominantFrontierStatus,
  frontierStreamCount,
} from "./activity";
import type { WorkstreamRow } from "./types";

export interface MapGraphNode {
  id: string;
  title: string;
  status: DominantStatus;
  streamCount: number;
}

export interface MapGraphEdge {
  id: string;
  source: string; // workstream id
  target: string; // workstream id (always resolves to another portfolio row)
  kind: string;
}

export interface MapGraph {
  nodes: MapGraphNode[];
  edges: MapGraphEdge[];
}

/**
 * Build the workstream-level dependency graph from the portfolio-wide rollup
 * `WorkstreamRow.edges` (see contract/types.ts and LiveHqTransport's
 * `aggregateWorkstreamEdges`). One node per workstream. An edge is kept only
 * when its target resolves to a DIFFERENT workstream in this same portfolio —
 * most raw DependencyEdges target a sibling OUTCOME id (e.g.
 * "requires-outcome" edges within one workstream's own ticket chain), which
 * has no place on a workstream-level map and is dropped here, not fabricated
 * as a self-loop or a dangling node. Deduped by (source, target) so a
 * workstream whose several outcomes each carry an edge to the same target
 * workstream still draws ONE line, not one per outcome.
 */
export function buildWorkstreamMapGraph(
  rows: readonly WorkstreamRow[],
): MapGraph {
  const idSet = new Set(rows.map((row) => row.id));
  const nodes: MapGraphNode[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: dominantFrontierStatus(row.frontier),
    streamCount: frontierStreamCount(row.frontier),
  }));

  const seen = new Set<string>();
  const edges: MapGraphEdge[] = [];
  for (const row of rows) {
    for (const edge of row.edges ?? []) {
      if (edge.target === row.id || !idSet.has(edge.target)) continue;
      const key = `${row.id}->${edge.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        id: key,
        source: row.id,
        target: edge.target,
        kind: edge.kind,
      });
    }
  }
  return { nodes, edges };
}

/** Node ids that carry at least one workstream-to-workstream edge (either direction). */
export function connectedNodeIds(graph: MapGraph): string[] {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    ids.add(edge.source);
    ids.add(edge.target);
  }
  return [...ids];
}

// --- filters ------------------------------------------------------------------
// The Map's two required filters (operator ask): (1) focus a workstream and
// its dependency neighborhood, (2) filter by status. Both DIM rather than
// remove — dagre's layout stays stable across filter changes, and "keep
// edges coherent" (the operator's explicit bar) means the graph's topology
// never fragments into dangling stubs when a filter narrows what's live.

export interface MapFilterState {
  /** A node id to isolate, or null for no focus. */
  workstreamFocus: string | null;
  /** An Activity bucket to isolate, or "all". */
  statusFilter: Activity | "all";
}

export const ALL_STATUS_FILTER: MapFilterState["statusFilter"] = "all";

export interface FilteredMapNode extends MapGraphNode {
  /** True when this node fails either active filter. */
  dimmed: boolean;
  /** True for the focused node itself (workstreamFocus === id). */
  focused: boolean;
}

export interface FilteredMapEdge extends MapGraphEdge {
  /** True when either endpoint is dimmed. */
  dimmed: boolean;
}

export interface FilteredMapGraph {
  nodes: FilteredMapNode[];
  edges: FilteredMapEdge[];
}

/** The focused node plus every node directly connected to it, either direction. */
function neighborhoodOf(graph: MapGraph, focusId: string): Set<string> {
  const ids = new Set<string>([focusId]);
  for (const edge of graph.edges) {
    if (edge.source === focusId) ids.add(edge.target);
    if (edge.target === focusId) ids.add(edge.source);
  }
  return ids;
}

/**
 * Apply the Map's filters to a built graph. A node is dimmed when it fails
 * EITHER active filter (outside the focused neighborhood, or not matching the
 * status bucket) — the two filters compose, they don't override each other.
 */
export function applyMapFilters(
  graph: MapGraph,
  filters: MapFilterState,
): FilteredMapGraph {
  const neighborIds = filters.workstreamFocus
    ? neighborhoodOf(graph, filters.workstreamFocus)
    : null;

  const nodes: FilteredMapNode[] = graph.nodes.map((node) => {
    const inNeighborhood = !neighborIds || neighborIds.has(node.id);
    const matchesStatus =
      filters.statusFilter === "all" ||
      dominantStatusActivity(node.status) === filters.statusFilter;
    return {
      ...node,
      dimmed: !inNeighborhood || !matchesStatus,
      focused: filters.workstreamFocus === node.id,
    };
  });

  const dimmedIds = new Set(
    nodes.filter((node) => node.dimmed).map((node) => node.id),
  );
  const edges: FilteredMapEdge[] = graph.edges.map((edge) => ({
    ...edge,
    dimmed: dimmedIds.has(edge.source) || dimmedIds.has(edge.target),
  }));

  return { nodes, edges };
}
