import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { validateHqShellSearch } from "@/features/hq-shell-proto/contract/hqShellSearch";
import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

// The HQ shell surface (the Bridge + inbox + Projects lens). Not gated behind
// preview-features, not linked from any nav — reached at #/hq-proto. See
// src/features/hq-shell-proto for the HqTransport contract + surfaces.
//
// Every surface state is deep-linked through search params so any stream,
// grill, or the Projects lens is directly addressable and shareable:
//   #/hq-proto            → the Bridge (home)
//   #/hq-proto?view=projects
//   #/hq-proto?attn=<attention-id>   → the inbox, focused on a grill/decision
//   #/hq-proto?ws=<workstream-id>    → the inbox, focused on a workstream
//   &from=projects                   → so Back returns to the Projects lens
export type { HqShellSearch } from "@/features/hq-shell-proto/contract/hqShellSearch";

const HqShellPrototype = React.lazy(async () => {
  const module = await import("@/features/hq-shell-proto/HqShellPrototype");
  return { default: module.HqShellPrototype };
});

export const Route = createFileRoute("/hq-proto")({
  validateSearch: validateHqShellSearch,
  component: HqProtoRouteComponent,
});

function HqProtoRouteComponent() {
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="projects" />}>
      <HqShellPrototype />
    </React.Suspense>
  );
}
