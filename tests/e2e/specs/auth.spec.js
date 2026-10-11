const { test, expect } = require("@playwright/test");

const rand = () => Math.random().toString(36).slice(2, 8);

test("register → login → dashboard", async ({ page }) => {
  const email = `e2e_student_${rand()}@example.com`;
  await page.goto("/register");
  await page.fill('input[name="full_name"]', "E2E Student");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.selectOption('select[name="role"]', "STUDENT");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login/);

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app\/student\/dashboard/);
  await expect(page.locator(".lm-nav")).toContainText("LearnMate");
});

test("wrong password shows error toast", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "nobody@example.com");
  await page.fill('input[name="password"]', "wrongwrong");
  await page.click('button[type="submit"]');
  await expect(page.locator(".lm-toast.error")).toBeVisible();
});