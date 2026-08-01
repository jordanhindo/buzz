---
name: resume-agent-session
description: Safely attach an existing native Codex, Claude, Goose, or other ACP session to one Buzz channel and leave it idle until the owner's next message. Use when asked to resume, import, attach, surface, or move an agent thread from a terminal or IDE into Buzz without leaking its private session identifier or starting work autonomously.
---

# Resume Agent Session

Attach one native ACP session to one explicit Buzz channel. The native session remains the continuity authority; Buzz becomes the conversation surface. Attachment means **load on the owner's next accepted message**, never “continue now.”

## Preconditions

1. Confirm the native session exists locally without publishing its identifier or transcript.
2. Resolve the destination channel UUID with `buzz channels list` or `buzz channels get`.
3. Determine the native session's original absolute working directory from its metadata.
4. Confirm `buzz-acp attach-session --help` is available in the installed harness.
5. Reuse or post a short destination marker before attachment so the human has a visible place to reply.

This binding is channel-scoped because Buzz ACP sessions are channel-scoped. Prefer a dedicated channel when unrelated conversations must retain separate context.

If a precondition fails, report the exact blocker. Never create a fresh native session and call it a resume.

## Attach and Wait

Pipe the private session ID over stdin so it is absent from process arguments and Activity tool-call text:

```bash
printf '%s\n' "$NATIVE_SESSION_ID" | buzz-acp attach-session \
  --session-id-stdin \
  --channel <buzz-channel-uuid> \
  --cwd <absolute-original-working-directory>
```

Run this from the managed agent's Buzz Nest so the helper and resident harness resolve the same protected binding store. The helper:

1. initializes the configured ACP adapter;
2. requires advertised `loadSession` support;
3. validates the native session with `session/load`;
4. writes a mode-`0600` per-agent binding;
5. exits with `status: attached_waiting`.

It does **not** call `session/prompt`. Do not send a synthetic continuation prompt after attachment. Do not post another agent-authored message into the destination merely to prove it is attached.

## Surface the Conversation

Give the human the destination and a direct link to the pre-existing marker:

```text
buzz://message?channel=<channel-uuid>&id=<marker-event-id>
```

The owner now replies normally. The resident harness sees the protected binding, loads the native session, supplies the current Buzz Base/system/team/memory/canvas framing, and forwards that owner message as the first continuation prompt. Agent-authored or other-author messages do not consume a waiting binding. Subsequent channel messages reuse the loaded session.

Buzz does not duplicate the historical native transcript into the channel timeline. The imported continuity remains in the native ACP session; new conversation appears in Buzz.

## Verification Gate

Prove all of these before declaring the attachment ready:

- Registration emits `session/load` but no `session/prompt`.
- The helper reports `attached_waiting` without the private session ID.
- The protected file is not group/world accessible.
- No agent turn begins until an accepted owner event arrives in the bound channel.
- Agent-authored and other-author events do not consume the waiting binding.
- That first owner event loads the native session before `session/prompt`.
- An unrelated channel creates or reuses its own session and never sends the bound ID over ACP.
- An adapter without `loadSession` fails before the binding is written.
- Reattaching another native session to the same channel replaces the binding without deleting either native session.
- The installed app and running managed harness use the verified build.

Use the project's verification skill for installed-app and real-adapter proof. Unit tests alone do not prove the handoff.

## Privacy and Recovery

Never publish the session identifier in Buzz messages, screenshots, logs, commit messages, PR text, or command arguments. The owner's encrypted Activity stream may carry it only as normal ACP session identity.

The binding survives a harness restart. Re-running `attach-session` for the same channel safely replaces it. Never delete or modify the original native session file as part of attachment.
