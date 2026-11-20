import { defineConfig } from 'vitest/config';

/**
 * Kiểm thử API trên server THẬT đang chạy (backend + MongoDB đã nạp dữ liệu chung).
 *   npm run data:import:reset && npm run db:setup && npm run start:dev   (terminal khác)
 *   npx vitest run --config ./vitest.config.api.mts
 * Đổi địa chỉ server: API_URL=http://localhost:4000/api
 */
export default defineConfig({
  test: {
    include: ['test/kiem-thu-api/**/*.api-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    reporters: ['verbose'],
    globalSetup: ['test/kiem-thu-api/_global-setup.ts'],
  },
});
