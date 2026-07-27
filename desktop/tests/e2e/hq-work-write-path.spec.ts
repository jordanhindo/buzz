import { expect, test } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";

// D5 write path: an approved founder reply → confirm the exact bytes → submit
// to the bound agent session → HQ receipt. In the captured-snapshot preview
// HqShellPrototype injects a FixtureFounderReplyRelay: one bound attention item
// accepts, another always returns a digest-mismatch (stale). This locks both
// branches + the confirm gate that shows the digest before anything sends.
const SHOTS = "test-results/hq-shots";

// Must match DEV_ACCEPT_ATTENTION_ID / DEV_MISMATCH_ATTENTION_ID in
// contract/workstreamBinding.ts (real ids from the founder-attention capture).
const ACCEPT_ATTN = "46dc6da4-0481-4159-ba03-0e458e2d26b2";
const MISMATCH_ATTN = "e8990413-5326-4762-a46b-2815129ba297";

test.describe("hq work — founder reply write path", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("buzz-follow-system", "true");
    });
    await installMockBridge(page);
  });

  test("confirm step shows the digest, then submit lands an accepted receipt", async ({
    page,
  }) => {
    await page.goto(`/#/hq-proto?attn=${ACCEPT_ATTN}`);

    // The write composer (not plain discussion) is offered for a needs-you item.
    const composer = page.getByPlaceholder(/Reply to approve/);
    await expect(composer).toBeVisible({ timeout: 10_000 });
    await composer.fill("Approved — proceed with the launch architecture.");

    // Review → the confirm surface exposes the EXACT bytes, incl. the digest.
    await page.getByTestId("reply-review").click();
    const confirm = page.getByTestId("reply-confirm");
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText("sha256:");
    await expect(confirm).toContainText(ACCEPT_ATTN);

    await waitForAnimations(page);
    await page.screenshot({
      path: `${SHOTS}/write-path-confirm.png`,
      clip: { x: 0, y: 0, width: 1440, height: 1000 },
    });

    // Confirm & send → HQ accepted receipt lands as an audit entry.
    await page.getByTestId("reply-confirm-send").click();
    await expect(page.getByText(/HQ receipt: accepted/)).toBeVisible({
      timeout: 10_000,
    });
    // Back to composing; no error banner.
    await expect(page.getByTestId("reply-confirm")).toHaveCount(0);
    await expect(page.getByTestId("reply-notice")).toHaveCount(0);
  });

  test("a digest mismatch re-presents instead of forging a stale approval", async ({
    page,
  }) => {
    await page.goto(`/#/hq-proto?attn=${MISMATCH_ATTN}`);

    const composer = page.getByPlaceholder(/Reply to approve/);
    await expect(composer).toBeVisible({ timeout: 10_000 });
    await composer.fill("Approve.");
    await page.getByTestId("reply-review").click();
    await page.getByTestId("reply-confirm-send").click();

    // Stale receipt → a re-present notice, no accepted receipt in the transcript.
    const notice = page.getByTestId("reply-notice");
    await expect(notice).toBeVisible({ timeout: 10_000 });
    await expect(notice).toContainText(/stale|confirm again/i);
    await expect(page.getByText(/HQ receipt: accepted/)).toHaveCount(0);
  });
});
