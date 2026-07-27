// HQ shell prototype — the captured-snapshot HqClient (browser preview + e2e
// screenshot path).
//
// Backs LiveHqTransport with the real HQ JSON captured from Jordan's live
// control plane — the exact bytes `__fixtures__/live/*.json` holds and
// LiveHqTransport.test.mjs already proves the mapping against. This is what
// renders when there is no Tauri runtime (vite dev preview, Playwright e2e):
// Jordan's real 48-workstream portfolio (`affiliates`, `launch-site`,
// `flagship-assets`, `release-train:0.2.10`, …), not fixtures.ts's invented
// rows. `createTauriHqClient()` is the only other HqClient LiveHqTransport
// takes — same mapping layer, different transport of the same shape.
//
// Per-workstream detail (`/v1/workstreams/:id` and its `/runs`) has a FULL
// capture (extra fields like `intake`, `artifactReceipts`) for exactly one
// workstream (`demand-loop`, via `hq workstream show` + `hq run list
// --workstream`) — that id alone gets real Runs strip data. Every other
// portfolio id falls back to its own entry inside `workstream-list.json`,
// wrapped as a `{ workstream }` response: the list capture already carries
// each workstream's real outcomes (state, contextLinks, executionContract,
// lifecycleFacts.dependencyEdges) — everything LiveHqTransport.getWorkstream
// maps except the Runs strip and a few show-only fields, which degrade
// honestly (empty Runs, no `intake`) rather than fabricate. This is what lets
// e.g. `launch-site`'s real blocked-by-workstream edges render in the detail
// panel without inventing data.

import type { HqClient } from "./LiveHqTransport";

import founderAttention from "./__fixtures__/live/founder-attention.json" with {
  type: "json",
};
import next from "./__fixtures__/live/next.json" with { type: "json" };
import releaseReport from "./__fixtures__/live/release-report.json" with {
  type: "json",
};
import runListSample from "./__fixtures__/live/run-list-sample.json" with {
  type: "json",
};
import runListWorkstream from "./__fixtures__/live/run-list-workstream.json" with {
  type: "json",
};
import workstreamList from "./__fixtures__/live/workstream-list.json" with {
  type: "json",
};
import workstreamShow from "./__fixtures__/live/workstream-show.json" with {
  type: "json",
};

// The single id `workstream-show.json` / `run-list-workstream.json` were
// captured for — read from the capture itself rather than hardcoding it twice.
const CAPTURED_DETAIL_ID = (workstreamShow as { workstream?: { id?: string } })
  .workstream?.id;

// Index every other portfolio id → its real `workstream-list.json` entry, so
// `/v1/workstreams/:id` can serve real (if Runs-less) detail for any id, not
// just the one full capture.
const LIST_WORKSTREAMS_BY_ID = new Map(
  (
    (workstreamList as { workstreams?: { id?: string }[] }).workstreams ?? []
  ).map((workstream) => [workstream.id, workstream]),
);

const EMPTY_RUN_LIST = { runs: [] };
const NO_WORKSTREAM: Record<string, never> = {};

/**
 * The captured-snapshot HqClient: every `/v1/...` read LiveHqTransport issues
 * resolves to real HQ JSON bundled from `__fixtures__/live/`. Reachable ids
 * beyond the one captured detail degrade honestly (see module comment) —
 * never a network call, never a fabricated projection.
 */
export function createLiveSnapshotHqClient(): HqClient {
  return {
    async getJson(path: string): Promise<unknown> {
      if (path === "/v1/frontier") return next;
      if (path === "/v1/workstreams") return workstreamList;
      if (path === "/v1/founder-attention") return founderAttention;
      // Unscoped `hq run list` — the sample capture's only running run.
      if (path === "/v1/runs") return runListSample;
      if (path === "/v1/releases") return releaseReport;

      const workstreamRuns = path.match(/^\/v1\/workstreams\/([^/]+)\/runs$/);
      if (workstreamRuns) {
        const id = decodeURIComponent(workstreamRuns[1]);
        return id === CAPTURED_DETAIL_ID ? runListWorkstream : EMPTY_RUN_LIST;
      }

      const workstream = path.match(/^\/v1\/workstreams\/([^/]+)$/);
      if (workstream) {
        const id = decodeURIComponent(workstream[1]);
        if (id === CAPTURED_DETAIL_ID) return workstreamShow;
        const listEntry = LIST_WORKSTREAMS_BY_ID.get(id);
        return listEntry ? { workstream: listEntry } : NO_WORKSTREAM;
      }

      throw new Error(
        `liveSnapshotHqClient: no captured HQ JSON for path '${path}'`,
      );
    },
  };
}
