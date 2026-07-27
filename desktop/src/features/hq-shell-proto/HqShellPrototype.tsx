// HQ shell — the company's main surface (the Bridge). One real surface, no
// dev switcher, no scenario toggle, no fixture chrome. Reached at #/hq-proto.
// Backed by the HqTransport contract; swapping to live HQ is one adapter.

import { isTauri } from "@tauri-apps/api/core";
import * as React from "react";

import type { HqClient } from "@/features/hq-shell-proto/contract/LiveHqTransport";
import { LiveHqTransport } from "@/features/hq-shell-proto/contract/LiveHqTransport";
import { createLiveSnapshotHqClient } from "@/features/hq-shell-proto/contract/liveSnapshotHqClient";
import { createTauriHqClient } from "@/features/hq-shell-proto/contract/tauriHqClient";
import { FixtureFounderReplyRelay } from "@/features/hq-shell-proto/contract/founderReplyRelay";
import {
  DEV_MISMATCH_ATTENTION_ID,
  DEV_WORKSTREAM_BINDING,
  FixtureWorkstreamBinding,
  LiveWorkstreamBinding,
} from "@/features/hq-shell-proto/contract/workstreamBinding";
import { VariantD_Bridge } from "@/features/hq-shell-proto/variants/VariantD_Bridge";

declare global {
  interface Window {
    // e2e-only: makes the captured-snapshot preview client reject every read,
    // standing in for a degraded/timing-out HQ daemon so the honest
    // "HQ isn't responding" + Retry surface can be exercised. Never consulted
    // on the live (Tauri) path — see the branch below.
    __BUZZ_E2E_HQ_FAIL_READS__?: boolean;
  }
}

// Wrap a snapshot client so every read rejects, simulating a degraded daemon.
// Preview/e2e only: the live Tauri path never reaches this.
function failingHqClient(): HqClient {
  return {
    async getJson(): Promise<unknown> {
      throw new Error("HQ daemon is not responding (e2e fault injection).");
    },
  };
}

export function HqShellPrototype() {
  // In the packaged Buzz Desktop app, read Jordan's real HQ through the native
  // `hq` bridge. In a plain browser preview (vite dev, e2e mocks) there is no
  // Tauri runtime, so fall back to the same LiveHqTransport mapping layer
  // driven by a real captured HQ snapshot (__fixtures__/live/*.json) rather
  // than fabricated data — one mapper, two HqClients.
  // Live HQ (Tauri) gets the real conversation-binding read: it surfaces the
  // live agent session now, and bound conversations once HQ's registration
  // write path authors relay coordinates (until then `bound === false`). The
  // captured-snapshot preview (browser/e2e) gets the dev fixture binding so the
  // bound-conversation + write-path relay UI can be built against real shapes.
  const transport = React.useMemo(() => {
    if (isTauri()) {
      const client = createTauriHqClient();
      return new LiveHqTransport(client, new LiveWorkstreamBinding(client));
    }
    return new LiveHqTransport(
      window.__BUZZ_E2E_HQ_FAIL_READS__
        ? failingHqClient()
        : createLiveSnapshotHqClient(),
      new FixtureWorkstreamBinding(DEV_WORKSTREAM_BINDING),
      new FixtureFounderReplyRelay({
        mismatchAttentionIds: [DEV_MISMATCH_ATTENTION_ID],
      }),
    );
  }, []);
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <VariantD_Bridge transport={transport} />
    </div>
  );
}

export default HqShellPrototype;
