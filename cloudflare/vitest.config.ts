import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    alias: {
      '@trivia/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
