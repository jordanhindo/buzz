// The one dominant-status signal shared by Home, Projects, and the Map. A
// workstream is never a wall of chips here — it resolves to a single LED
// colored by its dominant current state, or an amber "needs me" chip when the
// founder is on the critical path. Priority: needsJordan > blocked > toGrill
// > needsContract > running > verifying > research > waiting > ready.

import type * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/cn";
import type { Activity } from "@/features/hq-shell-proto/contract/activity";

// `dominantFrontierStatus`/`frontierStreamCount`/`WorkState`/`DominantStatus`
// live in contract/activity.ts — pure FrontierComposition arithmetic with no
// JSX, so the Map's graph builder (contract/mapGraph.ts) can import them under
// the node test runner (which can't parse this file's JSX). Re-exported here
// so every existing consumer of primitives/StatusLed (and primitives/index)
// keeps working unchanged.
export {
  type DominantStatus,
  dominantFrontierStatus,
  frontierStreamCount,
} from "@/features/hq-shell-proto/contract/activity";
import type { WorkState } from "@/features/hq-shell-proto/contract/activity";

export type { WorkState };

const LED_META: Record<
  WorkState,
  { dot: string; pulse: boolean; label: string }
> = {
  ready: { dot: "bg-emerald-500", pulse: false, label: "Ready" },
  running: { dot: "bg-emerald-500", pulse: true, label: "Running" },
  verifying: { dot: "bg-blue-500", pulse: true, label: "Verifying" },
  needsContract: {
    dot: "bg-amber-500",
    pulse: false,
    label: "Needs contract",
  },
  toGrill: { dot: "bg-amber-500", pulse: false, label: "To grill" },
  research: { dot: "bg-violet-500", pulse: false, label: "Research" },
  waiting: { dot: "bg-muted-foreground/40", pulse: false, label: "Waiting" },
  blocked: { dot: "bg-destructive", pulse: false, label: "Blocked" },
  done: { dot: "bg-emerald-500/70", pulse: false, label: "Done" },
};

// A single status LED. Running/verifying pulse; waiting/blocked/done are static
// (blocked is destructive-red, deliberately distinct from grey waiting).
export function StatusLed({
  state,
  className,
}: {
  state: WorkState;
  className?: string;
}) {
  const meta = LED_META[state];
  return (
    <span
      aria-label={meta.label}
      className={cn("relative flex h-2 w-2", className)}
      role="img"
      title={meta.label}
    >
      {meta.pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
            meta.dot,
          )}
        />
      ) : null}
      <span
        className={cn("relative inline-flex h-2 w-2 rounded-full", meta.dot)}
      />
    </span>
  );
}

// The amber "needs me" chip that replaces the LED whenever the founder is on
// the critical path for a workstream.
export function NeedsMeChip({ className }: { className?: string }) {
  return (
    <Badge
      className={cn("normal-case tracking-normal", className)}
      variant="warning"
    >
      needs me
    </Badge>
  );
}

// --- Activity pill (the honest six-word status vocabulary, activity.ts) ----
// Promoted here from VariantD_Bridge.tsx (it was file-local, used only by the
// Bridge's Releases box) so the Dependencies edge strip in
// WorkstreamDetailPanel can reuse the same pill instead of a third status
// vocabulary.

const ACTIVITY_META: Record<
  Activity,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  working: { label: "working", variant: "success" },
  "needs-you": { label: "needs you", variant: "warning" },
  blocked: { label: "blocked", variant: "destructive" },
  waiting: { label: "waiting", variant: "secondary" },
  idea: { label: "idea", variant: "info" },
  done: { label: "done", variant: "success" },
};

export function ActivityBadge({ activity }: { activity: Activity }) {
  const meta = ACTIVITY_META[activity];
  return (
    <Badge className="normal-case tracking-normal" variant={meta.variant}>
      {meta.label}
    </Badge>
  );
}
