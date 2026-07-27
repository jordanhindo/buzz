// Founder-reply relay implementations (D5 write path). The interface
// (`FounderReplyRelay`) lives in types.ts; concrete relays live here, mirroring
// the binding seam (workstreamBinding.ts).
//
// The shell can never shell `hq founder intent` itself — it isn't a native
// session. So "submit" means: hand the approved bytes to the bound agent
// session and surface HQ's receipt. Until that live relay exists the honest
// default refuses (nothing to relay to); the fixture relay returns canned
// receipts so the confirm → submit UI is buildable against real receipt shapes.

import type { FounderReplyInput, FounderReplyRelay, Receipt } from "./types";

// Honest default: no live agent session is bound, so there is nowhere to relay
// to. The confirm UI gates its submit affordance on a live binding, so this is
// defensive — but if called it refuses rather than fabricating an accept.
export const UnboundFounderReplyRelay: FounderReplyRelay = {
  async submit(input: FounderReplyInput): Promise<Receipt> {
    return {
      status: "rejected",
      intentId: input.idempotencyKey,
      subjectId: input.attentionId,
      message:
        "No live agent session is bound to this workstream yet — nothing to relay the reply to.",
      observedAt: new Date().toISOString(),
    };
  },
};

interface FixtureFounderReplyRelayOptions {
  // attentionIds that always return a digest-mismatch (stale) receipt — the
  // case that exercises the re-present path without a live HQ.
  mismatchAttentionIds?: string[];
}

export class FixtureFounderReplyRelay implements FounderReplyRelay {
  private readonly mismatch: ReadonlySet<string>;
  // Idempotency: the same idempotencyKey always resolves to the same receipt,
  // so a double-submit can't double-apply — same guarantee as FixtureTransport.
  private readonly receiptCache = new Map<string, Receipt>();

  constructor(options: FixtureFounderReplyRelayOptions = {}) {
    this.mismatch = new Set(options.mismatchAttentionIds ?? []);
  }

  async submit(input: FounderReplyInput): Promise<Receipt> {
    const cached = this.receiptCache.get(input.idempotencyKey);
    if (cached) return cached;

    const observedAt = new Date().toISOString();
    const receipt: Receipt = this.mismatch.has(input.attentionId)
      ? {
          status: "stale",
          intentId: input.idempotencyKey,
          subjectId: input.attentionId,
          // The verbatim HQ refusal message (confirmed by the HQ agent).
          message:
            "Founder intent package digest is stale; refresh Attention before replying.",
          observedAt,
        }
      : {
          status: "accepted",
          intentId: input.idempotencyKey,
          subjectId: input.attentionId,
          message: "Accepted by HQ.",
          observedAt,
        };

    this.receiptCache.set(input.idempotencyKey, receipt);
    return receipt;
  }
}
