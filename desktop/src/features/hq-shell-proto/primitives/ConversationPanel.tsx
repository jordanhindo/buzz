// The right half of the inbox: a real Buzz chat thread with the agent who owns
// this work. Messages are FLAT avatar + author + markdown rows (the same shape
// as the message timeline) — never iMessage bubbles. A grill lands here, not in
// a modal verdict form: you answer in your own words in the real composer box.
// Suggested stances insert into the composer; they are never auto-submitted.
//
// When the focused item is a founder needs-you call carrying a packageDigest
// (writeContext), the composer becomes the write path: send → a confirm step
// showing the EXACT bytes being approved → submit to the bound agent session →
// HQ's receipt, surfaced as an audit entry. A digest mismatch never
// auto-retries — it re-presents so the operator never forges a stale approval.

import * as React from "react";
import { SendHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Markdown } from "@/shared/ui/markdown";
import { Textarea } from "@/shared/ui/textarea";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import {
  MessageAuthorText,
  MessageHeaderRow,
} from "@/features/messages/ui/MessageHeader";
import { cn } from "@/shared/lib/cn";
import type {
  Conversation,
  ConversationMessage,
  Receipt,
} from "@/features/hq-shell-proto/contract/types";

function MessageRow({ message }: { message: ConversationMessage }) {
  // System notes are a quiet inline marker, not a chat row and not a grey box.
  if (message.authorKind === "system") {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-2xs text-muted-foreground/70">
        <span className="h-px flex-1 bg-border/50" />
        <span className="shrink-0">{message.body}</span>
        <span className="h-px flex-1 bg-border/50" />
      </div>
    );
  }

  const isFounder = message.authorKind === "founder";

  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-2 py-1.5">
      <UserAvatar
        accent={isFounder}
        avatarUrl={null}
        className="shrink-0"
        displayName={message.author}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <MessageHeaderRow>
          <MessageAuthorText>{message.author}</MessageAuthorText>
          <span className="text-xs text-muted-foreground">{message.at}</span>
        </MessageHeaderRow>
        <Markdown className="max-w-full text-sm" content={message.body} />
      </div>
    </div>
  );
}

// The confirm/submit phases for the founder write path. Read-only discussion
// (no writeContext) never leaves "composing".
type WritePhase = "composing" | "confirming" | "submitting";

type WriteContext = { attentionId: string; packageDigest?: string };

function shortDigest(digest: string): string {
  // sha256:3680a3ff… — enough to eyeball, never the full 64 hex.
  return digest.length > 16 ? `${digest.slice(0, 16)}…` : digest;
}

