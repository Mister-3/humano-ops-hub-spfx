import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: [
      'src/webparts/supervisionOperaciones/components/Common/__tests__/**/*.test.tsx',
      'src/auth/__tests__/**/*.test.ts'
    ],
    restoreMocks: true
  }
});
