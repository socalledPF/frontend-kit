export function createCoverageConfig(lines = 80) {
  return {
    provider: 'v8' as const,
    reporter: ['text', 'json-summary'] as Array<'text' | 'json-summary'>,
    include: ['src/**/*.{ts,vue}'],
    exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
    thresholds: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines
    }
  }
}
