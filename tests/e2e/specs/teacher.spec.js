const { test, expect } = require("@playwright/test");
const rand = () => Math.random().toString(36).slice(2, 10);

test("teacher creates and publishes a course with a module and lesson", async ({ page }) => {
  const email = `e2e_teacher_${rand()}@example.com`;

  await page.goto("/auth/register");
  await page.locator('input[type="text"]').fill("E2E Teacher");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("Secret123");
  await page.locator("select").selectOption("TEACHER");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/teacher\/dashboard(?:[/?#]|$)/, { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lm_access"))).toBeTruthy();

  await page.goto("/teacher/courses/new");
  await page.getByPlaceholder(/Data Structures and Algorithms/i).fill("Playwright Course");
  await page.getByPlaceholder(/Explain what students will learn/i).fill("A course created by the Playwright end-to-end test.");
  await page.getByRole("button", { name: /Next: Add Content/i }).click();

  await page.getByPlaceholder(/Introduction and Fundamentals/i).fill("Playwright Module");
  await page.getByPlaceholder(/Lesson 1 title/i).fill("Playwright Lesson");
  await page.getByRole("button", { name: /Next: Settings/i }).click();
  await page.getByRole("button", { name: /Review Course/i }).click();
  await expect(page.getByText("Playwright Course").first()).toBeVisible();
  await page.getByRole("button", { name: /Create & Publish/i }).click();

  await expect(page).toHaveURL(/\/teacher\/courses\/\d+(?:[/?#]|$)/, { timeout: 20_000 });
  await expect(page.getByText("Playwright Course").first()).toBeVisible();
});
