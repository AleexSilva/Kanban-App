import { expect, test } from "@playwright/test";

// The backend is not running in the frontend-only e2e setup, so the /api/* auth
// routes are stubbed at the browser level to exercise the login/logout UI flows.

test("shows the login form when unauthenticated", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Not authenticated" } })
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toHaveCount(0);
});

test("logs in with valid credentials and shows the board", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Not authenticated" } })
  );
  await page.route("**/api/login", (route) =>
    route.fulfill({ status: 200, json: { username: "user" } })
  );

  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();
});

test("shows an error on invalid credentials", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { detail: "Not authenticated" } })
  );
  await page.route("**/api/login", (route) =>
    route.fulfill({ status: 401, json: { detail: "Invalid credentials" } })
  );

  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Use first() because Next.js also injects a route-announcer with role="alert".
  await expect(page.getByRole("alert").first()).toContainText(
    /invalid username or password/i
  );
});

test("logs out and returns to the login form", async ({ page }) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 200, json: { username: "user" } })
  );
  await page.route("**/api/logout", (route) =>
    route.fulfill({ status: 200, json: { status: "ok" } })
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Kanban Studio" })
  ).toBeVisible();

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
