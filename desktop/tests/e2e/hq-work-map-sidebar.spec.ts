import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

// The Map lens is a first-class left-sidebar destination (like Work), not just
// a masthead toggle. It shares the /work route, driven by ?view=map — so the
// sidebar highlight moves between Work and Map off the search param. This spec
// locks that wiring: the button exists, selecting it renders the dependency
// DAG, and the active highlight tracks Work ⇄ Map.
const SHOTS = "test-results/hq-shots";

test.describe("hq work — Map sidebar destination", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("buzz-follow-system", "true");
    });
    await installMockBridge(page);
    await page.goto("/");
  });

  test("Map is a selectable sidebar destination that opens the DAG", async ({
    page,
  }) => {
    const mapButton = page.getByTestId("open-map-view");
    const workButton = page.getByTestId("open-work-view");

    // Both live in the sidebar, side by side.
    await expect(workButton).toBeVisible();
    await expect(mapButton).toBeVisible();

    // Selecting Map opens the portfolio-wide dependency DAG.
    await mapButton.click();
    await expect(page.getByTestId("map-canvas")).toBeVisible();
    await expect(page.getByTestId("map-node").first()).toBeVisible();
    expect(page.url()).toContain("view=map");

    // Highlight tracks the lens: Map active, Work not.
    await expect(mapButton).toHaveAttribute("data-active", "true");
    await expect(workButton).toHaveAttribute("data-active", "false");

    await waitForAnimations(page);
    await page.screenshot({
      path: `${SHOTS}/map-sidebar-selected.png`,
      clip: { x: 0, y: 0, width: 1440, height: 1000 },
    });

    // Selecting Work returns to the Work lens; the DAG is gone, highlight flips.
    await workButton.click();
    await expect(page.getByTestId("map-canvas")).toHaveCount(0);
    expect(page.url()).not.toContain("view=map");
    await expect(workButton).toHaveAttribute("data-active", "true");
    await expect(mapButton).toHaveAttribute("data-active", "false");
  });
});
