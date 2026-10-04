/*
 * React keys its development/production build off NODE_ENV and only the
 * development build exports `act`, which @testing-library/react needs.
 * Force it so tests behave the same regardless of the host environment.
 */
process.env.NODE_ENV = 'test'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
