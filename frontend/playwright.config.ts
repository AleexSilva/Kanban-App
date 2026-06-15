import { defineConfig, devices } from "@playwright/test";

// When running in the e2e Docker container (Dockerfile.e2e), the system apt
// Chromium is used instead of the Playwright CDN binary, which cannot be
// downloaded in this environment due to proxy TLS interception.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath && {
          launchOptions: {
            executablePath,
            // Required when running as root inside a Docker container.
            args: ["--no-sandbox"],
          },
        }),
      },
    },
  ],
});
