---
name: resume-agent-session
description: Safely attach an existing native Codex, Claude, Goose, or other ACP agent session to one Buzz channel. Use when asked to resume, import, attach, or move an agent thread from a terminal or IDE into Buzz, preserve its transcript and working context, or verify that a previously attached session resumed without leaking into another channel.
---

# Resume Agent Session

Attach one existing native ACP session to one explicit Buzz channel. Preserve the native session as the continuity authority and use Buzz as the collaboration surface.

## Preconditions

1. Confirm the agent adapter advertises ACP `agentCapabilities.loadSession: true`. Treat absence as unsupported; never probe by sending `session/load` anyway.
2. Confirm the native session exists locally without printing its transcript or identifier into a shared channel.
3. Resolve the destination channel UUID with `buzz --format compact channels list` or `buzz --format compact channels get`.
4. Confirm the installed `buzz-acp` supports `--existing-session-id` and `--existing-session-channel`.
5. Use one agent subprocess. Existing-session attachment requires `BUZZ_ACP_AGENTS=1`.

If any precondition fails, stop and report the exact blocker. Do not silently create a fresh native session and call it a resume.

## Attach

Configure the managed agent through the owner's Buzz Desktop review surface. In the agent editor, open **Advanced → Environment variables** and add:

```text
BUZZ_ACP_EXISTING_SESSION_ID=<native-session-id>
BUZZ_ACP_EXISTING_SESSION_CHANNEL=<buzz-channel-uuid>
BUZZ_ACP_AGENTS=1
```

Do not publish the session identifier in shared Buzz messages, screenshots, commit messages, or PR text. Generic configuration logs must omit it. The owner's encrypted Activity stream may carry it as the ACP session identity. The channel UUID is safe to show.

Ask the owner to save and restart the managed agent. Saving or restarting may terminate the current turn, so publish the handoff and direct channel link first.

## Resume in Buzz

1. Send one short continuation prompt in the bound channel after the agent restarts.
2. Expect `buzz-acp` to call `session/load` once for that channel before sending the new Buzz event as the current prompt.
3. Open **channel members → agent → Activity** to inspect the replayed native transcript and ACP activity.
4. Read the agent's reply in the channel timeline. Transcript replay belongs in Activity; the continuation reply belongs in the channel.
5. Use a direct link when the owner asked to surface the destination:

```text
buzz://message?channel=<channel-uuid>&id=<event-id>
```

## Verify Allowed and Forbidden Paths

Prove all of these before declaring continuity:

- The adapter received `session/load` with the configured session ID and absolute working directory.
- The loaded session received the current Buzz Base, persona, team, memory, and canvas framing in prompt blocks, because ACP `session/load` has no system-prompt field.
- The bound channel maps to the loaded session for later turns in the same process.
- An unrelated channel creates a fresh session and its ACP traffic does not contain the bound session ID.
- An adapter without `loadSession` fails startup before any load request is written.
- Configuration summaries and generic logs do not disclose the session ID; any owner-only Activity exposure remains inside the existing encrypted observer boundary.
- The real installed app shows replayed Activity and a successful channel reply after restart.

Use the project's verification skill for the installed-app and negative-path proof. Unit tests alone do not prove the desktop handoff.

## Detach or Keep

Keep the three environment values when the native thread should remain the agent's restart anchor. For a one-time migration, remove `BUZZ_ACP_EXISTING_SESSION_ID` and `BUZZ_ACP_EXISTING_SESSION_CHANNEL` after continuity is verified, then restart; future Buzz channels and sessions will use the normal fresh-session path.

Never remove or overwrite the original native session file as part of attachment.
