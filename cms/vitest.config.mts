import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Starting the CMS and laying out PDFs take longer than vitest's defaults (5s a test, 10s a hook)
    // when the machine is busy, which failed good tests at random.
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
