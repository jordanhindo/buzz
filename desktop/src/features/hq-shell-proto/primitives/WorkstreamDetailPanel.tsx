// The inbox's left half: one workstream's honest picture, carrying what HQ
// actually models. Rendered on the panel surface itself — clean section labels
// + separators, NOT stacked grey cards. The linked things (decision, ADR, spec,
// run, proof …) are shown UP FRONT, present as links or honestly absent — never
// buried. Deeper detail (the five outcome questions, plan, runs) is expandable.

import type * as React from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Component,
  Eye,
  FileCheck2,
  FileText,
  FlaskConical,
  Flag,
  Gavel,
  MessagesSquare,
  Palette,
  Scale,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { SubsectionLabel } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/lib/cn";
import { LifecycleBadge } from "@/features/hq-shell-proto/primitives/LifecycleState";
import {
  dominantFrontierStatus,
  NeedsMeChip,
  StatusLed,
} from "@/features/hq-shell-proto/primitives/StatusLed";
import {
  type ResolvedDependencyEdge,
  splitWorkstreamDependencyEdges,
} from "@/features/hq-shell-proto/contract/dependencyEdges";
import type {
  LineageLink,
  OutcomeSummary,
  WorkflowRoute,
  WorkstreamDetail,
  WorkstreamRow,
} from "@/features/hq-shell-proto/contract/types";

// --- workflow route badge ---------------------------------------------------

const WORKFLOW_META: Record<
  WorkflowRoute,
  { label: string; variant: React.ComponentProps<typeof Badge>["variant"] }
> = {
  ready: { label: "Ready", variant: "success" },
  "to-grill": { label: "To grill", variant: "warning" },
  research: { label: "Research", variant: "info" },
  waiting: { label: "Waiting", variant: "secondary" },
  "needs-jordan": { label: "Needs you", variant: "warning" },
  blocked: { label: "Blocked", variant: "destructive" },
};

// --- lineage (shown up front, always visible) -------------------------------

const LINEAGE_META: Record<
  LineageLink["relation"],
  { label: string; Icon: typeof Flag }
> = {
  origin: { label: "Origin", Icon: Flag },
  decision: { label: "Decision", Icon: Gavel },
  grill: { label: "Grill", Icon: MessagesSquare },
  adr: { label: "ADR", Icon: FileText },
  spec: { label: "Spec", Icon: FileCheck2 },
  research: { label: "Research", Icon: FlaskConical },
  issue: { label: "Issue", Icon: CircleDot },
  handoff: { label: "Handoff", Icon: ArrowLeftRight },
  run: { label: "Run", Icon: Terminal },
  review: { label: "Review", Icon: Eye },
  proof: { label: "Proof", Icon: ShieldCheck },
  prototype: { label: "Prototype", Icon: Component },
  "visual-contract": { label: "Visual contract", Icon: Palette },
  adjudication: { label: "Adjudication", Icon: Scale },
  completion: { label: "Completion", Icon: CheckCircle2 },
};

// Where a linked artifact actually lives — HQ stores a pin, not the content, so
// we tell the truth about where it is instead of faking a link that opens
// nothing. (When a real in-app opener is wired, these become clickable.)
function whereItLives(reference: string): string {
  if (reference.startsWith("hq://run/")) return "HQ · run receipt";
  if (reference.startsWith("hq://")) {
    return `HQ · ${reference.slice(5).split("/")[0] || "pin"}`;
  }
  if (
    /\.(md|txt|json|ya?ml)$/i.test(reference) ||
    reference.startsWith("research/") ||
    reference.startsWith("specs/")
  ) {
    return `repo · ${reference}`;
  }
  return reference;
}

