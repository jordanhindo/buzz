// Variant D — The Bridge. The company's main surface, realigned:
//   1. Needs you   ─┐  two soft ambiently-colored boxes, side by side, each a
//   2. Working now ─┘  calm playlist of the current items (no hero cards).
//   3. Recently        what just moved while you were gone (list, at the bottom).
//   • Projects widget   a peek into the org/structure lens (its own surface).
//
// One navigation law: clicking ANYTHING — a needs-you grill, a working-now
// capsule, a project workstream — opens the two-panel inbox (context left,
// live chat + composer right). No modals anywhere. Every element is a real app
// component over the same HqTransport as A/B/C.

import * as React from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { HqShellSearch } from "@/features/hq-shell-proto/contract/hqShellSearch";
import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  Gavel,
  GitBranch,
  GitMerge,
  Layers,
  Play,
  Rocket,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { portfolioActivitySummary } from "@/features/hq-shell-proto/contract/activity";
import type { Activity } from "@/features/hq-shell-proto/contract/activity";
import type {
  AttentionItem,
  HqTransport,
  RecentEvent,
  ReleaseSummary,
  WorkstreamRow,
} from "@/features/hq-shell-proto/contract/types";
import {
  ActivityBadge,
  AmbientListBox,
  dominantFrontierStatus,
  frontierStreamCount,
  InboxView,
  LifecycleStateView,
  MapView,
  NeedsMeChip,
  PlaylistRow,
  ProjectsView,
  StatusLed,
} from "@/features/hq-shell-proto/primitives";
import type { InboxFocus } from "@/features/hq-shell-proto/primitives";
import {
  useCompanyStructure,
  useHqPortfolio,
} from "@/features/hq-shell-proto/useHqPortfolio";

type VariantDProps = {
  transport: HqTransport;
};

const ATTENTION_KIND_LABEL: Record<AttentionItem["kind"], string> = {
  grill: "Grill",
  decision: "Decision",
  approval: "Approval",
  review: "Review",
};

// --- Recently ---------------------------------------------------------------

const RECENT_META: Record<
  RecentEvent["kind"],
  { Icon: typeof Rocket; tone: string }
> = {
  shipped: { Icon: Rocket, tone: "text-emerald-500" },
  merged: { Icon: GitMerge, tone: "text-primary" },
  decided: { Icon: Gavel, tone: "text-amber-500" },
  verified: { Icon: BadgeCheck, tone: "text-blue-500" },
  started: { Icon: Play, tone: "text-muted-foreground" },
  blocked: { Icon: Ban, tone: "text-destructive" },
};

