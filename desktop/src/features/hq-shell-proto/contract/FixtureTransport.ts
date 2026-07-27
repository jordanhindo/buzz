// HQ shell prototype — FixtureTransport (Seam 6).
// Fixture-only implementation of HqTransport. NEVER hits network. Canned
// projections + receipts, keyed by subject/intent so submitIntent behaves
// like a real HQ round trip: delivery is not acceptance, receipts are
// deterministic per subject, and duplicate intentIds are idempotent.
// See RESEARCH/BUZZ_HQ_CONSTITUTIONAL_FREEZE_2026_07_26.md (Seam 6).

import {
  ATTENTION_ITEMS,
  COMPANY_STRUCTURE,
  CONVERSATIONS,
  PACK_SURFACES,
  RECENT_EVENTS,
  RELEASES,
  WORKSTREAM_DETAILS,
  WORKSTREAMS,
} from "./fixtures";
import type {
  AttentionItem,
  CompanyStructure,
  Conversation,
  FounderReplyInput,
  FrontierComposition,
  HqTransport,
  PackSurface,
  Receipt,
  RecentEvent,
  ReleaseSummary,
  TypedIntent,
  WorkstreamDetail,
  WorkstreamRow,
} from "./types";

export type FixtureScenario = "rich" | "empty-company";

export interface FixtureTransportOptions {
  /** "empty-company" demonstrates the no-Workstreams-yet lifecycle state. */
  scenario?: FixtureScenario;
  /** Artificial latency in ms, applied to every call. Set to 0 in tests. */
  latencyMs?: number;
}

// Canned receipt behavior per subjectId — mirrors the row that fixture was
// built to demonstrate (see fixtures.ts). Anything not listed here defaults
// to "accepted".
const REJECTED_SUBJECTS: Record<string, string> = {
  "ws-security-policy":
    "Your role lacks Approve authority for this policy change.",
  "attn-security-approval":
    "Your role lacks Approve authority for this policy change.",
  "ws-onboarding-experiment":
    "Contract validation failed — missing proof spec for Outcome.",
};

const CONFLICTED_SUBJECTS: Record<string, string> = {
  "ws-data-warehouse": "ops-console holds an active fence on this Workstream.",
};

const STALE_SUBJECTS: Record<string, string> = {
  "ws-legacy-billing":
    "Source snapshot has moved on — refresh before resuming.",
  "attn-warehouse-stale":
    "Upstream changed since you opened this — refresh before deciding.",
};

// Mobile-style pending: delivered, never auto-resolves in the fixture.
const PENDING_SUBJECTS = new Set(["ws-customer-migration"]);

// Founder-reply attentionIds that always return a digest-mismatch (stale)
// receipt — the case that drives the confirm → re-present path in dev/e2e.
const FOUNDER_REPLY_MISMATCH = new Set(["attn-digest-mismatch"]);

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sum(rows: WorkstreamRow[], key: keyof FrontierComposition): number {
  return rows.reduce((total, row) => total + row.frontier[key], 0);
}

export class FixtureTransport implements HqTransport {
  private readonly scenario: FixtureScenario;
  private readonly latencyMs: number;
  private readonly receiptCache = new Map<string, Receipt>();

  constructor(options: FixtureTransportOptions = {}) {
    this.scenario = options.scenario ?? "rich";
    this.latencyMs = options.latencyMs ?? 180;
  }

  private get portfolio(): WorkstreamRow[] {
    return this.scenario === "empty-company" ? [] : WORKSTREAMS;
  }

  async getWorkstreamPortfolio(): Promise<WorkstreamRow[]> {
    await delay(this.latencyMs);
    return [...this.portfolio];
  }

  async getWorkstream(id: string): Promise<WorkstreamDetail | null> {
    await delay(this.latencyMs);
    if (this.scenario === "empty-company") return null;
    return WORKSTREAM_DETAILS[id] ?? null;
  }

  async getWorkingNow(): Promise<string[]> {
    await delay(this.latencyMs);
    if (this.scenario === "empty-company") return [];
    // Fixtures carry no literal `hq run list` record at the portfolio level;
    // the bound session actor's live presence is the closest honest proxy for
    // "a run is executing right now" — same rule as the live adapter, never a
    // frontier-bucket count (see activity.ts).
    return this.portfolio
      .filter((row) =>
        row.actors.some(
          (actor) => actor.kind === "session" && actor.presence === "running",
        ),
      )
      .map((row) => row.id);
  }

