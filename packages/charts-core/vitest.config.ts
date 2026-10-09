import { defineConfig } from 'vitest/config'
import { createCoverageConfig } from '../../vitest.shared.ts'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: createCoverageConfig(90)
  }
})
