// The one navigation law made real: click ANY item — a needs-you grill, a
// working-now workstream, a project row — and you land here. No modals.
//   left  = the full, honest workstream detail (expandable, everything reachable)
//   right = the live conversation with the agent, in the real composer
// Built over the same HqTransport as the Bridge, in real Buzz chrome.

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { ConversationPanel } from "@/features/hq-shell-proto/primitives/ConversationPanel";
import { LiveSessionPanel } from "@/features/hq-shell-proto/primitives/LiveSessionPanel";
import {
  type DominantStatus,
  dominantFrontierStatus,
} from "@/features/hq-shell-proto/primitives/StatusLed";
import {
  ArtifactDetailPane,
  OutcomeDetailPane,
  WorkstreamDetailPanel,
} from "@/features/hq-shell-proto/primitives/WorkstreamDetailPanel";
import {
  useConversation,
  useWorkstreamDetail,
} from "@/features/hq-shell-proto/useHqPortfolio";
import type {
  AttentionItem,
  HqTransport,
  LineageLink,
  OutcomeSummary,
  WorkstreamRow,
} from "@/features/hq-shell-proto/contract/types";

// The inbox's right pane can show, in place of the chat, either a linked
// artifact or an outcome's own detail. A single selection union keeps the
// Back-to-chat model identical for both.
type RightPaneSelection =
  | { kind: "link"; link: LineageLink }
  | { kind: "outcome"; outcome: OutcomeSummary };

// Soft ambient wash for the inbox's left pane, keyed to the stream's dominant
// state — same color language as the Working-now LEDs, so the panel feels alive
// and part of the app, not a flat grey sidebar.
const STATUS_TINT: Record<DominantStatus, string> = {
  "needs-me": "from-amber-500/[0.16]",
  blocked: "from-rose-500/[0.15]",
  toGrill: "from-amber-500/[0.14]",
  needsContract: "from-amber-500/[0.12]",
  running: "from-emerald-500/[0.15]",
  verifying: "from-blue-500/[0.15]",
  research: "from-violet-500/[0.13]",
  waiting: "from-slate-400/[0.10]",
  ready: "from-emerald-500/[0.12]",
  done: "from-emerald-500/[0.10]",
};

// What the inbox is focused on. Any click in the shell resolves to one of
// these — a founder-attention item or a workstream.
export type InboxFocus =
  | { kind: "attention"; item: AttentionItem }
  | { kind: "workstream"; id: string; title: string };

const ATTENTION_KIND_LABEL: Record<AttentionItem["kind"], string> = {
  grill: "Grill",
  decision: "Decision",
  approval: "Approval",
  review: "Review",
};

// The left context panel — resolves the workstream behind either focus kind.
function ContextPanel({
  focus,
  transport,
  onOpenLink,
  activeRelation,
  onOpenOutcome,
  activeOutcomeId,
  portfolio,
  onOpenWorkstream,
}: {
  focus: InboxFocus;
  transport: HqTransport;
  onOpenLink?: (link: LineageLink) => void;
  activeRelation?: LineageLink["relation"];
  onOpenOutcome?: (outcome: OutcomeSummary) => void;
  activeOutcomeId?: string;
  onOpenWorkstream?: (id: string) => void;
  // The full portfolio row set — needed to resolve the Dependencies edge
  // strip's downstream ("blocks") side, which HQ never returns directly (see
  // contract/dependencyEdges.ts). Optional: omitting it still renders
  // upstream edges, just without downstream.
  portfolio?: WorkstreamRow[];
}) {
  const workstreamId =
    focus.kind === "workstream" ? focus.id : (focus.item.workstreamId ?? null);
  const { detail } = useWorkstreamDetail(transport, workstreamId);

  const tint = detail
    ? STATUS_TINT[dominantFrontierStatus(detail.frontier)]
    : "from-muted-foreground/[0.05]";

  return (
    <div className="relative isolate h-full min-h-0">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b to-transparent",
          tint,
        )}
      />
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
        {focus.kind === "attention" ? (
          <div className="space-y-1.5 border-l-2 border-primary/40 pl-3">
            <p className="text-sm font-medium leading-snug text-foreground/90">
              {focus.item.question}
            </p>
            {focus.item.evidence ? (
              <p className="text-xs text-muted-foreground">
                {focus.item.evidence}
              </p>
            ) : null}
          </div>
        ) : null}

        {detail ? (
          <WorkstreamDetailPanel
            activeOutcomeId={activeOutcomeId}
            activeRelation={activeRelation}
            detail={detail}
            onOpenLink={onOpenLink}
            onOpenOutcome={onOpenOutcome}
            onOpenWorkstream={onOpenWorkstream}
            portfolio={portfolio}
          />
        ) : null}
      </div>
    </div>
  );
}

