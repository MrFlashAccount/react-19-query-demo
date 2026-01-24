import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  webServer: {
    command: "pnpm exec vite --port 5175 --strictPort",
    port: 5175,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: "http://localhost:5175",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
