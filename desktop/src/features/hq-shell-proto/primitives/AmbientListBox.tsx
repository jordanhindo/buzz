// A soft, ambiently-colored box with a compact playlist of rows inside.
// The Bridge's two hero zones — "Needs you" and "Working now" — are each one
// of these, side by side. No hero cards: just a calm tinted container and a
// scannable list. The tone tints the container and the accent rail; it never
// shouts.

import type * as React from "react";

import { cn } from "@/shared/lib/cn";

export type AmbientTone = "attention" | "alive" | "company" | "neutral";

const TONE_BOX: Record<AmbientTone, string> = {
  // Warm amber wash — this is the "needs me" zone.
  attention:
    "border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent",
  // Cool emerald wash — this is the "alive / running" zone.
  alive:
    "border-emerald-500/25 bg-gradient-to-b from-emerald-500/[0.07] to-transparent",
  // Violet wash — the company / structure lens.
  company:
    "border-violet-500/25 bg-gradient-to-b from-violet-500/[0.08] to-transparent",
  neutral: "border-border/60 bg-muted/20",
};

const TONE_DOT: Record<AmbientTone, string> = {
  attention: "bg-amber-500",
  alive: "bg-emerald-500",
  company: "bg-violet-500",
  neutral: "bg-muted-foreground/50",
};

export function AmbientListBox({
  tone,
  title,
  count,
  hint,
  children,
}: {
  tone: AmbientTone;
  title: string;
  count?: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-2xl border p-3.5",
        TONE_BOX[tone],
      )}
    >
      <header className="mb-2.5 flex items-center gap-2 px-1">
        <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} />
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
          {title}
        </h2>
        {typeof count === "number" ? (
          <span className="text-2xs tabular-nums text-muted-foreground/60">
            {count}
          </span>
        ) : null}
        {hint ? (
          <span className="ml-auto text-2xs text-muted-foreground/60">
            {hint}
          </span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

// One row in the playlist. Clickable, quiet, with an optional leading glyph,
// a title, a sub-line, and trailing meta. Hover reveals it's actionable.
export function PlaylistRow({
  leading,
  title,
  sub,
  trailing,
  onClick,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-background/70"
      onClick={onClick}
      type="button"
    >
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug">
          {title}
        </span>
        {sub ? (
          <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-2xs text-muted-foreground/70">
          {trailing}
        </span>
      ) : null}
    </button>
  );
}
