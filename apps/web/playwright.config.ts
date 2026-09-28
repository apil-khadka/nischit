import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = process.env.REUSE_EXISTING_SERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      command: "pnpm --filter @nischit/api start",
      url: "http://127.0.0.1:4000/api/health",
      reuseExistingServer,
      timeout: 120_000,
      env: { NODE_ENV: "test", PERSISTENCE_MODE: "memory", PORT: "4000" },
    },
    {
      command: "pnpm --filter @nischit/web dev -p 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer,
      timeout: 120_000,
      env: { NODE_ENV: "test", NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000/api" },
    },
  ],
});
