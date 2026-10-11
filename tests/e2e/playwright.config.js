const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["line"]] : "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
