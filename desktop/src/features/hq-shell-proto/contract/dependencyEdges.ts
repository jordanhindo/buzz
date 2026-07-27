// HQ shell prototype — resolving typed DependencyEdges into a "waiting on /
// blocks" split (D4's in-context edge strip, and the shared read the future
// portfolio Map (D3) can reuse). Pure, dependency-free — no React, no
// transport — same pattern as activity.ts.
//
// Upstream ("waiting on") comes straight off the selected workstream's own
// `edges` (WorkstreamRow.edges, which WorkstreamDetail inherits): each edge's
// target is either a sibling outcome on the SAME workstream (kind
// "requires-outcome", resolved against `detail.outcomes`) or another
// workstream entirely (kind "blocked-by-workstream", resolved against the
// portfolio rows). Downstream ("blocks") has no direct field anywhere in HQ's
// projection — it only exists as the reverse of some OTHER workstream's
// upstream edge — so it's derived by scanning the portfolio for any row whose
// own edges target this workstream's id.

import type {
  DependencyEdge,
  FrontierComposition,
  OutcomeSummary,
  WorkstreamRow,
} from "./types";

export interface ResolvedDependencyEdge {
  target: string; // the raw target id (outcome or workstream), unresolved fallback label
  kind: string; // HQ's raw edge kind, passed through
  label: string; // resolved human title, or the raw target id when unresolved
  resolvedAs: "outcome" | "workstream" | "unresolved";
  outcomeState?: OutcomeSummary["state"]; // set when resolvedAs === "outcome"
  frontier?: FrontierComposition; // set when resolvedAs === "workstream" (drives StatusLed)
}

export interface DependencyEdgeSplit {
  /** What this workstream is blocked by / waiting on. */
  upstream: ResolvedDependencyEdge[];
  /** What this workstream blocks. */
  downstream: ResolvedDependencyEdge[];
}

const EMPTY_SPLIT: DependencyEdgeSplit = { upstream: [], downstream: [] };

function resolveTarget(
  edge: DependencyEdge,
  outcomesById: Map<string, OutcomeSummary>,
  rowsById: Map<string, WorkstreamRow>,
): ResolvedDependencyEdge {
  const outcome = outcomesById.get(edge.target);
  if (outcome) {
    return {
      target: edge.target,
      kind: edge.kind,
      label: outcome.title,
      resolvedAs: "outcome",
      outcomeState: outcome.state,
    };
  }
  const row = rowsById.get(edge.target);
  if (row) {
    return {
      target: edge.target,
      kind: edge.kind,
      label: row.title,
      resolvedAs: "workstream",
      frontier: row.frontier,
    };
  }
  return {
    target: edge.target,
    kind: edge.kind,
    label: edge.target,
    resolvedAs: "unresolved",
  };
}

/**
 * Split one workstream's dependency edges into upstream ("waiting on") and
 * downstream ("blocks"). `portfolio` is optional — omitting it degrades
 * gracefully: upstream edges targeting another workstream (rather than a
 * sibling outcome) render with the raw target id instead of a resolved
 * title, and downstream is always empty (it can only be derived by scanning
 * every OTHER workstream's own edges).
 */
export function splitWorkstreamDependencyEdges(
  detail: { id: string; edges?: DependencyEdge[]; outcomes?: OutcomeSummary[] },
  portfolio: readonly WorkstreamRow[] = [],
): DependencyEdgeSplit {
  const ownEdges = detail.edges ?? [];
  if (ownEdges.length === 0 && portfolio.length === 0) return EMPTY_SPLIT;

  const outcomesById = new Map(
    (detail.outcomes ?? []).map((outcome) => [outcome.id, outcome]),
  );
  const rowsById = new Map(portfolio.map((row) => [row.id, row]));

  // Upstream: this workstream's own edges, deduped by target (an outcome can
  // carry the same target as a sibling outcome — e.g. two tickets both
  // requiring the same prerequisite — which should read as ONE upstream row,
  // not one per source outcome).
  const seenUpstreamTargets = new Set<string>();
  const upstream: ResolvedDependencyEdge[] = [];
  for (const edge of ownEdges) {
    if (seenUpstreamTargets.has(edge.target)) continue;
    seenUpstreamTargets.add(edge.target);
    upstream.push(resolveTarget(edge, outcomesById, rowsById));
  }

  // Downstream: any OTHER workstream in the portfolio carrying an edge whose
  // target is THIS workstream's id — the reverse relationship HQ never
  // returns directly. One row per blocking workstream, regardless of how many
  // of its outcomes carry the edge.
  const downstream: ResolvedDependencyEdge[] = [];
  for (const row of portfolio) {
    if (row.id === detail.id) continue;
    const blockingEdge = (row.edges ?? []).find(
      (edge) => edge.target === detail.id,
    );
    if (!blockingEdge) continue;
    downstream.push({
      target: row.id,
      kind: blockingEdge.kind,
      label: row.title,
      resolvedAs: "workstream",
      frontier: row.frontier,
    });
  }

  return { upstream, downstream };
}
