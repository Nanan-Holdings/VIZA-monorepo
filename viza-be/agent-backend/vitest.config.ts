import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'], // Load global test setup for mocks
    include: ['**/*.test.ts', '**/*.eval.spec.ts'], // Include eval tests
    // Integration tests use real database, exclude from global mock setup
    exclude: [
      '**/node_modules/**',
    ],
    testTimeout: 120000, // 2 minutes for LLM calls in eval tests
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**', // Exclude tests from coverage
        '**/*.test.ts',
        '**/*.eval.spec.ts',
        '**/*.config.ts',
      ],
    },
  },
});
