// HQ shell prototype — per-workstream detail overrides (Seam 7, extracted
// from fixtures.ts to keep each file under the 1000-line ceiling). Pure fixture
// data + its authoring types; no runtime deps beyond the contract types.
// See fixtures.ts for the rest of the prototype fixture set.

import type { LineageLink, WorkstreamDetail } from "./types";

export interface OutcomeSpec {
  label: string;
  deliverables?: string[];
  requiredEvidence?: string[];
  contextLinks?: LineageLink[];
}

export type DetailOverrides = Partial<
  Pick<
    WorkstreamDetail,
    | "brief"
    | "truthNow"
    | "truthOwner"
    | "workflow"
    | "origin"
    | "outcomeContract"
    | "lineage"
    | "plan"
    | "proofGate"
    | "runs"
    | "dependencyChain"
    | "boundConversations"
  >
> & { outcomeSpecs?: OutcomeSpec[] };

export const DETAIL_OVERRIDES: Record<string, DetailOverrides> = {
  // Grounded: the real Salience 0.2.5 first-use crash hot-fix + CI repair.
  "ws-checkout-latency": {
    brief:
      "Salience 0.2.4 crashes on first launch for everyone — the app kills its own setup step before it finishes. The fix is written and it launches clean on my machine, but our two build-checkers (the Mac and Windows CI runners) are still failing, so I can't cut a trusted 0.2.5 yet. The call for you: ship the moment CI goes green, or cut a hand-built version now and repair CI after so users get the fix sooner.",
    truthNow:
      "The crash fix is landed and verified locally; 0.2.5 can't ship until the Mac + Windows CI runners are green again.",
    truthOwner: "HQ · Salience 0.2.5 orchestration",
    workflow: "needs-jordan",
    origin:
      "Founder report: Salience 0.2.4 crashes for every user on first launch.",
    outcomeContract: {
      what: "Every fresh install of Salience 0.2.4 crashes on first launch.",
      controllingDecision: "Ship 0.2.5 as a hot-fix, not a feature cut.",
      authorizedResult:
        "A notarized 0.2.5 build that launches cleanly on a fresh machine.",
      proofThatCloses:
        "Green CI on both runners plus a verified clean first-run.",
      unknown:
        "Whether the Windows fsmonitor EBUSY is the same root cause or a second failure.",
    },
    lineage: [
      {
        relation: "origin",
        label: "Founder: crashes on first launch",
        reference: "hq://workstream/ws-checkout-latency",
        present: true,
      },
      {
        relation: "decision",
        label: "Ship 0.2.5 as a hot-fix, not a feature cut",
        reference: "hq://decision/ship-025-hotfix",
        present: true,
      },
      {
        relation: "research",
        label: "First-use crash root-cause",
        reference: "research/SALIENCE_FIRST_USE_CRASH.md",
        present: true,
      },
      {
        relation: "spec",
        label: "0.2.5 hot-fix spec",
        reference: "specs/salience-025-hotfix.md",
        present: true,
      },
      {
        relation: "run",
        label: "Codex session #88",
        reference: "hq://run/session-codex-88",
        present: true,
      },
      {
        relation: "adr",
        label: "none yet (created during grill)",
        reference: "",
        present: false,
      },
      {
        relation: "review",
        label: "no review yet — CI still red",
        reference: "",
        present: false,
      },
      {
        relation: "proof",
        label: "proof gate open — CI must be green",
        reference: "",
        present: false,
      },
    ],
    plan: {
      summary:
        "Land the crash fix, get CI green on Mac + Windows, then notarize and re-cut 0.2.5.",
      steps: [
        "Patch the self-destructing completion lambda so it survives first-run setup",
        "Seed the JUCE build cache on the Mac runner; clear the Windows fsmonitor EBUSY",
        "Re-run notarization and cut the signed 0.2.5 Mac build",
        "Publish the release note + changelog",
      ],
    },
    proofGate: {
      status: "open",
      contract:
        "Green CI on Mac + Windows and a clean first-run on a fresh machine.",
    },
    runs: [
      {
        id: "run-cx-88",
        label: "Codex session #88",
        result: "crash fix landed on trunk · verified locally",
        at: "12m ago",
      },
      {
        id: "run-cl-14a",
        label: "Claude session #14",
        result: "CI runner repair in progress · Mac JUCE cache seeding",
        at: "2h ago",
      },
    ],
    outcomeSpecs: [
      {
        label: "Approve shipping 0.2.5 once CI is green",
        deliverables: ["Founder go/no-go on the 0.2.5 cut"],
        requiredEvidence: ["Green CI run URLs for both runners"],
        contextLinks: [
          {
            relation: "decision",
            label: "Ship 0.2.5 as a hot-fix, not a feature cut",
            reference: "hq://decision/ship-025-hotfix",
            present: true,
          },
          {
            relation: "grill",
            label: "How should we finish the 0.2.5 crash hot-fix?",
            reference: "hq://grill/attn-checkout-grill",
            present: true,
          },
        ],
      },
      {
        label: "Verify a clean first-run on a fresh machine",
        deliverables: ["Clean first-launch on a wiped VM"],
        requiredEvidence: [
          "Screen recording of first-run setup",
          "No crash in logs",
        ],
        contextLinks: [
          {
            relation: "spec",
            label: "0.2.5 hot-fix spec",
            reference: "specs/salience-025-hotfix.md",
            present: true,
          },
        ],
      },
      { label: "Repair the Mac CI runner (JUCE cache)" },
      { label: "Repair the Windows CI runner (fsmonitor EBUSY)" },
      { label: "Notarize + re-cut the signed 0.2.5 Mac build" },
    ],
    boundConversations: [
      { kind: "channel", id: "chan-release-025", label: "#salience-0-2-5" },
      {
        kind: "thread",
        id: "thread-crash-triage",
        label: "Crash triage thread",
      },
    ],
  },
  // Grounded: the shared platform's vendor-onboarding automation.
  "ws-vendor-onboarding": {
    brief:
      "New marketplace vendors have to be identity-checked by hand today — it takes days. This stream is teaching HQ to do that intake automatically for the low-risk ones. It's running right now against a set of practice vendors and clearing them cleanly, no failures. Nothing needs you — it'll ask once it's ready to touch real vendors.",
    truthNow:
      "KYC intake automation is running against the sandbox vendor set with no failures so far.",
    truthOwner: "HQ · Platform orchestration",
    workflow: "ready",
    origin: "Platform: onboarding new marketplace vendors is manual and slow.",
    outcomeContract: {
      what: "Vendor KYC intake is a manual, multi-day bottleneck.",
      controllingDecision:
        "Automate the intake pipeline behind the existing sandbox gate.",
      authorizedResult:
        "An automated intake that clears low-risk vendors without a human step.",
      proofThatCloses:
        "A full sandbox vendor set cleared end-to-end with an audit trail.",
    },
    lineage: [
      {
        relation: "origin",
        label: "Platform: manual vendor intake",
        reference: "hq://workstream/ws-vendor-onboarding",
        present: true,
      },
      {
        relation: "spec",
        label: "Vendor onboarding pipeline spec",
        reference: "specs/vendor-onboarding.md",
        present: true,
      },
      {
        relation: "run",
        label: "Claude session #14",
        reference: "hq://run/session-claude-14",
        present: true,
      },
      {
        relation: "adr",
        label: "none yet (created during grill)",
        reference: "",
        present: false,
      },
      {
        relation: "proof",
        label: "proof gate open — full set not yet cleared",
        reference: "",
        present: false,
      },
    ],
    plan: {
      summary:
        "Automate the three intake stages, then prove the full sandbox set clears end-to-end.",
      steps: [
        "Automate document collection",
        "Automate sanctions screening",
        "Automate risk scoring + auto-clear low-risk vendors",
      ],
    },
    proofGate: {
      status: "open",
      contract: "Full sandbox vendor set cleared with a complete audit trail.",
    },
    runs: [
      {
        id: "run-cl-14b",
        label: "Claude session #14",
        result: "intake pipeline running · sandbox set in progress",
        at: "4m ago",
      },
    ],
    outcomeSpecs: [
      {
        label: "Automate document collection",
        deliverables: ["Intake form + document upload flow"],
        requiredEvidence: [
          "Sandbox vendor docs collected without a human step",
        ],
        contextLinks: [
          {
            relation: "spec",
            label: "Vendor onboarding pipeline spec",
            reference: "specs/vendor-onboarding.md",
            present: true,
          },
        ],
      },
      { label: "Automate sanctions screening" },
      {
        label: "Automate risk scoring",
        contextLinks: [
          {
            relation: "research",
            label: "Risk-scoring model exploration",
            reference: "research/vendor-risk-scoring.md",
            present: true,
          },
        ],
      },
    ],
    boundConversations: [
      { kind: "channel", id: "chan-platform", label: "#platform" },
    ],
  },
  "ws-nightly-index": {
    truthNow:
      "The index-rebuild daemon is intentionally stopped for a maintenance window; it resumes on its own schedule.",
    truthOwner: "HQ · Infra scheduler",
    boundConversations: [],
  },
  "ws-legacy-billing": {
    brief:
      "This stream keeps the old billing ledger and the new invoicing service agreeing with each other. To do that it works from a copy of the old ledger — and that copy is now 14 hours stale, because the nightly export that refreshes it hasn't run since. If it resumes against the stale copy it could reconcile against numbers that have already changed. So it's paused on purpose, waiting for a fresh export before it moves.",
    truthNow:
      "The working copy of the old ledger is 14 hours old — the nightly export that refreshes it hasn't run. Resuming now risks reconciling against numbers that have since changed.",
    truthOwner: "HQ · Finance",
    dependencyChain: [
      "legacy-ledger-export (the nightly job that refreshes the copy)",
      "invoicing-service-v2",
    ],
    boundConversations: [
      {
        kind: "thread",
        id: "thread-billing-recon",
        label: "Billing reconciliation",
      },
    ],
  },
  "ws-data-warehouse": {
    truthNow:
      "ops-console currently holds the write fence on this Workstream's source connector.",
    truthOwner: "HQ · Data connector authority",
    dependencyChain: ["warehouse-write-fence"],
    boundConversations: [],
  },
  "ws-security-policy": {
    brief:
      "SOC2 renewal needs our data-retention policy — the rules for how long we keep customer data — rewritten. That rewrite is done: it's the draft in #security, and the security reviewer has already checked it and signed off. The only thing left is your approval to publish it. HQ can't approve on your behalf, so it's holding here until you say yes.",
    truthNow:
      "The rewritten policy is drafted and security has signed off on it (see #security). It just needs your approval to publish — a step only you can take.",
    truthOwner: "HQ · Security & Compliance",
    workflow: "needs-jordan",
    origin: "SOC2 renewal requires a rewritten data-retention policy.",
    outcomeSpecs: [
      {
        label: "Founder approval",
        deliverables: ["Signed-off retention policy"],
        requiredEvidence: ["Founder approval receipt"],
        contextLinks: [
          {
            relation: "decision",
            label: "Approve the data-retention policy rewrite",
            reference: "hq://decision/retention-policy-approval",
            present: true,
          },
          {
            relation: "review",
            label: "Security review sign-off",
            reference: "hq://review/retention-policy-secreview",
            present: true,
          },
        ],
      },
      { label: "Draft retention policy" },
      { label: "Publish policy" },
    ],
    proofGate: {
      status: "passed",
      contract: "Security review signed off; only Founder approval remains.",
    },
    boundConversations: [
      { kind: "channel", id: "chan-security", label: "#security" },
    ],
  },
  "ws-customer-migration": {
    truthNow:
      "A migration decision was submitted from the mobile companion; HQ has not yet returned an authoritative receipt.",
    truthOwner: "HQ · Customer Success orchestration",
    boundConversations: [
      {
        kind: "thread",
        id: "thread-migration-wave3",
        label: "Wave 3 migration",
      },
    ],
  },
  "ws-onboarding-experiment": {
    truthNow:
      "HQ rejected the intake: the submitted contract has no proof spec for its Outcome.",
    truthOwner: "HQ · Growth experiments",
    boundConversations: [],
  },
  // Grounded: recovery from the real relay outage.
  "ws-relay-recovery": {
    truthNow:
      "A resume plan exists from the last failed run. HQ will not auto-resume — review the plan first.",
    truthOwner: "HQ · Incident recovery",
    workflow: "needs-jordan",
    origin: "Relay outage at 03:12 dropped live events for 28 minutes.",
    outcomeContract: {
      what: "The relay went down and clients missed 28 minutes of events.",
      controllingDecision:
        "Recover availability first, then backfill the missed events.",
      authorizedResult:
        "Relay restored and the event log backfilled with no gaps.",
      proofThatCloses: "Backfill verified complete against the audit log.",
      unknown: "Whether any events were lost before the audit checkpoint.",
    },
    lineage: [
      {
        relation: "origin",
        label: "Relay outage 03:12",
        reference: "hq://incident/relay-0312",
        present: true,
      },
      {
        relation: "handoff",
        label: "On-call → recovery handoff",
        reference: "hq://handoff/relay-recovery",
        present: true,
      },
      {
        relation: "run",
        label: "Claude session #14 (failed 03:12)",
        reference: "hq://run/session-claude-14-failed",
        present: true,
      },
      {
        relation: "adr",
        label: "none yet (created during grill)",
        reference: "",
        present: false,
      },
      {
        relation: "review",
        label: "resume plan awaiting your review",
        reference: "",
        present: false,
      },
      {
        relation: "proof",
        label: "proof gate open — backfill not verified",
        reference: "",
        present: false,
      },
    ],
    plan: {
      summary:
        "Availability is back; the drafted resume plan backfills the missed window before closing the incident.",
      steps: [
        "Confirm the relay is serving live traffic again",
        "Replay the 03:12–03:40 window from the audit log",
        "Verify no gaps remain against the audit checkpoint",
      ],
    },
    proofGate: {
      status: "open",
      contract: "Backfill verified complete with no gaps in the event log.",
    },
    runs: [
      {
        id: "run-cl-14-fail",
        label: "Claude session #14",
        result: "failed at 03:12 · relay unreachable",
        at: "03:12",
      },
      {
        id: "run-recovery-plan",
        label: "Recovery planner",
        result: "resume plan drafted · awaiting review",
        at: "03:40",
      },
    ],
    outcomeSpecs: [
      {
        label: "Review the resume plan",
        deliverables: ["Founder review of the drafted resume plan"],
        requiredEvidence: ["Approval to run the backfill"],
        contextLinks: [
          {
            relation: "handoff",
            label: "On-call → recovery handoff",
            reference: "hq://handoff/relay-recovery",
            present: true,
          },
          {
            relation: "grill",
            label: "Review the relay-outage resume plan",
            reference: "hq://grill/attn-recovery-review",
            present: true,
          },
        ],
      },
      { label: "Diagnose the relay outage root cause" },
      { label: "Backfill missed events" },
    ],
    boundConversations: [
      { kind: "channel", id: "chan-incidents", label: "#incidents" },
    ],
  },
  "ws-design-audit": {
    truthNow:
      "A drift scan is mapping where components have diverged from the design system; one strand is still queued behind review capacity.",
    truthOwner: "HQ · Design systems",
    workflow: "research",
    boundConversations: [],
  },
  // Grounded: the partner API launch, blocked pre-grill (no plan yet).
  "ws-partner-api": {
    truthNow: "Blocked until partner sandbox credentials are provisioned.",
    truthOwner: "HQ · Platform partnerships",
    workflow: "blocked",
    origin: "Partner deal: ship the v2 partner API with rate-limit tiers.",
    outcomeContract: {
      what: "The v2 partner API can't be verified without sandbox credentials.",
      controllingDecision:
        "Not yet decided — this is what the open grill resolves.",
      authorizedResult: "Bounded once the founder picks a path in the grill.",
      proofThatCloses: "Rate-limit tiers verified against the partner sandbox.",
      unknown: "When (or whether) the partner team will provision credentials.",
    },
    lineage: [
      {
        relation: "origin",
        label: "Partner deal: v2 API",
        reference: "hq://workstream/ws-partner-api",
        present: true,
      },
      {
        relation: "spec",
        label: "Partner API v2 spec",
        reference: "specs/partner-api-v2.md",
        present: true,
      },
      {
        relation: "issue",
        label: "Blocked: sandbox credentials",
        reference: "hq://issue/partner-sandbox-creds",
        present: true,
      },
      {
        relation: "decision",
        label: "no decision yet — open grill",
        reference: "",
        present: false,
      },
      {
        relation: "adr",
        label: "none yet (created during grill)",
        reference: "",
        present: false,
      },
      {
        relation: "run",
        label: "nothing has run — still blocked",
        reference: "",
        present: false,
      },
    ],
    dependencyChain: ["partner-sandbox-credentials"],
    outcomeSpecs: [
      {
        label: "Provision partner sandbox credentials",
        contextLinks: [
          {
            relation: "issue",
            label: "Blocked: sandbox credentials",
            reference: "hq://issue/partner-sandbox-creds",
            present: true,
          },
        ],
      },
      { label: "Wire the v2 rate-limit tiers" },
      {
        label: "Decide how to unblock the launch",
        contextLinks: [
          {
            relation: "grill",
            label: "How should we unblock the partner API launch?",
            reference: "hq://grill/attn-partner-grill",
            present: true,
          },
          {
            relation: "decision",
            label: "no decision yet — open grill",
            reference: "",
            present: false,
          },
        ],
      },
    ],
    boundConversations: [
      {
        kind: "thread",
        id: "thread-partner-creds",
        label: "Partner sandbox creds",
      },
    ],
  },
  "ws-field-ops-sync": {
    truthNow:
      "The relay has been unreachable for over a day; this is the last known projection.",
    truthOwner: "HQ · Mobile relay bridge",
    boundConversations: [],
  },
  "ws-legacy-slack-bridge": {
    truthNow:
      "This workspace has not enabled the legacy Slack bridge capability.",
    truthOwner: "HQ · Automations catalog",
    boundConversations: [],
  },
};
