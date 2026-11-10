import { expect, test } from "@playwright/test";

test("landing page presents the product and both calls to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/your code evolves/i);
  await expect(page.getByRole("link", { name: /connect github/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /see how it works/i }).first()).toBeVisible();
});

test("sign-in page offers GitHub authentication and explains permissions", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByRole("link", { name: /github/i }).first()).toBeVisible();
  await expect(page.getByText(/read.*repository|repo/i).first()).toBeVisible();
});

test("unknown routes render the not-found page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText(/page not found|not found/i).first()).toBeVisible();
});

test("dashboard routes require a session", async ({ page }) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAUTHENTICATED", message: "Sign in with GitHub to continue" },
        requestId: "e2e-session-check",
      }),
    }),
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/signin/);
});