  async getReadyFrontier(): Promise<FrontierComposition> {
    await delay(this.latencyMs);
    const rows = this.portfolio;
    return {
      ready: sum(rows, "ready"),
      running: sum(rows, "running"),
      verifying: sum(rows, "verifying"),
      needsContract: sum(rows, "needsContract"),
      toGrill: sum(rows, "toGrill"),
      needsJordan: sum(rows, "needsJordan"),
      waiting: sum(rows, "waiting"),
      research: sum(rows, "research"),
      blocked: sum(rows, "blocked"),
    };
  }

  async getFounderAttention(): Promise<AttentionItem[]> {
    await delay(this.latencyMs);
    return this.scenario === "empty-company" ? [] : [...ATTENTION_ITEMS];
  }

  async getPackSurfaces(): Promise<PackSurface[]> {
    await delay(this.latencyMs);
    return [...PACK_SURFACES];
  }

  async getReleases(): Promise<ReleaseSummary[]> {
    await delay(this.latencyMs);
    return this.scenario === "empty-company" ? [] : [...RELEASES];
  }

  async getRecentActivity(): Promise<RecentEvent[]> {
    await delay(this.latencyMs);
    return this.scenario === "empty-company" ? [] : [...RECENT_EVENTS];
  }

  async getConversation(subjectId: string): Promise<Conversation | null> {
    await delay(this.latencyMs);
    if (this.scenario === "empty-company") return null;
    return CONVERSATIONS[subjectId] ?? null;
  }

  async getCompanyStructure(): Promise<CompanyStructure> {
    await delay(this.latencyMs);
    if (this.scenario === "empty-company") {
      return { company: COMPANY_STRUCTURE.company, teams: [], projects: [] };
    }
    return COMPANY_STRUCTURE;
  }

  async submitIntent(intent: TypedIntent): Promise<Receipt> {
    await delay(this.latencyMs);

    // Idempotency: the same intentId must always resolve to the same
    // receipt — this is how "duplicate promotion" (Flow 2) is prevented.
    const cached = this.receiptCache.get(intent.intentId);
    if (cached) return cached;

    const observedAt = new Date().toISOString();
    let receipt: Receipt;

    if (PENDING_SUBJECTS.has(intent.subjectId)) {
      receipt = {
        status: "pending",
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        message: "Delivered — awaiting HQ's authoritative receipt.",
        observedAt,
      };
    } else if (intent.subjectId in REJECTED_SUBJECTS) {
      receipt = {
        status: "rejected",
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        message: REJECTED_SUBJECTS[intent.subjectId],
        observedAt,
      };
    } else if (intent.subjectId in CONFLICTED_SUBJECTS) {
      receipt = {
        status: "conflicted",
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        message: CONFLICTED_SUBJECTS[intent.subjectId],
        observedAt,
      };
    } else if (intent.subjectId in STALE_SUBJECTS) {
      receipt = {
        status: "stale",
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        message: STALE_SUBJECTS[intent.subjectId],
        observedAt,
      };
    } else {
      const row = WORKSTREAMS.find(
        (candidate) => candidate.id === intent.subjectId,
      );
      const nextVersion = row
        ? `v${Number.parseInt(row.sourceVersion.replace(/^v/, ""), 10) + 1}`
        : undefined;
      receipt = {
        status: "accepted",
        intentId: intent.intentId,
        subjectId: intent.subjectId,
        sourceVersion: nextVersion,
        message: "Accepted.",
        observedAt,
      };
    }

    this.receiptCache.set(intent.intentId, receipt);
    return receipt;
  }

  async submitFounderReply(input: FounderReplyInput): Promise<Receipt> {
    await delay(this.latencyMs);
    // Idempotent by key, like submitIntent — a double-submit can't double-apply.
    const cached = this.receiptCache.get(input.idempotencyKey);
    if (cached) return cached;

    const observedAt = new Date().toISOString();
    const receipt: Receipt = FOUNDER_REPLY_MISMATCH.has(input.attentionId)
      ? {
          status: "stale",
          intentId: input.idempotencyKey,
          subjectId: input.attentionId,
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
