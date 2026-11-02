import { defineConfig, devices } from "@playwright/test";

// Run `NEXT_PUBLIC_BASE_PATH=/algolab npm run build` first.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: { command: "node tests/e2e/serve.mjs", url: "http://localhost:4173/algolab/", reuseExistingServer: true },
});
