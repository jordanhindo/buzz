# Buzz Verification Matrix

Use this reference to choose and execute the proof required by the claim. Commands are starting points; adapt paths and package selectors to the checked-out revision and its `AGENTS.md`.

## Contents

1. Global preflight
2. Source and exact-state gate
2A. Operating Pack compatibility gate
3. Desktop and installed-app gate
4. Nostr transport and collaboration gate
5. Agent and activity gate
6. HQ Work and company-loop gate
7. Repository and hosted-Fetch gate
8. Upstream and release gate
9. Authority, privacy, and migration gate
10. Accessibility and visual gate
11. Mobile gate
12. Final integration gate
13. Known traps

## 1. Global Preflight

Record the claim before running commands. Read the closest `AGENTS.md`, the accepted issue/handoff, and any named design pack or screenshot contract.

Capture exact state with raw output:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
```

If a test result will be attributed to a commit, run `git rev-parse HEAD` again in the same shell after the test. Report dirty state explicitly; a clean commit and a dirty working tree are different artifacts.

Never mutate or clean unrelated user changes. Use a durable worktree for implementation and delete it after the work is integrated.

## 2. Source and Exact-State Gate

Use for every code change.

Required proof:

- Read the real diff without compression.
- Identify the base ref used for comparison.
- Trace frontend calls to registered Tauri/relay/HQ/provider commands.
- Check type and serialization shapes on both sides of each boundary.
- Search for duplicate or stale implementations before adding a new seam.
- Run format, static analysis, affected compilation, and full touched-package tests.
- Run the repository-wide final matrix only at the required merge/release boundary.

Fail when:

- the reported commit differs from the tested commit;
- the tree contains unreported changes that affect the result;
- a command is present in TypeScript but not registered natively;
- a fixture is the only proof for a claimed live integration;
- a scoped test is substituted for the required full package suite.

## 2A. Operating Pack Compatibility Gate

Use when work claims that a Latent Sea Operating Pack or another extension can contribute Work, Workspace, Attention, command, search, Automation, or capability surfaces.

Required proof:

- identify the versioned semantic contract and its compatibility rule;
- show that Pack-owned behavior lives behind the declared extension seam rather than in shell conditionals;
- load representative Pack fixtures through the same adapter production uses;
- prove Work, Workspace, Attention, commands, search, Automation, and capability declarations preserve their shared meanings across desktop and mobile adapters;
- exercise supported-version, unsupported-version, missing-capability, malformed-Pack, absent-Pack, upgrade, and removal states;
- confirm ordinary Buzz messaging and navigation remain usable when the Pack or HQ is absent or incompatible;
- prove Pack installation or upgrade cannot mutate identity, relay membership, messages, credentials, or company truth outside its authority;
- verify that adding a new conforming Pack requires a new extension plus adapter, not edits throughout the shell core.

Fail when company-specific behavior leaks into the generic Buzz shell, when desktop and mobile interpret the same semantic field differently, or when a fixture bypasses the production adapter.

## 3. Desktop and Installed-App Gate

Use for UI, app identity, updater, keyring, data migration, sidecar, deep-link, or launch behavior.

Expected Buzz HQ identity unless a newer accepted product contract supersedes it:

- visible product: `Buzz HQ`
- bundle identifier: `xyz.block.buzz.hq`
- deep-link scheme: `buzz-hq`
- keyring service: `buzz-desktop-hq`
- installed bundle: `/Applications/Buzz HQ.app`

Keep official Buzz separate:

- bundle identifier: `xyz.block.buzz.app`
- installed bundle: `/Applications/Buzz.app`
- official updater authority remains official Buzz only.

Inspect the bundle and process with platform-native tools such as:

```bash
plutil -p "/Applications/Buzz HQ.app/Contents/Info.plist"
codesign --verify --deep --strict --verbose=2 "/Applications/Buzz HQ.app"
codesign -dv --verbose=4 "/Applications/Buzz HQ.app"
ps -axo pid,command
```

Required live proof:

- launch from the intended installed path;
- confirm the running executable resolves inside that bundle;
- verify visible name, version, and surrounding app chrome;
- confirm official Buzz remains present and unaffected when that is the contract;
- close and reopen the installed app;
- prove identity, agents, settings, and required local state survive without onboarding or re-import;
- exercise every enabled control in scope;
- capture screenshots for all relevant states and inspect them manually.

Fail when a worktree build is presented as installed-app proof, when Launch Services opens a stale bundle, or when source metadata is used instead of the running app.

## 4. Nostr Transport and Collaboration Gate

Use for messages, threads, mentions, channels, membership, canvases, reactions, DMs, workflows, or reconnect behavior.

Required live proof:

- send through the same transport the user will use;
- record the returned event ID and accepted state;
- read the event back from the intended channel/thread when delivery itself is in scope;
- confirm `h` channel scoping and `e` reply/root tags;
- verify mention pubkeys when a notification is claimed;
- test reconnect/offline recovery when transport lifecycle changed;
- confirm a relay failure does not silently become an HQ failure, or vice versa.

Use a real relay for integration claims. A mocked bridge is appropriate for deterministic UI states, not for live delivery claims.

Fail when a local UI echo is the only proof of relay delivery or when a message appears in the wrong thread.

## 5. Agent and Activity Gate

Use for managed agents, ACP sessions, transcripts, activity summaries, tool-call telemetry, or agent identity.

Required live proof:

- trigger a bounded turn from the intended agent identity;
- confirm the human-facing reply appears in the correct thread;
- open the agent Activity/profile surface;
- confirm thinking/activity and tool-call entries correspond to the same turn;
- distinguish the Work view from Activity: Work shows company state; Activity shows the agent session;
- verify secrets and auth material are absent from visible activity and logs;
- confirm a restart/reconnect does not attach activity to the wrong agent or channel.

Fail when the reply exists but the claimed telemetry is absent, or when mock transcript fixtures stand in for the real session.

## 6. HQ Work and Company-Loop Gate

Use for the Work/Map surface, HQ bridge commands, founder attention, outcomes, runs, receipts, or orchestration.

Lifecycle proof:

```bash
hq daemon status
lsof -nP -iTCP:4178 -sTCP:LISTEN
```

Treat the daemon status as canonical and the listener as a cross-check. If a managed sandbox reports no launchd service or listener, repeat the probe with host authority before diagnosing an outage.

Required live proof for Work reads:

- the real Buzz HQ Work surface loads the intended company projection;
- displayed status agrees with the canonical HQ status;
- degraded, stopped, and unavailable states are honest;
- ordinary Buzz messaging remains usable while HQ is unavailable;
- recovery reloads current HQ state without inventing or duplicating work.

Required proof for the complete company loop:

1. A human decision is accepted in the bound Buzz thread.
2. The corresponding HQ Outcome becomes Ready.
3. The controller starts a bounded Outcome Lead in isolated work.
4. The lead implements and produces focused proof.
5. A different reviewer checks the complete outcome.
6. The controller adjudicates and reruns material proof.
7. Git records merge or rejection.
8. A canonical receipt returns to the same Buzz thread.
9. Newly unblocked work can continue without the human restating the mission.

Do not claim this gate from Work reads alone. A healthy dashboard is not a proved execution loop.

## 7. Repository and Hosted-Fetch Gate

Use for Projects, hosted repositories, Git credentials, Fetch, branches, PRs, or ref synchronization.

Required live proof:

- use a real hosted repository owned by or shared with the testing identity;
- record the clone URL without credentials;
- verify the selected Git executable meets the credential-helper protocol requirement;
- trigger Fetch from the real Projects UI;
- observe the visible result or error;
- compare local and remote refs with `git rev-parse` or `git ls-remote`;
- prove credential failures are actionable and do not leak secrets;
- preserve recoverability through branches, commits, and pull requests.

Fail when only the shell succeeds but the claimed UI path was not exercised, or when a success toast appears without the remote ref changing as expected.

## 8. Upstream and Release Gate

Use for official Buzz releases, Buzz HQ notifications, upstream sync, update channels, or publication.

Query the provider contract directly:

```bash
gh api repos/block/buzz/releases/latest \
  --jq '{tag_name, name, published_at, html_url}'
