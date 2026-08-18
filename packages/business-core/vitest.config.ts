import { defineConfig } from 'vitest/config'
import { createCoverageConfig } from '../../vitest.shared.ts'

export default defineConfig({ test: { coverage: createCoverageConfig(90) } })
