import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
    setupFiles: ['test/setup-env.ts'],
    // Her test dosyası kendi sürecinde, sırayla çalışır (Jest --runInBand ile aynı).
    fileParallelism: false,
  },
});