```

Required detection proof:

- test against the actual current `tag_name`, not only a hand-written fixture;
- support the provider's current prefixing convention, including tags such as `desktop-vX.Y.Z` when present;
- compare normalized semantic versions;
- handle prereleases, drafts, missing names, malformed tags, API errors, and rate limits deliberately;
- run an immediate check on app start and the configured background cadence when those behaviors are claimed;
- show an actionable notification for a simulated or real newer release;
- prove the official updater cannot install into Buzz HQ.

Required sync proof:

1. Create or locate a durable notification/task for the release.
2. Fetch the current official ref.
3. Create `upstream-sync/<version>` from the intended Buzz HQ integration branch.
4. Merge or rebase in Git; preserve both histories and record conflicts.
5. Run the full applicable Buzz and Buzz HQ verification modes.
6. Obtain independent review.
7. Merge the reviewed branch.
8. Build and publish through the Buzz HQ updater endpoint/channel.
9. Install/relaunch the published artifact and repeat installed-app smoke proof.

Detection, task creation, integration, and publication are four separate states. Report each separately. Never auto-merge a newly detected release into the daily app.

## 9. Authority, Privacy, and Migration Gate

Use for app-state copy, identities, keyrings, membership, agent definitions, credentials, filesystem moves, or destructive cleanup.

Required proof:

- identify every source and destination store;
- copy rather than move unless deletion is explicitly authorized;
- verify writes by reading through the destination API, not by logging secret values;
- use one-time markers only after the destination is complete;
- make retries idempotent;
- preserve official Buzz state while Buzz HQ migration is under evaluation;
- prove owner-only/human-floor actions still require the human;
- test one forbidden path, such as an agent attempting an unauthorized membership, merge, key export, or public action;
- document recovery and rollback.

Never print, echo, screenshot, transmit, or commit a private key. A successful migration claim requires identity continuity in the reopened app, not secret inspection.

## 10. Accessibility and Visual Gate

Use whenever visible UI or interaction changes.

Required proof:

- read the accepted design pack, prototype, screenshot contract, or current approved surface;
- build with the E2E bridge for fixture-driven desktop screenshots;
- capture each materially distinct state with animation settled;
- verify screenshots are not byte-identical when they claim distinct states;
- inspect the real rendered result, including surrounding chrome;
- check keyboard access, focus order, focus visibility, labels, tooltip-only actions, contrast, zoom/text scaling, reduced motion, empty/degraded/error copy, and hit targets;
- exercise the live path separately when the UI fronts a real relay, HQ, or provider operation.

Fail when screenshots exist without a visual judgment, when a tiny control is hidden in a full-window capture, or when the mock bridge is the only proof for a live integration.

## 11. Mobile Gate

Use whenever Flutter code, shared event semantics, pairing, notifications, or cross-client behavior changes.

Required automated proof:

```bash
cd mobile
dart format --output=none --set-exit-if-changed .
flutter analyze
flutter test
```

Also verify:

- shared event kinds and transport semantics match desktop/relay definitions;
- the relevant widget flow renders under both themes and practical text scale;
- navigation/back behavior, keyboard/safe-area handling, and offline/error states work;
- a real relay round trip is performed when interoperability is claimed;
- release or pairing behavior is tested on an allowed simulator/device workflow.

Do not run prohibited destructive Flutter lifecycle commands when the repository instructions forbid them.

## 12. Final Integration Gate

Before a merge/release verdict:

- reread the real diff;
- confirm no debug code, test bypass, stale fixture, temporary endpoint, or private material remains;
- run all touched-package suites raw;
- run the required final matrix once;
- confirm the tested `HEAD` and tree state;
- repeat the smallest real installed-app and transport smoke flow;
- record screenshots, event IDs, commit IDs, PR/release links, and HQ receipts;
- assign every residual risk to an owner or explicitly accept it.

The final report must say what was not tested. Silence is not coverage.

## 13. Known Traps

- **Provider-tag mismatch:** GitHub release tags may be `desktop-vX.Y.Z`, while a parser tested only with `vX.Y.Z` rejects the real release.
- **Detection is not merging:** a sidebar notice or release-notes link does not create an HQ task, integration branch, review, build, or publication.
- **Sandbox false outage:** restricted sessions may not see launchd or localhost listeners. Recheck on the host before reporting HQ stopped.
- **Worktree/install confusion:** a running worktree artifact does not prove `/Applications/Buzz HQ.app` will reopen with durable state.
- **Official/HQ identity collision:** sharing bundle IDs, schemes, updater endpoints, writable app data, or keyring services can let one app overwrite or corrupt the other.
- **Mock/live substitution:** fixtures prove pixels and deterministic client logic; they do not prove relay, HQ, Git, or provider integration.
- **Dashboard/loop substitution:** Work can load while the decision-to-receipt execution loop remains stalled.
- **Toast/ref substitution:** a success toast does not prove a repository ref actually changed.
- **Source/test substitution:** green code checks do not prove the first-run, restart, migration, or real update experience.
