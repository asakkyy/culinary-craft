import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    reporters: ['default', 'junit'],
    outputFile: { junit: './reports/frontend/tests/junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx', 'src/setupTests.js'],
      reportsDirectory: './reports/frontend/coverage',
      reporter: ['text', 'text-summary', 'json', 'json-summary', 'html', 'lcov'],
      thresholds: { lines: 60, functions: 60, statements: 60 },
    },
  },
});