function RecentRail({ events }: { events: RecentEvent[] }) {
  return (
    <ol className="space-y-0.5">
      {events.map((event) => {
        const meta = RECENT_META[event.kind];
        return (
          <li
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
            key={event.id}
          >
            <meta.Icon
              className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", meta.tone)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium">{event.title}</span>
                {event.detail ? (
                  <span className="text-muted-foreground">
                    {" — "}
                    {event.detail}
                  </span>
                ) : null}
              </p>
              {event.actorLabel ? (
                <p className="text-2xs text-muted-foreground/70">
                  {event.actorLabel}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
              {event.at}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- Playlist row leadings --------------------------------------------------

function AttentionDot() {
  return <span className="block h-1.5 w-1.5 rounded-full bg-amber-500" />;
}

// One working-now row's trailing signal: the stream count plus a single
// dominant-status LED — or the amber "needs me" chip when the founder is on
// the critical path (the count stays either way).
function WorkingTrailing({ row }: { row: WorkstreamRow }) {
  const status = dominantFrontierStatus(row.frontier);
  const count = frontierStreamCount(row.frontier);
  return (
    <span className="flex items-center gap-2">
      <span className="tabular-nums text-muted-foreground/60">
        {count} {count === 1 ? "stream" : "streams"}
      </span>
      {status === "needs-me" ? <NeedsMeChip /> : <StatusLed state={status} />}
    </span>
  );
}

// --- Releases -----------------------------------------------------------------
// One release box per open release train, version-badged. "Pure display" per
// the honest-status spec — items roll up by Activity (idea/waiting/working/
// needs-you/blocked/done), never by the raw HQ workflow lane-name.

// A single release's items, rolled up by Activity — never by the raw HQ
// state/workflow lane-name (that's exactly the "wall of research" bug).
function activityBreakdown(release: ReleaseSummary): [Activity, number][] {
  const counts = new Map<Activity, number>();
  for (const item of release.required) {
    counts.set(item.activity, (counts.get(item.activity) ?? 0) + 1);
  }
  const order: Activity[] = [
    "needs-you",
    "blocked",
    "working",
    "waiting",
    "idea",
    "done",
  ];
  return order
    .filter((activity) => counts.has(activity))
    .map((activity) => [activity, counts.get(activity) as number]);
}

function ReleaseRow({ release }: { release: ReleaseSummary }) {
  return (
    <div className="flex flex-col gap-1.5 px-2 py-2.5">
      <div className="flex items-center gap-2">
        <Badge className="normal-case tracking-normal" variant="outline">
          v{release.version}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-sm font-medium leading-snug">
          {release.headline}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
        {activityBreakdown(release).map(([activity, count]) => (
          <span className="flex items-center gap-1" key={activity}>
            <ActivityBadge activity={activity} />
            <span className="text-2xs tabular-nums text-muted-foreground/60">
              {count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- The Bridge -------------------------------------------------------------

export function VariantD_Bridge({ transport }: VariantDProps) {
  const {
    rows,
    attention,
    recent,
    frontier,
    releases,
    workingNow: liveWorkingNow,
    isLoading,
    error,
    reload,
  } = useHqPortfolio(transport);
  const { structure } = useCompanyStructure(transport);

  // Every surface state lives in the URL, so each stream / grill / the Projects
  // lens is directly addressable and shareable (deep-linked).
  // Route-agnostic: the Bridge reads its deep-link params loosely so it renders
  // under any mounting route (#/hq-proto and the primary Work destination), not
  // just one hardcoded route. `strict: false` avoids the "no active match for
  // /hq-proto" invariant when mounted elsewhere.
  const search = useSearch({ strict: false }) as HqShellSearch;
  // Bare `useNavigate` types `search` against the root route; the Bridge is
  // route-agnostic and only ever rewrites its own params on the current route,
  // so narrow it to the shared search shape.
  const navigate = useNavigate() as unknown as (opts: {
    search: HqShellSearch;
  }) => void;

  // The dev mock shim keeps `?e2e=mock` in the page query; on a cold hash-route
  // load the router can merge it onto the search value, so take the id up to any
  // stray `?`. A no-op for clean values (and in the real app).
  const attnId = search.attn?.split("?")[0];
  const wsId = search.ws?.split("?")[0];

  const focus: InboxFocus | null = React.useMemo(() => {
    if (attnId && attention) {
      const item = attention.find((a) => a.id === attnId);
      if (item) return { kind: "attention", item };
    }
    if (wsId) {
      const row = rows?.find((r) => r.id === wsId);
      return {
        kind: "workstream",
        id: wsId,
        title: row?.title ?? "Workstream",
      };
    }
    return null;
  }, [attnId, wsId, attention, rows]);

  const openAttention = (id: string) => navigate({ search: { attn: id } });
  const openWorkstream = (id: string, from?: "projects" | "map") =>
    navigate({ search: from ? { ws: id, from } : { ws: id } });
  const openProjects = () => navigate({ search: { view: "projects" } });
  const openMap = () => navigate({ search: { view: "map" } });
  const goHome = () => navigate({ search: {} });
  const goBackFromInbox = () =>
    navigate({
      search: search.from ? { view: search.from } : {},
    });

  // A failed HQ read is surfaced honestly — never left as an endless spinner.
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <LifecycleStateView
          action={
            <Button onClick={reload} size="sm" variant="outline">
              Retry
            </Button>
          }
          className="max-w-md"
          description="HQ didn't respond — its daemon may be degraded or still reconciling. Check `hq daemon status`, then retry."
          state="offline"
          title="HQ isn't responding"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LifecycleStateView
          className="max-w-md"
          description="Loading the latest projection from HQ."
          state="loading"
          title="Reading your company"
        />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <LifecycleStateView
          className="max-w-md"
          description="Once work is underway, this is where the whole company shows up at a glance."
          state="empty"
          title="No company yet"
        />
      </div>
    );
  }

  // Inbox — the one destination every click lands on.
  if (focus) {
    return (
      <InboxView
        focus={focus}
        onBack={goBackFromInbox}
        portfolio={rows}
        transport={transport}
      />
    );
  }

  // Projects — the org/structure lens.
  if (search.view?.split("?")[0] === "projects" && structure) {
    return (
      <ProjectsView
        onBack={goHome}
        onOpenWorkstream={(id) => openWorkstream(id, "projects")}
        structure={structure}
      />
    );
  }

  // Map — the portfolio-wide dependency DAG lens.
  if (search.view?.split("?")[0] === "map") {
    return (
      <MapView
        onBack={goHome}
        onOpenWorkstream={(id) => openWorkstream(id, "map")}
        portfolio={rows}
      />
    );
  }

  // Working now = the honest set: workstreams with a run executing right now
  // (activity.ts), never a frontier-bucket count — a `research` or `verifying`
  // bucket is not the same thing as a live run.
  const workingNowIds = new Set(liveWorkingNow ?? []);
  const workingAll = rows.filter((row) => workingNowIds.has(row.id));
  const WORKING_NOW_LIMIT = 4;
  const workingNow = workingAll.slice(0, WORKING_NOW_LIMIT);
  const workingOverflow = workingAll.length - workingNow.length;

  const needsYou = attention ?? [];
  const needsYouShown = needsYou.slice(0, 4);

  return (
    <div className="h-full overflow-y-auto">
      <div
        className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10"
        data-testid="bridge-canvas"
      >
        {/* Masthead */}
        <header className="mb-7 flex items-end justify-between gap-4 border-b border-border/50 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h1 className="text-xl font-semibold tracking-tight">
                Latent Sea
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {needsYou.length === 0
                ? "All clear — the company is running itself."
                : `${needsYou.length} ${needsYou.length === 1 ? "thing needs" : "things need"} you. Everything else is running.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              data-testid="open-map"
              onClick={openMap}
              size="sm"
              type="button"
              variant="outline"
            >
              <GitBranch className="h-4 w-4" />
              <span className="ml-1">Map</span>
            </Button>
            {frontier ? (
              <div
                className="flex flex-wrap items-center justify-end gap-2"
                data-testid="bridge-portfolio-summary"
              >
                {portfolioActivitySummary({
                  frontier,
                  workingCount: workingAll.length,
                  needsYouCount: needsYou.length,
                }).map(([activity, count]) => (
                  <span className="flex items-center gap-1" key={activity}>
                    <ActivityBadge activity={activity} />
                    <span className="text-2xs tabular-nums text-muted-foreground/60">
                      {count}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {/* 1 · Needs you  +  2 · Working now — two ambient boxes, side by side */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <AmbientListBox
            count={needsYou.length}
            title="Needs you"
            tone="attention"
          >
            {needsYouShown.length === 0 ? (
              <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                All clear — nothing waiting on you.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {needsYouShown.map((item) => (
                  <PlaylistRow
                    key={item.id}
                    leading={<AttentionDot />}
                    onClick={() => openAttention(item.id)}
                    sub={item.question}
                    title={item.title}
                    trailing={
                      item.freshness === "stale"
                        ? "stale"
                        : ATTENTION_KIND_LABEL[item.kind]
                    }
                  />
                ))}
              </div>
            )}
          </AmbientListBox>

          <AmbientListBox
            count={workingAll.length}
            hint={workingOverflow > 0 ? `+${workingOverflow} more` : undefined}
            title="Working now"
            tone="alive"
          >
            {workingNow.length === 0 ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Nothing is actively running right now.
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {workingNow.map((row: WorkstreamRow) => (
                  <PlaylistRow
                    key={row.id}
                    onClick={() => openWorkstream(row.id)}
                    sub={row.nextAction}
                    title={row.title}
                    trailing={<WorkingTrailing row={row} />}
                  />
                ))}
              </div>
            )}
          </AmbientListBox>
        </div>

        {/* 3 · Projects — a full-size ambient box (the company/structure lens) */}
        {structure && structure.projects.length > 0 ? (
          <div className="mb-8">
            <AmbientListBox
              count={structure.projects.length}
              hint="open projects →"
              title="Projects"
              tone="company"
            >
              <div className="divide-y divide-border/30">
                {structure.projects.map((project) => {
                  const modeled = project.workstreams.filter(
                    (ws) => ws.modeled,
                  ).length;
                  const waits = project.workstreams.filter(
                    (ws) => ws.waitingOn,
                  ).length;
                  return (
                    <PlaylistRow
                      key={project.id}
                      leading={<Layers className="h-4 w-4 text-violet-400" />}
                      onClick={openProjects}
                      sub={`${modeled} active · ${project.teams.length} teams${
                        waits > 0 ? ` · ${waits} cross-team waits` : ""
                      }`}
                      title={project.name}
                    />
                  );
                })}
              </div>
            </AmbientListBox>
          </div>
        ) : null}

        {/* Releases — version-badged, rolled up by honest Activity */}
        {releases && releases.length > 0 ? (
          <div className="mb-8">
            <AmbientListBox
              count={releases.length}
              title="Releases"
              tone="neutral"
            >
              <div className="divide-y divide-border/30">
                {releases.map((release) => (
                  <ReleaseRow key={release.id} release={release} />
                ))}
              </div>
            </AmbientListBox>
          </div>
        ) : null}

        {/* Recently — at the bottom */}
        <section className="mb-8">
          <h2 className="mb-2.5 px-1 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recently
          </h2>
          {recent && recent.length > 0 ? (
            <RecentRail events={recent} />
          ) : (
            <p className="px-2 text-sm text-muted-foreground">
              Nothing has changed recently.
            </p>
          )}
        </section>

        {/* Vitals — whisper-quiet footer. Only real HQ-derived numbers here;
            provider health and spend have no HQ read surface yet, so we show
            nothing rather than fabricate them. */}
        {frontier ? (
          <footer className="flex flex-wrap items-center gap-x-10 gap-y-3 border-t border-border/50 pt-5 text-2xs text-muted-foreground/70">
            <span>
              Frontier {frontier.running} running · {frontier.blocked} blocked
            </span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}
