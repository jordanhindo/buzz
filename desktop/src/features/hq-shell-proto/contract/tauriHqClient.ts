// HQ shell prototype — the native HqClient (M1 bridge, webview side).
//
// LiveHqTransport is a pure mapping layer that consumes an `HqClient.getJson`
// seam. This is the concrete implementation for the desktop app: it translates
// the adapter's REST-shaped read paths into `hq` CLI read verbs and invokes them
// through the native `hq_read` Tauri command.
//
// Why a CLI bridge and not a direct fetch: the HQ daemon is a locked local
// control plane (capability token + project-binding header + no CORS), so the
// webview physically cannot reach it. The `hq` CLI holds that capability; the
// native side shells it and hands back parsed JSON. See
// `src-tauri/src/commands/hq_bridge.rs`.

import { invoke } from "@tauri-apps/api/core";
import type { HqClient } from "./LiveHqTransport";

interface HqVerb {
  verb: string;
  arg?: string;
}

// Map the adapter's `/v1/...` read paths to the allowlisted `hq_read` verbs.
// Kept deliberately small: it covers exactly the paths LiveHqTransport issues.
function pathToVerb(path: string): HqVerb {
  if (path === "/v1/frontier") return { verb: "next" };
  if (path === "/v1/workstreams") return { verb: "workstream-list" };
  if (path === "/v1/founder-attention") return { verb: "founder-attention" };
  // Unscoped `hq run list` (no --workstream arg) — every run across every
  // workstream, the only honest source for "Working now" (activity.ts).
  if (path === "/v1/runs") return { verb: "run-list" };
  // The currently-open release's report — version + honest per-item status.
  if (path === "/v1/releases") return { verb: "release-report" };

  const workstreamRuns = path.match(/^\/v1\/workstreams\/([^/]+)\/runs$/);
  if (workstreamRuns) {
    return { verb: "run-list", arg: decodeURIComponent(workstreamRuns[1]) };
  }

  const workstream = path.match(/^\/v1\/workstreams\/([^/]+)$/);
  if (workstream) {
    return { verb: "workstream-show", arg: decodeURIComponent(workstream[1]) };
  }

  // The conversation-binding read (`hq workstream binding <subject-id>`) — the
  // live source for WorkstreamDetail.liveSession + boundConversations.
  const binding = path.match(/^\/v1\/conversation-bindings\/([^/]+)$/);
  if (binding) {
    return {
      verb: "workstream-binding",
      arg: decodeURIComponent(binding[1]),
    };
  }

  throw new Error(`tauriHqClient: no hq verb is mapped for path '${path}'`);
}

/**
 * The desktop HqClient — every read goes through the native `hq_read` bridge.
 * Drop into `new LiveHqTransport(createTauriHqClient())` to run the prototype
 * against Jordan's real HQ once the CLI's project binding resolves.
 */
export function createTauriHqClient(): HqClient {
  return {
    async getJson(path: string): Promise<unknown> {
      const { verb, arg } = pathToVerb(path);
      return invoke("hq_read", { verb, arg });
    },
  };
}
