import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { validateHqShellSearch } from "@/features/hq-shell-proto/contract/hqShellSearch";
import { usePreviewFeatureWarning } from "@/shared/features";
import { ViewLoadingFallback } from "@/shared/ui/ViewLoadingFallback";

export const Route = createFileRoute("/work")({
  validateSearch: validateHqShellSearch,
  component: WorkRouteComponent,
});

// The HQ "Bridge" — the Work surface. Rendered inside AppShell's main pane like
// any other primary destination (not the standalone #/hq-proto takeover). It
// reads Jordan's live HQ through the native bridge when running in Tauri, and
// falls back to fixtures in a plain browser preview.
const HqShellPrototype = React.lazy(async () => {
  const module = await import("@/features/hq-shell-proto/HqShellPrototype");
  return { default: module.HqShellPrototype };
});

function WorkRouteComponent() {
  usePreviewFeatureWarning("work");
  return (
    <React.Suspense fallback={<ViewLoadingFallback kind="work" />}>
      <HqShellPrototype />
    </React.Suspense>
  );
}
