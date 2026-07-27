// The Map lens — the portfolio-wide dependency DAG (D3). Left→right dagre
// layout over React Flow, colored by the SAME ambient Activity colors + pulse
// as the rest of the app (StatusLed/NeedsMeChip — no second palette). Two
// required filters, both built on the app's own Tabs control: focus a
// workstream + its dependency neighborhood, and filter by status. Clicking a
// node follows the app's one navigation law — it opens the same
// WorkstreamDetailPanel every other click in the shell opens (via
// onOpenWorkstream, which VariantD_Bridge wires to the ws= deep link).
//
// The graph shape itself (contract/mapGraph.ts) is pure and unit-tested
// against the real 48-workstream portfolio; this file is purely the
// React Flow + dagre presentation layer over that pure model.

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeProps,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getStraightPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { ArrowLeft, ChevronDown, GitBranch } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/cn";
import type { Activity } from "@/features/hq-shell-proto/contract/activity";
import {
  ALL_STATUS_FILTER,
  applyMapFilters,
  buildWorkstreamMapGraph,
  connectedNodeIds,
  type FilteredMapNode,
  type MapFilterState,
  type MapGraphEdge,
  type MapGraphNode,
} from "@/features/hq-shell-proto/contract/mapGraph";
import type { WorkstreamRow } from "@/features/hq-shell-proto/contract/types";
import {
  NeedsMeChip,
  StatusLed,
  type WorkState,
} from "@/features/hq-shell-proto/primitives/StatusLed";

// --- dagre layout ---------------------------------------------------------

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;

function layoutLeftToRight(
  nodes: MapGraphNode[],
  edges: MapGraphEdge[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 28, ranksep: 96 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    const pos = g.node(node.id);
    positions.set(node.id, {
      // dagre centers on (x, y); React Flow positions from the top-left.
      x: (pos?.x ?? 0) - NODE_WIDTH / 2,
      y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
    });
  }
  return positions;
}

// --- custom node ------------------------------------------------------------

type WorkstreamNodeData = {
  title: string;
  status: FilteredMapNode["status"];
  streamCount: number;
  dimmed: boolean;
  focused: boolean;
};

