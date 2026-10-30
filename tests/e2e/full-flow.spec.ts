import { expect, test } from "@playwright/test";

/**
 * Authenticated end-to-end flow. It needs a running API, worker, MongoDB and
 * Redis plus a GitHub API stub, so it only runs when E2E_LIVE=1 and
 * E2E_BASE_URL point at a prepared environment. See docs/deployment.md.
 *
 * Without those prerequisites the test is skipped rather than faked, so the
 * default suite never pretends the pipeline was exercised.
 */
const live = process.env.E2E_LIVE === "1";

test.describe("documentation lifecycle", () => {
  test.skip(!live, "Requires E2E_LIVE=1 with API, worker, MongoDB, Redis and a stub GitHub server");

  test("sign in, connect, generate, review, increment, clean up, disconnect", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("link", { name: /github/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/dashboard/repositories");
    const available = page.getByTestId("available-repository").first();
    await expect(available).toBeVisible();
    await available.getByRole("button", { name: /connect/i }).click();

    const connected = page.getByTestId("connected-repository").first();
    await expect(connected).toBeVisible();

    await connected.getByRole("button", { name: /generate readme/i }).click();
    await page.getByRole("button", { name: /queue generation/i }).click();

    await page.goto("/dashboard/activity");
    await expect(page.getByText(/succeeded|success/i).first()).toBeVisible({ timeout: 120_000 });

    await page.goto("/dashboard/repositories");
    await page.getByRole("link", { name: /^review$/i }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/reviews\//);
    await page.getByRole("button", { name: /approve & apply/i }).first().click();
    await page.getByRole("button", { name: /approve & apply/i }).last().click();
    await expect(page.getByText(/applied|approved/i).first()).toBeVisible({ timeout: 120_000 });

    await page.goto("/dashboard/repositories");
    const connectedAfter = page.getByTestId("connected-repository").first();
    await connectedAfter.getByRole("button", { name: /run update/i }).click();
    await page.getByRole("button", { name: /queue update/i }).click();
    await page.goto("/dashboard/activity");
    await expect(page.getByText(/succeeded|success/i).first()).toBeVisible({ timeout: 120_000 });

    await page.goto("/dashboard/repositories");
    const connectedForCleanup = page.getByTestId("connected-repository").first();
    await connectedForCleanup.getByRole("button", { name: /clean up/i }).click();
    await page.getByRole("button", { name: /queue cleanup/i }).click();
    await page.goto("/dashboard/activity");
    await expect(page.getByText(/succeeded|success/i).first()).toBeVisible({ timeout: 120_000 });

    await page.goto("/dashboard/repositories");
    const connectedForDisconnect = page.getByTestId("connected-repository").first();
    await connectedForDisconnect.getByRole("button", { name: /^disconnect$/i }).first().click();
    await page.getByRole("button", { name: /disconnect repository/i }).click();
    await expect(page.getByText(/no repositories connected|disconnected/i).first()).toBeVisible();
  });
});
