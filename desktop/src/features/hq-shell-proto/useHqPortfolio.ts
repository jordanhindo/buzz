// Shared read hook: loads the Work portfolio + Founder Attention set from
// whichever HqTransport is passed in. All three variants call this the same
// way — only the presentation of the result differs per paradigm.

import * as React from "react";

import type {
  AttentionItem,
  CompanyStructure,
  Conversation,
  FrontierComposition,
  HqTransport,
  LiveSessionRef,
  PackSurface,
  RecentEvent,
  ReleaseSummary,
  WorkstreamRow,
} from "./contract/types";

export type HqPortfolioState = {
  rows: WorkstreamRow[] | null;
  attention: AttentionItem[] | null;
  packSurfaces: PackSurface[] | null;
  releases: ReleaseSummary[] | null;
  recent: RecentEvent[] | null;
  frontier: FrontierComposition | null;
  // Distinct workstream ids with a run executing right now — the only honest
  // source for "Working now" (activity.ts). Never the frontier composition.
  workingNow: string[] | null;
  isLoading: boolean;
  // Set when an HQ read fails (e.g. the daemon is degraded or times out). The
  // surface must render this honestly — a failed read must never masquerade as
  // an endless loading spinner.
  error: string | null;
  // Re-run the whole portfolio load (the Retry affordance on the error state).
  reload: () => void;
};

export function useHqPortfolio(transport: HqTransport): HqPortfolioState {
  const [rows, setRows] = React.useState<WorkstreamRow[] | null>(null);
  const [attention, setAttention] = React.useState<AttentionItem[] | null>(
    null,
  );
  const [packSurfaces, setPackSurfaces] = React.useState<PackSurface[] | null>(
    null,
  );
  const [releases, setReleases] = React.useState<ReleaseSummary[] | null>(null);
  const [recent, setRecent] = React.useState<RecentEvent[] | null>(null);
  const [frontier, setFrontier] = React.useState<FrontierComposition | null>(
    null,
  );
  const [workingNow, setWorkingNow] = React.useState<string[] | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const reload = React.useCallback(() => {
    setReloadNonce((nonce) => nonce + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadNonce is an intentional trigger only; its value is not consumed in the effect body
  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setAttention(null);
    setPackSurfaces(null);
    setReleases(null);
    setRecent(null);
    setFrontier(null);
    setWorkingNow(null);
    setIsLoading(true);
    setError(null);

    Promise.all([
      transport.getWorkstreamPortfolio(),
      transport.getFounderAttention(),
      transport.getPackSurfaces(),
      transport.getReleases(),
      transport.getRecentActivity(),
      transport.getReadyFrontier(),
      transport.getWorkingNow(),
    ])
      .then(
        ([
          portfolioRows,
          attentionItems,
          surfaces,
          releaseRows,
          recentEvents,
          frontierTotals,
          workingNowIds,
        ]) => {
          if (cancelled) return;
          setRows(portfolioRows);
          setAttention(attentionItems);
          setPackSurfaces(surfaces);
          setReleases(releaseRows);
          setRecent(recentEvents);
          setFrontier(frontierTotals);
          setWorkingNow(workingNowIds);
          setIsLoading(false);
        },
      )
      .catch((cause: unknown) => {
        // A single HQ read rejecting (timeout, degraded daemon) used to leave the
        // whole surface spinning forever with an unhandled rejection. Surface it.
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "HQ read failed.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [transport, reloadNonce]);

  return {
    rows,
    attention,
    packSurfaces,
    releases,
    recent,
    frontier,
    workingNow,
    isLoading,
    error,
    reload,
  };
}

export function useConversation(
  transport: HqTransport,
  subjectId: string | null,
) {
  const [conversation, setConversation] = React.useState<Conversation | null>(
    null,
  );
  // The live agent session behind this subject, when HQ reports one but no Buzz
  // conversation is bound yet (`bound === false`). Lets the right pane show the
  // orchestrating session instead of a dead "nothing bound" gap.
  const [liveSession, setLiveSession] = React.useState<LiveSessionRef | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!subjectId) {
      setConversation(null);
      setLiveSession(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      transport.getConversation(subjectId),
      transport.getSubjectBinding(subjectId),
    ]).then(([conv, binding]) => {
      if (cancelled) return;
      setConversation(conv);
      setLiveSession(binding.session);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, subjectId]);

  return { conversation, liveSession, isLoading };
}

export function useCompanyStructure(transport: HqTransport) {
  const [structure, setStructure] = React.useState<CompanyStructure | null>(
    null,
  );

  React.useEffect(() => {
    let cancelled = false;
    setStructure(null);
    transport.getCompanyStructure().then((result) => {
      if (cancelled) return;
      setStructure(result);
    });
    return () => {
      cancelled = true;
    };
  }, [transport]);

  return { structure, isLoading: structure === null };
}

export function useWorkstreamDetail(transport: HqTransport, id: string | null) {
  const [detail, setDetail] = React.useState<Awaited<
    ReturnType<HqTransport["getWorkstream"]>
  > | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    transport.getWorkstream(id).then((result) => {
      if (cancelled) return;
      setDetail(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, id]);

  return { detail, isLoading };
}