function WorkstreamNode({ data }: NodeProps<Node<WorkstreamNodeData>>) {
  const { title, status, streamCount, dimmed, focused } = data;
  return (
    <div
      className={cn(
        "flex w-[220px] items-center gap-2 rounded-lg border bg-card px-3 py-2.5 shadow-sm transition-opacity",
        focused ? "border-primary ring-2 ring-primary/40" : "border-border/70",
        dimmed && !focused ? "opacity-30" : "opacity-100",
      )}
      data-node-status={status}
      data-testid="map-node"
    >
      {/* Hidden connection anchors — React Flow needs a source/target Handle on
          a custom node or dependency edges have nowhere to attach and never
          draw. Visually hidden; the LR layout carries the direction. */}
      <Handle
        className="!border-0 !bg-transparent"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!border-0 !bg-transparent"
        position={Position.Right}
        type="source"
      />
      {status === "needs-me" ? (
        <NeedsMeChip className="shrink-0" />
      ) : (
        <StatusLed className="shrink-0" state={status as WorkState} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-tight">{title}</p>
        <p className="text-2xs tabular-nums text-muted-foreground/60">
          {streamCount} {streamCount === 1 ? "stream" : "streams"}
        </p>
      </div>
    </div>
  );
}

const NODE_TYPES = { workstream: WorkstreamNode };

// A plain straight connector — the dependency direction is legible from the
// LR layout itself; the edge only needs to dim in step with its endpoints.
function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps<Edge<{ dimmed: boolean }>>) {
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return (
    <path
      className={cn(
        // `!stroke` beats React Flow's own faint default edge color, which is
        // invisible against the dark canvas — a dependency map has to show its
        // dependencies. Width via inline style (React Flow overrides the class).
        "react-flow__edge-path transition-opacity !stroke-muted-foreground/70",
        data?.dimmed ? "opacity-20" : "opacity-80",
      )}
      d={path}
      id={id}
      markerEnd="url(#map-edge-arrow)"
      style={{ strokeWidth: 1.5 }}
    />
  );
}

const EDGE_TYPES = { dependency: DependencyEdge };

// --- filter bar ---------------------------------------------------------

const STATUS_FILTER_OPTIONS: { value: Activity | "all"; label: string }[] = [
  { value: ALL_STATUS_FILTER, label: "All" },
  { value: "working", label: "Working" },
  { value: "needs-you", label: "Needs you" },
  { value: "blocked", label: "Blocked" },
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Done" },
];

function FilterBar({
  nodesById,
  connectedIds,
  filters,
  onChange,
}: {
  nodesById: Map<string, { title: string }>;
  connectedIds: string[];
  filters: MapFilterState;
  onChange: (next: MapFilterState) => void;
}) {
  const sortedConnected = React.useMemo(
    () =>
      [...connectedIds].sort((a, b) =>
        (nodesById.get(a)?.title ?? a).localeCompare(
          nodesById.get(b)?.title ?? b,
        ),
      ),
    [connectedIds, nodesById],
  );

  const focusLabel =
    filters.workstreamFocus == null
      ? "All workstreams"
      : (nodesById.get(filters.workstreamFocus)?.title ??
        filters.workstreamFocus);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border/60 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
          Focus
        </span>
        {/* Many long-named options — a dropdown, not a per-workstream tab row
            that overflows and truncates. Status below stays segmented (6 short
            fixed options: the right shape for tabs). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-7 max-w-[14rem] justify-between gap-2 text-2xs font-medium"
              size="sm"
              variant="outline"
            >
              <span className="truncate">{focusLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-[60vh] overflow-y-auto"
          >
            <DropdownMenuRadioGroup
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  workstreamFocus: value === "all" ? null : value,
                })
              }
              value={filters.workstreamFocus ?? "all"}
            >
              <DropdownMenuRadioItem value="all">
                All workstreams
              </DropdownMenuRadioItem>
              {sortedConnected.map((id) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {nodesById.get(id)?.title ?? id}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
          Status
        </span>
        <Tabs
          onValueChange={(value) =>
            onChange({
              ...filters,
              statusFilter: value as Activity | "all",
            })
          }
          value={filters.statusFilter}
        >
          <TabsList className="h-auto p-1">
            {STATUS_FILTER_OPTIONS.map((option) => (
              <TabsTrigger
                className="text-2xs"
                key={option.value}
                value={option.value}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}

// --- the Map lens -----------------------------------------------------------

export function MapView({
  portfolio,
  onBack,
  onOpenWorkstream,
}: {
  portfolio: WorkstreamRow[];
  onBack: () => void;
  onOpenWorkstream: (id: string) => void;
}) {
  const fullGraph = React.useMemo(
    () => buildWorkstreamMapGraph(portfolio),
    [portfolio],
  );
  const connectedIds = React.useMemo(
    () => connectedNodeIds(fullGraph),
    [fullGraph],
  );
  // The Map is the DEPENDENCY lens — render only the workstreams that actually
  // participate in an edge. Most of the portfolio carries no dependency at all;
  // laying those out is a wall of disconnected nodes (dagre stacks them into one
  // meaningless column) — noise, not signal. The header states the honest count
  // (N of total), and the standalone workstreams still live on the Bridge.
  const graph = React.useMemo(() => {
    const set = new Set(connectedIds);
    return {
      nodes: fullGraph.nodes.filter((node) => set.has(node.id)),
      edges: fullGraph.edges,
    };
  }, [fullGraph, connectedIds]);
  const nodesById = React.useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph],
  );

  const [filters, setFilters] = React.useState<MapFilterState>({
    workstreamFocus: null,
    statusFilter: ALL_STATUS_FILTER,
  });

  const filtered = React.useMemo(
    () => applyMapFilters(graph, filters),
    [graph, filters],
  );

  // Layout is computed once from the FULL graph so node positions stay stable
  // across filter changes — filtering dims/hides, it never re-flows the map.
  const positions = React.useMemo(
    () => layoutLeftToRight(graph.nodes, graph.edges),
    [graph],
  );

  const flowNodes: Node<WorkstreamNodeData>[] = React.useMemo(
    () =>
      filtered.nodes.map((node) => ({
        id: node.id,
        type: "workstream",
        position: positions.get(node.id) ?? { x: 0, y: 0 },
        data: {
          title: node.title,
          status: node.status,
          streamCount: node.streamCount,
          dimmed: node.dimmed,
          focused: node.focused,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      })),
    [filtered.nodes, positions],
  );

  const flowEdges: Edge<{ dimmed: boolean }>[] = React.useMemo(
    () =>
      filtered.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "dependency",
        data: { dimmed: edge.dimmed },
      })),
    [filtered.edges],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1">Bridge</span>
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <div>
            <h1 className="truncate text-base font-semibold tracking-tight">
              Map
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              The {graph.nodes.length} workstreams with dependencies ·{" "}
              {graph.edges.length} edges · the other{" "}
              {fullGraph.nodes.length - graph.nodes.length} stand alone on Work
            </p>
          </div>
        </div>
      </header>

      <FilterBar
        connectedIds={connectedIds}
        filters={filters}
        nodesById={nodesById}
        onChange={setFilters}
      />

      <div className="min-h-0 flex-1" data-testid="map-canvas">
        <ReactFlowProvider>
          <ReactFlow
            edgeTypes={EDGE_TYPES}
            edges={flowEdges}
            fitView
            // The whole 48-node LR DAG is far wider than the pane; React Flow's
            // default minZoom (0.5) clamps fitView before the graph fits, pushing
            // half the nodes off-screen. Drop the floor so fitView can zoom out
            // to show the entire portfolio at once — the point of the Map.
            fitViewOptions={{ padding: 0.12 }}
            minZoom={0.1}
            nodeTypes={NODE_TYPES}
            nodes={flowNodes}
            nodesConnectable={false}
            nodesDraggable={false}
            onNodeClick={(_event, node) => onOpenWorkstream(node.id)}
            proOptions={{ hideAttribution: true }}
          >
            {/* Purely a hidden <defs> host for the edge arrowhead marker — never
                rendered as visible content, so it's decorative, not an image. */}
            <svg
              aria-hidden="true"
              style={{ position: "absolute", width: 0, height: 0 }}
            >
              <defs>
                <marker
                  id="map-edge-arrow"
                  markerHeight="8"
                  markerWidth="8"
                  orient="auto-start-reverse"
                  refX="8"
                  refY="4"
                >
                  <path
                    className="fill-muted-foreground/50"
                    d="M0,0 L8,4 L0,8 Z"
                  />
                </marker>
              </defs>
            </svg>
            <Background gap={20} variant={BackgroundVariant.Dots} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
