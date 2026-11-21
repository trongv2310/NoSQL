import { defineConfig, devices } from '@playwright/test';

/**
 * Kiểm thử giao diện Shop Cầu Lông.
 * Cần chạy sẵn: backend (cổng 4000) + frontend (cổng 3000) + MongoDB đã nạp dữ liệu chung (npm run data:import:reset).
 *   cd kiem-thu-ui && npm install && npx playwright install chromium && npx playwright test
 * Đổi địa chỉ: UI_URL=http://localhost:3000 API_URL=http://localhost:4000/api
 */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'bao-cao-html' }], ['json', { outputFile: 'ket-qua/ket-qua.json' }]],
  globalSetup: './tests/_global-setup.ts',
  use: {
    baseURL: process.env.UI_URL ?? 'http://localhost:3000',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 90_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
