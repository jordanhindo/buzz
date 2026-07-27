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

  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setAttention(null);
    setPackSurfaces(null);
    setReleases(null);
    setRecent(null);
    setFrontier(null);
    setWorkingNow(null);

    Promise.all([
      transport.getWorkstreamPortfolio(),
      transport.getFounderAttention(),
      transport.getPackSurfaces(),
      transport.getReleases(),
      transport.getRecentActivity(),
      transport.getReadyFrontier(),
      transport.getWorkingNow(),
    ]).then(
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
      },
    );

    return () => {
      cancelled = true;
    };
  }, [transport]);

  return {
    rows,
    attention,
    packSurfaces,
    releases,
    recent,
    frontier,
    workingNow,
    isLoading: rows === null,
  };
}

export function useConversation(
  transport: HqTransport,
  subjectId: string | null,
) {
  const [conversation, setConversation] = React.useState<Conversation | null>(
    null,
  );
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!subjectId) {
      setConversation(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    transport.getConversation(subjectId).then((result) => {
      if (cancelled) return;
      setConversation(result);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, subjectId]);

  return { conversation, isLoading };
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
