import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4010;
const APP_PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Layout assertions must not read sizes mid-animation.
  use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${APP_PORT}`, trace: 'retain-on-failure', contextOptions: { reducedMotion: 'reduce' } },
  webServer: [
    { command: 'npx tsx e2e/mock-api.ts', url: `http://localhost:${API_PORT}/health`, env: { PORT: String(API_PORT) }, reuseExistingServer: !process.env.CI },
    {
      command: `npm run build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}/icon.svg`,
      env: { CHAINTABLE_API_BASE: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000
    }
  ]
});
