---
name: buzz-verification
description: Blocking verification gate for Buzz and the Buzz HQ fork. Use whenever work touches desktop or mobile UI, app identity and migration, Nostr messaging, agents and activity telemetry, channels, repositories and Fetch, the HQ Work bridge, updater or release behavior, upstream block/buzz synchronization, authority/privacy boundaries, accessibility, visual fixtures, or a claim that a Buzz/Buzz HQ slice is ready, installed, merged, or safe to ship.
---

# Buzz Verification

Prove the user-visible system, not a convenient proxy. A green unit test, a built bundle, or a source symbol is evidence for one layer only; none proves that the installed app, relay, HQ controller, Git provider, or reviewed release loop works.

## Start With the Claim

State the exact claim under review in one sentence. Then enumerate every surface a user would touch if the claim were true.

Use this source-of-truth split:

- Treat the relay as authority for messages, threads, membership, and shared identity.
- Treat HQ as authority for company work, outcomes, decisions, runs, and receipts.
- Treat Git and the hosted provider as authority for commits, refs, pull requests, and releases.
- Treat the running installed client as authority for visible app behavior.
- Treat the human as authority for product intent, consent, credentials, public claims, spending, and launch decisions.

Do not let one authority impersonate another. An app fixture does not prove relay delivery. A source branch does not prove the installed bundle. A Buzz message does not transition HQ work unless the bridge produced the canonical HQ receipt.

## Select Verification Modes

Read [references/verification-matrix.md](references/verification-matrix.md) and select every applicable mode:

- Source and exact-state gate
- Operating Pack compatibility gate
- Desktop/UI and installed-app gate
- Nostr transport and collaboration gate
- Agent/activity gate
- HQ Work and company-loop gate
- Repository and hosted-Fetch gate
- Upstream/release gate
- Authority, privacy, and migration gate
- Accessibility and visual gate
- Mobile gate

Mark a mode `not applicable` with a reason. Never omit a relevant mode silently.

## Run the Gate

### 1. Pin the exact state

Read the nearest `AGENTS.md`, the accepted handoff or product contract, the real diff, and the repository status. Record:

- repository and worktree path
- branch and full `HEAD`
- dirty files
- comparison base and upstream ref
- installed bundle path and running executable path when an app is involved

Run verification against the same `HEAD` you report. Immediately before attributing a test or artifact to a commit, confirm `git rev-parse HEAD` again and record whether the tree was clean.

### 2. Enumerate touchpoints and failure states

List the user-visible flow from entry to durable result. Include loading, empty, degraded, offline, conflict, permission-denied, and recovery states. Include surrounding chrome for UI work and all identity/data stores for migration work.

Name the three failures the user would notice first. Design focused proof around those failures before widening the gate.

### 3. Verify source contracts

Trace the real call path across frontend, native bridge, relay/HQ/provider, and persistence. Confirm that invoked commands exist, are registered, and return the shape the caller expects.

For updater and upstream work, query the live release API and test the parser against the actual returned tag schema. A fixture such as `vX.Y.Z` is not enough when the provider returns a prefix such as `desktop-vX.Y.Z`.

For authority-sensitive work, prove both the allowed path and a forbidden path. Never expose, print, copy into logs, or send private keys while testing identity migration.

### 4. Run proportional automated proof

Start with format/static checks, affected compilation, and focused tests while iterating. At the merge boundary, run the complete package suites for every touched package. Run the project-wide final matrix once when the release or handoff contract requires it.

Keep raw verification output. Do not use lossy output compression for commands that feed the verdict. A scoped test may diagnose a failure, but it cannot replace the required full package suite.

### 5. Prove the real runtime

Launch the intended rebuilt or installed app, not a stale worktree process. Inspect rendered pixels and exercise the actual interaction. For remote or provider flows, use a real test repository or channel when the claim is about real integration.

For HQ checks, treat `hq daemon status` as the canonical lifecycle report and cross-check the listener and real Work view. Managed sandboxes can hide launchd state or localhost listeners; repeat authoritative host probes outside the sandbox before declaring an outage.

Prove graceful degradation separately: ordinary Buzz collaboration must remain usable when HQ is down, and the Work surface must say that HQ is unavailable rather than inventing company state.

### 6. Prove reviewed release behavior

Keep official Buzz and Buzz HQ update authority separate. Buzz HQ may detect an official release, but it must not install the official binary into the fork.

Distinguish these claims:

- **Detection:** the fork notices a real newer official release.
- **Notification:** the user sees an actionable notice with the correct version and release notes.
- **Task creation:** a durable HQ/Buzz work item exists for the sync.
- **Integration:** an `upstream-sync/<version>` branch contains the reviewed merge or rebase.
- **Publication:** a green Buzz HQ build is published through the Buzz HQ channel.

Do not call detection “automatic merging.” Never auto-merge upstream into the daily app. Require recoverable Git integration, conflict review, the applicable verification modes, and a separate review verdict before publication.

### 7. Adjudicate

Use one verdict:

- `PASS` — the full claim is proven in the real system.
- `PASS WITH DRIFT` — the scoped claim is proven; named deferred gaps belong to already-authorized future work.
- `FAIL` — the implementation or evidence contradicts the claim.
- `BLOCKED` — a required dependency, authority, environment, or artifact prevents a verdict.

Do not downgrade a defect to drift. Do not upgrade missing live proof to `PASS` because static checks are green.

## Required Report

Use this structure:

```markdown
## Verification Verdict
PASS | PASS WITH DRIFT | FAIL | BLOCKED

## Exact State
- Repository/worktree:
- Branch and HEAD:
- Comparison base:
- Tree state:
- Installed/running app:

## Claim and Scope
- User-facing claim:
- Touchpoints:
- Modes used:
- Explicitly not applicable:

## Evidence
| Layer | Evidence | Result |
|---|---|---|
| Source/static | ... | ... |
| Automated suites | ... | ... |
| Rendered/runtime | ... | ... |
| Relay/HQ/provider | ... | ... |
| Upstream/release | ... | ... |

## Authority and Privacy
- Allowed path:
- Forbidden path:
- Identity/data handling:

## Required Fixes Before Done
1. ...

## Accepted Drift
1. ...

## Residual Risk
- ...
```

Write `None` when a section has no items. Cite paths, commit IDs, commands, screenshots, event IDs, PRs, release URLs, and receipts close to the claims they support.

## Final Rule

Make the verdict useful to the person deciding whether to rely on the system. If they would discover the failure within their first real interaction, the verification gate must discover it first.
