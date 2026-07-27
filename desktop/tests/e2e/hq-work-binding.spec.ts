import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

// D5 write-path blocker (b): the session→workstream binding. In the captured
// snapshot preview, HqShellPrototype injects the dev FixtureWorkstreamBinding,
// which binds the real `launch-site` workstream to a Buzz channel + agent
// session. This spec locks the honest split: a BOUND workstream shows the
// conversation composer (the seam the confirm → submit relay writes into),
// while an UNBOUND one still shows the honest "No conversation bound" gap.
const SHOTS = "test-results/hq-shots";
const COMPOSER = "Answer in your own words…";
const NO_BINDING = "No conversation bound to this yet.";

test.describe("hq work — session→workstream binding", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("buzz-follow-system", "true");
    });
    await installMockBridge(page);
  });

  test("a bound workstream opens its conversation; an unbound one shows the honest gap", async ({
    page,
  }) => {
    // launch-site IS bound by the dev fixture → the conversation composer shows.
    await page.goto("/#/hq-proto?ws=launch-site");
    await expect(page.getByPlaceholder(COMPOSER)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(NO_BINDING)).toHaveCount(0);

    await waitForAnimations(page);
    await page.screenshot({
      path: `${SHOTS}/binding-launch-site-bound.png`,
      clip: { x: 0, y: 0, width: 1440, height: 1000 },
    });

    // demand-loop is NOT bound → the honest empty state, no composer.
    await page.goto("/#/hq-proto?ws=demand-loop");
    await expect(page.getByText(NO_BINDING)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(COMPOSER)).toHaveCount(0);
  });
});
