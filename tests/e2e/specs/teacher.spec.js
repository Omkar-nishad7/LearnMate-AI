const { test, expect } = require("@playwright/test");
const rand = () => Math.random().toString(36).slice(2, 8);

test("teacher creates course, module, lesson, publishes", async ({ page }) => {
  const email = `e2e_teacher_${rand()}@example.com`;
  await page.goto("/register");
  await page.fill('input[name="full_name"]', "E2E Teacher");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.selectOption('select[name="role"]', "TEACHER");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/login/);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app\/teacher\/dashboard/);

  await page.goto("/app/teacher/course-builder");
  await page.fill('input[name="title"]', "Playwright Course");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/course-builder\?id=\d+/);
  await expect(page.locator("text=Modules & lessons")).toBeVisible();
});