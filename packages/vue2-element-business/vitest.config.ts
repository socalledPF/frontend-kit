import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { createCoverageConfig } from '../../vitest.shared.ts'

export default defineConfig({
  resolve: {
    alias: {
      vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.esm.js', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    coverage: createCoverageConfig()
  }
})
