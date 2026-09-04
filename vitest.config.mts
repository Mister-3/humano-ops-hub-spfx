import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/webparts/supervisionOperaciones/components/**/__tests__/**/*.test.tsx',
      'src/webparts/supervisionOperaciones/utils/**/__tests__/**/*.test.{ts,tsx}',
      'src/auth/__tests__/**/*.test.ts'
    ],
    restoreMocks: true
  }
});
