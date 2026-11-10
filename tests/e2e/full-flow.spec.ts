import { expect, test } from "@playwright/test";

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
