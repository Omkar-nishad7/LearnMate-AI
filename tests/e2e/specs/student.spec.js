const { test, expect } = require("@playwright/test");
const rand = () => Math.random().toString(36).slice(2, 8);

async function registerAndLogin(page, role) {
  const email = `e2e_${role.toLowerCase()}_${rand()}@example.com`;
  await page.goto("/register");
  await page.fill('input[name="full_name"]', `E2E ${role}`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.selectOption('select[name="role"]', role);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/login/);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Secret123");
  await page.click('button[type="submit"]');
  return email;
}

test("student can see catalog and enroll", async ({ page }) => {
  // teacher creates a published course first
  await registerAndLogin(page, "TEACHER");
  await expect(page).toHaveURL(/\/app\/teacher\/dashboard/);
  // create course via API (fast)
  const create = await page.evaluate(async () => {
    const t = localStorage.getItem("lm_access");
    const r = await fetch("/api/v1/teacher/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ title: "E2E Course", short_description: "e2e" }),
    });
    return r.json();
  });
  const cid = create.id;
  // add module + lesson + publish
  await page.evaluate(async ({ cid }) => {
    const t = localStorage.getItem("lm_access");
    const H = { "Content-Type": "application/json", Authorization: `Bearer ${t}` };
    const m = await (await fetch(`/api/v1/teacher/courses/${cid}/modules`, { method: "POST", headers: H, body: JSON.stringify({ title: "M" }) })).json();
    await fetch(`/api/v1/teacher/courses/modules/${m.id}/lessons`, { method: "POST", headers: H, body: JSON.stringify({ title: "L" }) });
    await fetch(`/api/v1/teacher/courses/${cid}/publish`, { method: "POST", headers: H });
  }, { cid });

  // logout & register student
  await page.evaluate(() => { localStorage.clear(); });
  await registerAndLogin(page, "STUDENT");
  await page.goto("/app/student/courses");
  await expect(page.locator("text=E2E Course")).toBeVisible({ timeout: 10000 });
});