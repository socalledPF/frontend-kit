import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { fileURLToPath } from 'node:url'
import { createCoverageConfig } from '../../vitest.shared.ts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.json',
      entryRoot: 'src',
      outDirs: ['dist'],
      include: ['src'],
      exclude: ['src/__tests__/**', 'src/**/*.test.ts'],
      pathsToAliases: false,
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        'query-form': 'src/entries/query-form.ts',
        'pro-table': 'src/entries/pro-table.ts',
        pagination: 'src/entries/pagination.ts',
        loading: 'src/entries/loading.ts',
        upload: 'src/entries/upload.ts',
        'async-button': 'src/entries/async-button.ts',
        'dict-tag': 'src/entries/dict-tag.ts',
        'dict-select': 'src/entries/dict-select.ts',
        'table-toolbar': 'src/entries/table-toolbar.ts',
        'form-dialog': 'src/entries/form-dialog.ts',
        permission: 'src/entries/permission.ts',
        descriptions: 'src/entries/descriptions.ts',
        'import-dialog': 'src/entries/import-dialog.ts',
        'export-button': 'src/entries/export-button.ts',
        'remote-select': 'src/entries/remote-select.ts',
        'drawer-form': 'src/entries/drawer-form.ts',
        'editable-table': 'src/entries/editable-table.ts',
        'status-switch': 'src/entries/status-switch.ts',
        'file-preview': 'src/entries/file-preview.ts'
      },
      name: 'AmusiteVue3ElementPlusBusiness',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'vue',
        'element-plus',
        '@element-plus/icons-vue',
        '@amusite/business-core',
        '@amusite/utils'
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
    coverage: {
      ...createCoverageConfig(),
      thresholds: {
        ...createCoverageConfig().thresholds,
        'src/components/Upload.vue': { lines: 90 },
        'src/permission.ts': { lines: 90 }
      }
    },
    alias: {
      vue: fileURLToPath(new URL('./node_modules/vue/dist/vue.esm-bundler.js', import.meta.url))
    }
  }
})
