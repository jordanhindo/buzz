// The deep-link search params that drive the HQ Bridge surface (which stream,
// grill, or the Projects lens is open). Shared by every route that mounts the
// Bridge — the standalone #/hq-proto surface and the primary Work destination —
// so the surface is route-agnostic: the component reads these loosely via
// `useSearch({ strict: false })`, and any mounting route validates them the same
// way. Keeping one validator here means a new mount point is one `validateSearch`
// import, not a re-derivation.

export type HqShellSearch = {
  view?: "projects" | "map";
  attn?: string;
  ws?: string;
  from?: "projects" | "map";
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function viewParam(value: unknown): HqShellSearch["view"] {
  if (value === "projects" || value === "map") return value;
  return undefined;
}

export function validateHqShellSearch(
  search: Record<string, unknown>,
): HqShellSearch {
  return {
    view: viewParam(search.view),
    attn: nonEmptyString(search.attn),
    ws: nonEmptyString(search.ws),
    from: viewParam(search.from),
  };
}
