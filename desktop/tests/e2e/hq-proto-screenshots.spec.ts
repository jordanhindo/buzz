import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

// Capture spec for the HQ shell surface (#/hq-proto) — the Bridge (Home), the
// two-pane inbox, and the Projects org lens. Not part of the permanent suite —
// safe to delete once the screenshots have been reviewed.
const SHOTS = "test-results/hq-shots";

// The Bridge is the company's main surface — capture it in the default Buzz
// DARK theme (what the owner actually looks at), full-canvas.
test.describe("hq-proto bridge (dark)", () => {
  test.use({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
  });

  test.beforeEach(async ({ page }) => {
    // localStorage seeding must run BEFORE the mock bridge (React reads it on
    // mount). Follow-system + emulated dark = the default buzz dark palette.
    await page.addInitScript(() => {
      window.localStorage.setItem("buzz-follow-system", "true");
    });
    await installMockBridge(page);
    await page.goto("/#/hq-proto");
    await expect(page.getByRole("heading", { name: /Latent Sea/ })).toBeVisible(
      { timeout: 10_000 },
    );
  });

  test("bridge-canvas", async ({ page }) => {
    // Two ambient boxes side by side, then Recently + the Projects widget.
    await expect(
      page.getByRole("heading", { name: "Needs you" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Working now" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recently", exact: true }),
    ).toBeVisible();
    await waitForAnimations(page);
    // The Bridge lives in an internal scroll container, so a full-page shot
    // can't reach the lower sections. Capture the top, then scroll the inner
    // container to the bottom and capture Recently / Projects / Vitals.
    await page.screenshot({ path: `${SHOTS}/bridge-top.png` });
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="bridge-canvas"]');
      const scroller = canvas?.parentElement;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/bridge-bottom.png` });
  });

  test("bridge-grill-inbox", async ({ page }) => {
    // Clicking a Needs-you grill opens the two-panel inbox — NOT a modal.
    // Left = the honest workstream detail. Real HQ founder-attention titles
    // aren't stable API contract, so target one tied to `demand-loop` — the
    // one workstream this snapshot has a full detail capture for (see
    // liveSnapshotHqClient.ts).
    await page
      .getByText(
        "Outcome stopped after 8 identical failures: demand-loop-ticket-3",
      )
      .first()
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // LiveHqTransport has no conversation projection yet (an honest gap, not
    // a bug — see LiveHqTransport.getConversation), so the right pane says so
    // rather than fabricating a chat.
    await expect(
      page.getByText("No conversation bound to this yet."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Back" }).last(),
    ).toBeVisible();
    // The rich left detail is present (the connected/absent lineage section).
    await expect(page.getByText("Linked").first()).toBeVisible();
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/bridge-grill-inbox.png` });
  });

  test("bridge-workstream-inbox", async ({ page }) => {
    // A Working-now row → the same inbox, left carrying the full workstream
    // detail (outcomes, plan, runs, lineage). "Working now" is the honest
    // run-derived set (activity.ts), not a frontier-bucket count — the real
    // captured run sample has exactly one running run, on `demand-loop`
    // ("Demand Loop completion").
    await page.getByText("Demand Loop completion").first().click();
    // See bridge-grill-inbox: no conversation projection from live HQ yet.
    await expect(
      page.getByText("No conversation bound to this yet."),
    ).toBeVisible();
    await expect(page.getByText("Outcomes").first()).toBeVisible();
    await expect(page.getByText("Linked").first()).toBeVisible();
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/bridge-workstream-inbox.png` });
  });

  test("bridge-projects", async ({ page }) => {
    // The Projects widget renders the org/structure lens over
    // getCompanyStructure(), which HQ does not model yet — LiveHqTransport
    // returns it honestly empty (same as the real control plane would), so
    // the Bridge correctly omits the Projects box rather than show one. There
    // is no live data to capture here until HQ models Projects.
    test.skip(
      true,
      "CompanyStructure has no HQ backing yet (LiveHqTransport.getCompanyStructure is an honest empty projection) — revisit once HQ models Projects.",
    );
    await page.getByText("Salience").first().click();
  });

  test("deep-link restores the inbox on cold load", async ({ page }) => {
    // Every surface is deep-linked: a pasted URL lands directly on the
    // stream. `demand-loop` is the one workstream this snapshot has a full
    // detail capture for.
    await page.goto("/#/hq-proto?ws=demand-loop");
    await expect(
      page.getByText("No conversation bound to this yet."),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Linked").first()).toBeVisible();
  });

  test("launch-site: the Dependencies edge strip shows real waiting-on/blocks edges", async ({
    page,
  }) => {
    // `launch-site` isn't the one workstream with a full `hq workstream show`
    // capture, but liveSnapshotHqClient now falls back to its real
    // `workstream-list.json` entry (which already carries real outcome +
    // lifecycleFacts.dependencyEdges data) for any portfolio id — see
    // contract/liveSnapshotHqClient.ts. That's what makes launch-site's real
    // blocked-by-workstream edges (brand-system, flagship-assets,
    // commerce-legal upstream; email-lifecycle, paid-ads downstream)
    // renderable here, not fabricated.
    await page.goto("/#/hq-proto?ws=launch-site");
    await expect(page.getByText("Linked").first()).toBeVisible({
      timeout: 10_000,
    });

    // The Dependencies DeepSection is collapsed by default — open it.
    const dependenciesSummary = page.getByText("Dependencies", {
      exact: false,
    });
    await expect(dependenciesSummary).toBeVisible();
    await dependenciesSummary.click();

    await expect(page.getByText("Waiting on")).toBeVisible();
    await expect(page.getByText("Blocks")).toBeVisible();

    // Upstream: launch-site is blocked by these three real workstreams.
    await expect(page.getByText("Brand system")).toBeVisible();
    await expect(page.getByText("Launch campaign kit")).toBeVisible();
    await expect(
      page.getByText("Commerce, refunds, and legal trust"),
    ).toBeVisible();

    // Downstream: these two real workstreams are blocked BY launch-site.
    await expect(page.getByText("Email and owned audience")).toBeVisible();
    await expect(page.getByText("Paid acquisition")).toBeVisible();

    await waitForAnimations(page);
    await page.screenshot({
      path: `${SHOTS}/launch-site-dependency-strip.png`,
    });
  });

  test("map: real graph, with a workstream filter AND a status filter both applied", async ({
    page,
  }) => {
    // The Map is reached from the Bridge's header "Map" affordance (mirrors
    // how Projects is reached from its own widget) — not a route typed
    // directly, proving the in-app nav affordance actually works.
    await page.getByTestId("open-map").click();
    await expect(page.getByRole("heading", { name: "Map" })).toBeVisible();

    // The Map is the DEPENDENCY lens: of the real 48-workstream portfolio, the
    // 13 that participate in a real workstream-to-workstream edge are rendered
    // (18 deduped edges — see contract/mapGraph.test.mjs). The ~35 standalone
    // workstreams aren't drawn as disconnected noise; the header says so.
    await expect(
      page.getByText("13 of 48 workstreams · 18 dependencies"),
    ).toBeVisible();
    await expect(page.getByTestId("map-node")).toHaveCount(13);

    // Real node ids/titles from the live capture — same ones the Dependencies
    // edge strip test above proves are real, not fabricated. Scoped to the node
    // itself: the title also appears as a Focus filter tab, so an unscoped
    // getByText would be ambiguous.
    await expect(
      page
        .getByTestId("map-node")
        .filter({ hasText: "Website and purchase surface" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("map-node").filter({ hasText: "Brand system" }),
    ).toBeVisible();

    // The full dependency DAG, no filter applied — every edge at full strength.
    await waitForAnimations(page);
    await page.screenshot({ path: `${SHOTS}/map-full.png` });

    // Filter 1: focus launch-site (`Website and purchase surface`) — narrows
    // to its real 6-node dependency neighborhood (see mapGraph.test.mjs).
    await page
      .getByRole("tab", { name: "Website and purchase surface" })
      .click();

    // Filter 2 (composes with filter 1): status = Waiting. Of launch-site's
    // neighborhood, launch-site itself and commerce-legal are "running"
    // (working); brand-system/flagship-assets/email-lifecycle/paid-ads are
    // "needsContract" (waiting) — so exactly those 4 stay undimmed.
    await page.getByRole("tab", { name: "Waiting", exact: true }).click();
    await waitForAnimations(page);

    const dimmedCount = await page
      .getByTestId("map-node")
      .evaluateAll(
        (nodes) =>
          nodes.filter((n) => n.className.includes("opacity-30")).length,
      );
    // 8 of the 13 rendered nodes carry the opacity-30 dim: the 7 outside
    // launch-site's neighborhood, plus commerce-legal inside it ("working", not
    // "waiting"). launch-site is also off-status, but as the FOCUSED node it
    // renders with the focus ring, not dimmed — so it isn't counted here. That
    // leaves brand-system/flagship-assets/email-lifecycle/paid-ads undimmed.
    expect(dimmedCount).toBe(8);

    await page.screenshot({
      path: `${SHOTS}/map-filtered.png`,
    });
  });
});