function LineageRow({
  link,
  onOpen,
  active,
}: {
  link: LineageLink;
  onOpen?: (link: LineageLink) => void;
  active?: boolean;
}) {
  const meta = LINEAGE_META[link.relation];

  if (!link.present) {
    return (
      <div className="flex items-baseline gap-2.5 py-1">
        <meta.Icon className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/30" />
        <span className="w-14 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
          {meta.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground/45">
          {link.label}
        </span>
      </div>
    );
  }

  // Present links are openable — clicking slides out the inspector.
  return (
    <button
      className={cn(
        "group/link flex w-full items-baseline gap-2.5 rounded-md py-1 pl-1 pr-1 text-left transition-colors hover:bg-muted/40",
        active && "bg-primary/10 hover:bg-primary/10",
      )}
      onClick={() => onOpen?.(link)}
      type="button"
    >
      <meta.Icon className="h-3.5 w-3.5 shrink-0 self-center text-foreground/60" />
      <span className="w-14 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
        {meta.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/90 group-hover/link:text-foreground">
        {link.label}
      </span>
      <span
        className="max-w-[38%] shrink-0 truncate text-2xs text-muted-foreground/45"
        title={link.reference}
      >
        {whereItLives(link.reference)}
      </span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground/25 transition-transform group-hover/link:translate-x-0.5 group-hover/link:text-muted-foreground/50" />
    </button>
  );
}

// The linked-artifact inspector — a real Buzz slide-over (Sheet). It shows what
// the artifact is, where it lives, and its pin metadata now; it's the seam where
// the real content renders once HQ exposes it. Turns a linked row into something
// you actually open, instead of dead text.
function InspectorField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
        {label}
      </p>
      <p
        className={cn(
          "break-all text-xs text-foreground/85",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// The linked-artifact detail — rendered in the inbox's RIGHT pane, in place of
// the chat (with a Back button). Shows the artifact itself; the content area is
// where the document / run / decision body renders once it's fetched.
export function ArtifactDetailPane({
  link,
  onBack,
}: {
  link: LineageLink;
  onBack: () => void;
}) {
  const meta = LINEAGE_META[link.relation];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1">Back to chat</span>
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-2">
            <meta.Icon className="h-4 w-4 text-primary" />
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </span>
          </div>
          <h2 className="text-lg font-semibold leading-snug tracking-tight">
            {link.label}
          </h2>
          <p className="text-sm text-muted-foreground">
            {whereItLives(link.reference)}
          </p>

          <Separator className="bg-border/40" />

          <InspectorField
            label="Reference"
            mono
            value={link.reference || "—"}
          />
          {link.version ? (
            <InspectorField label="Version" mono value={link.version} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- outcomes (visible list; each opens its own detail pane) ----------------

const OUTCOME_STATE_META: Record<
  OutcomeSummary["state"],
  {
    label: string;
    variant: React.ComponentProps<typeof Badge>["variant"];
    // Optional tone override for states the base variants don't distinguish
    // (research reads as violet, not the blue `info` verifying uses).
    className?: string;
  }
> = {
  running: { label: "running", variant: "success" },
  verifying: { label: "verifying", variant: "info" },
  "needs-you": { label: "needs you", variant: "warning" },
  waiting: { label: "waiting", variant: "secondary" },
  blocked: { label: "blocked", variant: "destructive" },
  done: { label: "done", variant: "success" },
  ready: { label: "ready", variant: "success" },
  needsContract: { label: "needs contract", variant: "warning" },
  toGrill: { label: "to grill", variant: "warning" },
  research: {
    label: "research",
    variant: "info",
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
};

function OutcomeStateBadge({ state }: { state: OutcomeSummary["state"] }) {
  const meta = OUTCOME_STATE_META[state];
  return (
    <Badge
      className={cn("normal-case tracking-normal", meta.className)}
      variant={meta.variant}
    >
      {meta.label}
    </Badge>
  );
}

// One outcome row — a real click target. Selecting it opens the outcome's own
// detail in the inbox's right pane (the same model as a linked artifact), not
// an inline expand.
function OutcomeItem({
  outcome,
  onOpen,
  active,
}: {
  outcome: OutcomeSummary;
  onOpen?: (outcome: OutcomeSummary) => void;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "group/outcome flex w-full items-center gap-2 rounded-md py-1 pl-1 pr-1 text-left transition-colors hover:bg-muted/40",
        active && "bg-primary/10 hover:bg-primary/10",
      )}
      onClick={() => onOpen?.(outcome)}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate text-xs text-foreground/90 group-hover/outcome:text-foreground">
        {outcome.title}
      </span>
      <OutcomeStateBadge state={outcome.state} />
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/25 transition-transform group-hover/outcome:translate-x-0.5 group-hover/outcome:text-muted-foreground/50" />
    </button>
  );
}

// The outcome's own detail — rendered in the inbox's RIGHT pane, in place of the
// chat (with a Back button). Same slot as ArtifactDetailPane: state, its plan
// (deliverables + proof gate), and the decision/grill that controls it.
export function OutcomeDetailPane({
  outcome,
  onBack,
  onOpenLink,
}: {
  outcome: OutcomeSummary;
  onBack: () => void;
  onOpenLink?: (link: LineageLink) => void;
}) {
  const plan = outcome.executionContract;
  const links = outcome.contextLinks ?? [];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1">Back to chat</span>
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="space-y-2">
            <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Outcome
            </span>
            <h2 className="text-lg font-semibold leading-snug tracking-tight">
              {outcome.title}
            </h2>
            <OutcomeStateBadge state={outcome.state} />
          </div>

          {outcome.proofContract ? (
            <p className="text-sm text-muted-foreground">
              {outcome.proofContract}
            </p>
          ) : null}

          {plan && plan.deliverables.length > 0 ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Deliverables
              </p>
              <ul className="mt-1.5 space-y-1">
                {plan.deliverables.map((item) => (
                  <li className="text-sm text-foreground/85" key={item}>
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {plan && plan.requiredEvidence.length > 0 ? (
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Proof gate
              </p>
              <ul className="mt-1.5 space-y-1">
                {plan.requiredEvidence.map((item) => (
                  <li className="text-sm text-muted-foreground" key={item}>
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {links.length > 0 ? (
            <div>
              <Separator className="mb-4 bg-border/40" />
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Controlling links
              </p>
              <div className="mt-1.5">
                {links.map((link) => (
                  <LineageRow
                    key={`${link.relation}-${link.reference || link.label}`}
                    link={link}
                    onOpen={onOpenLink}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// --- collapsible deep section (no box — just a labelled disclosure) ---------

function DeepSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group/section" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/section:rotate-90" />
        <span>{title}</span>
        {typeof count === "number" ? (
          <span className="tabular-nums text-muted-foreground/45">{count}</span>
        ) : null}
      </summary>
      <div className="space-y-2 pb-1 pl-5 pt-1">{children}</div>
    </details>
  );
}

// --- dependency edge strip ("waiting on ↑ / blocks ↓") ----------------------
// Upgrades the old flat `dependencyChain` string list into a typed strip
// driven by DependencyEdge (contract/dependencyEdges.ts). Reuses the same
// status pills the rest of the app uses for a given resolved target: an
// OutcomeStateBadge when the edge resolves to a sibling outcome, or a
// StatusLed/NeedsMeChip (the frontier-driven pill) when it resolves to
// another workstream. An unresolved target (no portfolio row, no matching
// outcome) still renders — as a plain, honestly unstyled id — rather than
// being dropped.

function DependencyPill({ edge }: { edge: ResolvedDependencyEdge }) {
  if (edge.resolvedAs === "outcome" && edge.outcomeState) {
    return <OutcomeStateBadge state={edge.outcomeState} />;
  }
  if (edge.resolvedAs === "workstream" && edge.frontier) {
    const status = dominantFrontierStatus(edge.frontier);
    return status === "needs-me" ? (
      <NeedsMeChip />
    ) : (
      <StatusLed state={status} />
    );
  }
  return null;
}

function DependencyGroup({
  label,
  Icon,
  edges,
}: {
  label: string;
  Icon: typeof ArrowUp;
  edges: ResolvedDependencyEdge[];
}) {
  if (edges.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/55">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <ul className="space-y-1">
        {edges.map((edge) => (
          <li
            className="flex items-center gap-2 text-xs"
            key={`${edge.resolvedAs}-${edge.target}`}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                edge.resolvedAs === "unresolved"
                  ? "italic text-foreground/45"
                  : "text-foreground/80",
              )}
              title={
                edge.resolvedAs === "unresolved" ? edge.target : edge.label
              }
            >
              {edge.label}
            </span>
            <DependencyPill edge={edge} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FiveQuestion({ q, a }: { q: string; a: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/55">
        {q}
      </p>
      <p className="text-xs leading-snug text-foreground/85">{a}</p>
    </div>
  );
}

// --- panel ------------------------------------------------------------------

export function WorkstreamDetailPanel({
  detail,
  onOpenLink,
  activeRelation,
  onOpenOutcome,
  activeOutcomeId,
  portfolio,
}: {
  detail: WorkstreamDetail;
  // Opening a linked artifact or an outcome swaps the inbox's right pane (the
  // chat) for that detail — handled by the parent, so the selection state lives
  // up in InboxView.
  onOpenLink?: (link: LineageLink) => void;
  activeRelation?: LineageLink["relation"];
  onOpenOutcome?: (outcome: OutcomeSummary) => void;
  activeOutcomeId?: string;
  // The full portfolio row set, for resolving the edge strip's downstream
  // ("blocks") side and cross-workstream upstream targets. Optional — see
  // splitWorkstreamDependencyEdges' degrade behavior when omitted.
  portfolio?: WorkstreamRow[];
}) {
  const contract = detail.outcomeContract;
  const lineage = detail.lineage ?? [];
  const runs = detail.runs ?? [];
  const deps = detail.dependencyChain ?? [];
  const { upstream, downstream } = splitWorkstreamDependencyEdges(
    detail,
    portfolio ?? [],
  );
  const hasTypedEdges = upstream.length > 0 || downstream.length > 0;
  const workflow = WORKFLOW_META[detail.workflow];

  return (
    <div className="space-y-4">
      {/* The stream's own brief — human first, the lead of the panel */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={workflow.variant}>{workflow.label}</Badge>
          <LifecycleBadge state={detail.lifecycle} />
        </div>
        <p className="text-sm leading-relaxed text-foreground/90">
          {detail.brief}
        </p>
        {detail.truthNow && detail.truthNow !== detail.nextAction ? (
          <FiveQuestion a={detail.truthNow} q="Where it stands" />
        ) : null}
        {detail.nextAction ? (
          <FiveQuestion a={detail.nextAction} q="Next" />
        ) : null}
        {detail.risk ? (
          <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            {detail.risk}
          </p>
        ) : null}
        <p className="text-2xs text-muted-foreground/55">
          Owned by {detail.truthOwner}
        </p>
      </div>

      {/* Linked — minimizable; collapsed by default to keep the panel calm */}
      {lineage.length > 0 ? (
        <details className="group/linked">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3 w-3 shrink-0 transition-transform group-open/linked:rotate-90" />
            <span>Linked</span>
            <span className="tabular-nums text-muted-foreground/45">
              {lineage.filter((link) => link.present).length}/{lineage.length}
            </span>
          </summary>
          <div className="mt-1.5">
            {lineage.map((link) => (
              <LineageRow
                active={activeRelation === link.relation}
                key={link.relation}
                link={link}
                onOpen={onOpenLink}
              />
            ))}
          </div>
        </details>
      ) : null}

      {/* Outcomes — visible list, each expands to its plan */}
      {detail.outcomes.length > 0 ? (
        <div>
          <SubsectionLabel>Outcomes · {detail.outcomes.length}</SubsectionLabel>
          <div className="mt-1">
            {detail.outcomes.map((outcome) => (
              <OutcomeItem
                active={activeOutcomeId === outcome.id}
                key={outcome.id}
                onOpen={onOpenOutcome}
                outcome={outcome}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Deeper detail — expandable, collapsed by default */}
      {contract || deps.length > 0 || runs.length > 0 || hasTypedEdges ? (
        <>
          <Separator className="bg-border/40" />
          <div className="space-y-0.5">
            {contract ? (
              <DeepSection title="Why it exists">
                <FiveQuestion q="What happened" a={contract.what} />
                <FiveQuestion
                  q="Controlling decision"
                  a={contract.controllingDecision}
                />
                <FiveQuestion
                  q="Authorized result"
                  a={contract.authorizedResult}
                />
                <FiveQuestion
                  q="Proof that closes it"
                  a={contract.proofThatCloses}
                />
                {contract.unknown ? (
                  <FiveQuestion q="Still unknown" a={contract.unknown} />
                ) : null}
              </DeepSection>
            ) : null}

            {hasTypedEdges ? (
              <DeepSection
                count={upstream.length + downstream.length}
                title="Dependencies"
              >
                <div className="space-y-2.5">
                  <DependencyGroup
                    edges={upstream}
                    Icon={ArrowUp}
                    label="Waiting on"
                  />
                  <DependencyGroup
                    edges={downstream}
                    Icon={ArrowDown}
                    label="Blocks"
                  />
                </div>
              </DeepSection>
            ) : deps.length > 0 ? (
              // Back-compat: no typed edges for this workstream (e.g. a
              // fixture-driven detail) — fall back to the flat opaque list.
              <DeepSection count={deps.length} title="Dependencies">
                <ul className="space-y-1">
                  {deps.map((dep) => (
                    <li className="flex items-baseline gap-2 text-xs" key={dep}>
                      <span className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/55">
                        blocked by
                      </span>
                      <span className="text-foreground/80">{dep}</span>
                    </li>
                  ))}
                </ul>
              </DeepSection>
            ) : null}

            {runs.length > 0 ? (
              <DeepSection count={runs.length} title="Runs">
                <ul className="space-y-1.5">
                  {runs.map((run) => (
                    <li className="space-y-0.5" key={run.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-medium">
                          {run.label}
                        </span>
                        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/55">
                          {run.at}
                        </span>
                      </div>
                      <p className="text-2xs text-muted-foreground">
                        {run.result}
                      </p>
                    </li>
                  ))}
                </ul>
              </DeepSection>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
