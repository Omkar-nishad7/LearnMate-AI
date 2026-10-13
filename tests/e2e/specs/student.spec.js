const { test, expect } = require("@playwright/test");
const rand = () => Math.random().toString(36).slice(2, 10);
const password = "Secret123";

async function registerAndReachDashboard(page, role) {
  const email = `e2e_${role.toLowerCase()}_${rand()}@example.com`;
  await page.goto("/auth/register");
  await page.locator('input[type="text"]').fill(`E2E ${role}`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator("select").selectOption(role);
  await page.getByRole("button", { name: /create account/i }).click();

  const dashboardPath = role === "TEACHER" ? "/teacher/dashboard" : "/student/dashboard";
  await expect(page).toHaveURL(new RegExp(`${dashboardPath.replaceAll("/", "\\/")}(?:[/?#]|$)`), { timeout: 20_000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lm_access"))).toBeTruthy();
  return email;
}

test("student can see a published course in the catalog", async ({ page }) => {
  // Create and publish a course as a teacher before checking the student catalog.
  await registerAndReachDashboard(page, "TEACHER");
  const create = await page.evaluate(async () => {
    const token = localStorage.getItem("lm_access");
    const response = await fetch("/api/v1/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: "E2E Catalog Course",
        short_description: "Created for the catalog E2E test.",
        description: "A course used to verify the student catalog.",
        category: "Computer Science",
        difficulty: "beginner",
        language: "en",
        is_free: true,
        price_cents: 0,
      }),
    });
    const body = await response.json();
    return { ok: response.ok, status: response.status, body };
  });
  expect(create.ok, `Course creation failed (${create.status}): ${JSON.stringify(create.body)}`).toBeTruthy();
  const courseId = create.body.id;
  expect(courseId).toBeTruthy();

  const content = await page.evaluate(async (id) => {
    const token = localStorage.getItem("lm_access");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const moduleResponse = await fetch(`/api/v1/teacher/courses/${id}/modules`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "E2E Module" }),
    });
    const moduleBody = await moduleResponse.json();
    if (!moduleResponse.ok) {
      return { ok: false, status: moduleResponse.status, body: moduleBody };
    }

    const lessonResponse = await fetch(`/api/v1/teacher/courses/modules/${moduleBody.id}/lessons`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: "E2E Lesson" }),
    });
    const lessonBody = await lessonResponse.json();
    if (!lessonResponse.ok) {
      return { ok: false, status: lessonResponse.status, body: lessonBody };
    }

    const publishResponse = await fetch(`/api/v1/teacher/courses/${id}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      ok: publishResponse.ok,
      status: publishResponse.status,
      body: await publishResponse.json(),
    };
  }, courseId);
  expect(content.ok, `Course content/publishing failed (${content.status}): ${JSON.stringify(content.body)}`).toBeTruthy();

  // Registration itself creates the session and routes directly to the dashboard.
  await registerAndReachDashboard(page, "STUDENT");
  await page.goto("/student/courses");
  await expect(page.getByText("E2E Catalog Course").first()).toBeVisible({ timeout: 15_000 });
});
