// HQ shell — the company's main surface (the Bridge). One real surface, no
// dev switcher, no scenario toggle, no fixture chrome. Reached at #/hq-proto.
// Backed by the HqTransport contract; swapping to live HQ is one adapter.

import { isTauri } from "@tauri-apps/api/core";
import * as React from "react";

import { LiveHqTransport } from "@/features/hq-shell-proto/contract/LiveHqTransport";
import { createLiveSnapshotHqClient } from "@/features/hq-shell-proto/contract/liveSnapshotHqClient";
import { createTauriHqClient } from "@/features/hq-shell-proto/contract/tauriHqClient";
import { FixtureFounderReplyRelay } from "@/features/hq-shell-proto/contract/founderReplyRelay";
import {
  DEV_MISMATCH_ATTENTION_ID,
  DEV_WORKSTREAM_BINDING,
  EmptyWorkstreamBinding,
  FixtureWorkstreamBinding,
} from "@/features/hq-shell-proto/contract/workstreamBinding";
import { VariantD_Bridge } from "@/features/hq-shell-proto/variants/VariantD_Bridge";

export function HqShellPrototype() {
  // In the packaged Buzz Desktop app, read Jordan's real HQ through the native
  // `hq` bridge. In a plain browser preview (vite dev, e2e mocks) there is no
  // Tauri runtime, so fall back to the same LiveHqTransport mapping layer
  // driven by a real captured HQ snapshot (__fixtures__/live/*.json) rather
  // than fabricated data — one mapper, two HqClients.
  // Live HQ (Tauri) gets the honest empty binding — no session→workstream wire
  // exists yet, so the inbox shows "No conversation bound to this yet". The
  // captured-snapshot preview (browser/e2e) gets the dev fixture binding so the
  // bound-conversation + write-path relay UI can be built against real shapes.
  const transport = React.useMemo(
    () =>
      isTauri()
        ? new LiveHqTransport(createTauriHqClient(), EmptyWorkstreamBinding)
        : new LiveHqTransport(
            createLiveSnapshotHqClient(),
            new FixtureWorkstreamBinding(DEV_WORKSTREAM_BINDING),
            new FixtureFounderReplyRelay({
              mismatchAttentionIds: [DEV_MISMATCH_ATTENTION_ID],
            }),
          ),
    [],
  );
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <VariantD_Bridge transport={transport} />
    </div>
  );
}

export default HqShellPrototype;