export function InboxView({
  focus,
  transport,
  onBack,
  portfolio,
  onOpenWorkstream,
}: {
  focus: InboxFocus;
  transport: HqTransport;
  onBack: () => void;
  // Threaded down to the Dependencies edge strip — see ContextPanel's doc.
  portfolio?: WorkstreamRow[];
  // Navigate to a workstream a dependency edge resolves to.
  onOpenWorkstream?: (id: string) => void;
}) {
  const subjectId = focus.kind === "attention" ? focus.item.id : focus.id;
  const title = focus.kind === "attention" ? focus.item.title : focus.title;
  const subtitle =
    focus.kind === "attention"
      ? `${ATTENTION_KIND_LABEL[focus.item.kind]} · needs your call`
      : "Workstream";
  const { conversation, liveSession } = useConversation(transport, subjectId);

  // The founder write path applies only to an attention item that carries a
  // packageDigest (HQ's content version). A workstream focus, or an item HQ
  // marked non-submittable (null digest → absent), stays plain discussion.
  const writeContext =
    focus.kind === "attention" && focus.item.packageDigest
      ? {
          attentionId: focus.item.id,
          packageDigest: focus.item.packageDigest,
        }
      : undefined;

  // Clicking a linked artifact OR an outcome swaps the right pane (the chat) for
  // that detail. One selection union covers both, with a shared Back-to-chat.
  const [selection, setSelection] = React.useState<RightPaneSelection | null>(
    null,
  );
  const openLink = (link: LineageLink) => setSelection({ kind: "link", link });
  const openOutcome = (outcome: OutcomeSummary) =>
    setSelection({ kind: "outcome", outcome });
  const backToChat = () => setSelection(null);
  // Reset when the focused stream/grill changes so a stale detail never sticks
  // — the React "adjust state during render" pattern (no effect needed).
  const [prevSubject, setPrevSubject] = React.useState(subjectId);
  if (subjectId !== prevSubject) {
    setPrevSubject(subjectId);
    setSelection(null);
  }

  const activeRelation =
    selection?.kind === "link" ? selection.link.relation : undefined;
  const activeOutcomeId =
    selection?.kind === "outcome" ? selection.outcome.id : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Slick page-header: back + title block. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/60 px-4 py-3">
        <Button onClick={onBack} size="sm" type="button" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1">Back</span>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {title}
          </h1>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 border-b border-border/60 md:w-[23rem] md:shrink-0 md:border-b-0 md:border-r lg:w-[27rem]">
          <ContextPanel
            activeOutcomeId={activeOutcomeId}
            activeRelation={activeRelation}
            focus={focus}
            onOpenLink={openLink}
            onOpenOutcome={openOutcome}
            onOpenWorkstream={onOpenWorkstream}
            portfolio={portfolio}
            transport={transport}
          />
        </div>
        <div className="min-h-0 flex-1">
          {selection?.kind === "link" ? (
            <ArtifactDetailPane link={selection.link} onBack={backToChat} />
          ) : selection?.kind === "outcome" ? (
            <OutcomeDetailPane
              onBack={backToChat}
              onOpenLink={openLink}
              outcome={selection.outcome}
            />
          ) : conversation ? (
            <ConversationPanel
              conversation={conversation}
              onSubmitReply={
                writeContext
                  ? (reply, idempotencyKey) =>
                      transport.submitFounderReply({
                        attentionId: writeContext.attentionId,
                        packageDigest: writeContext.packageDigest,
                        reply,
                        idempotencyKey,
                      })
                  : undefined
              }
              writeContext={writeContext}
            />
          ) : liveSession ? (
            <LiveSessionPanel session={liveSession} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              No conversation bound to this yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
