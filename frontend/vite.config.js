import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    reporters: ['default', 'junit'],
    outputFile: { junit: './reports/frontend/tests/vitest-junit.xml' },
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './reports/frontend/coverage',
      thresholds: { lines: 30, statements: 30, functions: 30 },
    },
  },
});
