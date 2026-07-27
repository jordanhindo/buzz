// Renders the composition of a Workstream's frontier (Seam 3). A Workstream
// is never one "Active" badge — this always shows the real mix, or an
// honest "No open frontier" when every bucket is zero.

import { cn } from "@/shared/lib/cn";
import type { FrontierComposition } from "@/features/hq-shell-proto/contract/types";

type FrontierBadgeProps = {
  frontier: FrontierComposition;
  /** "compact" for dense table/board rows, "full" for detail panels. */
  variant?: "compact" | "full";
  className?: string;
};

// HQ's nine Ready-Frontier buckets, ordered most-urgent first so the chips read
// in the same precedence as the dominant-status LED.
const BUCKETS: {
  key: keyof FrontierComposition;
  label: string;
  compactLabel: string;
  toneClass: string;
}[] = [
  {
    key: "blocked",
    label: "blocked",
    compactLabel: "blocked",
    toneClass: "bg-destructive/15 text-destructive",
  },
  {
    key: "needsJordan",
    label: "needs you",
    compactLabel: "needs you",
    toneClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "toGrill",
    label: "to grill",
    compactLabel: "to grill",
    toneClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "needsContract",
    label: "needs contract",
    compactLabel: "contract",
    toneClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  {
    key: "verifying",
    label: "verifying",
    compactLabel: "verifying",
    toneClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  {
    key: "running",
    label: "running",
    compactLabel: "running",
    toneClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "research",
    label: "research",
    compactLabel: "research",
    toneClass: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
  {
    key: "waiting",
    label: "waiting",
    compactLabel: "waiting",
    toneClass: "bg-muted text-muted-foreground",
  },
  {
    key: "ready",
    label: "ready",
    compactLabel: "ready",
    toneClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
];

export function FrontierBadge({
  frontier,
  variant = "compact",
  className,
}: FrontierBadgeProps) {
  const active = BUCKETS.filter((bucket) => frontier[bucket.key] > 0);

  if (active.length === 0) {
    return (
      <span
        className={cn(
          "text-2xs font-medium uppercase tracking-wide text-muted-foreground/70",
          className,
        )}
      >
        No open frontier
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {active.map((bucket) => (
        <span
          key={bucket.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold leading-none",
            bucket.toneClass,
          )}
        >
          {frontier[bucket.key]}
          <span className="font-normal normal-case tracking-normal">
            {variant === "full" ? bucket.label : bucket.compactLabel}
          </span>
        </span>
      ))}
    </div>
  );
}
