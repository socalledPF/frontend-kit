import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import { createCoverageConfig } from '../../vitest.shared.ts'

export default defineConfig({
  resolve: {
    alias: {
      '@amusite/charts-core': fileURLToPath(new URL('../charts-core/src/index.ts', import.meta.url))
    }
  },
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.json',
      entryRoot: 'src',
      outDirs: ['dist'],
      include: ['src'],
      exclude: ['src/__tests__/**', 'src/**/*.test.ts'],
      pathsToAliases: false,
      aliasesExclude: ['@amusite/charts-core'],
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        chart: 'src/entries/chart.ts',
        'chart-panel': 'src/entries/chart-panel.ts',
        'trend-chart': 'src/entries/trend-chart.ts',
        'metric-card': 'src/entries/metric-card.ts',
        'rank-chart': 'src/entries/rank-chart.ts',
        'use-chart-request': 'src/entries/use-chart-request.ts'
      },
      name: 'AmusiteVue3EChartsBusiness',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@element-plus/icons-vue',
        '@amusite/charts-core',
        'echarts',
        /^echarts\//
      ],
      output: {
        exports: 'named',
        assetFileNames: (asset) =>
          asset.name?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: createCoverageConfig(),
    alias: {
      vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.esm-bundler.js', import.meta.url)),
      '@amusite/charts-core': fileURLToPath(new URL('../charts-core/src/index.ts', import.meta.url))
    }
  }
})
