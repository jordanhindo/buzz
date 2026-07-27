// The Projects surface — the structure/org lens (Home is the attention/time
// lens). Company → projects → teams → workstreams, each carrying the SAME
// dominant-status LED as Home. Ambient and slick: real Cards with a soft
// per-team tint, not flat grey boxes. Teams come from charters (not the HQ
// projection) and cross-team waits that HQ doesn't model yet are marked
// honestly rather than invented as state. Clicking a modeled workstream drops
// into the same inbox as everywhere else.

import {
  ArrowLeft,
  ChevronRight,
  Code2,
  Megaphone,
  Palette,
  Users,
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/lib/cn";
import {
  NeedsMeChip,
  StatusLed,
  type WorkState,
} from "@/features/hq-shell-proto/primitives/StatusLed";
import type {
  CompanyStructure,
  ProjectSummary,
  ProjectWorkstreamRef,
  TeamKind,
} from "@/features/hq-shell-proto/contract/types";

const TEAM_ICON: Record<TeamKind, typeof Code2> = {
  dev: Code2,
  marketing: Megaphone,
  community: Users,
  design: Palette,
  ops: Users,
};

const TEAM_TONE: Record<TeamKind, string> = {
  dev: "text-blue-500",
  marketing: "text-pink-500",
  community: "text-amber-500",
  design: "text-violet-500",
  ops: "text-emerald-500",
};

// Soft ambient wash per project, keyed by its lead team — the slick tint that
// separates this org lens from Home without shouting.
const TEAM_TINT: Record<TeamKind, string> = {
  dev: "from-blue-500/[0.06]",
  marketing: "from-pink-500/[0.06]",
  community: "from-amber-500/[0.06]",
  design: "from-violet-500/[0.06]",
  ops: "from-emerald-500/[0.06]",
};

// Map a project workstream's coarse state onto the shared LED vocabulary.
const PROJECT_LED_STATE: Record<
  Exclude<ProjectWorkstreamRef["state"], "needs-you" | "not-modeled">,
  WorkState
> = {
  running: "running",
  verifying: "verifying",
  waiting: "waiting",
  blocked: "blocked",
  done: "done",
};

function ProjectStatus({ ws }: { ws: ProjectWorkstreamRef }) {
  if (!ws.modeled || ws.state === "not-modeled") {
    return <Badge variant="outline">not modeled in HQ yet</Badge>;
  }
  if (ws.state === "needs-you") {
    return <NeedsMeChip />;
  }
  return <StatusLed state={PROJECT_LED_STATE[ws.state]} />;
}

function WorkstreamRow({
  ws,
  teamName,
  onOpen,
}: {
  ws: ProjectWorkstreamRef;
  teamName?: string;
  onOpen?: () => void;
}) {
  const clickable = ws.modeled && !!onOpen;
  return (
    <button
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors",
        clickable
          ? "hover:border-border/60 hover:bg-muted/40"
          : "cursor-default",
      )}
      disabled={!clickable}
      onClick={clickable ? onOpen : undefined}
      type="button"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              ws.modeled ? "font-medium" : "text-muted-foreground",
            )}
          >
            {ws.title}
          </span>
          {teamName ? (
            <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/60">
              {teamName}
            </span>
          ) : null}
        </div>
        {ws.waitingOn ? (
          <p className="mt-0.5 flex items-center gap-1 text-2xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground/60">
              blocked by
            </span>
            {ws.waitingOn}
          </p>
        ) : null}
      </div>
      <ProjectStatus ws={ws} />
      {clickable ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
      ) : (
        <span className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

function ProjectCard({
  project,
  onOpenWorkstream,
}: {
  project: ProjectSummary;
  onOpenWorkstream: (id: string, title: string) => void;
}) {
  const teamName = (id?: string) =>
    project.teams.find((team) => team.id === id)?.name;
  const notModeled = project.workstreams.filter((ws) => !ws.modeled).length;
  const leadTeam = project.teams[0]?.kind ?? "dev";

  return (
    <Card className="relative isolate overflow-hidden">
      {/* Soft ambient wash — the org lens's slick tint. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b to-transparent",
          TEAM_TINT[leadTeam],
        )}
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold">{project.name}</p>
            <p className="text-2xs text-muted-foreground">{project.company}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {project.teams.map((team) => {
              const Icon = TEAM_ICON[team.kind];
              return (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-2xs text-muted-foreground"
                  key={team.id}
                >
                  <Icon className={cn("h-3 w-3", TEAM_TONE[team.kind])} />
                  {team.name}
                </span>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{project.headline}</p>

        <div className="space-y-0.5">
          {project.workstreams.map((ws) => (
            <WorkstreamRow
              key={ws.id}
              onOpen={() => onOpenWorkstream(ws.id, ws.title)}
              teamName={teamName(ws.teamId)}
              ws={ws}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground/70">
          <span>Teams shown from charters — not in the HQ projection.</span>
          {notModeled > 0 ? (
            <span>
              {notModeled} cross-team {notModeled === 1 ? "item" : "items"} not
              yet modeled as work in HQ.
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function ProjectsView({
  structure,
  onBack,
  onOpenWorkstream,
}: {
  structure: CompanyStructure;
  onBack: () => void;
  onOpenWorkstream: (id: string, title: string) => void;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-6 md:px-8">
        <header className="mb-6 flex items-center gap-3">
          <Button onClick={onBack} size="sm" type="button" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            <span className="ml-1">Bridge</span>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {structure.company} · Projects
            </h1>
            <p className="text-xs text-muted-foreground">
              The org lens — projects, the teams inside them, and what each is
              waiting on.
            </p>
          </div>
        </header>

        {structure.projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Once work is underway, the company&apos;s structure
            shows up here.
          </p>
        ) : (
          <div className="space-y-4">
            {structure.projects.map((project) => (
              <ProjectCard
                key={project.id}
                onOpenWorkstream={onOpenWorkstream}
                project={project}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
