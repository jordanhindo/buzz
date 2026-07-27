// Honest lifecycle presentation (Seam 1 + Seam 3). The shell only ever
// RENDERS these states — it never invents its own "everything is fine"
// success. LifecycleBadge is the inline tag; LifecycleStateView is the
// full-panel treatment for empty/loading/unauthorized/offline/etc.

import {
  Ban,
  CircleSlash,
  Clock,
  Cloud,
  CloudOff,
  Inbox,
  Loader2,
  ShieldAlert,
  ShieldOff,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/cn";
import type { LifecycleState } from "@/features/hq-shell-proto/contract/types";

type LifecycleMeta = {
  label: string;
  variant:
    | "default"
    | "secondary"
    | "outline"
    | "destructive"
    | "warning"
    | "success"
    | "info";
  Icon: typeof Loader2;
  description: string;
};

const META: Record<LifecycleState, LifecycleMeta> = {
  loading: {
    label: "Loading",
    variant: "secondary",
    Icon: Loader2,
    description: "Reading the latest projection from HQ.",
  },
  empty: {
    label: "Empty",
    variant: "secondary",
    Icon: Inbox,
    description: "Nothing here yet.",
  },
  ready: {
    label: "Ready",
    variant: "success",
    Icon: Clock,
    description: "Current and ready.",
  },
  stale: {
    label: "Stale",
    variant: "warning",
    Icon: TriangleAlert,
    description: "The source projection is older than expected.",
  },
  unauthorized: {
    label: "Unauthorized",
    variant: "destructive",
    Icon: ShieldOff,
    description: "Your current role does not have authority here.",
  },
  offline: {
    label: "Offline",
    variant: "outline",
    Icon: CloudOff,
    description: "The relay is unreachable — showing the last known state.",
  },
  unsupported: {
    label: "Unsupported",
    variant: "outline",
    Icon: CircleSlash,
    description: "This capability isn't available in this workspace yet.",
  },
  pending: {
    label: "Pending",
    variant: "info",
    Icon: Clock,
    description: "Delivered — awaiting HQ's authoritative receipt.",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    Icon: Ban,
    description: "HQ refused this.",
  },
  conflicted: {
    label: "Conflicted",
    variant: "warning",
    Icon: ShieldAlert,
    description: "A competing writer holds the fence.",
  },
  "planned-maintenance": {
    label: "Planned maintenance",
    variant: "outline",
    Icon: Wrench,
    description:
      "Intentionally stopped for a maintenance window — not an outage.",
  },
};

export function lifecycleMeta(state: LifecycleState): LifecycleMeta {
  return META[state];
}

type LifecycleBadgeProps = {
  state: LifecycleState;
  className?: string;
};

export function LifecycleBadge({ state, className }: LifecycleBadgeProps) {
  const meta = META[state];
  return (
    <Badge className={cn("gap-1", className)} variant={meta.variant}>
      <meta.Icon
        className={cn("h-3 w-3", state === "loading" && "animate-spin")}
      />
      {meta.label}
    </Badge>
  );
}

type LifecycleStateViewProps = {
  state: LifecycleState;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function LifecycleStateView({
  state,
  title,
  description,
  action,
  className,
}: LifecycleStateViewProps) {
  const meta = META[state];
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-3">
        <meta.Icon
          className={cn(
            "h-6 w-6 text-muted-foreground",
            state === "loading" && "animate-spin",
          )}
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title ?? meta.label}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {description ?? meta.description}
        </p>
      </div>
      {action}
      {state === "offline" ? (
        <Cloud className="sr-only" aria-hidden="true" />
      ) : null}
    </div>
  );
}