export function ConversationPanel({
  conversation,
  writeContext,
  onSubmitReply,
}: {
  conversation: Conversation;
  writeContext?: WriteContext;
  onSubmitReply?: (reply: string, idempotencyKey: string) => Promise<Receipt>;
}) {
  const [messages, setMessages] = React.useState<ConversationMessage[]>(
    conversation.messages,
  );
  const [draft, setDraft] = React.useState("");
  const [phase, setPhase] = React.useState<WritePhase>("composing");
  const [notice, setNotice] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const counterRef = React.useRef(0);
  // Idempotency key stays stable across resubmits of the SAME approved bytes, so
  // a retry after a lost response dedupes at HQ instead of double-applying. A
  // fresh key is minted only when the approved text changes or after an accept.
  const idemKeyRef = React.useRef<string | null>(null);
  const keyedBodyRef = React.useRef<string | null>(null);

  // The write path is live only for a needs-you item with a real digest AND a
  // relay to submit through. Otherwise the composer is plain local discussion.
  const canWrite = Boolean(writeContext?.packageDigest && onSubmitReply);

  // Reset the local transcript + write state whenever we switch subject.
  React.useEffect(() => {
    setMessages(conversation.messages);
    setDraft("");
    setPhase("composing");
    setNotice(null);
    counterRef.current = 0;
    idemKeyRef.current = null;
    keyedBodyRef.current = null;
  }, [conversation]);

  React.useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function appendMessage(message: Omit<ConversationMessage, "id">) {
    counterRef.current += 1;
    setMessages((prev) => [
      ...prev,
      { id: `local-${counterRef.current}`, ...message },
    ]);
  }

  // Plain discussion send (no write path): local echo, unchanged behavior.
  function sendLocal() {
    const body = draft.trim();
    if (!body) return;
    appendMessage({ author: "You", authorKind: "founder", body, at: "now" });
    setDraft("");
  }

  // Write path: send moves to the confirm step (draft preserved verbatim).
  function requestConfirm() {
    if (!draft.trim()) return;
    setNotice(null);
    setPhase("confirming");
  }

  async function confirmAndSubmit() {
    const body = draft.trim();
    if (!body || !onSubmitReply) return;
    // Stable key per approved draft: same bytes → same key (a retry dedupes at
    // HQ); edited bytes → a fresh key (a genuinely new intent).
    if (keyedBodyRef.current !== body || !idemKeyRef.current) {
      idemKeyRef.current = crypto.randomUUID();
      keyedBodyRef.current = body;
    }
    setPhase("submitting");
    let receipt: Receipt;
    try {
      receipt = await onSubmitReply(body, idemKeyRef.current);
    } catch (error) {
      setNotice(
        `Couldn't reach the bound agent session: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      setPhase("composing");
      return;
    }

    if (receipt.status === "accepted") {
      // Audit trail: the reply that was sent, then HQ's receipt as a quiet
      // system marker that survives navigating away and back.
      appendMessage({ author: "You", authorKind: "founder", body, at: "now" });
      appendMessage({
        author: "HQ",
        authorKind: "system",
        body: `HQ receipt: accepted${
          receipt.sourceVersion ? ` · ${receipt.sourceVersion}` : ""
        }`,
        at: "now",
      });
      idemKeyRef.current = null;
      keyedBodyRef.current = null;
      setDraft("");
      setNotice(null);
      setPhase("composing");
      return;
    }

    if (receipt.status === "stale") {
      // Digest moved under the operator. NEVER auto-retry — re-present so a
      // stale approval can't be forged. Draft is kept for edit/resend against
      // the refreshed item. (Live re-fetch of the fresh digest is the follow-on
      // to this stub; the receipt message is the authoritative refusal.)
      setNotice(
        `${receipt.message ?? "This changed since you replied."} Review and confirm again.`,
      );
      setPhase("composing");
      return;
    }

    // rejected / conflicted / pending: surface the reason, keep the draft.
    setNotice(receipt.message ?? `Reply ${receipt.status}.`);
    setPhase("composing");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 px-4 pb-3 pt-1">
        {notice ? (
          <div
            className="mb-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-2xs text-amber-200"
            data-testid="reply-notice"
          >
            {notice}
          </div>
        ) : null}

        {phase === "confirming" && writeContext ? (
          <div
            className="rounded-2xl border border-primary/40 bg-background/80 px-3 py-3 backdrop-blur-md dark:bg-background/70"
            data-testid="reply-confirm"
          >
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              Approving these exact bytes
            </div>
            <div className="mb-1 whitespace-pre-wrap rounded-lg bg-muted/40 px-2.5 py-2 text-sm">
              {draft.trim()}
            </div>
            <dl className="mb-3 space-y-0.5 text-2xs text-muted-foreground/70">
              <div className="flex gap-1.5">
                <dt className="shrink-0">Routing to</dt>
                <dd className="truncate text-foreground/80">
                  {conversation.title}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0">Attention</dt>
                <dd className="truncate font-mono">
                  {writeContext.attentionId}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="shrink-0">Digest</dt>
                <dd className="truncate font-mono">
                  {writeContext.packageDigest
                    ? shortDigest(writeContext.packageDigest)
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setPhase("composing")}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                data-testid="reply-confirm-send"
                onClick={confirmAndSubmit}
                size="sm"
                type="button"
              >
                Confirm &amp; send
              </Button>
            </div>
          </div>
        ) : (
          <>
            {conversation.suggestions && conversation.suggestions.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {conversation.suggestions.map((suggestion) => (
                  <button
                    className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    key={suggestion}
                    onClick={() => setDraft(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}

            {/* The real Buzz composer box treatment. */}
            <div
              className={cn(
                "relative rounded-2xl border border-border/50 bg-background/80 px-3 pb-2 pt-3 backdrop-blur-md",
                "dark:bg-background/70 dark:backdrop-blur-xl",
              )}
            >
              <Textarea
                className="min-h-[2.75rem] resize-none border-0 bg-transparent px-0 py-0 pr-10 text-sm shadow-none focus-visible:ring-0"
                disabled={phase === "submitting"}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    if (canWrite) requestConfirm();
                    else sendLocal();
                  }
                }}
                placeholder={
                  canWrite
                    ? "Reply to approve — you'll confirm before it sends…"
                    : "Answer in your own words…"
                }
                value={draft}
              />
              <Button
                className="absolute bottom-2 right-2 h-7 w-7 p-0"
                data-testid={canWrite ? "reply-review" : undefined}
                disabled={!draft.trim() || phase === "submitting"}
                onClick={canWrite ? requestConfirm : sendLocal}
                size="sm"
                type="button"
              >
                <SendHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
