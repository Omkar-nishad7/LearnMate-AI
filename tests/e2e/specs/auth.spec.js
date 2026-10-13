const { test, expect } = require("@playwright/test");

const rand = () => Math.random().toString(36).slice(2, 10);
const password = "Secret123";

async function fillRegistration(page, { name, email, role }) {
  await page.goto("/auth/register");
  // The current form is controlled by React and does not expose name attributes.
  await page.locator('input[type="text"]').fill(name);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator("select").selectOption(role);
  await page.getByRole("button", { name: /create account/i }).click();
}

async function login(page, email) {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /^login$/i }).click();
}

test("registration creates a session and redirects to the role dashboard", async ({ page }) => {
  const email = `e2e_student_${rand()}@example.com`;

  await fillRegistration(page, { name: "E2E Student", email, role: "STUDENT" });
  // The current registration endpoint returns tokens; registration logs the user in.
  await expect(page).toHaveURL(/\/student\/dashboard(?:[/?#]|$)/, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lm_access"))).toBeTruthy();

  // Verify the normal login flow separately using the account created above.
  await page.evaluate(() => {
    localStorage.removeItem("lm_access");
    localStorage.removeItem("lm_refresh");
    localStorage.removeItem("lm_user");
    document.cookie = "lm_access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    document.cookie = "lm_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
  });
  await login(page, email);
  await expect(page).toHaveURL(/\/student\/dashboard(?:[/?#]|$)/, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lm_access"))).toBeTruthy();
});

test("wrong password displays an authentication error", async ({ page }) => {
  await page.goto("/auth/login");
  await page.locator('input[type="email"]').fill(`missing_${rand()}@example.com`);
  await page.locator('input[type="password"]').fill("WrongPassword123");
  await page.getByRole("button", { name: /^login$/i }).click();

  await expect(page.locator("[data-sonner-toast]").last()).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/auth\/login(?:[/?#]|$)/);
});
