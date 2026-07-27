// The right pane when a subject has a live agent session but NO Buzz channel is
// bound to it yet (HQ's `conversation-binding-v1` with `bound === false`). HQ
// holds the native-session identity — harness, session id, lifecycle, a resume
// operation — long before any relay coordinates are registered. Rather than the
// dead "No conversation bound to this yet" gap, we show that identity honestly:
// "a live codex session is orchestrating this work; a Buzz conversation isn't
// wired to it yet." The moment HQ's registration write path authors real
// coordinates (`bound === true`), this pane is replaced by the real
// ConversationPanel — nothing here is a placeholder chat.

import type * as React from "react";
import { Radio, Terminal } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/cn";
import type { LiveSessionRef } from "@/features/hq-shell-proto/contract/types";

// HQ's leaseRelation → an operator-facing sentence. "Who, if anyone, currently
// holds the write lease on this session" — never the raw enum.
const LEASE_LABEL: Record<LiveSessionRef["leaseRelation"], string> = {
  "no-writer":
    "No operator holds the writer lease — the session is running on its own.",
  "current-writer": "You hold the writer lease on this session.",
  "other-writer": "Another operator holds the writer lease on this session.",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </span>
      {children}
    </div>
  );
}

export function LiveSessionPanel({ session }: { session: LiveSessionRef }) {
  const kind = session.sessionKind ?? session.harness ?? "agent";
  const isActive = session.lifecycleState.toLowerCase() === "active";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        {/* Header — it's live, and it's an orchestrating session, not a chat. */}
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "relative flex h-2.5 w-2.5 shrink-0 items-center justify-center",
              isActive ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {isActive ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
            )}
          </span>
          <h2 className="text-sm font-semibold tracking-tight">
            Live {kind} session
          </h2>
          <div className="ml-auto flex items-center gap-1.5">
            {session.sessionKind ? (
              <Badge variant="info">{session.sessionKind}</Badge>
            ) : null}
            <Badge variant={isActive ? "success" : "secondary"}>
              {session.lifecycleState || "unknown"}
            </Badge>
          </div>
        </div>

        {/* The honest framing: identity now, bound conversation not yet. */}
        <p className="text-sm leading-relaxed text-muted-foreground">
          This work is being carried by a live agent session. HQ knows its
          identity, but no Buzz conversation is wired to it yet — so there's no
          chat thread to read here. {LEASE_LABEL[session.leaseRelation]}
        </p>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
          {session.harness ? (
            <Field label="Harness">
              <span className="text-sm">{session.harness}</span>
            </Field>
          ) : null}
          {session.nativeSessionId ? (
            <Field label="Session id">
              <code className="break-all font-mono text-xs text-foreground/90">
                {session.nativeSessionId}
              </code>
            </Field>
          ) : null}
          {session.transcriptPointer ? (
            <Field label="Transcript">
              <code className="break-all font-mono text-xs text-foreground/90">
                {session.transcriptPointer}
              </code>
            </Field>
          ) : null}
        </div>

        {/* Resume — the one actionable thing an operator can do with an
            unbound session today: reattach to it in its own harness. */}
        {session.resumeOperation ? (
          <Field label="Resume this session">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
              <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <code className="break-all font-mono text-xs text-foreground/90">
                {session.resumeOperation}
              </code>
            </div>
          </Field>
        ) : null}

        {/* Why there's no chat — stated plainly, not hidden. */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground/80">
          <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            A Buzz conversation appears here once HQ registers this session's
            channel coordinates (its channel-registration write path). Until
            then this is provenance, not an address.
          </span>
        </div>
      </div>
    </div>
  );
}
