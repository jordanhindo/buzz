import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

// A degraded / timing-out HQ daemon must never leave the Work surface spinning
// forever. When an HQ read rejects, the surface has to say so honestly — the
// "HQ isn't responding" panel with a Retry affordance — not a dead spinner.
// __BUZZ_E2E_HQ_FAIL_READS__ makes the captured-snapshot preview client reject
// every read, standing in for the degraded daemon (failureClass
// stall-arrow-open) that produced this exact hang in the field.
const SHOTS = "test-results/hq-shots";

test.describe("hq work — degraded HQ daemon", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("buzz-follow-system", "true");
      // Must be set before the bridge mounts React (which reads the transport).
      window.__BUZZ_E2E_HQ_FAIL_READS__ = true;
    });
    await installMockBridge(page);
  });

  test("a rejected HQ read shows the honest offline panel, not an endless spinner", async ({
    page,
  }) => {
    await page.goto("/#/hq-proto");

    // The honest failure surface — title + a real Retry affordance.
    await expect(page.getByText("HQ isn't responding")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();

    // Crucially: it did NOT get stuck on the loading spinner.
    await expect(page.getByText("Reading your company")).toHaveCount(0);

    await waitForAnimations(page);
    await page.screenshot({
      path: `${SHOTS}/degraded-hq.png`,
      clip: { x: 0, y: 0, width: 1440, height: 1000 },
    });

    // Retry re-attempts honestly (the daemon is still down here, so it stays on
    // the offline panel) rather than crashing or hanging.
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByText("HQ isn't responding")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Reading your company")).toHaveCount(0);
  });
});
